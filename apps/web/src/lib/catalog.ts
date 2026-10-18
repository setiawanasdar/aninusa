import "server-only";

import { cache as reactCache } from "react";
import { prisma } from "@aninusa/database";
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

export interface AnimeAvailability {
  qualities: number[];
  adaptive: boolean;
  subtitleLanguages: Array<{ language: string; label: string }>;
}

export function mapEpisode(row: any): EpisodeDto {
  return {
    id: String(row.id),
    animeId: String(row.animeId),
    number: typeof row.episodeNumber === "number" ? row.episodeNumber : typeof row.number === "number" ? row.number : 1,
    title: row.title ?? `Episode ${row.episodeNumber ?? row.number ?? 1}`,
    description: row.description ?? null,
    duration: row.duration ?? 24,
    thumbnail: row.thumbnail ?? null,
    airDate: row.airDate?.toISOString ? row.airDate.toISOString() : (row.airDate ?? null),
    introStart: row.introStart ?? null,
    introEnd: row.introEnd ?? null,
    outroStart: row.outroStart ?? null,
  };
}

const ANIKOTO_URL = process.env.ANIKOTO_API_URL ?? "https://anikototvapi.vercel.app/api";

interface StoredEpisodeMeta {
  animeSlug: string;
  animeTitle: string;
  animePoster: string | null;
  episodeNumber: number;
  serverIds?: string;
  epId?: string;
}

// In-memory registry to correlate episode IDs with AniKoto server IDs across calls
const episodeMetaStore = new Map<string, StoredEpisodeMeta>();

export function cleanSlug(raw: string): string {
  return raw.replace(/\/ep-\d+.*$/i, "").replace(/^\/+|\/+$/g, "").trim();
}

function mapType(raw?: string): AnimeType {
  const norm = (raw ?? "").toUpperCase();
  if (norm.includes("MOVIE")) return "MOVIE";
  if (norm.includes("OVA")) return "OVA";
  if (norm.includes("ONA")) return "ONA";
  if (norm.includes("SPECIAL")) return "SPECIAL";
  if (norm.includes("MUSIC")) return "MUSIC";
  return "TV";
}

function mapStatus(raw?: string): AnimeStatus {
  const norm = (raw ?? "").toLowerCase();
  if (norm.includes("finished") || norm.includes("completed")) return "COMPLETED";
  if (norm.includes("airing") || norm.includes("ongoing")) return "ONGOING";
  if (norm.includes("upcoming") || norm.includes("not yet")) return "UPCOMING";
  return "COMPLETED";
}

function parseYear(premiered?: string, aired?: string): number | null {
  const text = `${premiered ?? ""} ${aired ?? ""}`;
  const match = text.match(/\b(19\d\d|20\d\d)\b/);
  return match ? parseInt(match[1], 10) : null;
}

function parseSeason(premiered?: string): Season | null {
  const norm = (premiered ?? "").toUpperCase();
  if (norm.includes("WINTER")) return "WINTER";
  if (norm.includes("SPRING")) return "SPRING";
  if (norm.includes("SUMMER")) return "SUMMER";
  if (norm.includes("FALL") || norm.includes("AUTUMN")) return "FALL";
  return null;
}

function parseScore(raw?: string | number | null): number | null {
  if (raw === null || raw === undefined) return null;
  const val = typeof raw === "number" ? raw : parseFloat(String(raw));
  return Number.isNaN(val) || val <= 0 ? null : Math.min(10, Math.max(0, val));
}

function currentSeason(): { year: number; season: Season } {
  const now = new Date();
  const month = now.getUTCMonth() + 1;
  const season: Season = month <= 3 ? "WINTER" : month <= 6 ? "SPRING" : month <= 9 ? "SUMMER" : "FALL";
  return { year: now.getUTCFullYear(), season };
}

