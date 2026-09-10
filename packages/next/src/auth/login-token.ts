import { createHmac, timingSafeEqual } from "node:crypto";
import { LOGIN_CHALLENGE_TTL_MS } from "../session/constants.js";

const LOGIN_TOKEN_VERSION = "v1";

function signPayload(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

/** Issue a short-lived HMAC login token for the MFA step. */
export function createLoginChallengeToken(
  userId: string,
  secret: string,
  now: Date = new Date(),
): string {
  const expiresAt = now.getTime() + LOGIN_CHALLENGE_TTL_MS;
  const payload = `${LOGIN_TOKEN_VERSION}.${userId}.${expiresAt}`;
  const signature = signPayload(payload, secret);
  return `${payload}.${signature}`;
}

/** Verify login challenge token; returns userId when valid and not expired. */
export function verifyLoginChallengeToken(
  token: string,
  secret: string,
  now: Date = new Date(),
): string | undefined {
  const parts = token.split(".");
  if (parts.length !== 4) {
    return undefined;
  }

  const [version, userId, expiresAtRaw, signature] = parts;
  if (version !== LOGIN_TOKEN_VERSION || !userId || !expiresAtRaw || !signature) {
    return undefined;
  }

  const expiresAt = Number(expiresAtRaw);
  if (!Number.isFinite(expiresAt) || expiresAt <= now.getTime()) {
    return undefined;
  }

  const payload = `${version}.${userId}.${expiresAtRaw}`;
  const expected = signPayload(payload, secret);

  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (
    actualBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(actualBuffer, expectedBuffer)
  ) {
    return undefined;
  }

  return userId;
}
