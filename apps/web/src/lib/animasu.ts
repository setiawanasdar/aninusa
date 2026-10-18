import type {
  AnimeDetail,
  AnimeStatus,
  AnimeSummary,
  AnimeType,
  EpisodeDto,
  PlaybackSource,
  Season,
} from "@aninusa/types";
import { cache, CACHE_KEYS, CACHE_TTL } from "./cache";

const rawEndpoint = process.env.ANIMASU_API_URL ?? "https://animasu-api-lilac.vercel.app/api";
export const ANIMASU_URL = rawEndpoint.endsWith("/api")
  ? rawEndpoint
  : `${rawEndpoint.replace(/\/+$/, "")}/api`;

export interface AnimasuListItem {
  title: string;
  slug: string;
  poster: string;
  type?: string;
  latestEpisode?: string;
  status?: string;
  subStatus?: string;
  url?: string;
}

export interface AnimasuAnimeDetailData {
  title: string;
  alterTitle?: string;
  slug: string;
  poster: string;
  rating?: string;
  synopsis?: string;
  genres?: string[];
  status?: string;
  type?: string;
  totalEpisodes?: string;
  duration?: string;
  studio?: string;
  releaseDate?: string;
  episodeList?: Array<{
    title: string;
    episodeSlug: string;
    url: string;
  }>;
}

export interface AnimasuServerItem {
  label: string;
  iframeUrl: string;
}

export interface AnimasuWatchResult {
  title: string;
  episodeSlug: string;
  streamUrl?: string;
  defaultIframe?: string;
  mirrors?: AnimasuServerItem[];
  servers?: AnimasuServerItem[];
  navigation?: {
    prevEpisodeSlug: string | null;
    nextEpisodeSlug: string | null;
    animeSlug: string;
  };
}

