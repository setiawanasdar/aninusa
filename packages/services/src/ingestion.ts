import { prisma, ingestNormalizedAnime, type Prisma } from "@aninusa/database";
import { createProviderRegistry, OpenMediaProvider, providerConfigFromEnv } from "@aninusa/source-adapters";
import type { NormalizedAnime, SyncMode } from "@aninusa/types";
import { createLogger, getErrorMessage } from "@aninusa/utils";

const logger = createLogger({ service: "ingestion" });

export interface SyncOptions {
  providerKey: string;
  mode?: SyncMode;
  limit?: number;
  triggeredBy?: string;
}

export interface SyncStats {
  providerKey: string;
  mode: SyncMode;
  fetched: number;
  created: number;
  updated: number;
  episodes: number;
  sources: number;
  subtitles: number;
  failed: number;
  durationMs: number;
  errors: string[];
}

export interface SyncResult {
  jobId: string;
  status: "SUCCEEDED" | "PARTIAL" | "FAILED";
  stats: SyncStats;
}

async function withRetry<T>(operation: () => Promise<T>, attempts = 3): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt === attempts) break;
      const delay = Math.min(4_000, 250 * 2 ** (attempt - 1));
      logger.warn("Retrying provider operation", { attempt, delay, error: getErrorMessage(error) });
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw lastError;
}

async function fetchProviderCatalog(
  providerKey: string,
  mode: SyncMode,
  limit: number,
): Promise<{ provider: ReturnType<ReturnType<typeof createProviderRegistry>["getMetadataProvider"]>; items: NormalizedAnime[] }> {
  const registry = createProviderRegistry(providerConfigFromEnv());
  const provider = registry.getMetadataProvider(providerKey);

  if (!provider) {
    throw new Error(
      `Provider "${providerKey}" is disabled, unsupported, or not registered. No access controls are bypassed.`,
    );
  }

  if (!provider.capabilities.automatedAccessPermitted) {
    throw new Error(`Provider "${providerKey}" does not permit automated access and is marked unsupported.`);
  }

  if (provider instanceof OpenMediaProvider) {
    return { provider, items: provider.getCatalog().slice(0, limit) };
  }

  if (mode === "FULL") {
    const popular = await withRetry(() => provider.getPopular?.({ page: 1, perPage: Math.min(limit, 50) }) ?? Promise.resolve([]));
    return { provider, items: popular };
  }

  const incremental = await withRetry(
    () => provider.getPopular?.({ page: 1, perPage: Math.min(limit, 25) }) ?? Promise.resolve([]),
  );
  return { provider, items: incremental };
}

/**
 * Synchronizes one authorized provider. The job is persisted so operators can
 * inspect failures. Ingestion is idempotent: provider refs, slugs, episodes,
 * sources and subtitles are all upserted.
 */
