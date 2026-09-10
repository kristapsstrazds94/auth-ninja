import { createHmac, randomBytes } from "node:crypto";
import { timingSafeEqualUtf8 } from "@auth-ninja/core";
import { CSRF_TOKEN_TTL_MS } from "./constants.js";

const CSRF_TOKEN_MIN_LENGTH = 32;

function signCsrfPayload(secret: string, payload: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

/** Issue a signed CSRF token (min 32 chars per OpenAPI). */
export function generateCsrfToken(secret: string, nowMs = Date.now()): string {
  const nonce = randomBytes(16).toString("hex");
  const expiresAt = nowMs + CSRF_TOKEN_TTL_MS;
  const payload = `${nonce}.${expiresAt}`;
  const signature = signCsrfPayload(secret, payload);
  const token = `${payload}.${signature}`;

  if (token.length < CSRF_TOKEN_MIN_LENGTH) {
    throw new Error("CSRF token shorter than minimum length");
  }

  return token;
}

/** Verify a CSRF token from the X-CSRF-Token header. */
export function verifyCsrfToken(
  secret: string,
  token: string | null | undefined,
  nowMs = Date.now(),
): boolean {
  if (!token || token.length < CSRF_TOKEN_MIN_LENGTH) {
    return false;
  }

  const parts = token.split(".");
  if (parts.length !== 3) {
    return false;
  }

  const [nonce, expiresAtRaw, signature] = parts;
  if (!nonce || !expiresAtRaw || !signature) {
    return false;
  }

  const expiresAt = Number(expiresAtRaw);
  if (!Number.isFinite(expiresAt) || nowMs > expiresAt) {
    return false;
  }

  const payload = `${nonce}.${expiresAtRaw}`;
  const expected = signCsrfPayload(secret, payload);
  return timingSafeEqualUtf8(signature, expected);
}
