export const TEST_PASSWORD = "secure-password-1";
export const AUTH_SESSION_COOKIE = "auth_session";
export const CSRF_HEADER = "X-CSRF-Token";

/** Phrases that must not appear in user-facing auth messages (enumeration / disclosure). */
export const FORBIDDEN_MESSAGE_FRAGMENTS = [
  "already registered",
  "already exists",
  "does not exist",
  "not found",
  "unknown email",
  "email exists",
  "no account",
  "no user",
  "unregistered",
] as const;

export function uniqueEmail(prefix: string): string {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return `${prefix}-${suffix}@test.local`;
}