export async function runProviderSync(options: SyncOptions): Promise<SyncResult> {
  const providerKey = options.providerKey;
  const mode = options.mode ?? "INCREMENTAL";
  const limit = Math.max(1, Math.min(options.limit ?? 12, 50));
  const startedAt = Date.now();

  const existing = await prisma.ingestionJob.findFirst({
    where: {
      providerKey,
      status: "RUNNING",
      startedAt: { gte: new Date(Date.now() - 30 * 60_000) },
    },
    select: { id: true },
  });
  if (existing) {
    throw new Error(`A sync job is already running for ${providerKey}`);
  }

  const providerRow = await prisma.provider.findUnique({ where: { key: providerKey } });

  const job = await prisma.ingestionJob.create({
    data: {
      providerId: providerRow?.id,
      providerKey,
      type: "metadata",
      mode,
      status: "RUNNING",
      startedAt: new Date(),
      stats: { triggeredBy: options.triggeredBy ?? "system" },
    },
    select: { id: true },
  });

  const stats: SyncStats = {
    providerKey,
    mode,
    fetched: 0,
    created: 0,
    updated: 0,
    episodes: 0,
    sources: 0,
    subtitles: 0,
    failed: 0,
    durationMs: 0,
    errors: [],
  };

  logger.info("Sync started", { jobId: job.id, providerKey, mode, limit });

  try {
    const { items } = await fetchProviderCatalog(providerKey, mode, limit);
    stats.fetched = items.length;

    for (const item of items) {
      try {
        const result = await prisma.$transaction(
          (tx) => ingestNormalizedAnime(tx, providerKey, item),
          { timeout: 30_000 },
        );
        if (result.created) stats.created += 1;
        else stats.updated += 1;
        stats.episodes += result.episodesUpserted;
        stats.sources += result.sourcesUpserted;
        stats.subtitles += result.subtitlesUpserted;
      } catch (error) {
        stats.failed += 1;
        const message = `"${item.title}": ${getErrorMessage(error)}`;
        if (stats.errors.length < 20) stats.errors.push(message);
        logger.error("Anime ingestion failed", { providerKey, title: item.title, error: getErrorMessage(error) });
      }
    }

    stats.durationMs = Date.now() - startedAt;
    const status = stats.failed > 0 ? (stats.created + stats.updated > 0 ? "PARTIAL" : "FAILED") : "SUCCEEDED";

    await prisma.$transaction([
      prisma.ingestionJob.update({
        where: { id: job.id },
        data: {
          status,
          finishedAt: new Date(),
          stats: stats as unknown as Prisma.InputJsonValue,
          error: stats.errors[0] ?? null,
        },
      }),
      ...(providerRow
        ? [
            prisma.provider.update({
              where: { id: providerRow.id },
              data: { lastSyncAt: new Date() },
            }),
          ]
        : []),
    ]);

    logger.info("Sync finished", { jobId: job.id, status, ...stats });
    return { jobId: job.id, status, stats };
  } catch (error) {
    stats.durationMs = Date.now() - startedAt;
    const message = getErrorMessage(error).slice(0, 2_000);
    stats.errors.push(message);

    await prisma.ingestionJob.update({
      where: { id: job.id },
      data: {
        status: "FAILED",
        finishedAt: new Date(),
        stats: stats as unknown as Prisma.InputJsonValue,
        error: message,
      },
    });

    logger.error("Sync failed", { jobId: job.id, providerKey, error: message });
    return { jobId: job.id, status: "FAILED", stats };
  }
}

export async function runScheduledSyncs(): Promise<SyncResult[]> {
  const providers = await prisma.provider.findMany({
    where: { enabled: true, kind: "METADATA", key: { not: "restricted-example" } },
    select: { key: true },
  });

  const results: SyncResult[] = [];
  for (const provider of providers) {
    try {
      results.push(await runProviderSync({ providerKey: provider.key, mode: "INCREMENTAL", limit: 10, triggeredBy: "scheduler" }));
    } catch (error) {
      logger.error("Scheduled sync could not start", { providerKey: provider.key, error: getErrorMessage(error) });
    }
  }

  return results;
}

export async function testProvider(providerKey: string): Promise<{
  ok: boolean;
  latencyMs: number;
  message: string;
}> {
  const startedAt = Date.now();
  const registry = createProviderRegistry(providerConfigFromEnv());
  const descriptor = registry.statuses.find((provider) => provider.key === providerKey);

  if (!descriptor) {
    return { ok: false, latencyMs: 0, message: "Provider is not registered" };
  }

  if (!descriptor.capabilities.automatedAccessPermitted) {
    return {
      ok: false,
      latencyMs: 0,
      message: "Provider does not permit automated access. It is intentionally unsupported.",
    };
  }

  const provider = registry.getMetadataProvider(providerKey);
  if (!provider) {
    return { ok: false, latencyMs: 0, message: "Provider is disabled" };
  }

  try {
    if (provider instanceof OpenMediaProvider) {
      const anime = await provider.getAnime("big-buck-bunny");
      if (!anime) throw new Error("Bundled catalog is empty");
    } else {
      const results = await provider.getPopular?.({ perPage: 1 });
      if (!results?.length) throw new Error("Provider returned no data");
    }

    return {
      ok: true,
      latencyMs: Date.now() - startedAt,
      message: "Provider responded successfully",
    };
  } catch (error) {
    return {
      ok: false,
      latencyMs: Date.now() - startedAt,
      message: getErrorMessage(error),
    };
  }
}
