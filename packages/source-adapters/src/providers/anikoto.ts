import type {
  AnimeStatus,
  AnimeType,
  NormalizedAnime,
  NormalizedEpisode,
  NormalizedSubtitle,
  NormalizedVideoSource,
  ProviderCapabilities,
  Season,
} from "@aninusa/types";
import {
  ProviderError,
  type MetadataProvider,
  type ProviderContext,
  type VideoProvider,
} from "../types";
import { RateGate, providerJson } from "../http";

const ANIKOTO_ENDPOINT = process.env.ANIKOTO_API_URL ?? "https://anikototvapi.vercel.app/api";

interface AniKotoHomeItem {
  slug: string;
  poster: string;
  title: string;
  japaneseTitle?: string;
  sub?: number;
  dub?: number;
  total?: number;
  type?: string;
}

interface AniKotoHomeResponse {
  success: boolean;
  results: {
    spotlights?: AniKotoHomeItem[];
    trending?: AniKotoHomeItem[];
    topAiring?: AniKotoHomeItem[];
    genres?: string[];
  };
}

interface AniKotoSearchItem {
  slug: string;
  animeId: string;
  poster: string;
  title: string;
  japaneseTitle?: string;
  sub?: number;
  dub?: number;
  total?: number;
  type?: string;
  rating?: string;
  genres?: string | string[];
}

interface AniKotoSearchResponse {
  success: boolean;
  results: AniKotoSearchItem[];
  pagination?: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
  };
}

interface AniKotoAnimeInfo {
  slug: string;
  animeId: string | number;
  title: string;
  japaneseTitle?: string;
  altNames?: string;
  poster: string;
  backgroundImage?: string;
  synopsis?: string;
  type?: string;
  premiered?: string;
  aired?: string;
  status?: string;
  malScore?: string;
  duration?: string;
  episodes?: string | number;
  studios?: string[];
  producers?: string[];
  genres?: string[];
  rating?: string;
}

interface AniKotoInfoResponse {
  success: boolean;
  results: AniKotoAnimeInfo;
}

interface AniKotoEpisodeItem {
  id: string | number;
  episode_no: number;
  slug: string;
  title?: string;
  server_ids?: string;
  mal_id?: string;
}

interface AniKotoEpisodesResponse {
  success: boolean;
  results: AniKotoEpisodeItem[];
}

interface AniKotoServerItem {
  type: string;
  typeLabel: string;
  ep_id: string;
  link_id: string;
  name: string;
  normalizedName: string;
}

interface AniKotoServersResponse {
  success: boolean;
  results: AniKotoServerItem[];
}

interface AniKotoStreamResponse {
  success: boolean;
  results: {
    linkId: string;
    url: string;
    type: string;
    skipData?: {
      intro?: number[];
      outro?: number[];
    };
  };
}

