import { MemoryCache, RedisCache, type CacheAdapter } from "@aninusa/utils";
import { serverEnv } from "./env";

const globalForCache = globalThis as unknown as {
  __aninusaCache?: CacheAdapter;
};

function createCache(): CacheAdapter {
  const env = serverEnv();
  if (!env.REDIS_URL) return new MemoryCache();

  try {
    // Lazy require keeps Redis optional and avoids bundling the driver in edge runtimes.
    const Redis = require("ioredis") as typeof import("ioredis").default;
    const client = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: 2,
      enableOfflineQueue: false,
      lazyConnect: false,
      connectTimeout: 3_000,
      retryStrategy: (times: number) => (times > 5 ? null : Math.min(times * 250, 2_000)),
    });
    client.on("error", (error: Error) => {
      if (process.env.NODE_ENV !== "test") {
        console.error(JSON.stringify({ level: "warn", message: "Redis error; cache degraded", error: error.message }));
      }
    });
    return new RedisCache(client as unknown as ConstructorParameters<typeof RedisCache>[0]);
  } catch (error) {
    console.error(
      JSON.stringify({
        level: "warn",
        message: "Redis unavailable; using in-process cache",
        error: error instanceof Error ? error.message : String(error),
      }),
    );
    return new MemoryCache();
  }
}

export function cache(): CacheAdapter {
  if (!globalForCache.__aninusaCache) {
    globalForCache.__aninusaCache = createCache();
  }
  return globalForCache.__aninusaCache;
}

export const CACHE_KEYS = {
  home: "catalog:home:v1",
  catalog: (query: string) => `catalog:list:v1:${query}`,
  anime: (slug: string) => `catalog:anime:v1:${slug}`,
  playback: (episodeId: string) => `catalog:playback:v2:${episodeId}`,
  genres: "catalog:genres:v1",
  studios: "catalog:studios:v1",
  seasons: "catalog:seasons:v1",
  sitemap: "catalog:sitemap:v1",
  mangaHome: "manga:home:v1",
  mangaLatest: (page: number) => `manga:latest:v1:${page}`,
  mangaPopular: "manga:popular:v1",
  mangaSearch: (q: string, page: number) => `manga:search:v1:${q}:${page}`,
  mangaDetail: (slug: string) => `manga:detail:v1:${slug}`,
  mangaChapter: (slug: string) => `manga:chapter:v1:${slug}`,
  mangaGenreSearch: (genre: string, page: number) => `manga:genre:v1:${genre}:${page}`,
} as const;

export const CACHE_TTL = {
  home: 300,
  catalog: 300,
  anime: 1_800,
  playback: 1_800,
  taxonomy: 3_600,
  sitemap: 3_600,
  mangaHome: 300,
  mangaList: 300,
  mangaDetail: 900,
  mangaChapter: 3_600,
} as const;

export async function invalidateCatalogCache(): Promise<void> {
  await Promise.all([
    cache().deletePrefix("catalog:"),
    cache().deletePrefix("search:"),
    cache().deletePrefix("animasu:"),
    cache().deletePrefix("manga:"),
  ]);
}
