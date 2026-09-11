/** Default idle window — matches `@auth-ninja/core` `sessionIdleMinutes`. */
export const DEFAULT_SESSION_IDLE_MINUTES = 15;

export const IDLE_ACTIVITY_EVENTS = [
  "mousedown",
  "keydown",
  "touchstart",
  "scroll",
  "focus",
] as const;

export type IdleRefreshOptions = {
  idleMinutes: number;
  onRefresh: () => void | Promise<void>;
  activityThrottleMs?: number;
  periodicRefreshMs?: number;
};

/** Periodic refresh interval: half the idle window, clamped to 30s–5min. */
export function idleRefreshIntervalMs(idleMinutes: number): number {
  const halfIdle = (idleMinutes * 60 * 1000) / 2;
  return Math.min(Math.max(halfIdle, 30_000), 300_000);
}

/** Minimum gap between activity-triggered refreshes. */
export function activityThrottleMs(idleMinutes: number): number {
  const quarterIdle = (idleMinutes * 60 * 1000) / 4;
  return Math.min(Math.max(quarterIdle, 15_000), 60_000);
}

export type IdleRefreshController = {
  start(): void;
  stop(): void;
  notifyActivity(): void;
};

/**
 * Keeps the server session alive while the user is active and periodically
 * re-validates before the idle timeout elapses.
 */
export function createIdleRefreshController(
  options: IdleRefreshOptions,
): IdleRefreshController {
  const throttleMs =
    options.activityThrottleMs ?? activityThrottleMs(options.idleMinutes);
  const periodicMs =
    options.periodicRefreshMs ?? idleRefreshIntervalMs(options.idleMinutes);

  let periodicTimer: ReturnType<typeof setInterval> | null = null;
  /** 0 = no activity refresh yet; otherwise timestamp of last refresh. */
  let lastActivityRefresh = 0;
  let stopped = true;

  function triggerRefresh(): void {
    void options.onRefresh();
  }

  function notifyActivity(): void {
    if (stopped) return;

    const now = Date.now();
    if (lastActivityRefresh !== 0 && now - lastActivityRefresh < throttleMs) return;

    lastActivityRefresh = now;
    triggerRefresh();
  }

  function start(): void {
    if (!stopped) return;
    stopped = false;
    lastActivityRefresh = 0;

    for (const event of IDLE_ACTIVITY_EVENTS) {
      window.addEventListener(event, notifyActivity, { passive: true });
    }

    periodicTimer = setInterval(triggerRefresh, periodicMs);
  }

  function stop(): void {
    if (stopped) return;
    stopped = true;

    for (const event of IDLE_ACTIVITY_EVENTS) {
      window.removeEventListener(event, notifyActivity);
    }

    if (periodicTimer !== null) {
      clearInterval(periodicTimer);
      periodicTimer = null;
    }
  }

  return { start, stop, notifyActivity };
}