function cleanSlug(raw: string): string {
  return raw.replace(/\/ep-\d+.*$/i, "").replace(/^\//, "").trim();
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

function parseDuration(raw?: string): number | null {
  if (!raw) return null;
  const match = raw.match(/(\d+)\s*m/);
  return match ? parseInt(match[1], 10) : null;
}

function parseScore(raw?: string): number | null {
  if (!raw) return null;
  const val = parseFloat(raw);
  return Number.isNaN(val) || val <= 0 ? null : Math.min(10, Math.max(0, val));
}

export class AniKotoProvider implements MetadataProvider, VideoProvider {
  readonly key = "anikoto";
  readonly name = "AniKoto API";

  readonly capabilities: ProviderCapabilities = {
    metadata: true,
    video: true,
    subtitles: false,
    incremental: true,
    seasonal: true,
    automatedAccessPermitted: true,
    notes: "AniKoto free REST API for anime metadata, search, and episode streams",
  };

  private readonly gate: RateGate;
  private readonly baseUrl: string;

  constructor(
    private readonly ctx: ProviderContext,
    options: { baseUrl?: string; requestsPerMinute?: number } = {},
  ) {
    this.baseUrl = (options.baseUrl ?? ANIKOTO_ENDPOINT).replace(/\/$/, "");
    this.gate = new RateGate(options.requestsPerMinute ?? 60);
  }

  private async request<T>(path: string): Promise<T> {
    await this.gate.wait();
    const url = `${this.baseUrl}${path.startsWith("/") ? "" : "/"}${path}`;
    return providerJson<T>(
      url,
      { method: "GET" },
      {
        timeoutMs: this.ctx.timeoutMs,
        userAgent: this.ctx.userAgent,
      },
    );
  }

  async search(query: string, options: { limit?: number; page?: number } = {}): Promise<NormalizedAnime[]> {
    const q = query.trim();
    if (!q) return [];

    try {
      const page = options.page ?? 1;
      const res = await this.request<any>(
        `/search?keyword=${encodeURIComponent(q)}&page=${page}`,
      );

      const rawItems = Array.isArray(res?.results?.data)
        ? res.results.data
        : Array.isArray(res?.results)
          ? res.results
          : [];

      const items = rawItems.slice(0, options.limit ?? 20);
      return items.map((item: any) => this.mapSearchItem(item));
    } catch (error) {
      this.ctx.logger?.warn("AniKoto search failed", { query, error: String(error) });
      return [];
    }
  }

  async getAnime(externalId: string): Promise<NormalizedAnime | null> {
    const targetSlug = cleanSlug(externalId);
    if (!targetSlug) return null;

    try {
      const res = await this.request<AniKotoInfoResponse>(`/info?id=${encodeURIComponent(targetSlug)}`);
      if (!res.success || !res.results) return null;

      const info = res.results;
      const animeId = String(info.animeId);

      // Fetch episodes
      let episodes: NormalizedEpisode[] = [];
      try {
        const epRes = await this.request<any>(`/episodes/${encodeURIComponent(animeId)}`);
        const epList = Array.isArray(epRes?.results?.episodes)
          ? epRes.results.episodes
          : Array.isArray(epRes?.results)
            ? epRes.results
            : [];

        if (epList.length > 0) {
          episodes = epList.map((ep: any) => {
            const epNumber = ep.episode_no || 1;
            const epTitle = ep.title?.trim() || `Episode ${epNumber}`;
            return {
              number: epNumber,
              title: epTitle,
              sources: ep.server_ids
                ? [
                    {
                      provider: this.key,
                      externalId: String(ep.id),
                      url: `anikoto://${targetSlug}/${epNumber}?server_ids=${encodeURIComponent(ep.server_ids)}`,
                      quality: 1080,
                      format: "HLS" as const,
                      language: "ja",
                      subtitleSupport: true,
                    },
                  ]
                : [],
            };
          });
        }
      } catch (epError) {
        this.ctx.logger?.warn("AniKoto episodes fetch failed", { slug: targetSlug, error: String(epError) });
      }

      const genres = Array.isArray(info.genres)
        ? info.genres.filter(Boolean)
        : [];

      const studios = Array.isArray(info.studios)
        ? info.studios.filter(Boolean)
        : [];

      const year = parseYear(info.premiered, info.aired);
      const season = parseSeason(info.premiered);
      const score = parseScore(info.malScore ?? info.rating);
      const totalEpisodes =
        typeof info.episodes === "number"
          ? info.episodes
          : parseInt(String(info.episodes ?? ""), 10) || episodes.length || null;

      return {
        externalId: targetSlug,
        title: info.title,
        japaneseTitle: info.japaneseTitle ?? null,
        englishTitle: info.title,
        alternativeTitles: info.altNames ? info.altNames.split(";").map((s) => s.trim()).filter(Boolean) : [],
        synopsis: info.synopsis ?? null,
        poster: info.poster ?? null,
        banner: info.backgroundImage ?? null,
        type: mapType(info.type),
        status: mapStatus(info.status),
        year,
        season,
        score,
        popularity: 100,
        duration: parseDuration(info.duration),
        totalEpisodes,
        genres,
        studios,
        source: "AniKoto",
        episodes,
      };
    } catch (error) {
      this.ctx.logger?.error("AniKoto getAnime failed", { externalId, error: String(error) });
      return null;
    }
  }

  async getPopular(options: { page?: number; perPage?: number } = {}): Promise<NormalizedAnime[]> {
    const limit = options.perPage ?? 15;
    try {
      const res = await this.request<AniKotoHomeResponse>("/");
      if (!res.success || !res.results) return [];

      const list: AniKotoHomeItem[] = [
        ...(res.results.trending ?? []),
        ...(res.results.topAiring ?? []),
        ...(res.results.spotlights ?? []),
      ];

      // Deduplicate by clean slug
      const seen = new Set<string>();
      const uniqueItems: AniKotoHomeItem[] = [];
      for (const item of list) {
        const slug = cleanSlug(item.slug);
        if (!seen.has(slug)) {
          seen.add(slug);
          uniqueItems.push({ ...item, slug });
        }
        if (uniqueItems.length >= limit) break;
      }

      // Fetch detail for items to get full metadata + episodes
      const results: NormalizedAnime[] = [];
      for (const item of uniqueItems) {
        try {
          const detail = await this.getAnime(item.slug);
          if (detail) {
            results.push(detail);
          } else {
            results.push(this.mapHomeItem(item));
          }
        } catch {
          results.push(this.mapHomeItem(item));
        }
      }

      return results;
    } catch (error) {
      this.ctx.logger?.error("AniKoto getPopular failed", { error: String(error) });
      return [];
    }
  }

  async getSeasonalAnime(
    year: number,
    season: Season,
    options: { page?: number; perPage?: number } = {},
  ): Promise<NormalizedAnime[]> {
    return this.getPopular(options);
  }

  async getVideoSources(animeExternalId: string, episodeNumber: number): Promise<NormalizedVideoSource[]> {
    const targetSlug = cleanSlug(animeExternalId);
    try {
      // 1. Get anime info to get animeId
      const infoRes = await this.request<AniKotoInfoResponse>(`/info?id=${encodeURIComponent(targetSlug)}`);
      if (!infoRes.success || !infoRes.results) return [];

      const animeId = String(infoRes.results.animeId);

      // 2. Get episodes list
      const epRes = await this.request<any>(`/episodes/${encodeURIComponent(animeId)}`);
      const epList = Array.isArray(epRes?.results?.episodes)
        ? epRes.results.episodes
        : Array.isArray(epRes?.results)
          ? epRes.results
          : [];

      const targetEp = epList.find((ep: any) => ep.episode_no === episodeNumber);
      if (!targetEp || !targetEp.server_ids) return [];

      // 3. Resolve servers
      const encodedIds = encodeURIComponent(targetEp.server_ids);
      const serverRes = await this.request<AniKotoServersResponse>(`/servers?ids=${encodedIds}`);
      if (!serverRes.success || !Array.isArray(serverRes.results) || serverRes.results.length === 0) {
        return [];
      }

      const sources: NormalizedVideoSource[] = [];

      // Resolve stream link for top servers (up to 2)
      for (const server of serverRes.results.slice(0, 2)) {
        try {
          const streamRes = await this.request<AniKotoStreamResponse>(
            `/stream?id=${encodeURIComponent(server.link_id)}`,
          );
          if (streamRes.success && streamRes.results?.url) {
            sources.push({
              provider: this.key,
              externalId: server.link_id,
              url: streamRes.results.url,
              quality: 1080,
              format: streamRes.results.type?.toUpperCase() === "MP4" ? "MP4" : "HLS",
              language: server.type === "dub" ? "en" : "ja",
              subtitleSupport: true,
            });
          }
        } catch {
          // ignore single server failures
        }
      }

      return sources;
    } catch (error) {
      this.ctx.logger?.error("AniKoto getVideoSources failed", { animeExternalId, episodeNumber, error: String(error) });
      return [];
    }
  }

  async getSubtitleTracks(animeExternalId: string, episodeNumber: number): Promise<NormalizedSubtitle[]> {
    return [];
  }

  private mapHomeItem(item: AniKotoHomeItem): NormalizedAnime {
    const slug = cleanSlug(item.slug);
    return {
      externalId: slug,
      title: item.title,
      japaneseTitle: item.japaneseTitle ?? null,
      poster: item.poster ?? null,
      type: mapType(item.type),
      status: "ONGOING",
      score: 8.0,
      popularity: 100,
      genres: [],
      studios: [],
      source: "AniKoto",
    };
  }

  private mapSearchItem(item: AniKotoSearchItem): NormalizedAnime {
    const slug = cleanSlug(item.slug);
    const genres = Array.isArray(item.genres)
      ? item.genres
      : typeof item.genres === "string"
        ? item.genres.split(/\s+/).filter(Boolean)
        : [];

    return {
      externalId: slug,
      title: item.title,
      japaneseTitle: item.japaneseTitle ?? null,
      poster: item.poster ?? null,
      type: mapType(item.type),
      status: "COMPLETED",
      score: parseScore(item.rating),
      popularity: 100,
      totalEpisodes: item.total || item.sub || null,
      genres,
      studios: [],
      source: "AniKoto",
    };
  }
}