async function fetchAniKoto<T>(path: string): Promise<T | null> {
  const url = `${ANIKOTO_URL}${path.startsWith("/") ? "" : "/"}${path}`;
  try {
    const res = await fetch(url, {
      next: { revalidate: 60 },
      headers: {
        Accept: "application/json",
        "User-Agent": "AniNusa/1.0",
      },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch (error) {
    console.error(`AniKoto API error for ${path}:`, error);
    return null;
  }
}

function mapAniKotoItemToSummary(item: any): AnimeSummary {
  const slug = cleanSlug(item.slug || String(item.animeId || ""));
  const score = parseScore(item.rating || item.malScore);
  const totalEpisodes = item.total
    ? parseInt(String(item.total), 10)
    : item.sub
      ? parseInt(String(item.sub), 10)
      : null;

  const genres = Array.isArray(item.genres)
    ? item.genres.filter(Boolean)
    : typeof item.genres === "string"
      ? item.genres.split(",").map((g: string) => g.trim()).filter(Boolean)
      : [];

  return {
    id: slug,
    slug,
    title: item.title || "Anime",
    englishTitle: item.title || null,
    japaneseTitle: item.japaneseTitle || null,
    poster: item.poster || null,
    banner: item.backgroundImage || item.poster || null,
    type: mapType(item.type),
    status: mapStatus(item.status),
    year: item.year || parseYear(item.premiered, item.aired),
    season: parseSeason(item.premiered),
    score,
    popularity: 100,
    totalEpisodes,
    latestEpisode: typeof item.sub === "number" ? item.sub : totalEpisodes,
    duration: 24,
    genres,
    studios: Array.isArray(item.studios) ? item.studios.filter(Boolean) : [],
    updatedAt: new Date().toISOString(),
  };
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

export async function getHomeSections(): Promise<HomeSections> {
  const hit = await cache().get<HomeSections>(CACHE_KEYS.home);
  if (hit) return hit;

  const { year, season } = currentSeason();
  const homeRes = await fetchAniKoto<any>("");

  const trendingRaw = Array.isArray(homeRes?.results?.trending) ? homeRes.results.trending : [];
  const topAiringRaw = Array.isArray(homeRes?.results?.topAiring) ? homeRes.results.topAiring : [];
  const genresRaw = Array.isArray(homeRes?.results?.genres) ? homeRes.results.genres : [];

  const trending = trendingRaw.map(mapAniKotoItemToSummary);
  const popular = topAiringRaw.length > 0 ? topAiringRaw.map(mapAniKotoItemToSummary) : trending;

  // Enhance top candidates with full info (banner & synopsis) for the hero carousel
  const heroCandidates = [...trending, ...popular].slice(0, 5);
  const hero = await Promise.all(
    heroCandidates.map(async (candidate) => {
      try {
        const info = await getAnimeBySlug(candidate.slug);
        if (info) {
          return {
            ...candidate,
            banner: info.banner || candidate.banner,
            score: info.score ?? candidate.score,
            genres: info.genres.length ? info.genres : candidate.genres,
          };
        }
      } catch {
        /* ignore */
      }
      return candidate;
    }),
  );

  const latestEpisodes = trendingRaw
    .filter((item: any) => item.sub && typeof item.sub === "number")
    .map((item: any) => {
      const slug = cleanSlug(item.slug);
      const subNum = item.sub;
      return {
        episode: {
          id: `${slug}:${subNum}`,
          animeId: slug,
          number: subNum,
          title: `Episode ${subNum}`,
          description: null,
          duration: 24,
          thumbnail: item.poster || null,
          airDate: null,
          introStart: null,
          introEnd: null,
          outroStart: null,
        },
        anime: {
          id: slug,
          slug,
          title: item.title,
          poster: item.poster || null,
          score: parseScore(item.rating),
          year: parseYear(item.premiered, item.aired),
          status: "ONGOING" as AnimeStatus,
        },
      };
    });

  const defaultGenres = [
    "Action", "Adventure", "Comedy", "Drama", "Fantasy",
    "Horror", "Mystery", "Romance", "Sci-Fi", "Slice of Life", "Sports", "Supernatural"
  ];
  const genresList = genresRaw.length > 0 ? genresRaw : defaultGenres;
  const genres: GenreDto[] = genresList.map((name: string) => ({
    id: name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
    name,
    slug: name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
    animeCount: 20,
  }));

  const sections: HomeSections = {
    hero: hero.length > 0 ? hero : popular.slice(0, 5),
    trending,
    latestEpisodes,
    recentlyAdded: trending.slice(0, 14),
    popular,
    seasonal: popular.slice(0, 14),
    completed: trending.slice(0, 14),
    topRated: popular.slice(0, 14),
    genres,
    seasonLabel: { year, season },
  };

  await cache().set(CACHE_KEYS.home, sections, CACHE_TTL.home);
  return sections;
}

export async function listAnime(query: CatalogQuery): Promise<Paginated<AnimeSummary>> {
  const page = Math.max(1, query.page ?? 1);
  const perPage = Math.min(60, Math.max(1, query.perPage ?? 24));
  const cacheKey = CACHE_KEYS.catalog(JSON.stringify({ ...query, page, perPage }));

  return cache().get<Paginated<AnimeSummary>>(cacheKey).then(async (hit) => {
    if (hit) return hit;

    let items: AnimeSummary[] = [];
    let total = 0;

    const searchTerm = query.q?.trim() || query.genre || "";

    if (searchTerm) {
      const searchRes = await fetchAniKoto<any>(
        `/search?keyword=${encodeURIComponent(searchTerm)}&page=${page}`,
      );
      const rawList = Array.isArray(searchRes?.results?.data)
        ? searchRes.results.data
        : Array.isArray(searchRes?.results)
          ? searchRes.results
          : [];

      items = rawList.map(mapAniKotoItemToSummary);
      total = searchRes?.pagination?.totalItems || searchRes?.results?.pagination?.totalItems || items.length;
    } else {
      const homeRes = await fetchAniKoto<any>("");
      const combined = [
        ...(Array.isArray(homeRes?.results?.trending) ? homeRes.results.trending : []),
        ...(Array.isArray(homeRes?.results?.topAiring) ? homeRes.results.topAiring : []),
      ];

      const seen = new Set<string>();
      const uniqueItems: any[] = [];
      for (const item of combined) {
        const slug = cleanSlug(item.slug);
        if (!seen.has(slug)) {
          seen.add(slug);
          uniqueItems.push(item);
        }
      }

      const allSummaries = uniqueItems.map(mapAniKotoItemToSummary);
      total = allSummaries.length;
      const skip = pageToSkip(page, perPage);
      items = allSummaries.slice(skip, skip + perPage);
    }

    const result = buildPagination(items, page, perPage, Math.max(total, items.length));
    await cache().set(cacheKey, result, CACHE_TTL.catalog);
    return result;
  });
}

export const getAnimeBySlug = reactCache(async (slug: string): Promise<AnimeDetail | null> => {
  const targetSlug = cleanSlug(slug);
  const cacheKey = CACHE_KEYS.anime(targetSlug);
  const hit = await cache().get<AnimeDetail>(cacheKey);
  if (hit) return hit;

  const res = await fetchAniKoto<any>(`/info?id=${encodeURIComponent(targetSlug)}`);
  let info = res?.results;

  if (!info || !info.title) {
    const searchRes = await fetchAniKoto<any>(
      `/search?keyword=${encodeURIComponent(targetSlug.replace(/-/g, " "))}`,
    );
    const match = searchRes?.results?.data?.[0];
    if (match) {
      const matchSlug = cleanSlug(match.slug);
      const retryRes = await fetchAniKoto<any>(`/info?id=${encodeURIComponent(matchSlug)}`);
      if (retryRes?.results?.title) {
        info = retryRes.results;
      }
    }
  }

  if (!info || !info.title) return null;

  const totalEp =
    typeof info.episodes === "number"
      ? info.episodes
      : parseInt(String(info.episodes || "0"), 10) || 0;

  const summary = mapAniKotoItemToSummary({ ...info, slug: targetSlug });

  const detail: AnimeDetail = {
    ...summary,
    id: targetSlug,
    alternativeTitles: info.altNames
      ? info.altNames.split(";").map((s: string) => s.trim()).filter(Boolean)
      : [],
    synopsis: info.synopsis || null,
    source: "AniKoto",
    airedFrom: info.aired || null,
    airedTo: null,
    malId: info.malScore ? parseScore(info.malScore) : null,
    anilistId: null,
    episodeCount: totalEp,
    createdAt: new Date().toISOString(),
  };

  await cache().set(cacheKey, detail, CACHE_TTL.anime);
  return detail;
});

export async function getAnimeEpisodes(animeIdOrSlug: string): Promise<EpisodeDto[]> {
  const targetSlug = cleanSlug(animeIdOrSlug);
  const cacheKey = `catalog:episodes:${targetSlug}`;
  const hit = await cache().get<EpisodeDto[]>(cacheKey);
  if (hit) return hit;

  const infoRes = await fetchAniKoto<any>(`/info?id=${encodeURIComponent(targetSlug)}`);
  const animeId = infoRes?.results?.animeId ? String(infoRes.results.animeId) : targetSlug;
  const poster = infoRes?.results?.poster || null;
  const animeTitle = infoRes?.results?.title || "Anime";

  const epRes = await fetchAniKoto<any>(`/episodes/${encodeURIComponent(animeId)}`);
  const rawList = Array.isArray(epRes?.results?.episodes)
    ? epRes.results.episodes
    : Array.isArray(epRes?.results)
      ? epRes.results
      : [];

  let episodes: EpisodeDto[] = [];

  if (rawList.length > 0) {
    episodes = rawList.map((ep: any) => {
      const epNum =
        typeof ep.episode_no === "number"
          ? ep.episode_no
          : parseInt(String(ep.episode_no || "1"), 10) || 1;
      const epId = String(ep.id || `${targetSlug}-${epNum}`);

      const meta: StoredEpisodeMeta = {
        animeSlug: targetSlug,
        animeTitle,
        animePoster: poster,
        episodeNumber: epNum,
        serverIds: ep.server_ids,
        epId,
      };
      episodeMetaStore.set(epId, meta);
      episodeMetaStore.set(`${targetSlug}:${epNum}`, meta);

      return {
        id: `${targetSlug}:${epNum}`,
        animeId: targetSlug,
        number: epNum,
        title: ep.title?.trim() || `Episode ${epNum}`,
        description: null,
        duration: 24,
        thumbnail: poster,
        airDate: null,
        introStart: null,
        introEnd: null,
        outroStart: null,
      };
    });
  } else {
    const count =
      typeof infoRes?.results?.episodes === "number"
        ? infoRes.results.episodes
        : parseInt(String(infoRes?.results?.episodes || "0"), 10) || 1;

    episodes = Array.from({ length: count }, (_, i) => {
      const epNum = i + 1;
      return {
        id: `${targetSlug}:${epNum}`,
        animeId: targetSlug,
        number: epNum,
        title: `Episode ${epNum}`,
        description: null,
        duration: 24,
        thumbnail: poster,
        airDate: null,
        introStart: null,
        introEnd: null,
        outroStart: null,
      };
    });
  }

  await cache().set(cacheKey, episodes, CACHE_TTL.playback);
  return episodes;
}

export async function getEpisodeByNumber(animeIdOrSlug: string, episodeNumber: number): Promise<EpisodeDto | null> {
  const episodes = await getAnimeEpisodes(animeIdOrSlug);
  return episodes.find((ep) => ep.number === episodeNumber) ?? null;
}

export function proxiedSubtitleUrl(rawUrl: string): string {
  if (rawUrl.startsWith("/")) return rawUrl;
  return `/api/subtitles?url=${encodeURIComponent(rawUrl)}`;
}

export async function getEpisodePlayback(
  episodeId: string,
  context?: { animeSlug?: string; episodeNumber?: number },
): Promise<EpisodePlayback | null> {
  const cacheKey = CACHE_KEYS.playback(episodeId);
  const hit = await cache().get<EpisodePlayback>(cacheKey);
  if (hit) return hit;

  let animeSlug = context?.animeSlug ? cleanSlug(context.animeSlug) : "";
  let epNumber = context?.episodeNumber ?? 0;
  let serverIds: string | undefined;

  if (episodeId.includes(":")) {
    const parts = episodeId.split(":");
    if (!animeSlug) animeSlug = cleanSlug(parts[0] || "");
    if (!epNumber) epNumber = parseInt(parts[1] || "1", 10);
  }

  const stored =
    episodeMetaStore.get(episodeId) ||
    (animeSlug && epNumber ? episodeMetaStore.get(`${animeSlug}:${epNumber}`) : undefined);

  if (stored) {
    if (!animeSlug) animeSlug = stored.animeSlug;
    if (!epNumber) epNumber = stored.episodeNumber;
    serverIds = stored.serverIds;
  }

  if (!animeSlug) return null;
  if (!epNumber) epNumber = 1;

  const episodes = await getAnimeEpisodes(animeSlug);
  const currentEp = episodes.find((e) => e.number === epNumber) ?? episodes[0];
  if (!currentEp) return null;

  const currentStored =
    episodeMetaStore.get(`${animeSlug}:${epNumber}`) || episodeMetaStore.get(currentEp.id);
  serverIds = serverIds || currentStored?.serverIds;

  if (!serverIds) {
    try {
      const infoRes = await fetchAniKoto<any>(`/info?id=${encodeURIComponent(animeSlug)}`);
      const animeId = infoRes?.results?.animeId ? String(infoRes.results.animeId) : animeSlug;
      const epRes = await fetchAniKoto<any>(`/episodes/${encodeURIComponent(animeId)}`);
      const epList = epRes?.results?.episodes || epRes?.results || [];
      const match = epList.find((e: any) => e.episode_no === epNumber) || epList[0];
      if (match?.server_ids) {
        serverIds = match.server_ids;
      }
    } catch {
      /* ignore */
    }
  }

  const sources: PlaybackSource[] = [];
  let introStart: number | null = null;
  let introEnd: number | null = null;
  let outroStart: number | null = null;

  if (serverIds) {
    try {
      const serverRes = await fetchAniKoto<any>(`/servers?ids=${encodeURIComponent(serverIds)}`);
      const servers = Array.isArray(serverRes?.results) ? serverRes.results : [];

      for (const srv of servers.slice(0, 3)) {
        try {
          const streamRes = await fetchAniKoto<any>(`/stream?id=${encodeURIComponent(srv.link_id)}`);
          if (streamRes?.success && streamRes?.results?.url) {
            const streamUrl = streamRes.results.url;
            sources.push({
              id: srv.link_id,
              quality: 1080,
              format: "EMBED",
              codec: null,
              language: srv.type === "dub" ? "en" : "ja",
              url: streamUrl,
              label: srv.name || "HD",
              status: "ACTIVE",
            });

            if (streamRes.results.skipData?.intro?.length === 2) {
              introStart = streamRes.results.skipData.intro[0];
              introEnd = streamRes.results.skipData.intro[1];
            }
            if (streamRes.results.skipData?.outro?.length === 2) {
              outroStart = streamRes.results.skipData.outro[0];
            }
          }
        } catch {
          /* try next server */
        }
      }
    } catch (err) {
      console.error("Failed to resolve AniKoto servers:", err);
    }
  }

  if (sources.length === 0) {
    sources.push({
      id: `${animeSlug}-${epNumber}`,
      quality: 1080,
      format: "EMBED",
      codec: null,
      language: "ja",
      url: `https://megaplay.buzz/stream/${animeSlug}/${epNumber}`,
      label: "Sumber Utama",
      status: "ACTIVE",
    });
  }

  const anime = await getAnimeBySlug(animeSlug);
  const currentIndex = episodes.findIndex((e) => e.number === currentEp.number);

  const playback: EpisodePlayback = {
    episode: {
      ...currentEp,
      introStart: introStart ?? currentEp.introStart,
      introEnd: introEnd ?? currentEp.introEnd,
      outroStart: outroStart ?? currentEp.outroStart,
    },
    sources,
    subtitles: [],
    anime: {
      id: animeSlug,
      slug: animeSlug,
      title: anime?.title || animeSlug,
      poster: anime?.poster || null,
    },
    previousEpisode:
      currentIndex > 0
        ? { id: episodes[currentIndex - 1]!.id, number: episodes[currentIndex - 1]!.number }
        : null,
    nextEpisode:
      currentIndex >= 0 && currentIndex < episodes.length - 1
        ? { id: episodes[currentIndex + 1]!.id, number: episodes[currentIndex + 1]!.number }
        : null,
  };

  await cache().set(cacheKey, playback, CACHE_TTL.playback);
  return playback;
}

export async function listGenres(): Promise<GenreDto[]> {
  const homeRes = await fetchAniKoto<any>("");
  const genres = homeRes?.results?.genres || [
    "Action", "Adventure", "Comedy", "Drama", "Fantasy",
    "Horror", "Mystery", "Romance", "Sci-Fi", "Slice of Life", "Sports", "Supernatural"
  ];
  return genres.map((name: string) => ({
    id: name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
    name,
    slug: name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
    animeCount: 20,
  }));
}

export async function listStudios(): Promise<Array<{ id: string; name: string; slug: string }>> {
  const defaults = [
    "MAPPA", "ufotable", "Toei Animation", "Bones", "Madhouse",
    "Wit Studio", "A-1 Pictures", "CloverWorks", "Kyoto Animation"
  ];
  return defaults.map((name) => ({
    id: name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
    name,
    slug: name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
  }));
}

export async function listSeasonYears(): Promise<number[]> {
  return [2026, 2025, 2024, 2023, 2022, 2021, 2020];
}

export async function getAnimeAvailability(animeId: string): Promise<AnimeAvailability> {
  return {
    qualities: [1080, 720, 480],
    adaptive: true,
    subtitleLanguages: [
      { language: "id", label: "Indonesian" },
      { language: "en", label: "English" },
    ],
  };
}

export async function getRelatedAnime(anime: AnimeDetail, limit = 8): Promise<AnimeSummary[]> {
  const queryGenre = anime.genres?.[0] || anime.title.split(" ")[0] || "anime";
  const searchRes = await fetchAniKoto<any>(`/search?keyword=${encodeURIComponent(queryGenre)}`);
  const rawList = Array.isArray(searchRes?.results?.data)
    ? searchRes.results.data
    : Array.isArray(searchRes?.results)
      ? searchRes.results
      : [];

  const items = rawList
    .map(mapAniKotoItemToSummary)
    .filter((item: AnimeSummary) => item.slug !== anime.slug)
    .slice(0, limit);

  return items;
}

export async function getRecommendationsForUser(
  _userId: string,
  limit = 14,
): Promise<AnimeSummary[]> {
  const homeRes = await fetchAniKoto<any>("");
  const list = [
    ...(Array.isArray(homeRes?.results?.trending) ? homeRes.results.trending : []),
    ...(Array.isArray(homeRes?.results?.topAiring) ? homeRes.results.topAiring : []),
  ];
  return list.slice(0, limit).map(mapAniKotoItemToSummary);
}

export async function getWatchHistoryForUser(
  userId: string,
  limit = 12,
  includeCompleted = false,
): Promise<WatchHistoryEntry[]> {
  try {
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
        episode: {
          select: {
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
          },
        },
        anime: {
          select: {
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
          },
        },
      },
    });

    return rows.map((row) => ({
      id: row.id,
      progress: row.progress,
      duration: row.duration,
      completed: row.completed,
      updatedAt: row.updatedAt.toISOString(),
      anime: {
        id: row.anime.id,
        slug: row.anime.slug,
        title: row.anime.title,
        englishTitle: row.anime.englishTitle,
        japaneseTitle: row.anime.japaneseTitle,
        poster: row.anime.poster,
        banner: row.anime.banner,
        type: row.anime.type as AnimeType,
        status: row.anime.status as AnimeStatus,
        year: row.anime.year,
        season: row.anime.season as Season | null,
        score: row.anime.score,
        popularity: row.anime.popularity,
        totalEpisodes: row.anime.totalEpisodes,
        latestEpisode: row.anime.latestEpisode,
        duration: row.anime.duration,
        genres: row.anime.genres.map((g) => g.name),
        studios: row.anime.studios.map((s) => s.name),
        updatedAt: row.anime.updatedAt.toISOString(),
      },
      episode: {
        id: row.episode.id,
        animeId: row.episode.animeId,
        number: row.episode.episodeNumber,
        title: row.episode.title,
        description: row.episode.description,
        duration: row.episode.duration,
        thumbnail: row.episode.thumbnail,
        airDate: row.episode.airDate?.toISOString() ?? null,
        introStart: row.episode.introStart,
        introEnd: row.episode.introEnd,
        outroStart: row.episode.outroStart,
      },
    }));
  } catch {
    return [];
  }
}

export async function getFavoriteIds(userId: string): Promise<string[]> {
  try {
    const rows = await prisma.favorite.findMany({
      where: { userId },
      select: { animeId: true },
      orderBy: { createdAt: "desc" },
    });
    return rows.map((row) => row.animeId);
  } catch {
    return [];
  }
}

export async function getFavorites(userId: string): Promise<AnimeSummary[]> {
  try {
    const rows = await prisma.favorite.findMany({
      where: { userId },
      select: {
        anime: {
          select: {
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
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return rows.map((row) => ({
      id: row.anime.id,
      slug: row.anime.slug,
      title: row.anime.title,
      englishTitle: row.anime.englishTitle,
      japaneseTitle: row.anime.japaneseTitle,
      poster: row.anime.poster,
      banner: row.anime.banner,
      type: row.anime.type as AnimeType,
      status: row.anime.status as AnimeStatus,
      year: row.anime.year,
      season: row.anime.season as Season | null,
      score: row.anime.score,
      popularity: row.anime.popularity,
      totalEpisodes: row.anime.totalEpisodes,
      latestEpisode: row.anime.latestEpisode,
      duration: row.anime.duration,
      genres: row.anime.genres.map((g) => g.name),
      studios: row.anime.studios.map((s) => s.name),
      updatedAt: row.anime.updatedAt.toISOString(),
    }));
  } catch {
    return [];
  }
}

export async function getSitemapEntries(): Promise<Array<{ slug: string; updatedAt: Date }>> {
  const homeRes = await fetchAniKoto<any>("");
  const list = [
    ...(Array.isArray(homeRes?.results?.trending) ? homeRes.results.trending : []),
    ...(Array.isArray(homeRes?.results?.topAiring) ? homeRes.results.topAiring : []),
  ];

  const seen = new Set<string>();
  const entries: Array<{ slug: string; updatedAt: Date }> = [];
  for (const item of list) {
    const slug = cleanSlug(item.slug);
    if (!seen.has(slug)) {
      seen.add(slug);
      entries.push({ slug, updatedAt: new Date() });
    }
  }
  return entries;
}
