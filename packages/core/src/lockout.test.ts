import { describe, expect, it } from "vitest";
import { AuthNinjaError } from "./errors.js";
import {
  clearLockoutRecord,
  evaluateLockout,
  InMemoryLockoutStore,
  LockoutEngine,
  pruneLockoutRecord,
  recordFailedAttempt,
  type LockoutConfig,
  type LockoutRecord,
} from "./lockout.js";

const TEST_CONFIG: LockoutConfig = {
  lockoutMaxAttempts: 3,
  lockoutWindowMinutes: 15,
  lockoutDurationMinutes: 30,
};

const ACCOUNT_KEY = "user:550e8400-e29b-41d4-a716-446655440000";

function atMinute(minute: number): Date {
  return new Date(minute * 60_000);
}

function createEngine(config: LockoutConfig = TEST_CONFIG): LockoutEngine {
  return new LockoutEngine(config, new InMemoryLockoutStore());
}

describe("pruneLockoutRecord", () => {
  it("removes attempts outside the sliding window", () => {
    const now = atMinute(20);
    const record: LockoutRecord = {
      attempts: [atMinute(1).getTime(), atMinute(10).getTime(), atMinute(19).getTime()],
    };

    const pruned = pruneLockoutRecord(record, TEST_CONFIG, now);
    expect(pruned.attempts).toEqual([atMinute(10).getTime(), atMinute(19).getTime()]);
  });

  it("clears expired locks", () => {
    const now = atMinute(40);
    const record: LockoutRecord = {
      attempts: [atMinute(35).getTime()],
      lockedUntil: atMinute(30).getTime(),
    };

    const pruned = pruneLockoutRecord(record, TEST_CONFIG, now);
    expect(pruned.lockedUntil).toBeUndefined();
  });
});

describe("evaluateLockout", () => {
  it("reports not locked with remaining attempts", () => {
    const status = evaluateLockout(
      { attempts: [atMinute(1).getTime()] },
      TEST_CONFIG,
      atMinute(2),
    );

    expect(status).toEqual({
      locked: false,
      attemptCount: 1,
      remainingAttempts: 2,
    });
  });

  it("reports locked while lock duration is active", () => {
    const unlockAt = atMinute(35);
    const status = evaluateLockout(
      {
        attempts: [atMinute(1).getTime(), atMinute(2).getTime(), atMinute(3).getTime()],
        lockedUntil: unlockAt.getTime(),
      },
      TEST_CONFIG,
      atMinute(10),
    );

    expect(status.locked).toBe(true);
    expect(status.remainingAttempts).toBe(0);
    expect(status.unlockAt).toEqual(unlockAt);
  });
});

describe("recordFailedAttempt", () => {
  it("locks when max attempts are reached within the window", () => {
    const now = atMinute(5);
    let record: LockoutRecord = clearLockoutRecord();
    let justLocked = false;

    for (let minute = 1; minute <= 3; minute += 1) {
      const step = recordFailedAttempt(record, TEST_CONFIG, atMinute(minute));
      record = step.record;
      if (step.result.justLocked) {
        justLocked = true;
      }
    }

    const status = evaluateLockout(record, TEST_CONFIG, now);
    expect(status.locked).toBe(true);
    expect(status.attemptCount).toBe(3);
    expect(justLocked).toBe(true);
    expect(record.lockedUntil).toBe(atMinute(3 + 30).getTime());
  });

  it("does not add attempts while already locked", () => {
    const lockedRecord: LockoutRecord = {
      attempts: [1, 2, 3],
      lockedUntil: atMinute(40).getTime(),
    };

    const { record, result } = recordFailedAttempt(
      lockedRecord,
      TEST_CONFIG,
      atMinute(10),
    );

    expect(record.attempts).toEqual([1, 2, 3]);
    expect(result.locked).toBe(true);
    expect(result.justLocked).toBe(false);
  });
});

describe("LockoutEngine", () => {
  it("tracks failures until lockout threshold", async () => {
    const engine = createEngine();
    const now = atMinute(0);

    const first = await engine.recordFailure(ACCOUNT_KEY, now);
    expect(first.locked).toBe(false);
    expect(first.attemptCount).toBe(1);
    expect(first.remainingAttempts).toBe(2);

    const second = await engine.recordFailure(ACCOUNT_KEY, atMinute(1));
    expect(second.attemptCount).toBe(2);

    const third = await engine.recordFailure(ACCOUNT_KEY, atMinute(2));
    expect(third.locked).toBe(true);
    expect(third.justLocked).toBe(true);
    expect(third.unlockAt).toEqual(atMinute(32));
  });

  it("throws ACCOUNT_LOCKED when assertNotLocked is called on locked account", async () => {
    const engine = createEngine();

    for (let minute = 0; minute < TEST_CONFIG.lockoutMaxAttempts; minute += 1) {
      await engine.recordFailure(ACCOUNT_KEY, atMinute(minute));
    }

    await expect(engine.assertNotLocked(ACCOUNT_KEY, atMinute(5))).rejects.toMatchObject({
      code: "ACCOUNT_LOCKED",
    });
  });

  it("allows attempts again after lock duration expires", async () => {
    const engine = createEngine();

    for (let minute = 0; minute < TEST_CONFIG.lockoutMaxAttempts; minute += 1) {
      await engine.recordFailure(ACCOUNT_KEY, atMinute(minute));
    }

    const afterLock = await engine.getStatus(ACCOUNT_KEY, atMinute(40));
    expect(afterLock.locked).toBe(false);
    expect(afterLock.attemptCount).toBe(0);
  });

  it("clears state on successful authentication", async () => {
    const engine = createEngine();

    await engine.recordFailure(ACCOUNT_KEY, atMinute(1));
    await engine.recordFailure(ACCOUNT_KEY, atMinute(2));
    await engine.recordSuccess(ACCOUNT_KEY);

    const status = await engine.getStatus(ACCOUNT_KEY, atMinute(3));
    expect(status).toEqual({
      locked: false,
      attemptCount: 0,
      remainingAttempts: TEST_CONFIG.lockoutMaxAttempts,
    });
  });

  it("supports admin unlock", async () => {
    const engine = createEngine();

    for (let minute = 0; minute < TEST_CONFIG.lockoutMaxAttempts; minute += 1) {
      await engine.recordFailure(ACCOUNT_KEY, atMinute(minute));
    }

    await engine.unlock(ACCOUNT_KEY);

    const status = await engine.getStatus(ACCOUNT_KEY, atMinute(5));
    expect(status.locked).toBe(false);
    expect(status.attemptCount).toBe(0);
  });

  it("prunes stale attempts on read so old failures do not accumulate", async () => {
    const engine = createEngine();

    await engine.recordFailure(ACCOUNT_KEY, atMinute(1));
    await engine.recordFailure(ACCOUNT_KEY, atMinute(2));

    const status = await engine.getStatus(ACCOUNT_KEY, atMinute(20));
    expect(status.attemptCount).toBe(0);
    expect(status.remainingAttempts).toBe(TEST_CONFIG.lockoutMaxAttempts);
  });

  it("rejects empty lockout keys", async () => {
    const engine = createEngine();
    await expect(engine.recordFailure("   ")).rejects.toBeInstanceOf(AuthNinjaError);
  });
});
