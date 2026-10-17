import { NextResponse } from "next/server";
import { fetchWithTimeout } from "@aninusa/utils";
import { enforceRateLimit, errorResponse, errors } from "@/lib/api";

export const runtime = "nodejs";

const MAX_BYTES = 1_000_000;

function allowedHosts(): string[] {
  return (process.env.SUBTITLE_HOST_ALLOWLIST ?? "")
    .split(",")
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean);
}

function isPrivateHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".local") || host === "::1" || host === "[::1]") return true;
  if (/^127\./.test(host) || /^10\./.test(host) || /^192\.168\./.test(host) || /^169\.254\./.test(host)) {
    return true;
  }
  return /^172\.(1[6-9]|2\d|3[0-1])\./.test(host);
}

/**
 * Subtitle proxy for authorized providers that do not send CORS headers.
 * External hosts must be explicitly allowlisted; unlisted hosts fail closed.
 * Local /public subtitle files never go through this route.
 */
export async function GET(request: Request) {
  try {
    await enforceRateLimit(request, "public");

    const url = new URL(request.url);
    const target = url.searchParams.get("url");
    if (!target) throw errors.badRequest("Parameter url wajib diisi");

    let parsed: URL;
    try {
      parsed = new URL(target);
    } catch {
      throw errors.badRequest("URL subtitle tidak valid");
    }

    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      throw errors.badRequest("Hanya URL http(s) yang didukung");
    }

    if (isPrivateHost(parsed.hostname)) {
      throw errors.forbidden("Host tidak diizinkan");
    }

    const allowlist = allowedHosts();
    if (!allowlist.includes(parsed.hostname.toLowerCase())) {
      throw errors.forbidden(
        "Host subtitle tidak ada dalam SUBTITLE_HOST_ALLOWLIST. Tambahkan host resmi provider terlebih dahulu.",
      );
    }

    const response = await fetchWithTimeout(
      parsed.toString(),
      {
        headers: {
          "user-agent": process.env.PROVIDER_USER_AGENT ?? "AniNusaSubtitleProxy/1.0",
          accept: "text/vtt, text/plain, application/x-subrip, */*",
        },
        redirect: "follow",
      },
      Number(process.env.INGEST_REQUEST_TIMEOUT_MS ?? 15_000),
    );

    if (response.status === 401 || response.status === 403) {
      return NextResponse.json(
        { error: { code: "UPSTREAM_UNAVAILABLE", message: "Subtitle Indonesia tidak tersedia." } },
        { status: 502 },
      );
    }

    if (!response.ok) {
      return NextResponse.json(
        { error: { code: "UPSTREAM_UNAVAILABLE", message: "Subtitle tidak tersedia." } },
        { status: 502 },
      );
    }

    const buffer = await response.arrayBuffer();
    if (buffer.byteLength > MAX_BYTES) throw errors.badRequest("Subtitle terlalu besar");

    const text = new TextDecoder().decode(buffer);
    if (!/WEBVTT|-->/.test(text)) {
      return NextResponse.json(
        { error: { code: "UPSTREAM_UNAVAILABLE", message: "Format subtitle tidak dikenali." } },
        { status: 502 },
      );
    }

    return new NextResponse(text, {
      status: 200,
      headers: {
        "content-type": "text/vtt; charset=utf-8",
        "cache-control": "public, s-maxage=300, stale-while-revalidate=3600",
        "x-content-type-options": "nosniff",
        "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'",
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
