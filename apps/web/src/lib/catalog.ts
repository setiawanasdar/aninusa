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
import {
  getAnimasuAnime,
  getAnimasuEpisodes,
  getAnimasuLatest,
  getAnimasuPlaybackSources,
  searchAnimasu,
} from "./animasu";

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

const rawEndpoint = process.env.ANIKOTO_API_URL ?? "https://anikototvapi.vercel.app/api";
const ANIKOTO_URL = rawEndpoint.endsWith("/api")
  ? rawEndpoint
  : `${rawEndpoint.replace(/\/+$/, "")}/api`;

function extractList(res: any): any[] {
  if (!res) return [];
  if (Array.isArray(res.results?.data)) return res.results.data;
  if (Array.isArray(res.results)) return res.results;
  if (Array.isArray(res.data)) return res.data;
  return [];
}

function extractTotal(res: any, fallbackCount: number, perPage = 20): number {
  if (!res) return fallbackCount;
  const total =
    res.pagination?.totalItems ||
    res.results?.pagination?.totalItems ||
    res.results?.totalItems ||
    res.totalItems ||
    res.total;
  if (typeof total === "number" && total > 0) return total;

  const pageSize =
    res.pagination?.perPage ||
    res.pagination?.pageSize ||
    res.results?.pagination?.perPage ||
    res.results?.pagination?.pageSize ||
    (Array.isArray(res.results?.data) ? res.results.data.length : null) ||
    (Array.isArray(res.results) ? res.results.length : null) ||
    (Array.isArray(res.data) ? res.data.length : null) ||
    (fallbackCount > 0 ? fallbackCount : perPage);

  const totalPages =
    res.pagination?.totalPages ||
    res.results?.pagination?.totalPages ||
    res.results?.totalPages ||
    res.totalPages;
  if (typeof totalPages === "number" && totalPages > 0) {
    return totalPages * (pageSize > 0 ? pageSize : perPage);
  }
  return fallbackCount;
}

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

