import "server-only";

import { cache as reactCache } from "react";
import { prisma, Prisma } from "@aninusa/database";
import type {
  AnimeDetail,
  AnimeStatus,
  AnimeSummary,
  AnimeType,
  CatalogQuery,
  EpisodeDto,
  EpisodePlayback,
  GenreDto,
  Paginated,
  PlaybackSource,
  Season,
  SubtitleTrack,
  WatchHistoryEntry,
} from "@aninusa/types";
import { buildPagination, pageToSkip } from "@aninusa/utils";
import { CACHE_KEYS, CACHE_TTL, cache } from "./cache";

const summarySelect = {
  id: true,
  slug: true,
  title: true,
  englishTitle: true,
  japaneseTitle: true,
  poster: true,
  banner: true,
  type: true,
  status: true,
  year: true,
  season: true,
  score: true,
  popularity: true,
  totalEpisodes: true,
  latestEpisode: true,
  duration: true,
  updatedAt: true,
  genres: { select: { name: true } },
  studios: { select: { name: true } },
} satisfies Prisma.AnimeSelect;

type SummaryRow = Prisma.AnimeGetPayload<{ select: typeof summarySelect }>;

const detailSelect = {
  ...summarySelect,
  alternativeTitles: true,
  synopsis: true,
  source: true,
  airedFrom: true,
  airedTo: true,
  malId: true,
  anilistId: true,
  createdAt: true,
  _count: { select: { episodes: true } },
} satisfies Prisma.AnimeSelect;

type DetailRow = Prisma.AnimeGetPayload<{ select: typeof detailSelect }>;

const episodeSelect = {
  id: true,
  animeId: true,
  episodeNumber: true,
  title: true,
  description: true,
  duration: true,
  thumbnail: true,
  airDate: true,
  introStart: true,
  introEnd: true,
  outroStart: true,
} satisfies Prisma.EpisodeSelect;

type EpisodeRow = Prisma.EpisodeGetPayload<{ select: typeof episodeSelect }>;

