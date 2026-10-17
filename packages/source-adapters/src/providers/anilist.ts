import type {
  AnimeStatus,
  AnimeType,
  NormalizedAnime,
  NormalizedEpisode,
  Season,
} from "@aninusa/types";
import { ProviderError, type MetadataProvider, type ProviderContext } from "../types";
import { RateGate, providerJson } from "../http";

const ANILIST_ENDPOINT = "https://graphql.anilist.co";

const MEDIA_FRAGMENT = `
  id
  idMal
  title { romaji english native }
  description(asHtml: false)
  coverImage { extraLarge large }
  bannerImage
  format
  status
  season
  seasonYear
  episodes
  duration
  averageScore
  popularity
  genres
  startDate { year month day }
  endDate { year month day }
  studios(isMain: true) { nodes { name } }
  streamingEpisodes { title thumbnail url site }
`;

interface AniListMedia {
  id: number;
  idMal: number | null;
  title: { romaji: string | null; english: string | null; native: string | null };
  description: string | null;
  coverImage: { extraLarge: string | null; large: string | null } | null;
  bannerImage: string | null;
  format: string | null;
  status: string | null;
  season: string | null;
  seasonYear: number | null;
  episodes: number | null;
  duration: number | null;
  averageScore: number | null;
  popularity: number | null;
  genres: string[];
  startDate: { year: number | null; month: number | null; day: number | null } | null;
  endDate: { year: number | null; month: number | null; day: number | null } | null;
  studios: { nodes: Array<{ name: string }> } | null;
  streamingEpisodes: Array<{
    title: string | null;
    thumbnail: string | null;
    url: string | null;
    site: string | null;
  }> | null;
}

interface AniListPageResponse {
  Page: {
    pageInfo: { hasNextPage: boolean; currentPage: number; lastPage: number };
    media: AniListMedia[];
  };
}

interface AniListMediaResponse {
  Media: AniListMedia | null;
}

