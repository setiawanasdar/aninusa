import type { NormalizedAnime, NormalizedEpisode } from "@aninusa/types";
import { AnimeMatcher, makeUniqueSlug, slugify, type AnimeMatchResult } from "@aninusa/utils";
import type { Prisma, PrismaClient } from "./generated/prisma";

type DbClient = PrismaClient | Prisma.TransactionClient;

export interface IngestAnimeResult {
  animeId: string;
  slug: string;
  created: boolean;
  match: AnimeMatchResult | null;
  episodesUpserted: number;
  sourcesUpserted: number;
  subtitlesUpserted: number;
}

function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

async function uniqueSlug(db: DbClient, title: string): Promise<string> {
  const base = slugify(title);
  const existing = await db.anime.findMany({
    where: { slug: { startsWith: base } },
    select: { slug: true },
  });
  return makeUniqueSlug(base, new Set(existing.map((entry) => entry.slug)));
}

async function resolveExistingAnime(
  db: DbClient,
  providerKey: string,
  anime: NormalizedAnime,
): Promise<{ animeId: string; match: AnimeMatchResult } | null> {
  const ref = await db.providerRef.findUnique({
    where: { providerKey_externalId: { providerKey, externalId: anime.externalId } },
    select: { animeId: true },
  });
  if (ref) {
    return {
      animeId: ref.animeId,
      match: {
        animeId: ref.animeId,
        confidence: 1,
        decision: "AUTO",
        reasons: ["Existing provider reference"],
        matchedTitle: anime.title,
      },
    };
  }

  if (anime.malId || anime.anilistId) {
    const byId = await db.anime.findFirst({
      where: {
        OR: [
          ...(anime.malId ? [{ malId: anime.malId }] : []),
          ...(anime.anilistId ? [{ anilistId: anime.anilistId }] : []),
        ],
      },
      select: {
        id: true,
        title: true,
        englishTitle: true,
        japaneseTitle: true,
        alternativeTitles: true,
        year: true,
        season: true,
        totalEpisodes: true,
        malId: true,
        anilistId: true,
      },
    });

    if (byId) {
      return {
        animeId: byId.id,
        match: {
          animeId: byId.id,
          confidence: 0.99,
          decision: "AUTO",
          reasons: ["External ID matches an existing anime"],
          matchedTitle: byId.title,
        },
      };
    }
  }

  const token = anime.title.split(/\s+/).find((part) => part.length >= 3) ?? anime.title;
  const candidates = await db.anime.findMany({
    where: {
      OR: [
        { title: { contains: token, mode: "insensitive" } },
        { englishTitle: { contains: token, mode: "insensitive" } },
        { japaneseTitle: { contains: token, mode: "insensitive" } },
      ],
    },
    take: 40,
    select: {
      id: true,
      title: true,
      englishTitle: true,
      japaneseTitle: true,
      alternativeTitles: true,
      year: true,
      season: true,
      totalEpisodes: true,
      malId: true,
      anilistId: true,
    },
  });

  const best = new AnimeMatcher().findBest(
    {
      title: anime.title,
      englishTitle: anime.englishTitle,
      japaneseTitle: anime.japaneseTitle,
      alternativeTitles: anime.alternativeTitles,
      year: anime.year,
      season: anime.season,
      totalEpisodes: anime.totalEpisodes,
      malId: anime.malId,
      anilistId: anime.anilistId,
    },
    candidates,
  );

  // Probable matches (0.80-0.94) intentionally do NOT merge automatically.
  // They surface in admin review while the provider record stays separate.
  if (best && best.decision === "AUTO" && best.animeId) {
    return { animeId: best.animeId, match: best };
  }

  return null;
}

