export type RateLimitResult = {
  allowed: boolean;
  /** Seconds until the client may retry (when blocked). */
  retryAfterSeconds?: number;
};

export type RateLimiter = {
  check(
    key: string,
    limit: number,
    windowMs: number,
    nowMs?: number,
  ): RateLimitResult | Promise<RateLimitResult>;
};

type Bucket = {
  count: number;
  windowStartMs: number;
};

/** In-memory fixed-window rate limiter keyed by client identifier (typically IP). */
export class InMemoryRateLimiter implements RateLimiter {
  private readonly buckets = new Map<string, Bucket>();

  check(key: string, limit: number, windowMs: number, nowMs = Date.now()): RateLimitResult {
    const bucket = this.buckets.get(key);

    if (!bucket || nowMs - bucket.windowStartMs >= windowMs) {
      this.buckets.set(key, { count: 1, windowStartMs: nowMs });
      return { allowed: true };
    }

    if (bucket.count >= limit) {
      const retryAfterMs = windowMs - (nowMs - bucket.windowStartMs);
      return {
        allowed: false,
        retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1000)),
      };
    }

    bucket.count += 1;
    return { allowed: true };
  }

  /** Clear all counters — useful in tests. */
  reset(): void {
    this.buckets.clear();
  }
}
