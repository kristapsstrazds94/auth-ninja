export const PROTOCOL_VERSION = "0.1.0";

/** Canonical auth API routes — must match packages/protocol/openapi.json */
export const AUTH_ENDPOINTS = [
  "POST /auth/register",
  "POST /auth/login",
  "POST /auth/logout",
  "GET /auth/session",
  "GET /auth/csrf",
  "POST /auth/password-reset/request",
  "POST /auth/password-reset/confirm",
  "POST /auth/2fa/enroll",
  "POST /auth/2fa/confirm",
  "POST /auth/2fa/verify",
  "POST /auth/2fa/backup-codes",
  "DELETE /auth/2fa",
  "POST /auth/passkeys/register/begin",
  "POST /auth/passkeys/register/finish",
  "POST /auth/passkeys/login/begin",
  "POST /auth/passkeys/login/finish",
  "GET /auth/passkeys",
  "DELETE /auth/passkeys/{credentialId}",
] as const;

export type AuthEndpoint = (typeof AUTH_ENDPOINTS)[number];

/** Error codes in the OpenAPI contract — aligned with @auth-ninja/core AuthNinjaErrorCode */
export const AUTH_ERROR_CODES = [
  "INVALID_CREDENTIALS",
  "ACCOUNT_LOCKED",
  "SESSION_EXPIRED",
  "MFA_REQUIRED",
  "MFA_INVALID",
  "CSRF_INVALID",
  "RATE_LIMITED",
  "FORBIDDEN",
  "VALIDATION_ERROR",
] as const;

export type AuthErrorCode = (typeof AUTH_ERROR_CODES)[number];

/** State-changing routes that require CSRF when csrfEnabled is true */
export const CSRF_PROTECTED_METHODS = [
  "POST /auth/register",
  "POST /auth/login",
  "POST /auth/logout",
  "POST /auth/password-reset/request",
  "POST /auth/password-reset/confirm",
  "POST /auth/2fa/enroll",
  "POST /auth/2fa/confirm",
  "POST /auth/2fa/verify",
  "POST /auth/2fa/backup-codes",
  "DELETE /auth/2fa",
  "POST /auth/passkeys/register/begin",
  "POST /auth/passkeys/register/finish",
  "POST /auth/passkeys/login/begin",
  "POST /auth/passkeys/login/finish",
  "DELETE /auth/passkeys/{credentialId}",
] as const;

export type CsrfProtectedMethod = (typeof CSRF_PROTECTED_METHODS)[number];