export function mapSummary(row: SummaryRow): AnimeSummary {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    englishTitle: row.englishTitle,
    japaneseTitle: row.japaneseTitle,
    poster: row.poster,
    banner: row.banner,
    type: row.type as AnimeType,
    status: row.status as AnimeStatus,
    year: row.year,
    season: row.season as Season | null,
    score: row.score,
    popularity: row.popularity,
    totalEpisodes: row.totalEpisodes,
    latestEpisode: row.latestEpisode,
    duration: row.duration,
    genres: row.genres.map((genre) => genre.name),
    studios: row.studios.map((studio) => studio.name),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function mapDetail(row: DetailRow): AnimeDetail {
  return {
    ...mapSummary(row),
    alternativeTitles: row.alternativeTitles,
    synopsis: row.synopsis,
    source: row.source,
    airedFrom: row.airedFrom?.toISOString() ?? null,
    airedTo: row.airedTo?.toISOString() ?? null,
    malId: row.malId,
    anilistId: row.anilistId,
    episodeCount: row._count.episodes,
    createdAt: row.createdAt.toISOString(),
  };
}

export function mapEpisode(row: EpisodeRow): EpisodeDto {
  return {
    id: row.id,
    animeId: row.animeId,
    number: row.episodeNumber,
    title: row.title,
    description: row.description,
    duration: row.duration,
    thumbnail: row.thumbnail,
    airDate: row.airDate?.toISOString() ?? null,
    introStart: row.introStart,
    introEnd: row.introEnd,
    outroStart: row.outroStart,
  };
}

function sortToOrderBy(sort: CatalogQuery["sort"]): Prisma.AnimeOrderByWithRelationInput[] {
  switch (sort) {
    case "rating":
      return [{ score: { sort: "desc", nulls: "last" } }, { popularity: "desc" }];
    case "newest":
      return [{ year: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }];
    case "updated":
      return [{ updatedAt: "desc" }];
    case "alphabetical":
      return [{ title: "asc" }];
    case "popularity":
    default:
      return [{ popularity: "desc" }, { score: { sort: "desc", nulls: "last" } }];
  }
}

function buildWhere(query: CatalogQuery): Prisma.AnimeWhereInput {
  const where: Prisma.AnimeWhereInput = {};

  if (query.type) where.type = query.type;
  if (query.status) where.status = query.status;
  if (query.year) where.year = query.year;
  if (query.season) where.season = query.season;
  if (query.genre) where.genres = { some: { slug: query.genre } };
  if (query.studio) where.studios = { some: { slug: query.studio } };

  return where;
}

async function searchIds(query: CatalogQuery): Promise<{ ids: string[]; total: number }> {
  const q = query.q?.trim() ?? "";
  const page = query.page ?? 1;
  const perPage = query.perPage ?? 24;
  const skip = pageToSkip(page, perPage);

  const filters: Prisma.Sql[] = [];
  if (query.type) filters.push(Prisma.sql`a."type" = ${query.type}::"AnimeType"`);
  if (query.status) filters.push(Prisma.sql`a."status" = ${query.status}::"AnimeStatus"`);
  if (query.year) filters.push(Prisma.sql`a."year" = ${query.year}`);
  if (query.season) filters.push(Prisma.sql`a."season" = ${query.season}::"Season"`);
  if (query.genre) {
    filters.push(
      Prisma.sql`EXISTS (SELECT 1 FROM "Anime" ag JOIN "_AnimeGenres" rel ON rel."A" = ag."id" JOIN "Genre" g ON g."id" = rel."B" WHERE ag."id" = a."id" AND g."slug" = ${query.genre})`,
    );
  }
  if (query.studio) {
    filters.push(
      Prisma.sql`EXISTS (SELECT 1 FROM "Anime" asx JOIN "_AnimeStudios" rel ON rel."A" = asx."id" JOIN "Studio" s ON s."id" = rel."B" WHERE asx."id" = a."id" AND s."slug" = ${query.studio})`,
    );
  }

  const like = `%${q.replace(/[%_\\]/g, (match) => `\\${match}`)}%`;
  const vector = Prisma.sql`to_tsvector('simple', coalesce(a."title", '') || ' ' || coalesce(a."englishTitle", '') || ' ' || coalesce(a."japaneseTitle", '') || ' ' || coalesce(a."synopsis", ''))`;
  const tsQuery = Prisma.sql`plainto_tsquery('simple', ${q})`;

  filters.push(
    Prisma.sql`(
      ${vector} @@ ${tsQuery}
      OR a."title" ILIKE ${like}
      OR a."englishTitle" ILIKE ${like}
      OR a."japaneseTitle" ILIKE ${like}
      OR EXISTS (SELECT 1 FROM unnest(a."alternativeTitles") AS alt WHERE alt ILIKE ${like})
      OR EXISTS (
        SELECT 1 FROM "Anime" ag
        JOIN "_AnimeGenres" rel ON rel."A" = ag."id"
        JOIN "Genre" g ON g."id" = rel."B"
        WHERE ag."id" = a."id" AND g."name" ILIKE ${like}
      )
      OR EXISTS (
        SELECT 1 FROM "Anime" asx
        JOIN "_AnimeStudios" rel ON rel."A" = asx."id"
        JOIN "Studio" s ON s."id" = rel."B"
        WHERE asx."id" = a."id" AND s."name" ILIKE ${like}
      )
    )`,
  );

  const whereSql = Prisma.join(filters, " AND ");
  const orderSql =
    query.sort === "alphabetical"
      ? Prisma.sql`a."title" ASC`
      : query.sort === "rating"
        ? Prisma.sql`a."score" DESC NULLS LAST, a."popularity" DESC`
        : query.sort === "newest"
          ? Prisma.sql`a."year" DESC NULLS LAST, a."createdAt" DESC`
          : query.sort === "updated"
            ? Prisma.sql`a."updatedAt" DESC`
            : Prisma.sql`ts_rank(${vector}, ${tsQuery}) DESC, a."popularity" DESC`;

  const [rows, countRows] = await Promise.all([
    prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT a."id"
      FROM "Anime" a
      WHERE ${whereSql}
      ORDER BY ${orderSql}
      LIMIT ${perPage} OFFSET ${skip}
    `),
    prisma.$queryRaw<Array<{ count: bigint | number }>>(Prisma.sql`
      SELECT count(*)::int AS count
      FROM "Anime" a
      WHERE ${whereSql}
    `),
  ]);

  const total = Number(countRows[0]?.count ?? 0);
  return { ids: rows.map((row) => row.id), total };
}

export async function listAnime(query: CatalogQuery): Promise<Paginated<AnimeSummary>> {
  const page = Math.max(1, query.page ?? 1);
  const perPage = Math.min(60, Math.max(1, query.perPage ?? 24));

  const cacheKey = CACHE_KEYS.catalog(JSON.stringify({ ...query, page, perPage }));

  return cache().get<Paginated<AnimeSummary>>(cacheKey).then(async (hit) => {
    if (hit) return hit;

    let result: Paginated<AnimeSummary>;

    if (query.q?.trim()) {
      const { ids, total } = await searchIds({ ...query, page, perPage });
      const rows = await prisma.anime.findMany({
        where: { id: { in: ids } },
        select: summarySelect,
      });
      const byId = new Map(rows.map((row) => [row.id, row]));
      const ordered = ids.map((id) => byId.get(id)).filter((row): row is SummaryRow => Boolean(row));
      result = buildPagination(ordered.map(mapSummary), page, perPage, total);
    } else {
      const where = buildWhere(query);
      const [rows, total] = await Promise.all([
        prisma.anime.findMany({
          where,
          select: summarySelect,
          orderBy: sortToOrderBy(query.sort),
          skip: pageToSkip(page, perPage),
          take: perPage,
        }),
        prisma.anime.count({ where }),
      ]);
      result = buildPagination(rows.map(mapSummary), page, perPage, total);
    }

    await cache().set(cacheKey, result, CACHE_TTL.catalog);
    return result;
  });
}

export const getAnimeBySlug = reactCache(async (slug: string): Promise<AnimeDetail | null> => {
  const cacheKey = CACHE_KEYS.anime(slug);
  const hit = await cache().get<AnimeDetail>(cacheKey);
  if (hit) return hit;

  const row = await prisma.anime.findUnique({ where: { slug }, select: detailSelect });
  if (!row) return null;

  const detail = mapDetail(row);
  await cache().set(cacheKey, detail, CACHE_TTL.anime);
  return detail;
});

export async function getAnimeEpisodes(animeId: string): Promise<EpisodeDto[]> {
  const rows = await prisma.episode.findMany({
    where: { animeId },
    select: episodeSelect,
    orderBy: { episodeNumber: "asc" },
  });
  return rows.map(mapEpisode);
}

export async function getEpisodeByNumber(animeId: string, episodeNumber: number) {
  return prisma.episode.findUnique({
    where: { animeId_episodeNumber: { animeId, episodeNumber } },
    select: episodeSelect,
  });
}

export function proxiedSubtitleUrl(rawUrl: string): string {
  if (rawUrl.startsWith("/")) return rawUrl;
  return `/api/subtitles?url=${encodeURIComponent(rawUrl)}`;
}

export async function getEpisodePlayback(episodeId: string): Promise<EpisodePlayback | null> {
  const cacheKey = CACHE_KEYS.playback(episodeId);
  const hit = await cache().get<EpisodePlayback>(cacheKey);
  if (hit) return hit;

  const episode = await prisma.episode.findUnique({
    where: { id: episodeId },
    select: {
      ...episodeSelect,
      anime: {
        select: {
          id: true,
          slug: true,
          title: true,
          poster: true,
          episodes: {
            select: { id: true, episodeNumber: true },
            orderBy: { episodeNumber: "asc" },
          },
        },
      },
      sources: {
        where: { isActive: true, status: { in: ["ACTIVE", "DEGRADED"] } },
        orderBy: [{ quality: "desc" }, { createdAt: "asc" }],
        select: {
          id: true,
          quality: true,
          format: true,
          codec: true,
          language: true,
          url: true,
          status: true,
          provider: true,
        },
      },
      subtitles: {
        where: { isActive: true, status: { in: ["ACTIVE", "DEGRADED"] } },
        orderBy: [{ isDefault: "desc" }, { language: "asc" }],
        select: {
          id: true,
          language: true,
          label: true,
          format: true,
          url: true,
          isDefault: true,
          status: true,
        },
      },
    },
  });

  if (!episode) return null;

  const sources: PlaybackSource[] = episode.sources.map((source) => ({
    id: source.id,
    quality: source.quality,
    format: source.format as PlaybackSource["format"],
    codec: source.codec,
    language: source.language,
    url: source.url,
    label: source.quality > 0 ? `${source.quality}p` : "Auto",
    status: source.status as PlaybackSource["status"],
  }));

  const subtitles: SubtitleTrack[] = episode.subtitles.map((track) => ({
    id: track.id,
    language: track.language,
    label: track.label,
    format: track.format as SubtitleTrack["format"],
    url: proxiedSubtitleUrl(track.url),
    isDefault: track.isDefault,
    status: track.status as SubtitleTrack["status"],
  }));

  const list = episode.anime.episodes;
  const index = list.findIndex((entry) => entry.id === episode.id);

  const playback: EpisodePlayback = {
    episode: mapEpisode(episode),
    sources,
    subtitles,
    anime: {
      id: episode.anime.id,
      slug: episode.anime.slug,
      title: episode.anime.title,
      poster: episode.anime.poster,
    },
    previousEpisode: index > 0 ? { id: list[index - 1]!.id, number: list[index - 1]!.episodeNumber } : null,
    nextEpisode:
      index >= 0 && index < list.length - 1
        ? { id: list[index + 1]!.id, number: list[index + 1]!.episodeNumber }
        : null,
  };

  await cache().set(cacheKey, playback, CACHE_TTL.playback);
  return playback;
}

export interface HomeSections {
  hero: AnimeSummary[];
  trending: AnimeSummary[];
  latestEpisodes: Array<{
    episode: EpisodeDto;
    anime: Pick<AnimeSummary, "id" | "slug" | "title" | "poster" | "score" | "year" | "status">;
  }>;
  recentlyAdded: AnimeSummary[];
  popular: AnimeSummary[];
  seasonal: AnimeSummary[];
  completed: AnimeSummary[];
  topRated: AnimeSummary[];
  genres: GenreDto[];
  seasonLabel: { year: number; season: Season } | null;
}

function currentSeason(): { year: number; season: Season } {
  const now = new Date();
  const month = now.getUTCMonth() + 1;
  const season: Season = month <= 3 ? "WINTER" : month <= 6 ? "SPRING" : month <= 9 ? "SUMMER" : "FALL";
  return { year: now.getUTCFullYear(), season };
}

export async function getHomeSections(): Promise<HomeSections> {
  const hit = await cache().get<HomeSections>(CACHE_KEYS.home);
  if (hit) return hit;

  const { year, season } = currentSeason();

  const [hero, trending, latestEpisodeRows, recentlyAdded, popular, seasonalRows, completed, topRated, genres] =
    await Promise.all([
      prisma.anime.findMany({
        where: { banner: { not: null }, score: { gte: 7 } },
        select: summarySelect,
        orderBy: [{ popularity: "desc" }],
        take: 5,
      }),
      prisma.anime.findMany({ select: summarySelect, orderBy: [{ updatedAt: "desc" }], take: 14 }),
      prisma.episode.findMany({
        where: { anime: { episodes: { some: {} } } },
        select: {
          ...episodeSelect,
          anime: {
            select: { id: true, slug: true, title: true, poster: true, score: true, year: true, status: true },
          },
        },
        orderBy: [{ airDate: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
        take: 12,
      }),
      prisma.anime.findMany({ select: summarySelect, orderBy: [{ createdAt: "desc" }], take: 14 }),
      prisma.anime.findMany({ select: summarySelect, orderBy: [{ popularity: "desc" }], take: 14 }),
      prisma.anime.findMany({
        where: { season, year },
        select: summarySelect,
        orderBy: [{ popularity: "desc" }],
        take: 14,
      }),
      prisma.anime.findMany({
        where: { status: "COMPLETED" },
        select: summarySelect,
        orderBy: [{ popularity: "desc" }],
        take: 14,
      }),
      prisma.anime.findMany({
        where: { score: { not: null } },
        select: summarySelect,
        orderBy: [{ score: "desc" }, { popularity: "desc" }],
        take: 14,
      }),
      prisma.genre.findMany({
        select: { id: true, name: true, slug: true, _count: { select: { anime: true } } },
        orderBy: { name: "asc" },
      }),
    ]);

  const sections: HomeSections = {
    hero: hero.length ? hero.map(mapSummary) : popular.slice(0, 5).map(mapSummary),
    trending: trending.map(mapSummary),
    latestEpisodes: latestEpisodeRows.map((row) => ({
      episode: mapEpisode(row),
      anime: {
        id: row.anime.id,
        slug: row.anime.slug,
        title: row.anime.title,
        poster: row.anime.poster,
        score: row.anime.score,
        year: row.anime.year,
        status: row.anime.status as AnimeStatus,
      },
    })),
    recentlyAdded: recentlyAdded.map(mapSummary),
    popular: popular.map(mapSummary),
    seasonal: seasonalRows.map(mapSummary),
    completed: completed.map(mapSummary),
    topRated: topRated.map(mapSummary),
    genres: genres.map((genre) => ({
      id: genre.id,
      name: genre.name,
      slug: genre.slug,
      animeCount: genre._count.anime,
    })),
    seasonLabel: { year, season },
  };

  await cache().set(CACHE_KEYS.home, sections, CACHE_TTL.home);
  return sections;
}

export const listGenres = reactCache(async (): Promise<GenreDto[]> => {
  const hit = await cache().get<GenreDto[]>(CACHE_KEYS.genres);
  if (hit) return hit;

  const rows = await prisma.genre.findMany({
    select: { id: true, name: true, slug: true, _count: { select: { anime: true } } },
    orderBy: { name: "asc" },
  });
  const genres = rows.map((row) => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    animeCount: row._count.anime,
  }));
  await cache().set(CACHE_KEYS.genres, genres, CACHE_TTL.taxonomy);
  return genres;
});

export async function listStudios(): Promise<Array<{ id: string; name: string; slug: string }>> {
  const hit = await cache().get<Array<{ id: string; name: string; slug: string }>>(CACHE_KEYS.studios);
  if (hit) return hit;

  const rows = await prisma.studio.findMany({
    select: { id: true, name: true, slug: true },
    orderBy: { name: "asc" },
  });
  await cache().set(CACHE_KEYS.studios, rows, CACHE_TTL.taxonomy);
  return rows;
}

export async function listSeasonYears(): Promise<number[]> {
  const rows = await prisma.anime.findMany({
    where: { year: { not: null } },
    select: { year: true },
    distinct: ["year"],
    orderBy: { year: "desc" },
  });
  return rows.map((row) => row.year).filter((year): year is number => year !== null);
}

export interface AnimeAvailability {
  qualities: number[];
  adaptive: boolean;
  subtitleLanguages: Array<{ language: string; label: string }>;
}

/**
 * Aggregates the qualities and subtitle languages actually available across an
 * anime's active episodes. Used on the detail page so users know what to expect
 * before pressing play.
 */
export async function getAnimeAvailability(animeId: string): Promise<AnimeAvailability> {
  const [sources, subtitles] = await Promise.all([
    prisma.videoSource.findMany({
      where: {
        episode: { animeId },
        isActive: true,
        status: { in: ["ACTIVE", "DEGRADED"] },
      },
      select: { quality: true },
      distinct: ["quality"],
      orderBy: { quality: "desc" },
    }),
    prisma.subtitle.findMany({
      where: {
        episode: { animeId },
        isActive: true,
        status: { in: ["ACTIVE", "DEGRADED"] },
      },
      select: { language: true, label: true },
      distinct: ["language"],
      orderBy: { language: "asc" },
    }),
  ]);

  const qualities = sources
    .map((source) => source.quality)
    .filter((quality) => quality > 0)
    .sort((a, b) => b - a);

  return {
    qualities: Array.from(new Set(qualities)),
    adaptive: sources.some((source) => source.quality === 0),
    subtitleLanguages: subtitles,
  };
}

export async function getRelatedAnime(anime: AnimeDetail, limit = 8): Promise<AnimeSummary[]> {
  const genreNames = anime.genres.slice(0, 3);
  if (!genreNames.length) {
    return prisma.anime
      .findMany({
        where: { id: { not: anime.id } },
        select: summarySelect,
        orderBy: [{ popularity: "desc" }],
        take: limit,
      })
      .then((rows) => rows.map(mapSummary));
  }

  const rows = await prisma.anime.findMany({
    where: {
      id: { not: anime.id },
      genres: { some: { name: { in: genreNames } } },
    },
    select: summarySelect,
    orderBy: [{ popularity: "desc" }],
    take: limit,
  });

  return rows.map(mapSummary);
}

/**
 * Lightweight personalized rail: the genres a viewer watches most, excluding
 * titles they already started. Falls back to top-rated titles for new users.
 * This is intentionally a single indexed query; replace with a dedicated
 * recommendation service when collaborative/vector signals are available.
 */
export async function getRecommendationsForUser(
  userId: string,
  limit = 14,
): Promise<AnimeSummary[]> {
  const history = await prisma.watchHistory.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    take: 10,
    select: {
      animeId: true,
      anime: { select: { genres: { select: { name: true } } } },
    },
  });

  const watchedIds = Array.from(new Set(history.map((entry) => entry.animeId)));
  const genreCounts = new Map<string, number>();

  for (const entry of history) {
    for (const genre of entry.anime.genres) {
      genreCounts.set(genre.name, (genreCounts.get(genre.name) ?? 0) + 1);
    }
  }

  const topGenres = Array.from(genreCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([name]) => name);

  if (!topGenres.length) {
    const fallback = await prisma.anime.findMany({
      where: { score: { not: null } },
      select: summarySelect,
      orderBy: [{ score: "desc" }, { popularity: "desc" }],
      take: limit,
    });
    return fallback.map(mapSummary);
  }

  const rows = await prisma.anime.findMany({
    where: {
      id: { notIn: watchedIds.length ? watchedIds : ["__none__"] },
      genres: { some: { name: { in: topGenres } } },
    },
    select: summarySelect,
    orderBy: [{ popularity: "desc" }, { score: { sort: "desc", nulls: "last" } }],
    take: limit,
  });

  return rows.map(mapSummary);
}

export async function getWatchHistoryForUser(
  userId: string,
  limit = 12,
  includeCompleted = false,
): Promise<WatchHistoryEntry[]> {
  const rows = await prisma.watchHistory.findMany({
    where: { userId, ...(includeCompleted ? {} : { completed: false }) },
    orderBy: { updatedAt: "desc" },
    take: limit,
    select: {
      id: true,
      progress: true,
      duration: true,
      completed: true,
      updatedAt: true,
      episode: { select: episodeSelect },
      anime: { select: summarySelect },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    progress: row.progress,
    duration: row.duration,
    completed: row.completed,
    updatedAt: row.updatedAt.toISOString(),
    anime: mapSummary(row.anime),
    episode: mapEpisode(row.episode),
  }));
}

export async function getFavoriteIds(userId: string): Promise<string[]> {
  const rows = await prisma.favorite.findMany({
    where: { userId },
    select: { animeId: true },
    orderBy: { createdAt: "desc" },
  });
  return rows.map((row) => row.animeId);
}

export async function getFavorites(userId: string): Promise<AnimeSummary[]> {
  const rows = await prisma.favorite.findMany({
    where: { userId },
    select: { anime: { select: summarySelect } },
    orderBy: { createdAt: "desc" },
  });
  return rows.map((row) => mapSummary(row.anime));
}

export async function getSitemapEntries(): Promise<Array<{ slug: string; updatedAt: Date }>> {
  const hit = await cache().get<Array<{ slug: string; updatedAt: string }>>(CACHE_KEYS.sitemap);
  if (hit) return hit.map((entry) => ({ slug: entry.slug, updatedAt: new Date(entry.updatedAt) }));

  const rows = await prisma.anime.findMany({
    select: { slug: true, updatedAt: true },
    orderBy: { updatedAt: "desc" },
  });
  await cache().set(
    CACHE_KEYS.sitemap,
    rows.map((row) => ({ slug: row.slug, updatedAt: row.updatedAt.toISOString() })),
    CACHE_TTL.sitemap,
  );
  return rows;
}
