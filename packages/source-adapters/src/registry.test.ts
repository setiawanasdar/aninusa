import { describe, expect, it } from "vitest";
import { OpenMediaProvider } from "./providers/open-media";
import { RestrictedProviderExample } from "./providers/unsupported-example";
import { createProviderRegistry, providerConfigFromEnv } from "./registry";
import { UnsupportedProviderError } from "./types";

const config = {
  anilistEnabled: false,
  openMediaEnabled: true,
  anilistRateLimitPerMinute: 60,
  ingestMaxEpisodes: 60,
  requestTimeoutMs: 1_000,
  userAgent: "AniNusaTest/1.0",
};

describe("provider registry", () => {
  it("registers only enabled providers", () => {
    const registry = createProviderRegistry(config);
    expect(registry.getMetadataProvider("open-media")).toBeDefined();
    expect(registry.getMetadataProvider("anilist")).toBeUndefined();
    expect(registry.getVideoProvider("open-media")).toBeDefined();
  });

  it("always exposes statuses, including unsupported providers", () => {
    const registry = createProviderRegistry(config);
    const restricted = registry.statuses.find((provider) => provider.key === "restricted-example");
    expect(restricted?.capabilities.automatedAccessPermitted).toBe(false);
  });

  it("reads configuration from the environment", () => {
    const parsed = providerConfigFromEnv({
      ANILIST_ENABLED: "false",
      OPEN_MEDIA_ENABLED: "true",
      INGEST_MAX_EPISODES: "12",
      INGEST_REQUEST_TIMEOUT_MS: "5000",
      NEXT_PUBLIC_SITE_URL: "https://aninusa.test",
    } as NodeJS.ProcessEnv);

    expect(parsed.anilistEnabled).toBe(false);
    expect(parsed.openMediaEnabled).toBe(true);
    expect(parsed.ingestMaxEpisodes).toBe(12);
    expect(parsed.userAgent).toContain("aninusa.test");
  });
});

describe("OpenMediaProvider", () => {
  const provider = new OpenMediaProvider();

  it("ships only openly licensed media", () => {
    for (const anime of provider.getCatalog()) {
      expect(anime.source).toBe("open-media");
      expect(anime.synopsis?.toLowerCase()).toMatch(/cc by|creative commons|lisensi/);
      for (const episode of anime.episodes ?? []) {
        for (const source of episode.sources ?? []) {
          expect(source.provider).toBe("open-media");
          expect(source.url).toMatch(/^https:\/\//);
        }
      }
    }
  });

  it("finds anime by normalized title", async () => {
    const results = await provider.search("big buck bunny");
    expect(results).toHaveLength(1);
    expect(results[0]?.externalId).toBe("big-buck-bunny");
  });

  it("returns authorized sources and Indonesian subtitles", async () => {
    const sources = await provider.getVideoSources("sintel", 1);
    expect(sources.length).toBeGreaterThan(0);

    const subtitles = await provider.getSubtitleTracks("sintel", 1);
    expect(subtitles.some((track) => track.language === "id")).toBe(true);
  });

  it("returns an empty list for unknown episodes", async () => {
    expect(await provider.getVideoSources("sintel", 99)).toEqual([]);
  });
});

describe("RestrictedProviderExample", () => {
  it("fails closed instead of bypassing access controls", async () => {
    const provider = new RestrictedProviderExample();
    await expect(provider.search("one piece")).rejects.toBeInstanceOf(UnsupportedProviderError);
    await expect(provider.getVideoSources("restricted", 1)).rejects.toBeInstanceOf(UnsupportedProviderError);
    expect(provider.capabilities.automatedAccessPermitted).toBe(false);
  });
});
