import type { CacheAdapter } from "./cache";

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
}

export interface RateLimitOptions {
  limit: number;
  windowSeconds: number;
  prefix?: string;
}

export class RateLimiter {
  private readonly cache: CacheAdapter;
  private readonly limit: number;
  private readonly windowSeconds: number;
  private readonly prefix: string;

  constructor(cache: CacheAdapter, options: RateLimitOptions) {
    this.cache = cache;
    this.limit = options.limit;
    this.windowSeconds = options.windowSeconds;
    this.prefix = options.prefix ?? "ratelimit:";
  }

  async check(identifier: string): Promise<RateLimitResult> {
    const key = `${this.prefix}${identifier}`;
    const count = await this.cache.increment(key, this.windowSeconds);
    const resetAt = Date.now() + this.windowSeconds * 1000;

    return {
      allowed: count <= this.limit,
      limit: this.limit,
      remaining: Math.max(0, this.limit - count),
      resetAt,
    };
  }
}