function animeUpdateData(anime: NormalizedAnime): Prisma.AnimeUpdateInput {
  return {
    title: anime.title,
    japaneseTitle: anime.japaneseTitle ?? null,
    englishTitle: anime.englishTitle ?? null,
    alternativeTitles: anime.alternativeTitles ?? [],
    synopsis: anime.synopsis ?? null,
    poster: anime.poster ?? null,
    banner: anime.banner ?? null,
    type: anime.type ?? "TV",
    status: anime.status ?? "COMPLETED",
    year: anime.year ?? null,
    season: anime.season ?? null,
    score: anime.score ?? null,
    popularity: anime.popularity ?? 0,
    source: anime.source,
    duration: anime.duration ?? null,
    totalEpisodes: anime.totalEpisodes ?? null,
    airedFrom: parseDate(anime.airedFrom),
    airedTo: parseDate(anime.airedTo),
    malId: anime.malId ?? null,
    anilistId: anime.anilistId ?? null,
    genres: {
      set: [],
      connectOrCreate: dedupeBySlug(anime.genres ?? []).map((genre) => ({
        where: { slug: genre.slug },
        create: { name: genre.name, slug: genre.slug },
      })),
    },
    studios: {
      set: [],
      connectOrCreate: dedupeBySlug(anime.studios ?? []).map((studio) => ({
        where: { slug: studio.slug },
        create: { name: studio.name, slug: studio.slug },
      })),
    },
  };
}

function animeCreateData(anime: NormalizedAnime, slug: string, providerKey: string): Prisma.AnimeCreateInput {
  return {
    slug,
    title: anime.title,
    japaneseTitle: anime.japaneseTitle ?? null,
    englishTitle: anime.englishTitle ?? null,
    alternativeTitles: anime.alternativeTitles ?? [],
    synopsis: anime.synopsis ?? null,
    poster: anime.poster ?? null,
    banner: anime.banner ?? null,
    type: anime.type ?? "TV",
    status: anime.status ?? "COMPLETED",
    year: anime.year ?? null,
    season: anime.season ?? null,
    score: anime.score ?? null,
    popularity: anime.popularity ?? 0,
    source: anime.source ?? providerKey,
    duration: anime.duration ?? null,
    totalEpisodes: anime.totalEpisodes ?? null,
    airedFrom: parseDate(anime.airedFrom),
    airedTo: parseDate(anime.airedTo),
    malId: anime.malId ?? null,
    anilistId: anime.anilistId ?? null,
    genres: {
      connectOrCreate: dedupeBySlug(anime.genres ?? []).map((genre) => ({
        where: { slug: genre.slug },
        create: { name: genre.name, slug: genre.slug },
      })),
    },
    studios: {
      connectOrCreate: dedupeBySlug(anime.studios ?? []).map((studio) => ({
        where: { slug: studio.slug },
        create: { name: studio.name, slug: studio.slug },
      })),
    },
  };
}

function dedupeBySlug(values: string[]): Array<{ name: string; slug: string }> {
  const map = new Map<string, string>();
  for (const value of values) {
    const trimmed = value.trim();
    if (!trimmed) continue;
    const slug = slugify(trimmed);
    if (!map.has(slug)) map.set(slug, trimmed);
  }
  return Array.from(map.entries()).map(([slug, name]) => ({ slug, name }));
}