export async function fetchAnimasu<T>(path: string, options?: { revalidate?: number; timeoutMs?: number }): Promise<T | null> {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  const url = `${ANIMASU_URL}${cleanPath}`;
  try {
    const res = await fetch(url, {
      next: { revalidate: options?.revalidate ?? 300 },
      signal: AbortSignal.timeout(options?.timeoutMs ?? 6000),
      headers: {
        Accept: "application/json",
        "User-Agent": "AniNusa/1.0",
      },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch (error) {
    console.error(`Animasu API error for ${path}:`, error);
    return null;
  }
}

function mapAnimasuType(raw?: string): AnimeType {
  const norm = (raw ?? "").toUpperCase();
  if (norm.includes("MOVIE")) return "MOVIE";
  if (norm.includes("OVA")) return "OVA";
  if (norm.includes("ONA")) return "ONA";
  if (norm.includes("SPECIAL")) return "SPECIAL";
  if (norm.includes("MUSIC")) return "MUSIC";
  return "TV";
}

function mapAnimasuStatus(raw?: string): AnimeStatus {
  const norm = (raw ?? "").toLowerCase();
  if (norm.includes("selesai") || norm.includes("finished") || norm.includes("completed") || norm.includes("✓")) return "COMPLETED";
  if (norm.includes("tayang") || norm.includes("airing") || norm.includes("ongoing") || norm.includes("🔥")) return "ONGOING";
  if (norm.includes("segera") || norm.includes("upcoming") || norm.includes("not yet")) return "UPCOMING";
  return "COMPLETED";
}

function parseScore(raw?: string | number | null): number | null {
  if (raw === null || raw === undefined) return null;
  const val = typeof raw === "number" ? raw : parseFloat(String(raw));
  return Number.isNaN(val) || val <= 0 ? null : Math.min(10, Math.max(0, val));
}

function parseQuality(label: string): number {
  const m = label.match(/(\d+)p/i);
  if (m) return parseInt(m[1], 10);
  return 720;
}

export function cleanAnimasuTitle(raw: string): string {
  return raw
    .replace(/\s*Sub\s+Indo(?:nesia)?/i, "")
    .replace(/\s*\[.*?\]/g, "")
    .trim();
}

export function cleanIframeUrl(raw: string): string {
  if (!raw) return "";
  return raw
    .replace(/&amp;/g, "&")
    .replace(/&#038;/g, "&")
    .replace(/&#38;/g, "&")
    .trim();
}

export function mapAnimasuItemToSummary(item: AnimasuListItem): AnimeSummary {
  const cleanTitle = cleanAnimasuTitle(item.title);
  const epMatch = (item.latestEpisode || "").match(/(\d+)/);
  const epCount = epMatch ? parseInt(epMatch[1], 10) : null;
  const rawPoster = item.poster?.trim() || "";
  const poster = rawPoster.startsWith("http") ? rawPoster : null;

  return {
    id: item.slug,
    slug: item.slug,
    title: cleanTitle,
    englishTitle: cleanTitle,
    japaneseTitle: null,
    poster,
    banner: poster,
    type: mapAnimasuType(item.type),
    status: mapAnimasuStatus(item.status || item.subStatus),
    year: null,
    season: null,
    score: null,
    popularity: 100,
    totalEpisodes: epCount,
    latestEpisode: epCount,
    duration: 24,
    genres: [],
    studios: [],
    updatedAt: new Date().toISOString(),
    source: "Animasu (Sub Indo)",
  };
}

export function mapAnimasuDetailToAnime(data: AnimasuAnimeDetailData): AnimeDetail {
  const cleanTitle = cleanAnimasuTitle(data.title);
  const totalEp = data.episodeList?.length || parseInt(data.totalEpisodes || "0", 10) || null;
  const rawPoster = data.poster?.trim() || "";
  const poster = rawPoster.startsWith("http") ? rawPoster : null;
  const yearMatch = (data.releaseDate || "").match(/\b(19\d\d|20\d\d)\b/);
  const year = yearMatch ? parseInt(yearMatch[1], 10) : null;
  const score = parseScore(data.rating);

  const durationMatch = (data.duration || "").match(/(\d+)/);
  const duration = durationMatch ? parseInt(durationMatch[1], 10) : 24;

  const altTitles: string[] = [];
  if (data.alterTitle?.trim()) {
    altTitles.push(data.alterTitle.trim());
  }

  return {
    id: data.slug,
    slug: data.slug,
    title: cleanTitle,
    englishTitle: cleanTitle,
    japaneseTitle: null,
    alternativeTitles: altTitles,
    poster,
    banner: poster,
    type: mapAnimasuType(data.type),
    status: mapAnimasuStatus(data.status || (data as any).subStatus),
    year,
    season: null,
    score,
    popularity: 100,
    totalEpisodes: totalEp,
    latestEpisode: data.episodeList?.length ? data.episodeList.length : totalEp,
    duration,
    genres: Array.isArray(data.genres) ? data.genres.filter(Boolean) : [],
    studios: data.studio ? [data.studio.trim()] : [],
    synopsis: data.synopsis || null,
    source: "Animasu (Sub Indo)",
    airedFrom: data.releaseDate || null,
    airedTo: null,
    malId: null,
    anilistId: null,
    episodeCount: totalEp ?? 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export async function getAnimasuLatest(page = 1): Promise<AnimeSummary[]> {
  const cacheKey = `animasu:latest:${page}`;
  const hit = await cache().get<AnimeSummary[]>(cacheKey);
  if (hit) return hit;

  const res = await fetchAnimasu<{ success: boolean; results: AnimasuListItem[] }>(
    `/latest?page=${page}`,
  );
  const list = Array.isArray(res?.results) ? res.results : [];
  const summaries = list.map(mapAnimasuItemToSummary);

  await cache().set(cacheKey, summaries, CACHE_TTL.catalog);
  return summaries;
}

export async function searchAnimasu(keyword: string): Promise<AnimeSummary[]> {
  const trimmed = keyword.trim();
  if (!trimmed) return [];

  const cacheKey = `animasu:search:${trimmed.toLowerCase()}`;
  const hit = await cache().get<AnimeSummary[]>(cacheKey);
  if (hit) return hit;

  const res = await fetchAnimasu<{ success: boolean; results: AnimasuListItem[] }>(
    `/search?keyword=${encodeURIComponent(trimmed)}`,
  );
  const list = Array.isArray(res?.results) ? res.results : [];
  const summaries = list.map(mapAnimasuItemToSummary);

  await cache().set(cacheKey, summaries, CACHE_TTL.catalog);
  return summaries;
}

export async function getAnimasuAnime(slug: string): Promise<AnimeDetail | null> {
  const clean = slug.replace(/^animasu:/i, "").trim();
  const cacheKey = `animasu:anime:${clean}`;
  const hit = await cache().get<AnimeDetail>(cacheKey);
  if (hit) return hit;

  const res = await fetchAnimasu<{ success: boolean; results: AnimasuAnimeDetailData }>(
    `/anime/${encodeURIComponent(clean)}`,
  );
  if (!res?.success || !res?.results?.title) return null;

  const detail = mapAnimasuDetailToAnime(res.results);
  await cache().set(cacheKey, detail, CACHE_TTL.anime);
  return detail;
}

export async function getAnimasuEpisodes(slug: string): Promise<EpisodeDto[]> {
  const clean = slug.replace(/^animasu:/i, "").trim();
  const cacheKey = `animasu:episodes:${clean}`;
  const hit = await cache().get<EpisodeDto[]>(cacheKey);
  if (hit) return hit;

  const res = await fetchAnimasu<{ success: boolean; results: AnimasuAnimeDetailData }>(
    `/anime/${encodeURIComponent(clean)}`,
  );
  const rawList = res?.results?.episodeList || [];
  if (!rawList.length) return [];

  const poster = res?.results?.poster || null;

  // Animasu lists episodes newest-first; we reverse so Episode 1 is first
  const reversed = [...rawList].reverse();
  const episodes: EpisodeDto[] = reversed.map((ep, idx) => {
    const slugMatch = ep.episodeSlug.match(/-episode-(\d+(?:\.\d+)?)(?:-|$)/i);
    const titleMatch = ep.title.match(/(?:episode|ep\.?)\s*(\d+(?:\.\d+)?)/i);
    const num = slugMatch ? parseFloat(slugMatch[1]) : titleMatch ? parseFloat(titleMatch[1]) : idx + 1;

    return {
      id: `${clean}:${num}`,
      animeId: clean,
      number: num,
      title: ep.title?.trim() || `Episode ${num}`,
      description: null,
      duration: 24,
      thumbnail: poster,
      airDate: null,
      introStart: null,
      introEnd: null,
      outroStart: null,
    };
  });

  await cache().set(cacheKey, episodes, CACHE_TTL.playback);
  return episodes;
}

export async function getAnimasuWatch(episodeSlug: string): Promise<AnimasuWatchResult | null> {
  const cacheKey = `animasu:watch:${episodeSlug}`;
  const hit = await cache().get<AnimasuWatchResult>(cacheKey);
  if (hit) return hit;

  const res = await fetchAnimasu<{ success: boolean; results: AnimasuWatchResult }>(
    `/watch/${encodeURIComponent(episodeSlug)}`,
  );
  if (!res?.success || !res?.results) return null;

  await cache().set(cacheKey, res.results, CACHE_TTL.playback);
  return res.results;
}

/**
 * Resolve Indonesian subtitle streaming playback sources from Animasu for a given anime and episode.
 */
export async function getAnimasuPlaybackSources(params: {
  animeSlug?: string;
  animeTitle?: string;
  altTitles?: string[];
  episodeNumber: number;
}): Promise<PlaybackSource[]> {
  const { animeSlug, animeTitle, altTitles, episodeNumber } = params;
  const cacheKey = `animasu:playback_sources:${animeSlug || ""}:${animeTitle || ""}:${episodeNumber}`;
  const hit = await cache().get<PlaybackSource[]>(cacheKey);
  if (hit) return hit;

  const matchCacheKey = `animasu:match:${animeSlug || ""}:${animeTitle || ""}`;
  let matchedAnimeSlug: string | null = await cache().get<string>(matchCacheKey);

  // 1. If not yet matched, try direct slug
  if (!matchedAnimeSlug && animeSlug) {
    const clean = animeSlug.replace(/^animasu:/i, "").trim();
    try {
      const directDetail = await fetchAnimasu<{ success: boolean; results: AnimasuAnimeDetailData }>(
        `/anime/${encodeURIComponent(clean)}`,
      );
      if (directDetail?.success && directDetail?.results?.title) {
        matchedAnimeSlug = clean;
      }
    } catch {
      /* ignore */
    }
  }

  // 2. If not matched, search Animasu using title, altTitles, and variants
  if (!matchedAnimeSlug && (animeTitle || animeSlug)) {
    const searchQueries: string[] = [];
    if (animeTitle) {
      searchQueries.push(animeTitle);
      // Without Season prefix/suffix
      const withoutSeason = animeTitle
        .replace(/\s*-\s*Starting Life in Another World.*/i, "")
        .replace(/Season \d+/i, "")
        .replace(/2nd Season/i, "")
        .replace(/3rd Season/i, "")
        .replace(/4th Season/i, "")
        .trim();
      if (withoutSeason && withoutSeason !== animeTitle) {
        searchQueries.push(withoutSeason);
      }
      if (altTitles?.length) {
        searchQueries.push(...altTitles.slice(0, 2));
      }
    }
    if (animeSlug) {
      searchQueries.push(animeSlug.replace(/-/g, " "));
    }

    const seen = new Set<string>();
    for (const q of searchQueries) {
      const qLower = q.trim().toLowerCase();
      if (!qLower || seen.has(qLower)) continue;
      seen.add(qLower);

      try {
        const sRes = await fetchAnimasu<{ success: boolean; results: AnimasuListItem[] }>(
          `/search?keyword=${encodeURIComponent(q.trim())}`,
        );
        const results = sRes?.results || [];
        if (results.length > 0) {
          // Check for best candidate (matching season number if present)
          const seasonMatch = (animeTitle || "").match(/season\s*(\d+)/i) || (animeTitle || "").match(/(\d+)(?:nd|rd|th)\s*season/i);
          let candidate = results[0];
          if (seasonMatch) {
            const sNum = seasonMatch[1];
            const seasonRegex = new RegExp(`season\\s*${sNum}|s${sNum}|${sNum}(?:nd|rd|th)`, "i");
            const matchSeason = results.find((r) => seasonRegex.test(`${r.title} ${r.slug}`));
            if (matchSeason) candidate = matchSeason;
          }
          matchedAnimeSlug = candidate.slug;
          break;
        }
      } catch {
        /* try next query */
      }
    }
  }

  if (!matchedAnimeSlug) return [];

  // Cache the matched slug so all subsequent episode clicks resolve in 0ms!
  await cache().set(matchCacheKey, matchedAnimeSlug, CACHE_TTL.anime);

  // Fetch or read cached episode list for this anime
  const epListCacheKey = `animasu:eplist:${matchedAnimeSlug}`;
  let epList = await cache().get<AnimasuAnimeDetailData["episodeList"]>(epListCacheKey);

  if (!epList || !epList.length) {
    const detail = await fetchAnimasu<{ success: boolean; results: AnimasuAnimeDetailData }>(
      `/anime/${encodeURIComponent(matchedAnimeSlug)}`,
    );
    epList = detail?.results?.episodeList || [];
    if (epList.length > 0) {
      await cache().set(epListCacheKey, epList, CACHE_TTL.anime);
    }
  }

  if (!epList.length) return [];

  // Find matching episode
  let targetEp = epList.find((ep) => {
    const slugMatch = ep.episodeSlug.match(/-episode-(\d+(?:\.\d+)?)(?:-|$)/i);
    if (slugMatch && parseFloat(slugMatch[1]) === episodeNumber) return true;
    const titleMatch = ep.title.match(/(?:episode|ep\.?)\s*(\d+(?:\.\d+)?)/i);
    if (titleMatch && parseFloat(titleMatch[1]) === episodeNumber) return true;
    return false;
  });

  // For movies or single-episode releases where episodeList has 1 item and episodeNumber is 1
  if (!targetEp && epList.length === 1 && episodeNumber === 1) {
    targetEp = epList[0];
  }

  if (!targetEp) return [];

  // Fetch watch data for that episode
  const watchData = await getAnimasuWatch(targetEp.episodeSlug);
  if (!watchData) return [];

  const serverItems =
    Array.isArray(watchData.servers) && watchData.servers.length > 0
      ? watchData.servers
      : Array.isArray(watchData.mirrors) && watchData.mirrors.length > 0
        ? watchData.mirrors
        : [];

  const sources: PlaybackSource[] = [];

  for (let i = 0; i < serverItems.length; i++) {
      const srv = serverItems[i];
      if (!srv?.iframeUrl) continue;
      const cleanUrl = cleanIframeUrl(srv.iframeUrl);
      const quality = parseQuality(srv.label);
      const cleanLabel = srv.label ? srv.label.trim() : `${quality}p`;

      sources.push({
        id: `animasu-${targetEp.episodeSlug}-${i}-${quality}`,
        quality,
        format: "EMBED",
        codec: null,
        language: "id",
        url: cleanUrl,
        label: `Sub Indo (${cleanLabel})`,
        status: "ACTIVE",
      });
    }

    // If no server item had iframeUrl, check defaultIframe / streamUrl
    if (sources.length === 0) {
      const fallbackRaw = watchData.defaultIframe || watchData.streamUrl;
      if (fallbackRaw) {
        const fallbackUrl = cleanIframeUrl(fallbackRaw);
        sources.push({
          id: `animasu-${targetEp.episodeSlug}-default`,
          quality: 1080,
          format: "EMBED",
          codec: null,
          language: "id",
          url: fallbackUrl,
          label: "Sub Indo (Default)",
          status: "ACTIVE",
        });
      }
    }

  if (sources.length > 0) {
    await cache().set(cacheKey, sources, CACHE_TTL.playback);
  }

  return sources;
}
