import { describe, expect, it, vi } from "vitest";
import { MemoryCache, cached } from "./cache";
import { RateLimiter } from "./rate-limit";

describe("MemoryCache", () => {
  it("stores, reads and expires entries", async () => {
    const cache = new MemoryCache();
    await cache.set("key", { value: 1 }, 60);
    expect(await cache.get("key")).toEqual({ value: 1 });

    await cache.set("short", "gone", 0.01);
    await new Promise((resolve) => setTimeout(resolve, 25));
    expect(await cache.get("short")).toBeNull();
  });

  it("deletes entries by prefix", async () => {
    const cache = new MemoryCache();
    await cache.set("catalog:1", "a", 60);
    await cache.set("catalog:2", "b", 60);
    await cache.set("other:1", "c", 60);

    await cache.deletePrefix("catalog:");
    expect(await cache.get("catalog:1")).toBeNull();
    expect(await cache.get("other:1")).toBe("c");
  });

  it("increments counters and keeps the original TTL", async () => {
    const cache = new MemoryCache();
    expect(await cache.increment("hits", 60)).toBe(1);
    expect(await cache.increment("hits", 60)).toBe(2);
  });
});

describe("cached", () => {
  it("deduplicates concurrent loads (single flight)", async () => {
    const cache = new MemoryCache();
    const loader = vi.fn(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      return "value";
    });

    const [a, b, c] = await Promise.all([
      cached(cache, "key", 60, loader),
      cached(cache, "key", 60, loader),
      cached(cache, "key", 60, loader),
    ]);

    expect([a, b, c]).toEqual(["value", "value", "value"]);
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it("serves subsequent calls from cache", async () => {
    const cache = new MemoryCache();
    const loader = vi.fn(async () => 42);

    await cached(cache, "answer", 60, loader);
    await cached(cache, "answer", 60, loader);

    expect(loader).toHaveBeenCalledTimes(1);
  });
});

describe("RateLimiter", () => {
  it("allows requests up to the limit and blocks the rest", async () => {
    const limiter = new RateLimiter(new MemoryCache(), { limit: 2, windowSeconds: 60 });
    expect((await limiter.check("ip")).allowed).toBe(true);
    expect((await limiter.check("ip")).allowed).toBe(true);
    const blocked = await limiter.check("ip");
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
  });

  it("tracks identifiers independently", async () => {
    const limiter = new RateLimiter(new MemoryCache(), { limit: 1, windowSeconds: 60 });
    expect((await limiter.check("a")).allowed).toBe(true);
    expect((await limiter.check("b")).allowed).toBe(true);
    expect((await limiter.check("a")).allowed).toBe(false);
  });
});
