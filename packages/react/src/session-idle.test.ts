/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  activityThrottleMs,
  createIdleRefreshController,
  idleRefreshIntervalMs,
} from "./session-idle.js";

describe("session-idle helpers", () => {
  it("computes refresh intervals from idle minutes", () => {
    expect(idleRefreshIntervalMs(15)).toBe(300_000);
    expect(idleRefreshIntervalMs(1)).toBe(30_000);
    expect(idleRefreshIntervalMs(60)).toBe(300_000);
    expect(activityThrottleMs(15)).toBe(60_000);
    expect(activityThrottleMs(1)).toBe(15_000);
  });
});

describe("createIdleRefreshController", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("refreshes on activity after throttle elapses", () => {
    const onRefresh = vi.fn();
    const controller = createIdleRefreshController({
      idleMinutes: 15,
      activityThrottleMs: 1_000,
      periodicRefreshMs: 60_000,
      onRefresh,
    });

    controller.start();
    controller.notifyActivity();
    expect(onRefresh).toHaveBeenCalledTimes(1);

    controller.notifyActivity();
    expect(onRefresh).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(1_000);
    controller.notifyActivity();
    expect(onRefresh).toHaveBeenCalledTimes(2);

    controller.stop();
  });

  it("refreshes periodically while running", () => {
    const onRefresh = vi.fn();
    const controller = createIdleRefreshController({
      idleMinutes: 15,
      activityThrottleMs: 60_000,
      periodicRefreshMs: 5_000,
      onRefresh,
    });

    controller.start();
    expect(onRefresh).not.toHaveBeenCalled();

    vi.advanceTimersByTime(5_000);
    expect(onRefresh).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(5_000);
    expect(onRefresh).toHaveBeenCalledTimes(2);

    controller.stop();
    onRefresh.mockClear();

    vi.advanceTimersByTime(10_000);
    expect(onRefresh).not.toHaveBeenCalled();
  });
});
