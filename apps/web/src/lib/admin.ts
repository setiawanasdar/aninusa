import "server-only";

import { prisma } from "./db";
import { invalidateCatalogCache } from "./cache";
import { slugify } from "@aninusa/utils";

export async function ensureUniqueAnimeSlug(desired: string, excludeId?: string): Promise<string> {
  const base = slugify(desired);
  let candidate = base;
  let suffix = 2;

  for (;;) {
    const existing = await prisma.anime.findUnique({
      where: { slug: candidate },
      select: { id: true },
    });
    if (!existing || existing.id === excludeId) return candidate;
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
}

export async function audit(
  userId: string | null,
  action: string,
  targetType: string,
  targetId?: string | null,
  metadata?: Record<string, unknown>,
  ip?: string | null,
): Promise<void> {
  await prisma.auditLog
    .create({
      data: {
        userId,
        action,
        targetType,
        targetId: targetId ?? null,
        metadata: metadata as never,
        ip: ip ?? null,
      },
    })
    .catch(() => undefined);
}

export async function afterCatalogMutation(): Promise<void> {
  await invalidateCatalogCache();
}

export async function getAdminStats() {
  const [
    animeCount,
    episodeCount,
    sourceCount,
    activeProviders,
    failedJobs,
    brokenSources,
    brokenSubtitles,
    userCount,
    recentAnime,
    recentJobs,
  ] = await Promise.all([
    prisma.anime.count(),
    prisma.episode.count(),
    prisma.videoSource.count(),
    prisma.provider.count({ where: { enabled: true } }),
    prisma.ingestionJob.count({ where: { status: "FAILED" } }),
    prisma.videoSource.count({ where: { status: "BROKEN" } }),
    prisma.subtitle.count({ where: { status: "BROKEN" } }),
    prisma.user.count(),
    prisma.anime.findMany({
      orderBy: { createdAt: "desc" },
      take: 6,
      select: {
        id: true,
        slug: true,
        title: true,
        poster: true,
        status: true,
        year: true,
        createdAt: true,
      },
    }),
    prisma.ingestionJob.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      select: {
        id: true,
        providerKey: true,
        type: true,
        mode: true,
        status: true,
        attempts: true,
        stats: true,
        error: true,
        startedAt: true,
        finishedAt: true,
        createdAt: true,
      },
    }),
  ]);

  return {
    animeCount,
    episodeCount,
    sourceCount,
    activeProviders,
    failedJobs,
    brokenSources,
    brokenSubtitles,
    userCount,
    recentAnime,
    recentJobs,
  };
}
