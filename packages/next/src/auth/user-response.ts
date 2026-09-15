import { and, eq } from "drizzle-orm";
import type { AuthDb } from "../db/client.js";
import { credentials, type User } from "../db/schema.js";

/** Wire-format user snapshot for SessionResponse. */
export type SessionUser = {
  id: string;
  email: string;
  mfaEnabled: boolean;
  /** True when the user has at least one registered WebAuthn passkey. */
  passkeysEnabled: boolean;
};

export async function userHasRegisteredPasskeys(
  db: AuthDb,
  userId: string,
): Promise<boolean> {
  const rows = await db
    .select({ id: credentials.id })
    .from(credentials)
    .where(and(eq(credentials.userId, userId), eq(credentials.type, "passkey")))
    .limit(1);

  return rows.length > 0;
}

export async function toSessionUser(user: User, db: AuthDb): Promise<SessionUser> {
  return {
    id: user.id,
    email: user.email,
    mfaEnabled: user.mfaEnabled,
    passkeysEnabled: await userHasRegisteredPasskeys(db, user.id),
  };
}

export async function toSessionResponse(user: User, db: AuthDb) {
  return {
    authenticated: true as const,
    user: await toSessionUser(user, db),
  };
}

export type SessionResponse = Awaited<ReturnType<typeof toSessionResponse>>;
