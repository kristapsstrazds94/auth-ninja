import { createHash } from "node:crypto";
import pg from "pg";
import { AUTH_SESSION_COOKIE } from "./constants.js";

const { Client } = pg;

function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function requireDatabaseUrl(): string {
  const url = process.env.AUTH_NINJA_DATABASE_URL;
  if (!url) {
    throw new Error("AUTH_NINJA_DATABASE_URL is required for database helpers");
  }
  return url;
}

/** Move session last_seen_at past idle timeout so the next request fails closed. */
export async function expireSessionIdle(sessionToken: string, idleMinutes = 15): Promise<void> {
  const client = new Client({ connectionString: requireDatabaseUrl() });
  const tokenHash = hashSessionToken(sessionToken);
  const idleExpired = new Date(Date.now() - (idleMinutes + 1) * 60 * 1000);

  try {
    await client.connect();
    const result = await client.query(
      `UPDATE sessions SET last_seen_at = $1 WHERE token_hash = $2`,
      [idleExpired, tokenHash],
    );
    if (result.rowCount === 0) {
      throw new Error("Session row not found for idle expiry");
    }
  } finally {
    await client.end();
  }
}

export function browserSessionCookie(sessionToken: string) {
  return {
    name: AUTH_SESSION_COOKIE,
    value: sessionToken,
    domain: "localhost",
    path: "/",
    httpOnly: true,
    sameSite: "Strict" as const,
  };
}
