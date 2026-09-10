import type { AuthNinjaConfig } from "./config.js";
import { createAuthError } from "./errors.js";

/** Lockout settings shared with `AuthNinjaConfig`. */
export type LockoutConfig = Pick<
  AuthNinjaConfig,
  "lockoutMaxAttempts" | "lockoutWindowMinutes" | "lockoutDurationMinutes"
>;

/** Persisted lockout state for one account or composite key (e.g. user id, IP). */
export type LockoutRecord = {
  /** Failed attempt timestamps (epoch ms), newest last. */
  attempts: number[];
  /** Epoch ms after which the lock expires; omitted when not locked. */
  lockedUntil?: number;
};

export type LockoutStatus = {
  locked: boolean;
  attemptCount: number;
  /** Remaining failures allowed before lockout within the current window. */
  remainingAttempts: number;
  unlockAt?: Date;
};

export type RecordFailureResult = LockoutStatus & {
  /** True when this failure triggered a new lockout. */
  justLocked: boolean;
};

export interface LockoutStore {
  get(key: string): Promise<LockoutRecord | undefined>;
  set(key: string, record: LockoutRecord): Promise<void>;
  delete(key: string): Promise<void>;
}

const EMPTY_RECORD: LockoutRecord = { attempts: [] };

function assertLockoutKey(key: string): void {
  if (key.trim().length === 0) {
    throw createAuthError("VALIDATION_ERROR");
  }
}

function minutesToMs(minutes: number): number {
  return minutes * 60_000;
}

function normalizeRecord(record: LockoutRecord | undefined): LockoutRecord {
  if (!record) {
    return { attempts: [] };
  }
  return {
    attempts: [...record.attempts],
    ...(record.lockedUntil !== undefined ? { lockedUntil: record.lockedUntil } : {}),
  };
}

/** Drop attempts outside the sliding window and clear expired locks. */
export function pruneLockoutRecord(
  record: LockoutRecord,
  config: LockoutConfig,
  now: Date,
): LockoutRecord {
  const nowMs = now.getTime();
  const windowStart = nowMs - minutesToMs(config.lockoutWindowMinutes);
  const attempts = record.attempts.filter((attemptMs) => attemptMs >= windowStart);

  let lockedUntil = record.lockedUntil;
  if (lockedUntil !== undefined && lockedUntil <= nowMs) {
    lockedUntil = undefined;
  }

  if (lockedUntil === undefined) {
    return { attempts };
  }

  return { attempts, lockedUntil };
}

/** Evaluate lockout state without mutating stored attempts. */
export function evaluateLockout(
  record: LockoutRecord,
  config: LockoutConfig,
  now: Date,
): LockoutStatus {
  const pruned = pruneLockoutRecord(record, config, now);
  const nowMs = now.getTime();

  if (pruned.lockedUntil !== undefined && pruned.lockedUntil > nowMs) {
    return {
      locked: true,
      attemptCount: pruned.attempts.length,
      remainingAttempts: 0,
      unlockAt: new Date(pruned.lockedUntil),
    };
  }

  const attemptCount = pruned.attempts.length;
  const remainingAttempts = Math.max(0, config.lockoutMaxAttempts - attemptCount);

  return {
    locked: false,
    attemptCount,
    remainingAttempts,
  };
}

/** Apply one failed attempt and lock when the threshold is reached. */
export function recordFailedAttempt(
  record: LockoutRecord,
  config: LockoutConfig,
  now: Date,
): { record: LockoutRecord; result: RecordFailureResult } {
  const pruned = pruneLockoutRecord(record, config, now);
  const nowMs = now.getTime();

  if (pruned.lockedUntil !== undefined && pruned.lockedUntil > nowMs) {
    return {
      record: pruned,
      result: {
        locked: true,
        attemptCount: pruned.attempts.length,
        remainingAttempts: 0,
        unlockAt: new Date(pruned.lockedUntil),
        justLocked: false,
      },
    };
  }

  const attempts = [...pruned.attempts, nowMs];
  let lockedUntil = pruned.lockedUntil;
  let justLocked = false;

  if (attempts.length >= config.lockoutMaxAttempts) {
    lockedUntil = nowMs + minutesToMs(config.lockoutDurationMinutes);
    justLocked = true;
  }

  const nextRecord: LockoutRecord =
    lockedUntil !== undefined ? { attempts, lockedUntil } : { attempts };

  const result: RecordFailureResult = {
    ...evaluateLockout(nextRecord, config, now),
    justLocked,
  };

  return { record: nextRecord, result };
}

/** Clear failed attempts and active lock after successful authentication. */
export function clearLockoutRecord(): LockoutRecord {
  return { attempts: [] };
}

/** In-memory store for single-node dev and unit tests. */
export class InMemoryLockoutStore implements LockoutStore {
  private readonly records = new Map<string, LockoutRecord>();

  async get(key: string): Promise<LockoutRecord | undefined> {
    const record = this.records.get(key);
    if (!record) {
      return undefined;
    }
    return normalizeRecord(record);
  }

  async set(key: string, record: LockoutRecord): Promise<void> {
    this.records.set(key, normalizeRecord(record));
  }

  async delete(key: string): Promise<void> {
    this.records.delete(key);
  }
}

/** Server-side lockout engine — adapters supply durable storage in production. */
export class LockoutEngine {
  constructor(
    private readonly config: LockoutConfig,
    private readonly store: LockoutStore,
  ) {}

  async getStatus(key: string, now: Date = new Date()): Promise<LockoutStatus> {
    assertLockoutKey(key);
    const record = await this.loadRecord(key, now);
    return evaluateLockout(record, this.config, now);
  }

  async assertNotLocked(key: string, now: Date = new Date()): Promise<LockoutStatus> {
    const status = await this.getStatus(key, now);
    if (status.locked) {
      throw createAuthError("ACCOUNT_LOCKED");
    }
    return status;
  }

  async recordFailure(
    key: string,
    now: Date = new Date(),
  ): Promise<RecordFailureResult> {
    assertLockoutKey(key);
    const current = await this.loadRecord(key, now);
    const { record, result } = recordFailedAttempt(current, this.config, now);
    await this.store.set(key, record);
    return result;
  }

  async recordSuccess(key: string): Promise<void> {
    assertLockoutKey(key);
    await this.store.delete(key);
  }

  /** Admin or support unlock — clears lock and attempt counter. */
  async unlock(key: string): Promise<void> {
    assertLockoutKey(key);
    await this.store.delete(key);
  }

  private async loadRecord(key: string, now: Date): Promise<LockoutRecord> {
    const stored = await this.store.get(key);
    const record = normalizeRecord(stored ?? EMPTY_RECORD);
    const pruned = pruneLockoutRecord(record, this.config, now);

    const changed =
      pruned.attempts.length !== record.attempts.length ||
      pruned.lockedUntil !== record.lockedUntil;

    if (changed) {
      if (pruned.attempts.length === 0 && pruned.lockedUntil === undefined) {
        await this.store.delete(key);
        return EMPTY_RECORD;
      }
      await this.store.set(key, pruned);
    }

    return pruned;
  }
}

/** Extract lockout settings from full auth config. */
export function lockoutConfigFromAuthConfig(config: AuthNinjaConfig): LockoutConfig {
  return {
    lockoutMaxAttempts: config.lockoutMaxAttempts,
    lockoutWindowMinutes: config.lockoutWindowMinutes,
    lockoutDurationMinutes: config.lockoutDurationMinutes,
  };
}