function parseSeason(premiered?: string, aired?: string): Season | null {
  const norm = `${premiered ?? ""} ${aired ?? ""}`.toUpperCase();
  if (norm.includes("WINTER")) return "WINTER";
  if (norm.includes("SPRING")) return "SPRING";
  if (norm.includes("SUMMER")) return "SUMMER";
  if (norm.includes("FALL") || norm.includes("AUTUMN")) return "FALL";

  if (/JAN|FEB|MAR|\b0[1-3]\b/.test(norm)) return "WINTER";
  if (/APR|MAY|JUN|\b0[4-6]\b/.test(norm)) return "SPRING";
  if (/JUL|AUG|SEP\s*([1-9]|1[0-9]|20)\b|\b0[7-8]\b/.test(norm)) return "SUMMER";
  if (/OCT|NOV|DEC|SEP\s*(2[1-9]|30)\b|\b(10|11|12)\b/.test(norm)) return "FALL";

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

async function fetchAniKoto<T>(
  path: string,
  options?: { revalidate?: number; timeoutMs?: number },
): Promise<T | null> {
  const url = `${ANIKOTO_URL}${path.startsWith("/") ? "" : "/"}${path}`;
  try {
    const res = await fetch(url, {
      next: { revalidate: options?.revalidate ?? 300 },
      signal: AbortSignal.timeout(options?.timeoutMs ?? 4000),
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

  const rawPoster = typeof item.poster === "string" ? item.poster.trim() : "";
  const poster = rawPoster.startsWith("http") ? rawPoster : null;

  const rawBg = typeof item.backgroundImage === "string" ? item.backgroundImage.trim() : "";
  const banner = rawBg.startsWith("http") ? rawBg : poster;

  return {
    id: slug,
    slug,
    title: item.title || "Anime",
    englishTitle: item.title || null,
    japaneseTitle: item.japaneseTitle || null,
    poster,
    banner,
    type: mapType(item.type),
    status: mapStatus(item.status),
    year: item.year || parseYear(item.premiered, item.aired),
    season: parseSeason(item.premiered, item.aired),
    score,
    popularity: 100,
    totalEpisodes,
    latestEpisode: typeof item.sub === "number" ? item.sub : totalEpisodes,
    duration: 24,
    genres,
    studios: Array.isArray(item.studios) ? item.studios.filter(Boolean) : [],
    updatedAt: new Date().toISOString(),
    synopsis: item.synopsis || item.description || null,
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
  subIndoLatest: AnimeSummary[];
  genres: GenreDto[];
  seasonLabel: { year: number; season: Season } | null;
}

export async function getHomeSections(): Promise<HomeSections> {
  const hit = await cache().get<HomeSections>(CACHE_KEYS.home);
  if (hit) return hit;

  const { year, season } = currentSeason();

  const [homeRes, popularRes, latestRes, newReleaseRes, completedRes, subIndoLatest] = await Promise.all([
    fetchAniKoto<any>(""),
    fetchAniKoto<any>("/most-popular?page=1"),
    fetchAniKoto<any>("/latest-updated?page=1"),
    fetchAniKoto<any>("/new-release?page=1"),
    fetchAniKoto<any>("/filter?status=finished-airing&page=1"),
    getAnimasuLatest(1).catch(() => [] as AnimeSummary[]),
  ]);

  const trendingRaw = Array.isArray(homeRes?.results?.trending) ? homeRes.results.trending : [];
  const popularRaw = extractList(popularRes);
  const latestRaw = extractList(latestRes);
  const newReleaseRaw = extractList(newReleaseRes);
  const completedRaw = extractList(completedRes);

  const trending =
    trendingRaw.length > 0
      ? trendingRaw.map(mapAniKotoItemToSummary)
      : popularRaw.slice(0, 14).map(mapAniKotoItemToSummary);

  const popular =
    popularRaw.length > 0
      ? popularRaw.map(mapAniKotoItemToSummary)
      : (Array.isArray(homeRes?.results?.topAiring) ? homeRes.results.topAiring : trendingRaw).map(
          mapAniKotoItemToSummary,
        );

  const recentlyAdded =
    newReleaseRaw.length > 0
      ? newReleaseRaw.map(mapAniKotoItemToSummary)
      : trending.slice(0, 14);

  const completed =
    completedRaw.length > 0
      ? completedRaw.map(mapAniKotoItemToSummary)
      : trending.slice(0, 14);

  const topRated =
    Array.isArray(homeRes?.results?.topAiring) && homeRes.results.topAiring.length > 0
      ? homeRes.results.topAiring.map(mapAniKotoItemToSummary)
      : popular.slice(0, 14);

  const seasonal = popular.slice(0, 14);

  // Enhance top candidates with full info (banner & synopsis) for the hero carousel
  // De-duplicate by slug to prevent double-fetching identical anime in trending and popular
  const seenHeroSlugs = new Set<string>();
  const heroCandidates: AnimeSummary[] = [];
  for (const candidate of [...trending, ...popular]) {
    if (!seenHeroSlugs.has(candidate.slug)) {
      seenHeroSlugs.add(candidate.slug);
      heroCandidates.push(candidate);
      if (heroCandidates.length >= 5) break;
    }
  }

  const hero = await Promise.all(
    heroCandidates.map(async (candidate) => {
      try {
        const info = await getAnimeBySlug(candidate.slug);
        if (info) {
          const rawInfoBanner = typeof info.banner === "string" ? info.banner.trim() : "";
          const validBanner = rawInfoBanner.startsWith("http")
            ? rawInfoBanner
            : candidate.banner && candidate.banner.startsWith("http")
              ? candidate.banner
              : candidate.poster;

          return {
            ...candidate,
            banner: validBanner,
            score: info.score ?? candidate.score,
            genres: info.genres.length ? info.genres : candidate.genres,
            synopsis: info.synopsis || null,
          };
        }
      } catch {
        /* ignore */
      }
      return candidate;
    }),
  );

  const latestEpisodeSource = latestRaw.length > 0 ? latestRaw : trendingRaw;
  const latestEpisodes = latestEpisodeSource.slice(0, 14).map((item: any) => {
    const slug = cleanSlug(item.slug || "");
    const subNum =
      typeof item.sub === "number" && item.sub > 0
        ? item.sub
        : parseInt(String(item.sub || item.episode || "1"), 10) || 1;
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
        title: item.title || "Anime",
        poster: item.poster || null,
        score: parseScore(item.rating),
        year: parseYear(item.premiered, item.aired),
        status: "ONGOING" as AnimeStatus,
      },
    };
  });

  const genres = await listGenres();

  const sections: HomeSections = {
    hero: hero.length > 0 ? hero : popular.slice(0, 5),
    trending,
    latestEpisodes,
    recentlyAdded,
    popular,
    seasonal,
    completed,
    topRated,
    subIndoLatest,
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

    if (query.q && query.q.trim()) {
      const q = query.q.trim();
      const [resAniKoto, animasuResults] = await Promise.all([
        fetchAniKoto<any>(`/search?keyword=${encodeURIComponent(q)}&page=${page}`),
        page === 1 ? searchAnimasu(q).catch(() => [] as AnimeSummary[]) : Promise.resolve([] as AnimeSummary[]),
      ]);
      const aniKotoList = extractList(resAniKoto).map(mapAniKotoItemToSummary);

      const seenSlugs = new Set<string>();
      const combined: AnimeSummary[] = [];

      for (const item of [...animasuResults, ...aniKotoList]) {
        if (!seenSlugs.has(item.slug)) {
          seenSlugs.add(item.slug);
          combined.push(item);
        }
      }

      items = combined;
      total = extractTotal(resAniKoto, items.length, perPage) + animasuResults.length;
    } else if (query.season) {
      const targetSeason = query.season.toUpperCase() as Season;
      const targetYear = query.year ?? new Date().getFullYear();
      const seasonCacheKey = `catalog:season:${targetYear}:${targetSeason}:p${page}:l${perPage}`;
      const hitSeason = await cache().get<Paginated<AnimeSummary>>(seasonCacheKey);
      if (hitSeason) return hitSeason;

      const [resPage1, resPage2] = await Promise.all([
        fetchAniKoto<any>(`/filter?year=${targetYear}&page=${page}`),
        fetchAniKoto<any>(`/filter?year=${targetYear}&page=${page + 1}`),
      ]);

      const pool = [
        ...extractList(resPage1).map(mapAniKotoItemToSummary),
        ...extractList(resPage2).map(mapAniKotoItemToSummary),
      ];

      const resolved = await Promise.all(
        pool.map(async (item) => {
          if (item.season) return item;
          try {
            const info = await getAnimeBySlug(item.slug);
            if (info?.season) return { ...item, season: info.season };
          } catch {
            /* ignore */
          }
          return item;
        }),
      );

      const matching = resolved.filter((item) => item.season === targetSeason);
      const unique = Array.from(new Map(matching.map((m) => [m.slug, m])).values());

      items = unique.slice(0, perPage);
      total = Math.max(items.length, unique.length);

      const result = buildPagination(items, page, perPage, total);
      await cache().set(seasonCacheKey, result, CACHE_TTL.catalog);
      await cache().set(cacheKey, result, CACHE_TTL.catalog);
      return result;
    } else if (query.genre || query.year || query.status || query.type) {
      if (query.genre && !query.year && !query.status && !query.type) {
        const genreSlug = query.genre.trim().toLowerCase();
        const res = await fetchAniKoto<any>(
          `/genre/${encodeURIComponent(genreSlug)}?page=${page}`,
        );
        items = extractList(res).map(mapAniKotoItemToSummary);
        total = extractTotal(res, items.length, perPage);
      } else {
        const params = new URLSearchParams();
        params.set("page", String(page));
        if (query.genre) params.set("genre", query.genre.trim().toLowerCase());
        if (query.year) params.set("year", String(query.year));
        if (query.status === "COMPLETED") params.set("status", "finished-airing");
        else if (query.status === "ONGOING") params.set("status", "currently-airing");
        else if (query.status === "UPCOMING") params.set("status", "not-yet-aired");

        if (query.type) {
          const typeLower = query.type.toLowerCase();
          if (["tv", "movie", "ova", "ona", "special", "music"].includes(typeLower)) {
            params.set("type", typeLower);
          }
        }

        const res = await fetchAniKoto<any>(`/filter?${params.toString()}`);
        items = extractList(res).map(mapAniKotoItemToSummary);
        total = extractTotal(res, items.length, perPage);
      }
    } else if (query.sort === "newest" || query.sort === "updated") {
      const res = await fetchAniKoto<any>(
        `/latest-updated?page=${page}`,
      );
      items = extractList(res).map(mapAniKotoItemToSummary);
      total = extractTotal(res, items.length, perPage);
    } else {
      const res = await fetchAniKoto<any>(
        `/most-popular?page=${page}`,
      );
      const list = extractList(res);
      if (list.length > 0) {
        items = list.map(mapAniKotoItemToSummary);
        total = extractTotal(res, items.length, perPage);
      } else {
        const homeRes = await fetchAniKoto<any>("");
        const combined = [
          ...(Array.isArray(homeRes?.results?.trending) ? homeRes.results.trending : []),
          ...(Array.isArray(homeRes?.results?.topAiring) ? homeRes.results.topAiring : []),
        ];
        items = combined.map(mapAniKotoItemToSummary);
        total = items.length;
      }
    }

    const sliced = items.length > perPage ? items.slice(0, perPage) : items;
    const result = buildPagination(sliced, page, perPage, Math.max(total, items.length));
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

  if (!info || !info.title) {
    const animasuDetail = await getAnimasuAnime(targetSlug);
    if (animasuDetail) {
      await cache().set(cacheKey, animasuDetail, CACHE_TTL.anime);
      return animasuDetail;
    }
    return null;
  }

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

  let episodes: EpisodeDto[] = [];
  try {
    const cachedAnime = await cache().get<AnimeDetail>(CACHE_KEYS.anime(targetSlug));
    let animeId = cachedAnime?.id || targetSlug;
    let poster = cachedAnime?.poster || null;
    let animeTitle = cachedAnime?.title || "Anime";
    let hasInfo = Boolean(cachedAnime?.title);
    let infoRes: any = null;

    if (!hasInfo) {
      infoRes = await fetchAniKoto<any>(`/info?id=${encodeURIComponent(targetSlug)}`);
      if (infoRes?.results?.title) {
        hasInfo = true;
        animeId = infoRes.results.animeId ? String(infoRes.results.animeId) : targetSlug;
        poster = infoRes.results.poster || poster;
        animeTitle = infoRes.results.title || animeTitle;
      }
    }

    if (hasInfo) {
      const epRes = await fetchAniKoto<any>(`/episodes/${encodeURIComponent(animeId)}`);
      const rawList = Array.isArray(epRes?.results?.episodes)
        ? epRes.results.episodes
        : Array.isArray(epRes?.results)
          ? epRes.results
          : [];

      if (rawList.length > 0) {
        episodes = rawList.map((ep: any) => {
          const epNum =
            typeof ep.episode_no === "number"
              ? ep.episode_no
              : parseFloat(String(ep.episode_no || "1")) || 1;
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
        const totalEp = cachedAnime?.episodeCount || infoRes?.results?.episodes;
        const count =
          typeof totalEp === "number"
            ? totalEp
            : parseInt(String(totalEp || "0"), 10) || 1;

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
    }
  } catch {
    /* ignore */
  }

  // Fallback to Animasu if AniKoto returned no episodes
  if (episodes.length === 0) {
    const animasuEps = await getAnimasuEpisodes(targetSlug);
    if (animasuEps.length > 0) {
      episodes = animasuEps;
    }
  }

  await cache().set(cacheKey, episodes, CACHE_TTL.anime);
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

export const ENABLE_EXPERIMENTAL_SUB_INDO =
  process.env.ENABLE_EXPERIMENTAL_SUB_INDO !== "false";

export function translatedSubtitleUrl(rawUrl: string, lang = "id"): string {
  if (rawUrl.startsWith("/api/subtitles/translate")) return rawUrl;
  return `/api/subtitles/translate?url=${encodeURIComponent(rawUrl)}&lang=${encodeURIComponent(lang)}`;
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
    if (!epNumber) epNumber = parseFloat(parts[1] || "1") || 1;
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
      const match =
        epList.find((e: any) => parseFloat(String(e.episode_no ?? "")) === epNumber) || epList[0];
      if (match?.server_ids) {
        serverIds = match.server_ids;
      }
    } catch {
      /* ignore */
    }
  }

  const anime = await getAnimeBySlug(animeSlug);

  const sources: PlaybackSource[] = [];
  const rawSubtitles: SubtitleTrack[] = [];
  let introStart: number | null = null;
  let introEnd: number | null = null;
  let outroStart: number | null = null;

  // Parallel resolution for AniKoto stream servers
  const resolveAniKoto = async () => {
    if (!serverIds) return null;
    try {
      const serverRes = await fetchAniKoto<any>(`/servers?ids=${encodeURIComponent(serverIds)}`);
      const servers = Array.isArray(serverRes?.results) ? serverRes.results : [];

      const streamTasks = servers.slice(0, 3).map(async (srv: any) => {
        try {
          const streamRes = await fetchAniKoto<any>(`/stream?id=${encodeURIComponent(srv.link_id)}`);
          return { srv, streamRes };
        } catch {
          return null;
        }
      });

      const results = await Promise.all(streamTasks);
      const aniSources: PlaybackSource[] = [];
      const aniSubs: SubtitleTrack[] = [];
      let aniIntroStart: number | null = null;
      let aniIntroEnd: number | null = null;
      let aniOutroStart: number | null = null;

      for (const res of results) {
        if (!res || !res.streamRes?.success || !res.streamRes?.results?.url) continue;
        const { srv, streamRes } = res;
        const streamUrl = streamRes.results.url;
        aniSources.push({
          id: srv.link_id,
          quality: 1080,
          format: "EMBED",
          codec: null,
          language: srv.type === "dub" ? "en" : "ja",
          url: streamUrl,
          label: srv.name ? `${srv.name} (Sub Eng)` : "Server HD (Sub Eng)",
          status: "ACTIVE",
        });

        if (streamRes.results.skipData?.intro?.length === 2 && !aniIntroStart) {
          aniIntroStart = streamRes.results.skipData.intro[0];
          aniIntroEnd = streamRes.results.skipData.intro[1];
        }
        if (streamRes.results.skipData?.outro?.length === 2 && !aniOutroStart) {
          aniOutroStart = streamRes.results.skipData.outro[0];
        }

        const tracks =
          streamRes.results.tracks ||
          streamRes.results.subtitles ||
          (Array.isArray(streamRes.tracks) ? streamRes.tracks : []);

        if (Array.isArray(tracks)) {
          for (const trk of tracks) {
            const trkUrl = trk.file || trk.url;
            if (!trkUrl || trk.kind === "thumbnails") continue;
            const lang = (trk.language || trk.lang || "en").toLowerCase();
            const label = trk.label || (lang.startsWith("en") ? "English" : lang);
            if (!aniSubs.some((s) => s.url === trkUrl)) {
              aniSubs.push({
                id: `sub-${srv.link_id}-${aniSubs.length}`,
                language: lang,
                label,
                url: proxiedSubtitleUrl(trkUrl),
                format: "VTT",
                isDefault: Boolean(trk.default),
                status: "ACTIVE",
              });
            }
          }
        }
      }

      return {
        sources: aniSources,
        subtitles: aniSubs,
        introStart: aniIntroStart,
        introEnd: aniIntroEnd,
        outroStart: aniOutroStart,
      };
    } catch (err) {
      console.error("Failed to resolve AniKoto servers:", err);
      return null;
    }
  };

  const resolveAnimasu = async () => {
    try {
      return await getAnimasuPlaybackSources({
        animeSlug,
        animeTitle: anime?.title || currentStored?.animeTitle,
        altTitles: anime?.alternativeTitles,
        episodeNumber: epNumber,
      });
    } catch (err) {
      console.error("Failed to resolve Animasu Sub Indo servers:", err);
      return [] as PlaybackSource[];
    }
  };

  // Run AniKoto stream fetching and Animasu resolution concurrently!
  const [aniKotoResult, animasuSources] = await Promise.all([
    resolveAniKoto(),
    resolveAnimasu(),
  ]);

  if (animasuSources && animasuSources.length > 0) {
    sources.push(...animasuSources);
  }
  if (aniKotoResult) {
    sources.push(...aniKotoResult.sources);
    rawSubtitles.push(...aniKotoResult.subtitles);
    if (aniKotoResult.introStart !== null) introStart = aniKotoResult.introStart;
    if (aniKotoResult.introEnd !== null) introEnd = aniKotoResult.introEnd;
    if (aniKotoResult.outroStart !== null) outroStart = aniKotoResult.outroStart;
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
  const currentIndex = episodes.findIndex((e) => e.number === currentEp.number);

  // Check Prisma database for active subtitles associated with this episode
  if (rawSubtitles.length === 0) {
    try {
      const dbSubtitles = await prisma.subtitle.findMany({
        where: {
          episode: {
            anime: { slug: animeSlug },
            episodeNumber: epNumber,
          },
          status: "ACTIVE",
        },
        select: { id: true, language: true, label: true, url: true, isDefault: true, format: true },
      });
      for (const sub of dbSubtitles) {
        rawSubtitles.push({
          id: sub.id,
          language: sub.language,
          label: sub.label,
          url: sub.url,
          format: sub.format as "VTT",
          isDefault: sub.isDefault,
          status: "ACTIVE",
        });
      }
    } catch {
      /* ignore DB lookup */
    }
  }

  const subtitles: SubtitleTrack[] = [...rawSubtitles];

  if (ENABLE_EXPERIMENTAL_SUB_INDO && rawSubtitles.length > 0) {
    const hasIndo = rawSubtitles.some((sub) => sub.language.toLowerCase().startsWith("id"));
    if (!hasIndo) {
      const sourceSub =
        rawSubtitles.find((sub) => sub.isDefault) ||
        rawSubtitles.find((sub) => sub.language.toLowerCase().startsWith("en")) ||
        rawSubtitles[0];

      if (sourceSub) {
        subtitles.unshift({
          id: `${sourceSub.id}-id-auto`,
          language: "id",
          label: "Indonesia (Auto Terjemahan)",
          url: translatedSubtitleUrl(sourceSub.url, "id"),
          format: "VTT",
          isDefault: true,
          status: "ACTIVE",
        });
      }
    }
  }

  const playback: EpisodePlayback = {
    episode: {
      ...currentEp,
      introStart: introStart ?? currentEp.introStart,
      introEnd: introEnd ?? currentEp.introEnd,
      outroStart: outroStart ?? currentEp.outroStart,
    },
    sources,
    subtitles,
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
  const GENRE_LIST = [
    { name: "Action", slug: "action" },
    { name: "Adventure", slug: "adventure" },
    { name: "Comedy", slug: "comedy" },
    { name: "Drama", slug: "drama" },
    { name: "Fantasy", slug: "fantasy" },
    { name: "Romance", slug: "romance" },
    { name: "Sci-Fi", slug: "sci-fi" },
    { name: "Slice of Life", slug: "slice-of-life" },
    { name: "Supernatural", slug: "supernatural" },
    { name: "Mystery", slug: "mystery" },
    { name: "Horror", slug: "horror" },
    { name: "Isekai", slug: "isekai" },
    { name: "Mecha", slug: "mecha" },
    { name: "Sports", slug: "sports" },
    { name: "Shounen", slug: "shounen" },
    { name: "Seinen", slug: "seinen" },
    { name: "Psychological", slug: "psychological" },
    { name: "Thriller", slug: "thriller" },
    { name: "Martial Arts", slug: "martial-arts" },
    { name: "School", slug: "school" },
    { name: "Magic", slug: "magic" },
    { name: "Super Power", slug: "super-power" },
    { name: "Historical", slug: "historical" },
    { name: "Military", slug: "military" },
    { name: "Demons", slug: "demons" },
    { name: "Vampire", slug: "vampire" },
    { name: "Music", slug: "music" },
    { name: "Parody", slug: "parody" },
    { name: "Game", slug: "game" },
    { name: "Harem", slug: "harem" },
    { name: "Ecchi", slug: "ecchi" },
    { name: "Erotica", slug: "erotica" },
    { name: "Hentai", slug: "hentai" },
  ];

  return GENRE_LIST.map((g) => ({
    id: g.slug,
    name: g.name,
    slug: g.slug,
    animeCount: 30,
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
  const currentYear = new Date().getFullYear();
  return Array.from({ length: 8 }, (_, i) => currentYear - i);
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
  const cacheKey = `catalog:related:${anime.slug}:${limit}`;
  const hit = await cache().get<AnimeSummary[]>(cacheKey);
  if (hit) return hit;

  const queryGenre = anime.genres?.[0] || anime.title.split(" ")[0] || "anime";
  const searchRes = await fetchAniKoto<any>(`/search?keyword=${encodeURIComponent(queryGenre)}`, {
    timeoutMs: 2500,
  });
  const rawList = Array.isArray(searchRes?.results?.data)
    ? searchRes.results.data
    : Array.isArray(searchRes?.results)
      ? searchRes.results
      : [];

  const items = rawList
    .map(mapAniKotoItemToSummary)
    .filter((item: AnimeSummary) => item.slug !== anime.slug)
    .slice(0, limit);

  await cache().set(cacheKey, items, CACHE_TTL.catalog);
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
      select: { animeId: true, anime: { select: { slug: true } } },
      orderBy: { createdAt: "desc" },
    });
    const ids = new Set<string>();
    for (const row of rows) {
      if (row.animeId) ids.add(row.animeId);
      if (row.anime?.slug) ids.add(row.anime.slug);
    }
    return Array.from(ids);
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
