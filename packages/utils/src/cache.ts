export interface CacheAdapter {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlSeconds: number): Promise<void>;
  delete(key: string): Promise<void>;
  increment(key: string, ttlSeconds: number): Promise<number>;
  deletePrefix(prefix: string): Promise<void>;
}

interface MemoryEntry {
  value: unknown;
  expiresAt: number;
}

export class MemoryCache implements CacheAdapter {
  private readonly entries = new Map<string, MemoryEntry>();
  private readonly maxEntries: number;

  constructor(maxEntries = 5_000) {
    this.maxEntries = maxEntries;
  }

  async get<T>(key: string): Promise<T | null> {
    const entry = this.entries.get(key);
    if (!entry) return null;
    if (entry.expiresAt <= Date.now()) {
      this.entries.delete(key);
      return null;
    }
    return entry.value as T;
  }

  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    if (ttlSeconds <= 0) return;
    if (this.entries.size >= this.maxEntries) this.evict();
    this.entries.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
  }

  async delete(key: string): Promise<void> {
    this.entries.delete(key);
  }

  async increment(key: string, ttlSeconds: number): Promise<number> {
    const current = await this.get<number>(key);
    const next = (current ?? 0) + 1;
    const existing = this.entries.get(key);
    const expiresAt = existing && existing.expiresAt > Date.now() ? existing.expiresAt : Date.now() + ttlSeconds * 1000;
    this.entries.set(key, { value: next, expiresAt });
    return next;
  }

  async deletePrefix(prefix: string): Promise<void> {
    for (const key of this.entries.keys()) {
      if (key.startsWith(prefix)) this.entries.delete(key);
    }
  }

  private evict(): void {
    const now = Date.now();
    for (const [key, entry] of this.entries) {
      if (entry.expiresAt <= now) this.entries.delete(key);
    }
    while (this.entries.size >= this.maxEntries) {
      const oldest = this.entries.keys().next().value as string | undefined;
      if (!oldest) break;
      this.entries.delete(oldest);
    }
  }
}

export interface RedisLike {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, mode: "EX", ttl: number): Promise<unknown>;
  del(key: string): Promise<unknown>;
  incr(key: string): Promise<number>;
  expire(key: string, ttl: number): Promise<unknown>;
  scan(cursor: string, ...args: Array<string | number>): Promise<[string, string[]]>;
}

export class RedisCache implements CacheAdapter {
  private readonly redis: RedisLike;
  private readonly prefix: string;

  constructor(redis: RedisLike, prefix = "aninusa:cache:") {
    this.redis = redis;
    this.prefix = prefix;
  }

  async get<T>(key: string): Promise<T | null> {
    const raw = await this.redis.get(this.prefix + key);
    if (raw === null) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    if (ttlSeconds <= 0) return;
    await this.redis.set(this.prefix + key, JSON.stringify(value), "EX", ttlSeconds);
  }

  async delete(key: string): Promise<void> {
    await this.redis.del(this.prefix + key);
  }

  async increment(key: string, ttlSeconds: number): Promise<number> {
    const redisKey = this.prefix + key;
    const count = await this.redis.incr(redisKey);
    if (count === 1) await this.redis.expire(redisKey, ttlSeconds);
    return count;
  }

  async deletePrefix(prefix: string): Promise<void> {
    let cursor = "0";
    const pattern = `${this.prefix}${prefix}*`;
    do {
      const [nextCursor, keys] = await this.redis.scan(cursor, "MATCH", pattern, "COUNT", 200);
      cursor = nextCursor;
      if (keys.length) await Promise.all(keys.map((key) => this.redis.del(key)));
    } while (cursor !== "0");
  }
}

const inFlight = new WeakMap<CacheAdapter, Map<string, Promise<unknown>>>();

/**
 * Cache-aside helper with single-flight request deduplication. This prevents a
 * cache stampede when many users hit the same catalog page after invalidation.
 */
export async function cached<T>(
  cache: CacheAdapter,
  key: string,
  ttlSeconds: number,
  loader: () => Promise<T>,
): Promise<T> {
  const existing = await cache.get<T>(key);
  if (existing !== null) return existing;

  let pending = inFlight.get(cache);
  if (!pending) {
    pending = new Map();
    inFlight.set(cache, pending);
  }

  const inProgress = pending.get(key) as Promise<T> | undefined;
  if (inProgress) return inProgress;

  const promise = loader()
    .then(async (value) => {
      await cache.set(key, value, ttlSeconds);
      return value;
    })
    .finally(() => {
      pending?.delete(key);
    });

  pending.set(key, promise);
  return promise;
}
