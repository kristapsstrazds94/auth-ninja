import type { LockoutRecord, LockoutStore } from "@auth-ninja/core";
import type { Redis } from "ioredis";
import type { RateLimitResult } from "../middleware/rate-limit.js";
import type {
  WebAuthnChallengeKind,
  WebAuthnChallengeRecord,
  WebAuthnChallengeStore,
} from "../auth/webauthn-challenge-store.js";

const LOCKOUT_PREFIX = "auth-ninja:lockout:";
const RATE_LIMIT_PREFIX = "auth-ninja:rate:";
const WEBAUTHN_PREFIX = "auth-ninja:webauthn:";

/** Redis-backed lockout store for multi-instance deployments. */
export class RedisLockoutStore implements LockoutStore {
  constructor(private readonly redis: Redis) {}

  async get(key: string): Promise<LockoutRecord | undefined> {
    const raw = await this.redis.get(`${LOCKOUT_PREFIX}${key}`);
    if (!raw) {
      return undefined;
    }
    return JSON.parse(raw) as LockoutRecord;
  }

  async set(key: string, record: LockoutRecord): Promise<void> {
    await this.redis.set(`${LOCKOUT_PREFIX}${key}`, JSON.stringify(record));
  }

  async delete(key: string): Promise<void> {
    await this.redis.del(`${LOCKOUT_PREFIX}${key}`);
  }
}

/** Redis-backed fixed-window rate limiter keyed by client identifier. */
export class RedisRateLimiter {
  constructor(private readonly redis: Redis) {}

  async check(
    key: string,
    limit: number,
    windowMs: number,
    nowMs = Date.now(),
  ): Promise<RateLimitResult> {
    const redisKey = `${RATE_LIMIT_PREFIX}${key}`;
    const count = await this.redis.incr(redisKey);

    if (count === 1) {
      await this.redis.pexpire(redisKey, windowMs);
      return { allowed: true };
    }

    const ttlMs = await this.redis.pttl(redisKey);
    if (count > limit) {
      return {
        allowed: false,
        retryAfterSeconds: Math.max(1, Math.ceil(ttlMs / 1000)),
      };
    }

    return { allowed: true };
  }
}

type StoredWebAuthnChallenge = WebAuthnChallengeRecord;

/** Redis-backed WebAuthn challenge store with TTL. */
export class RedisWebAuthnChallengeStore implements WebAuthnChallengeStore {
  constructor(private readonly redis: Redis) {}

  async set(
    challenge: string,
    record: Omit<WebAuthnChallengeRecord, "expiresAt">,
    ttlMs: number,
    now: Date = new Date(),
  ): Promise<void> {
    const stored: StoredWebAuthnChallenge = {
      ...record,
      expiresAt: now.getTime() + ttlMs,
    };
    await this.redis.set(
      `${WEBAUTHN_PREFIX}${challenge}`,
      JSON.stringify(stored),
      "PX",
      ttlMs,
    );
  }

  async consume(
    challenge: string,
    kind: WebAuthnChallengeKind,
    now: Date = new Date(),
  ): Promise<WebAuthnChallengeRecord | undefined> {
    const redisKey = `${WEBAUTHN_PREFIX}${challenge}`;
    const raw = await this.redis.get(redisKey);
    if (!raw) {
      return undefined;
    }

    await this.redis.del(redisKey);
    const entry = JSON.parse(raw) as StoredWebAuthnChallenge;

    if (entry.kind !== kind || now.getTime() > entry.expiresAt) {
      return undefined;
    }

    return entry;
  }
}

export type RedisAuthStores = {
  lockoutStore: RedisLockoutStore;
  rateLimiter: RedisRateLimiter;
  webAuthnChallengeStore: RedisWebAuthnChallengeStore;
  redis: Redis;
  close: () => Promise<void>;
};

/** Create Redis-backed auth stores from AUTH_NINJA_REDIS_URL. */
export async function createRedisAuthStores(redisUrl: string): Promise<RedisAuthStores> {
  const { Redis: RedisClient } = await import("ioredis");
  const redis = new RedisClient(redisUrl);

  return {
    lockoutStore: new RedisLockoutStore(redis),
    rateLimiter: new RedisRateLimiter(redis),
    webAuthnChallengeStore: new RedisWebAuthnChallengeStore(redis),
    redis,
    close: async () => {
      await redis.quit();
    },
  };
}
