import { readFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "@aninusa/database";
import type { SourceStatus } from "@aninusa/types";
import {
  contentTypeOf,
  createLogger,
  fetchWithTimeout,
  getErrorMessage,
  readTextWithLimit,
} from "@aninusa/utils";

const logger = createLogger({ service: "source-health" });

/**
 * A single failed probe is often a transient network/DNS issue. Sources are
 * degraded first and only removed from playback after repeated failures.
 */
function brokenThreshold(): number {
  const configured = Number(process.env.HEALTH_BROKEN_THRESHOLD ?? 3);
  return Number.isFinite(configured) && configured >= 1 ? Math.floor(configured) : 3;
}

function effectiveStatus(outcome: HealthOutcome, failureCount: number): SourceStatus {
  if (outcome.status !== "BROKEN") return outcome.status;
  return failureCount >= brokenThreshold() ? "BROKEN" : "DEGRADED";
}

export interface HealthOutcome {
  status: SourceStatus;
  httpStatus: number | null;
  contentType: string | null;
  latencyMs: number;
  error: string | null;
}

export interface HealthSweepSummary {
  sourcesChecked: number;
  subtitlesChecked: number;
  active: number;
  degraded: number;
  broken: number;
  errors: string[];
}

function siteUrl(): string {
  return (
    process.env.SITE_URL ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    "http://localhost:3000"
  ).replace(/\/$/, "");
}

function resolveUrl(raw: string): string | null {
  try {
    const url = new URL(raw, siteUrl());
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

function isPrivateHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".local") || host === "::1" || host === "[::1]") return true;
  if (/^127\./.test(host) || /^10\./.test(host) || /^192\.168\./.test(host) || /^169\.254\./.test(host)) {
    return true;
  }
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(host)) return true;
  return false;
}

function isSafeTarget(url: string): boolean {
  const parsed = new URL(url);
  const ownHost = new URL(siteUrl()).hostname;
  if (parsed.hostname === ownHost) return true;
  return !isPrivateHost(parsed.hostname);
}

function publicDirCandidates(): string[] {
  return [
    path.join(process.cwd(), "apps/web/public"),
    path.join(process.cwd(), "public"),
    path.join(process.cwd(), "../../apps/web/public"),
  ].map((candidate) => path.resolve(candidate));
}

/**
 * Local subtitle files are part of this repository, not a remote provider.
 * Reading them directly keeps the worker independent of the public site URL
 * (which may be HTTPS-only or unreachable from the internal network).
 */
async function probeLocalSubtitle(rawUrl: string): Promise<HealthOutcome | null> {
  if (!rawUrl.startsWith("/")) return null;

  const pathname = rawUrl.split("?")[0] ?? rawUrl;
  for (const publicDir of publicDirCandidates()) {
    const target = path.resolve(publicDir, `.${pathname}`);
    if (target !== publicDir && !target.startsWith(publicDir + path.sep)) continue;

    try {
      const text = await readFile(target, "utf8");
      const isVtt = /^\uFEFF?WEBVTT/.test(text.trimStart());
      const isSrt = text.includes("-->");
      if (isVtt || isSrt) {
        return {
          status: "ACTIVE",
          httpStatus: 200,
          contentType: "text/vtt",
          latencyMs: 0,
          error: null,
        };
      }
      return {
        status: "DEGRADED",
        httpStatus: 200,
        contentType: "text/plain",
        latencyMs: 0,
        error: "Subtitle file could not be recognized",
      };
    } catch {
      // Try the next candidate directory before declaring the asset missing.
    }
  }

  // Not a bundled file: fall through to the HTTP probe so site-relative API
  // endpoints can still be validated.
  return null;
}