function stripHtml(value: string | null): string | null {
  if (!value) return null;
  return value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function mapType(format: string | null): AnimeType {
  switch (format) {
    case "MOVIE":
      return "MOVIE";
    case "OVA":
      return "OVA";
    case "ONA":
      return "ONA";
    case "SPECIAL":
      return "SPECIAL";
    case "MUSIC":
      return "MUSIC";
    case "TV":
    case "TV_SHORT":
    default:
      return "TV";
  }
}

function mapStatus(status: string | null): AnimeStatus {
  switch (status) {
    case "FINISHED":
      return "COMPLETED";
    case "NOT_YET_RELEASED":
      return "UPCOMING";
    case "RELEASING":
    case "HIATUS":
    case "CANCELLED":
    default:
      return "ONGOING";
  }
}

function mapSeason(season: string | null): Season | null {
  if (season === "WINTER" || season === "SPRING" || season === "SUMMER" || season === "FALL") {
    return season;
  }
  return null;
}

function dateString(date: { year: number | null; month: number | null; day: number | null } | null): string | null {
  if (!date?.year) return null;
  const month = String(date.month ?? 1).padStart(2, "0");
  const day = String(date.day ?? 1).padStart(2, "0");
  return `${date.year}-${month}-${day}`;
}

export class AniListProvider implements MetadataProvider {
  readonly key = "anilist";
  readonly name = "AniList (official public API)";
  readonly capabilities = {
    metadata: true,
    video: false,
    subtitles: false,
    incremental: false,
    seasonal: true,
    automatedAccessPermitted: true,
    notes:
      "Official public GraphQL API. Metadata is cached and attributed. No video streams are provided by this adapter.",
  };

  private readonly context: ProviderContext;
  private readonly maxEpisodes: number;
  private readonly gate: RateGate;

  constructor(context: ProviderContext, options: { maxEpisodes: number; requestsPerMinute: number }) {
    this.context = context;
    this.maxEpisodes = options.maxEpisodes;
    this.gate = new RateGate(options.requestsPerMinute);
  }

  private async request<T>(query: string, variables: Record<string, unknown>): Promise<T> {
    await this.gate.wait();

    const payload = await providerJson<{ data?: T; errors?: Array<{ message: string }> }>(
      ANILIST_ENDPOINT,
      {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({ query, variables }),
      },
      {
        timeoutMs: this.context.timeoutMs,
        userAgent: this.context.userAgent,
      },
    );

    if (payload.errors?.length) {
      throw new ProviderError(`AniList API error: ${payload.errors[0]?.message ?? "unknown"}`, {
        retryable: true,
      });
    }

    if (!payload.data) {
      throw new ProviderError("AniList returned an empty payload", { retryable: true });
    }

    return payload.data;
  }

  async search(query: string, options: { limit?: number } = {}): Promise<NormalizedAnime[]> {
    const data = await this.request<AniListPageResponse>(
      `query ($search: String, $perPage: Int) {
        Page(page: 1, perPage: $perPage) {
          pageInfo { hasNextPage currentPage lastPage }
          media(search: $search, type: ANIME, isAdult: false, sort: [SEARCH_MATCH]) {
            ${MEDIA_FRAGMENT}
          }
        }
      }`,
      { search: query, perPage: Math.min(options.limit ?? 10, 25) },
    );

    return data.Page.media.map((media) => this.mapMedia(media));
  }

  async getAnime(externalId: string): Promise<NormalizedAnime | null> {
    const id = Number(externalId);
    if (!Number.isInteger(id) || id <= 0) return null;

    const data = await this.request<AniListMediaResponse>(
      `query ($id: Int) {
        Media(id: $id, type: ANIME) { ${MEDIA_FRAGMENT} }
      }`,
      { id },
    );

    return data.Media ? this.mapMedia(data.Media) : null;
  }

  async getSeasonalAnime(
    year: number,
    season: Season,
    options: { page?: number; perPage?: number } = {},
  ): Promise<NormalizedAnime[]> {
    return this.getPage(
      `query ($season: MediaSeason, $seasonYear: Int, $page: Int, $perPage: Int) {
        Page(page: $page, perPage: $perPage) {
          pageInfo { hasNextPage currentPage lastPage }
          media(
            type: ANIME,
            season: $season,
            seasonYear: $seasonYear,
            isAdult: false,
            sort: [POPULARITY_DESC]
          ) { ${MEDIA_FRAGMENT} }
        }
      }`,
      { season, seasonYear: year, page: options.page ?? 1, perPage: Math.min(options.perPage ?? 24, 50) },
    );
  }

  async getPopular(options: { page?: number; perPage?: number } = {}): Promise<NormalizedAnime[]> {
    return this.getPage(
      `query ($page: Int, $perPage: Int) {
        Page(page: $page, perPage: $perPage) {
          pageInfo { hasNextPage currentPage lastPage }
          media(type: ANIME, isAdult: false, sort: [POPULARITY_DESC]) { ${MEDIA_FRAGMENT} }
        }
      }`,
      { page: options.page ?? 1, perPage: Math.min(options.perPage ?? 24, 50) },
    );
  }

  private async getPage(
    query: string,
    variables: Record<string, unknown>,
  ): Promise<NormalizedAnime[]> {
    const data = await this.request<AniListPageResponse>(query, variables);
    return data.Page.media.map((media) => this.mapMedia(media));
  }

  private mapMedia(media: AniListMedia): NormalizedAnime {
    const title =
      media.title.english?.trim() || media.title.romaji?.trim() || media.title.native?.trim() || "Untitled";
    const alternativeTitles = Array.from(
      new Set(
        [media.title.romaji, media.title.english, media.title.native]
          .filter((value): value is string => Boolean(value && value.trim() && value.trim() !== title))
          .map((value) => value.trim()),
      ),
    );

    return {
      externalId: String(media.id),
      title,
      englishTitle: media.title.english,
      japaneseTitle: media.title.native,
      alternativeTitles,
      synopsis: stripHtml(media.description),
      poster: media.coverImage?.extraLarge ?? media.coverImage?.large ?? null,
      banner: media.bannerImage,
      type: mapType(media.format),
      status: mapStatus(media.status),
      year: media.seasonYear ?? media.startDate?.year ?? null,
      season: mapSeason(media.season),
      score: media.averageScore === null ? null : Number((media.averageScore / 10).toFixed(1)),
      popularity: media.popularity ?? 0,
      duration: media.duration,
      totalEpisodes: media.episodes,
      airedFrom: dateString(media.startDate),
      airedTo: dateString(media.endDate),
      malId: media.idMal,
      anilistId: media.id,
      genres: media.genres ?? [],
      studios: media.studios?.nodes.map((studio) => studio.name) ?? [],
      source: "anilist",
      episodes: this.mapEpisodes(media),
    };
  }

  private mapEpisodes(media: AniListMedia): NormalizedEpisode[] {
    const streaming = (media.streamingEpisodes ?? []).filter((episode) => episode.title);

    if (streaming.length) {
      return streaming.slice(0, this.maxEpisodes).map((episode, index) => ({
        number: index + 1,
        title: episode.title?.replace(/^Episode\s+\d+\s*[-–]\s*/i, "").trim() ?? null,
        thumbnail: episode.thumbnail,
        description: null,
      }));
    }

    if (!media.episodes || media.episodes > this.maxEpisodes) return [];

    return Array.from({ length: media.episodes }, (_, index) => ({
      number: index + 1,
      title: null,
      description: null,
    }));
  }
}
