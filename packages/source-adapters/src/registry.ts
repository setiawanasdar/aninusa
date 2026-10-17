import { AniListProvider } from "./providers/anilist";
import { OpenMediaProvider } from "./providers/open-media";
import { RestrictedProviderExample } from "./providers/unsupported-example";
import type {
  MetadataProvider,
  ProviderContext,
  ProviderRegistry,
  ProviderRuntimeConfig,
  ProviderDescriptor,
  SubtitleProvider,
  VideoProvider,
} from "./types";

export function providerConfigFromEnv(env: NodeJS.ProcessEnv = process.env): ProviderRuntimeConfig {
  return {
    anilistEnabled: env.ANILIST_ENABLED !== "false",
    openMediaEnabled: env.OPEN_MEDIA_ENABLED !== "false",
    anilistRateLimitPerMinute: Number(env.ANILIST_RATE_LIMIT_PER_MINUTE ?? 80),
    ingestMaxEpisodes: Number(env.INGEST_MAX_EPISODES ?? 60),
    requestTimeoutMs: Number(env.INGEST_REQUEST_TIMEOUT_MS ?? 15_000),
    userAgent:
      env.PROVIDER_USER_AGENT ??
      `AniNusa/1.0 (+${env.SITE_URL ?? env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"})`,
  };
}

export function createProviderRegistry(
  config: ProviderRuntimeConfig,
  context?: Partial<ProviderContext>,
): ProviderRegistry {
  const metadata = new Map<string, MetadataProvider>();
  const video = new Map<string, VideoProvider>();
  const subtitles = new Map<string, SubtitleProvider>();
  const statuses: ProviderDescriptor[] = [];

  const ctx: ProviderContext = {
    timeoutMs: config.requestTimeoutMs,
    userAgent: config.userAgent,
    ...context,
  };

  const openMedia = new OpenMediaProvider();
  if (config.openMediaEnabled) {
    metadata.set(openMedia.key, openMedia);
    video.set(openMedia.key, openMedia);
    subtitles.set(openMedia.key, openMedia);
  }
  statuses.push(openMedia);

  const anilist = new AniListProvider(ctx, {
    maxEpisodes: config.ingestMaxEpisodes,
    requestsPerMinute: config.anilistRateLimitPerMinute,
  });
  if (config.anilistEnabled) {
    metadata.set(anilist.key, anilist);
  }
  statuses.push(anilist);

  statuses.push(new RestrictedProviderExample());

  return {
    metadata,
    video,
    subtitles,
    statuses,
    getMetadataProvider: (key) => metadata.get(key),
    getVideoProvider: (key) => video.get(key),
  };
}