async function probe(
  rawUrl: string,
  kind: "video" | "subtitle",
  format?: string,
): Promise<HealthOutcome> {
  const startedAt = Date.now();

  if (kind === "subtitle") {
    const local = await probeLocalSubtitle(rawUrl);
    if (local) return local;
  }

  const url = resolveUrl(rawUrl);

  if (!url) {
    return { status: "BROKEN", httpStatus: null, contentType: null, latencyMs: 0, error: "Invalid URL" };
  }

  if (!isSafeTarget(url)) {
    return {
      status: "BROKEN",
      httpStatus: null,
      contentType: null,
      latencyMs: 0,
      error: "Refusing to probe a private or loopback address",
    };
  }

  const timeoutMs = Number(process.env.HEALTH_CHECK_TIMEOUT_MS ?? 10_000);
  const userAgent =
    process.env.HEALTH_CHECK_USER_AGENT ?? "AniNusaSourceHealth/1.0 (+https://example.com/source-health)";

  try {
    const response = await fetchWithTimeout(
      url,
      {
        method: "GET",
        redirect: "follow",
        headers: {
          "user-agent": userAgent,
          accept: kind === "video" ? "application/vnd.apple.mpegurl, video/*, */*" : "text/vtt, text/plain, */*",
          ...(kind === "video" ? { range: "bytes=0-4095" } : {}),
        },
      },
      timeoutMs,
    );

    const latencyMs = Date.now() - startedAt;
    const contentType = contentTypeOf(response) || null;

    if (response.status === 401 || response.status === 403) {
      return {
        status: "BROKEN",
        httpStatus: response.status,
        contentType,
        latencyMs,
        error: "Provider denied automated access. No bypass was attempted.",
      };
    }

    if (response.status === 429) {
      return {
        status: "DEGRADED",
        httpStatus: response.status,
        contentType,
        latencyMs,
        error: "Provider rate limit reached",
      };
    }

    if (!response.ok && response.status !== 206) {
      return {
        status: "BROKEN",
        httpStatus: response.status,
        contentType,
        latencyMs,
        error: `HTTP ${response.status}`,
      };
    }

    if (kind === "video") {
      const looksLikeHls =
        Boolean(format && format.toUpperCase() === "HLS") ||
        Boolean(contentType && /mpegurl/i.test(contentType));
      const isVideoType =
        Boolean(contentType && (/^video\//.test(contentType) || /octet-stream/.test(contentType)));

      if (looksLikeHls) {
        const text = await readTextWithLimit(response, 8_192);
        if (text.includes("#EXTM3U")) {
          return { status: "ACTIVE", httpStatus: response.status, contentType, latencyMs, error: null };
        }
        return {
          status: "DEGRADED",
          httpStatus: response.status,
          contentType,
          latencyMs,
          error: "HLS playlist did not contain #EXTM3U",
        };
      }

      if (isVideoType) {
        return { status: "ACTIVE", httpStatus: response.status, contentType, latencyMs, error: null };
      }

      return {
        status: "DEGRADED",
        httpStatus: response.status,
        contentType,
        latencyMs,
        error: `Unexpected content type: ${contentType ?? "unknown"}`,
      };
    }

    const text = await readTextWithLimit(response, 32_768);
    const isVtt = /^\uFEFF?WEBVTT/.test(text.trimStart());
    const isSrt = text.includes("-->");
    const isTextType = Boolean(
      contentType && (/^text\//.test(contentType) || /octet-stream|json/.test(contentType)),
    );

    if ((isVtt || isSrt) && (isTextType || !contentType)) {
      return { status: "ACTIVE", httpStatus: response.status, contentType, latencyMs, error: null };
    }

    return {
      status: "DEGRADED",
      httpStatus: response.status,
      contentType,
      latencyMs,
      error: "Subtitle payload could not be recognized",
    };
  } catch (error) {
    return {
      status: "BROKEN",
      httpStatus: null,
      contentType: null,
      latencyMs: Date.now() - startedAt,
      error: getErrorMessage(error),
    };
  }
}

export async function checkVideoSource(sourceId: string): Promise<HealthOutcome> {
  const source = await prisma.videoSource.findUnique({
    where: { id: sourceId },
    select: { id: true, url: true, format: true, status: true, failureCount: true, isActive: true },
  });
  if (!source) throw new Error("Video source not found");

  if (source.status === "DISABLED") {
    return { status: "DISABLED", httpStatus: null, contentType: null, latencyMs: 0, error: null };
  }

  const outcome = await probe(source.url, "video", source.format);
  const failureCount = outcome.status === "ACTIVE" ? 0 : source.failureCount + 1;
  const status = effectiveStatus(outcome, failureCount);

  await prisma.$transaction([
    prisma.videoSource.update({
      where: { id: source.id },
      data: {
        status,
        lastCheckedAt: new Date(),
        lastHttpStatus: outcome.httpStatus,
        contentType: outcome.contentType,
        failureCount,
      },
    }),
    prisma.sourceHealthCheck.create({
      data: {
        videoSourceId: source.id,
        status,
        httpStatus: outcome.httpStatus,
        contentType: outcome.contentType,
        latencyMs: outcome.latencyMs,
        error: outcome.error,
      },
    }),
  ]);

  return { ...outcome, status };
}

export async function checkSubtitle(subtitleId: string): Promise<HealthOutcome> {
  const subtitle = await prisma.subtitle.findUnique({
    where: { id: subtitleId },
    select: { id: true, url: true, format: true, status: true, failureCount: true },
  });
  if (!subtitle) throw new Error("Subtitle not found");

  if (subtitle.status === "DISABLED") {
    return { status: "DISABLED", httpStatus: null, contentType: null, latencyMs: 0, error: null };
  }

  const outcome = await probe(subtitle.url, "subtitle", subtitle.format);
  const failureCount = outcome.status === "ACTIVE" ? 0 : subtitle.failureCount + 1;
  const status = effectiveStatus(outcome, failureCount);

  await prisma.$transaction([
    prisma.subtitle.update({
      where: { id: subtitle.id },
      data: {
        status,
        lastCheckedAt: new Date(),
        failureCount,
      },
    }),
    prisma.sourceHealthCheck.create({
      data: {
        subtitleId: subtitle.id,
        status,
        httpStatus: outcome.httpStatus,
        contentType: outcome.contentType,
        latencyMs: outcome.latencyMs,
        error: outcome.error,
      },
    }),
  ]);

  return { ...outcome, status };
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  operation: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  let index = 0;

  async function worker() {
    while (index < items.length) {
      const current = items[index];
      index += 1;
      if (!current) continue;
      results.push(await operation(current));
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()));
  return results;
}

export async function runHealthSweep(options: { limit?: number; provider?: string } = {}): Promise<HealthSweepSummary> {
  const limit = Math.max(1, Math.min(options.limit ?? 50, 200));

  const sources = await prisma.videoSource.findMany({
    where: {
      isActive: true,
      status: { not: "DISABLED" },
      ...(options.provider ? { provider: options.provider } : {}),
    },
    orderBy: [{ lastCheckedAt: { sort: "asc", nulls: "first" } }],
    take: limit,
    select: { id: true },
  });

  const subtitles = await prisma.subtitle.findMany({
    where: { isActive: true, status: { not: "DISABLED" } },
    orderBy: [{ lastCheckedAt: { sort: "asc", nulls: "first" } }],
    take: limit,
    select: { id: true },
  });

  const summary: HealthSweepSummary = {
    sourcesChecked: 0,
    subtitlesChecked: 0,
    active: 0,
    degraded: 0,
    broken: 0,
    errors: [],
  };

  await mapWithConcurrency(sources, 5, async (source) => {
    try {
      const outcome = await checkVideoSource(source.id);
      summary.sourcesChecked += 1;
      if (outcome.status === "ACTIVE") summary.active += 1;
      else if (outcome.status === "DEGRADED") summary.degraded += 1;
      else if (outcome.status === "BROKEN") summary.broken += 1;
    } catch (error) {
      if (summary.errors.length < 20) summary.errors.push(getErrorMessage(error));
    }
  });

  await mapWithConcurrency(subtitles, 5, async (subtitle) => {
    try {
      const outcome = await checkSubtitle(subtitle.id);
      summary.subtitlesChecked += 1;
      if (outcome.status === "ACTIVE") summary.active += 1;
      else if (outcome.status === "DEGRADED") summary.degraded += 1;
      else if (outcome.status === "BROKEN") summary.broken += 1;
    } catch (error) {
      if (summary.errors.length < 20) summary.errors.push(getErrorMessage(error));
    }
  });

  logger.info("Health sweep finished", { ...summary });
  return summary;
}
