import type { AuthNinjaConfig } from "@auth-ninja/core";
import { eq } from "drizzle-orm";
import type { AuthDb } from "../db/client.js";
import { sessions } from "../db/schema.js";
import { generateSessionToken, hashSessionToken } from "./token.js";

export type SessionCreationMeta = {
  ipAddress?: string;
  userAgent?: string;
};

export type CreatedSession = {
  token: string;
  sessionId: string;
  expiresAt: Date;
};

function sessionExpiresAt(config: AuthNinjaConfig, now: Date): Date {
  return new Date(now.getTime() + config.sessionAbsoluteHours * 60 * 60 * 1000);
}

/** Persist a new server-side session and return the raw cookie token. */
export async function createSession(
  db: AuthDb,
  config: AuthNinjaConfig,
  userId: string,
  meta: SessionCreationMeta = {},
  now: Date = new Date(),
): Promise<CreatedSession> {
  const token = generateSessionToken();
  const tokenHash = hashSessionToken(token);
  const expiresAt = sessionExpiresAt(config, now);

  const [row] = await db
    .insert(sessions)
    .values({
      tokenHash,
      userId,
      expiresAt,
      lastSeenAt: now,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    })
    .returning({ id: sessions.id });

  if (!row) {
    throw new Error("Failed to create session");
  }

  return { token, sessionId: row.id, expiresAt };
}

/** Delete a session by raw cookie token. No-op when token is missing or unknown. */
export async function invalidateSessionByToken(
  db: AuthDb,
  token: string | undefined,
): Promise<void> {
  if (!token) {
    return;
  }

  const tokenHash = hashSessionToken(token);
  await db.delete(sessions).where(eq(sessions.tokenHash, tokenHash));
}

/**
 * Invalidate any existing session cookie and create a fresh session (session fixation prevention).
 */
export async function rotateSession(
  db: AuthDb,
  config: AuthNinjaConfig,
  userId: string,
  existingToken: string | undefined,
  meta: SessionCreationMeta = {},
  now: Date = new Date(),
): Promise<CreatedSession> {
  await invalidateSessionByToken(db, existingToken);
  return createSession(db, config, userId, meta, now);
}