async function upsertEpisode(
  db: DbClient,
  animeId: string,
  episode: NormalizedEpisode,
  providerKey: string,
): Promise<{ sources: number; subtitles: number }> {
  const data = {
    title: episode.title ?? null,
    description: episode.description ?? null,
    duration: episode.duration ?? null,
    thumbnail: episode.thumbnail ?? null,
    airDate: parseDate(episode.airDate),
    introStart: episode.introStart ?? null,
    introEnd: episode.introEnd ?? null,
    outroStart: episode.outroStart ?? null,
  };

  const row = await db.episode.upsert({
    where: { animeId_episodeNumber: { animeId, episodeNumber: episode.number } },
    update: data,
    create: { animeId, episodeNumber: episode.number, ...data },
    select: { id: true },
  });

  let sources = 0;
  for (const source of episode.sources ?? []) {
    const existing = await db.videoSource.findFirst({
      where: { episodeId: row.id, provider: source.provider || providerKey, url: source.url },
      select: { id: true },
    });

    const sourceData = {
      url: source.url,
      quality: source.quality,
      format: source.format,
      codec: source.codec ?? null,
      language: source.language ?? "ja",
      subtitleSupport: source.subtitleSupport ?? true,
      isActive: true,
    };

    if (existing) {
      await db.videoSource.update({ where: { id: existing.id }, data: sourceData });
    } else {
      await db.videoSource.create({
        data: {
          episodeId: row.id,
          provider: source.provider || providerKey,
          externalId: source.externalId ?? null,
          ...sourceData,
        },
      });
    }
    sources += 1;
  }

  let subtitles = 0;
  for (const subtitle of episode.subtitles ?? []) {
    const existing = await db.subtitle.findFirst({
      where: { episodeId: row.id, language: subtitle.language, url: subtitle.url },
      select: { id: true },
    });

    const subtitleData = {
      label: subtitle.label,
      format: subtitle.format,
      isActive: true,
    };

    if (existing) {
      await db.subtitle.update({
        where: { id: existing.id },
        data: { ...subtitleData, isDefault: subtitle.isDefault ?? false },
      });
    } else {
      await db.subtitle.create({
        data: {
          episodeId: row.id,
          language: subtitle.language,
          url: subtitle.url,
          isDefault: subtitle.isDefault ?? false,
          ...subtitleData,
        },
      });
    }
    subtitles += 1;
  }

  if (episode.subtitles?.some((subtitle) => subtitle.isDefault)) {
    const defaultLanguage = episode.subtitles.find((subtitle) => subtitle.isDefault)?.language;
    if (defaultLanguage) {
      await db.subtitle.updateMany({
        where: { episodeId: row.id, language: { not: defaultLanguage } },
        data: { isDefault: false },
      });
    }
  }

  return { sources, subtitles };
}

/**
 * Idempotent provider-to-catalog ingestion. Creates or updates an Anime,
 * its episodes, authorized video sources and subtitles in a single transaction.
 */
export async function ingestNormalizedAnime(
  db: DbClient,
  providerKey: string,
  anime: NormalizedAnime,
): Promise<IngestAnimeResult> {
  const resolved = await resolveExistingAnime(db, providerKey, anime);
  let animeId: string;
  let slug: string;
  let created = false;
  let match: AnimeMatchResult | null = resolved?.match ?? null;

  if (resolved) {
    animeId = resolved.animeId;
    const updated = await db.anime.update({
      where: { id: animeId },
      data: animeUpdateData(anime),
      select: { slug: true },
    });
    slug = updated.slug;
  } else {
    slug = await uniqueSlug(db, anime.englishTitle || anime.title);
    const row = await db.anime.create({
      data: animeCreateData(anime, slug, providerKey),
      select: { id: true },
    });
    animeId = row.id;
    created = true;
  }

  await db.providerRef.upsert({
    where: { providerKey_externalId: { providerKey, externalId: anime.externalId } },
    update: { animeId, confidence: match?.confidence ?? 1 },
    create: {
      providerKey,
      externalId: anime.externalId,
      animeId,
      confidence: match?.confidence ?? 1,
    },
  });

  let episodesUpserted = 0;
  let sourcesUpserted = 0;
  let subtitlesUpserted = 0;

  for (const episode of anime.episodes ?? []) {
    const result = await upsertEpisode(db, animeId, episode, providerKey);
    episodesUpserted += 1;
    sourcesUpserted += result.sources;
    subtitlesUpserted += result.subtitles;
  }

  const episodeStats = await db.episode.aggregate({
    where: { animeId },
    _count: { _all: true },
    _max: { episodeNumber: true },
  });

  await db.anime.update({
    where: { id: animeId },
    data: {
      latestEpisode: episodeStats._max.episodeNumber ?? null,
      totalEpisodes: anime.totalEpisodes ?? episodeStats._count._all,
    },
  });

  return {
    animeId,
    slug,
    created,
    match,
    episodesUpserted,
    sourcesUpserted,
    subtitlesUpserted,
  };
}

