export const SESSION_SYNC_CHANNEL = "auth-ninja-session";

export type SessionSyncMessage = { type: "session-changed" };

export type SessionSync = {
  broadcast(): void;
  close(): void;
};

/** Cross-tab session sync via `BroadcastChannel` (no-op when unavailable). */
export function createSessionSync(onMessage: () => void): SessionSync {
  if (typeof BroadcastChannel === "undefined") {
    return { broadcast: () => {}, close: () => {} };
  }

  const channel = new BroadcastChannel(SESSION_SYNC_CHANNEL);

  channel.onmessage = () => {
    onMessage();
  };

  return {
    broadcast: () => {
      channel.postMessage({ type: "session-changed" } satisfies SessionSyncMessage);
    },
    close: () => {
      channel.close();
    },
  };
}
