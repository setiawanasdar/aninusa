import type {
  NormalizedAnime,
  NormalizedSubtitle,
  NormalizedVideoSource,
  ProviderCapabilities,
  Season,
} from "@aninusa/types";

export class ProviderError extends Error {
  readonly retryable: boolean;
  readonly status?: number;

  constructor(message: string, options: { retryable?: boolean; status?: number } = {}) {
    super(message);
    this.name = "ProviderError";
    this.retryable = options.retryable ?? false;
    this.status = options.status;
  }
}

export class UnsupportedProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnsupportedProviderError";
  }
}

export interface ProviderContext {
  timeoutMs: number;
  userAgent: string;
  logger?: {
    info(message: string, context?: Record<string, unknown>): void;
    warn(message: string, context?: Record<string, unknown>): void;
    error(message: string, context?: Record<string, unknown>): void;
  };
}

export interface ProviderDescriptor {
  key: string;
  name: string;
  capabilities: ProviderCapabilities;
}

export interface MetadataProvider extends ProviderDescriptor {
  search(query: string, options?: { limit?: number }): Promise<NormalizedAnime[]>;
  getAnime(externalId: string): Promise<NormalizedAnime | null>;
  getSeasonalAnime(
    year: number,
    season: Season,
    options?: { page?: number; perPage?: number },
  ): Promise<NormalizedAnime[]>;
  getPopular?(options?: { page?: number; perPage?: number }): Promise<NormalizedAnime[]>;
}

export interface VideoProvider extends ProviderDescriptor {
  getVideoSources(animeExternalId: string, episodeNumber: number): Promise<NormalizedVideoSource[]>;
  getSubtitleTracks(animeExternalId: string, episodeNumber: number): Promise<NormalizedSubtitle[]>;
  getAvailableQualities?(animeExternalId: string, episodeNumber: number): Promise<number[]>;
}

export interface SubtitleProvider extends ProviderDescriptor {
  getSubtitleTracks(animeExternalId: string, episodeNumber: number): Promise<NormalizedSubtitle[]>;
}

export interface ProviderRegistry {
  metadata: Map<string, MetadataProvider>;
  video: Map<string, VideoProvider>;
  subtitles: Map<string, SubtitleProvider>;
  statuses: ProviderDescriptor[];
  getMetadataProvider(key: string): MetadataProvider | undefined;
  getVideoProvider(key: string): VideoProvider | undefined;
}

export interface ProviderRuntimeConfig {
  anilistEnabled: boolean;
  openMediaEnabled: boolean;
  anikotoEnabled?: boolean;
  anilistRateLimitPerMinute: number;
  ingestMaxEpisodes: number;
  requestTimeoutMs: number;
  userAgent: string;
}
