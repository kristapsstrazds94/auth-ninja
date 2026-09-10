export const PROTOCOL_VERSION = "0.0.0";

/** Placeholder until OpenAPI spec is implemented in task 1.1 */
export const AUTH_ENDPOINTS = [
  "POST /auth/register",
  "POST /auth/login",
  "POST /auth/logout",
  "GET /auth/session",
  "POST /auth/2fa/verify",
  "POST /auth/passkeys/register",
  "POST /auth/passkeys/login",
] as const;

export type AuthEndpoint = (typeof AUTH_ENDPOINTS)[number];
