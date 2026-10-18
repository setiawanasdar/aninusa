export const ANIME_TYPES = ["TV", "MOVIE", "OVA", "ONA", "SPECIAL", "MUSIC"] as const;
export type AnimeType = (typeof ANIME_TYPES)[number];

export const ANIME_STATUSES = ["ONGOING", "COMPLETED", "UPCOMING"] as const;
export type AnimeStatus = (typeof ANIME_STATUSES)[number];

export const SEASONS = ["WINTER", "SPRING", "SUMMER", "FALL"] as const;
export type Season = (typeof SEASONS)[number];

export const VIDEO_FORMATS = ["HLS", "DASH", "MP4", "WEBM"] as const;
export type VideoFormat = (typeof VIDEO_FORMATS)[number];

export const SUBTITLE_FORMATS = ["VTT", "SRT", "ASS"] as const;
export type SubtitleFormat = (typeof SUBTITLE_FORMATS)[number];

export const SOURCE_STATUSES = ["ACTIVE", "DEGRADED", "BROKEN", "DISABLED"] as const;
export type SourceStatus = (typeof SOURCE_STATUSES)[number];

export const ROLES = ["USER", "MODERATOR", "ADMIN"] as const;
export type Role = (typeof ROLES)[number];

export const SORT_OPTIONS = ["popularity", "rating", "newest", "updated", "alphabetical"] as const;
export type SortOption = (typeof SORT_OPTIONS)[number];

export const SYNC_MODES = ["FULL", "INCREMENTAL"] as const;
export type SyncMode = (typeof SYNC_MODES)[number];

export interface AnimeSummary {
  id: string;
  slug: string;
  title: string;
  englishTitle: string | null;
  japaneseTitle: string | null;
  poster: string | null;
  banner: string | null;
  type: AnimeType;
  status: AnimeStatus;
  year: number | null;
  season: Season | null;
  score: number | null;
  popularity: number;
  totalEpisodes: number | null;
  latestEpisode: number | null;
  duration: number | null;
  genres: string[];
  studios: string[];
  updatedAt: string;
}

export interface AnimeDetail extends AnimeSummary {
  alternativeTitles: string[];
  synopsis: string | null;
  source: string | null;
  airedFrom: string | null;
  airedTo: string | null;
  malId: number | null;
  anilistId: number | null;
  episodeCount: number;
  createdAt: string;
}

export interface EpisodeDto {
  id: string;
  animeId: string;
  number: number;
  title: string | null;
  description: string | null;
  duration: number | null;
  thumbnail: string | null;
  airDate: string | null;
  introStart: number | null;
  introEnd: number | null;
  outroStart: number | null;
}

export interface PlaybackSource {
  id: string;
  quality: number;
  format: VideoFormat | "EMBED";
  codec: string | null;
  language: string;
  url: string;
  label: string;
  status: SourceStatus;
}

export interface SubtitleTrack {
  id: string;
  language: string;
  label: string;
  format: SubtitleFormat;
  url: string;
  isDefault: boolean;
  status: SourceStatus;
}

export interface EpisodePlayback {
  episode: EpisodeDto;
  sources: PlaybackSource[];
  subtitles: SubtitleTrack[];
  anime: Pick<AnimeSummary, "id" | "slug" | "title" | "poster">;
  previousEpisode: Pick<EpisodeDto, "id" | "number"> | null;
  nextEpisode: Pick<EpisodeDto, "id" | "number"> | null;
}

export interface WatchHistoryEntry {
  id: string;
  progress: number;
  duration: number;
  completed: boolean;
  updatedAt: string;
  anime: AnimeSummary;
  episode: EpisodeDto;
}

export interface UserDto {
  id: string;
  username: string;
  email: string;
  avatar: string | null;
  role: Role;
  createdAt: string;
}

export interface GenreDto {
  id: string;
  name: string;
  slug: string;
  animeCount?: number;
}

export interface StudioDto {
  id: string;
  name: string;
  slug: string;
}

export interface ProviderDto {
  id: string;
  key: string;
  name: string;
  kind: "METADATA" | "VIDEO" | "SUBTITLE";
  baseUrl: string | null;
  enabled: boolean;
  lastSyncAt: string | null;
}

export interface IngestionJobDto {
  id: string;
  providerKey: string;
  type: string;
  mode: "FULL" | "INCREMENTAL";
  status: "QUEUED" | "RUNNING" | "SUCCEEDED" | "PARTIAL" | "FAILED";
  attempts: number;
  stats: Record<string, unknown> | null;
  error: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
}

export interface AdminStats {
  animeCount: number;
  episodeCount: number;
  sourceCount: number;
  activeProviders: number;
  failedJobs: number;
  brokenSources: number;
  brokenSubtitles: number;
  userCount: number;
  recentAnime: AnimeSummary[];
  recentJobs: IngestionJobDto[];
}

export interface Paginated<T> {
  items: T[];
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
}

export interface CatalogQuery {
  q?: string;
  page?: number;
  perPage?: number;
  type?: AnimeType;
  status?: AnimeStatus;
  year?: number;
  season?: Season;
  genre?: string;
  studio?: string;
  sort?: SortOption;
}

// ---------------------------------------------------------------------------
// Provider-normalized ingestion contracts
// ---------------------------------------------------------------------------

export interface NormalizedSubtitle {
  language: string;
  label: string;
  url: string;
  format: SubtitleFormat;
  isDefault?: boolean;
}

export interface NormalizedVideoSource {
  provider: string;
  externalId?: string;
  url: string;
  quality: number;
  format: VideoFormat;
  codec?: string;
  language?: string;
  subtitleSupport?: boolean;
}

export interface NormalizedEpisode {
  number: number;
  title?: string | null;
  description?: string | null;
  duration?: number | null;
  thumbnail?: string | null;
  airDate?: string | null;
  introStart?: number | null;
  introEnd?: number | null;
  outroStart?: number | null;
  sources?: NormalizedVideoSource[];
  subtitles?: NormalizedSubtitle[];
}

export interface NormalizedAnime {
  externalId: string;
  title: string;
  japaneseTitle?: string | null;
  englishTitle?: string | null;
  alternativeTitles?: string[];
  synopsis?: string | null;
  poster?: string | null;
  banner?: string | null;
  type?: AnimeType;
  status?: AnimeStatus;
  year?: number | null;
  season?: Season | null;
  score?: number | null;
  popularity?: number;
  duration?: number | null;
  totalEpisodes?: number | null;
  airedFrom?: string | null;
  airedTo?: string | null;
  malId?: number | null;
  anilistId?: number | null;
  genres?: string[];
  studios?: string[];
  source?: string;
  episodes?: NormalizedEpisode[];
}

export interface ProviderCapabilities {
  metadata: boolean;
  video: boolean;
  subtitles: boolean;
  incremental: boolean;
  seasonal: boolean;
  automatedAccessPermitted: boolean;
  notes?: string;
}

export interface ProviderStatus {
  key: string;
  name: string;
  capabilities: ProviderCapabilities;
  enabled: boolean;
}
