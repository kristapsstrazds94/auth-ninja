import { createAuthError, type AuthNinjaConfig } from "@auth-ninja/core";
import { eq } from "drizzle-orm";
import type { AuthDb } from "../db/client.js";
import { sessions, users, type Session, type User } from "../db/schema.js";
import { generateSessionToken, hashSessionToken } from "./token.js";

export type ResolvedSession = {
  session: Session;
  user: User;
};

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

/** Load session and user by cookie token; enforce idle and absolute timeouts. */
export async function resolveSessionByToken(
  db: AuthDb,
  config: AuthNinjaConfig,
  token: string | undefined,
  now: Date = new Date(),
): Promise<ResolvedSession> {
  if (!token) {
    throw createAuthError("SESSION_EXPIRED");
  }

  const tokenHash = hashSessionToken(token);
  const [row] = await db
    .select({
      session: sessions,
      user: users,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(eq(sessions.tokenHash, tokenHash))
    .limit(1);

  if (!row) {
    throw createAuthError("SESSION_EXPIRED");
  }

  const { session, user } = row;

  if (now >= session.expiresAt) {
    await db.delete(sessions).where(eq(sessions.id, session.id));
    throw createAuthError("SESSION_EXPIRED");
  }

  const idleMs = config.sessionIdleMinutes * 60 * 1000;
  if (now.getTime() - session.lastSeenAt.getTime() > idleMs) {
    await db.delete(sessions).where(eq(sessions.id, session.id));
    throw createAuthError("SESSION_EXPIRED");
  }

  return { session, user };
}

/** Bump last-seen timestamp for an active session. */
export async function touchSession(
  db: AuthDb,
  sessionId: string,
  now: Date = new Date(),
): Promise<void> {
  await db.update(sessions).set({ lastSeenAt: now }).where(eq(sessions.id, sessionId));
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
