import { createHash, randomBytes } from "node:crypto";

/** Generate a cryptographically random opaque session token. */
export function generateSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

/** SHA-256 hash of the raw cookie value for database storage. */
export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
