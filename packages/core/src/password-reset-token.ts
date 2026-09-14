import { createHash, randomBytes } from "node:crypto";

/** One-time password reset token length in bytes (base64url expands to 43 chars). */
export const PASSWORD_RESET_TOKEN_BYTES = 32;

/** Default password reset token TTL (1 hour). */
export const PASSWORD_RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

/** Generate a cryptographically strong password reset token. */
export function generatePasswordResetToken(): string {
  return randomBytes(PASSWORD_RESET_TOKEN_BYTES).toString("base64url");
}

/** Hash a reset token for storage — never persist the raw token. */
export function hashPasswordResetToken(token: string): string {
  return createHash("sha256").update(token).digest("base64url");
}
