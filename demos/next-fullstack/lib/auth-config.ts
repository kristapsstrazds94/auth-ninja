/** Client-side auth config for same-origin Next.js demo. */
export function readDemoAuthClientConfig() {
  const baseUrl = process.env.NEXT_PUBLIC_AUTH_BASE_URL ?? "";
  const idleRaw = process.env.NEXT_PUBLIC_AUTH_SESSION_IDLE_MINUTES;
  const sessionIdleMinutes = idleRaw ? Number.parseInt(idleRaw, 10) : undefined;

  return {
    baseUrl,
    ...(sessionIdleMinutes && Number.isFinite(sessionIdleMinutes)
      ? { sessionIdleMinutes }
      : {}),
  };
}
