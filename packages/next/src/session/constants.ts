/** HttpOnly session cookie name — matches OpenAPI `sessionCookie` security scheme. */
export const AUTH_SESSION_COOKIE_NAME = "auth_session";

/** Login challenge token TTL for MFA step (5 minutes). */
export const LOGIN_CHALLENGE_TTL_MS = 5 * 60_000;

/** WebAuthn ceremony challenge TTL (5 minutes). */
export const WEBAUTHN_CHALLENGE_TTL_MS = 5 * 60_000;
