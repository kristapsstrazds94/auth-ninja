import { randomUUID } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  AUTH_ERROR_MESSAGES,
  hashPassword,
  type AuthNinjaConfig,
} from "@auth-ninja/core";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { createAuthNinjaContext } from "../context.js";
import type { AuthDb } from "../db/client.js";
import { auditEvents, authNinjaSchema, sessions, users } from "../db/schema.js";
import { AUTH_SESSION_COOKIE_NAME } from "../session/constants.js";
import { generateSessionToken, hashSessionToken } from "../session/token.js";
import { createLogoutHandler } from "../routes/logout.js";
import { createSessionHandler } from "../routes/session.js";
import { getSessionUser } from "./get-session.js";
import { logoutUser } from "./logout.js";

const TEST_SECRET = "test-secret-min-32-chars-long!!";
const TEST_PASSWORD = "secure-password-1";

const migrationsFolder = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../drizzle",
);

const testConfig: AuthNinjaConfig = {
  secret: TEST_SECRET,
  baseUrl: "http://localhost:3000",
  databaseUrl: "postgres://test",
  sessionIdleMinutes: 15,
  sessionAbsoluteHours: 8,
  lockoutMaxAttempts: 3,
  lockoutWindowMinutes: 15,
  lockoutDurationMinutes: 30,
  require2fa: false,
  twoFaIssuer: "AuthNinja",
  passkeysEnabled: true,
  passkeyRpId: "localhost",
  ipAuditEnabled: true,
  csrfEnabled: false,
  apiRateLimitPerMinute: 100,
};

async function createTestContext() {
  const client = new PGlite();
  const db = drizzle(client, { schema: authNinjaSchema });
  await migrate(db, { migrationsFolder });
  const ctx = createAuthNinjaContext({ config: testConfig, db: db as unknown as AuthDb });
  return { ctx, db, client };
}

async function seedSession(options: {
  lastSeenAt?: Date;
  expiresAt?: Date;
} = {}) {
  const { ctx, db } = await createTestContext();
  const passwordHash = await hashPassword(TEST_PASSWORD);
  const userId = randomUUID();
  const token = generateSessionToken();
  const now = new Date();

  await db.insert(users).values({
    id: userId,
    email: "session@test.local",
    emailNormalized: "session@test.local",
    passwordHash,
  });

  await db.insert(sessions).values({
    tokenHash: hashSessionToken(token),
    userId,
    lastSeenAt: options.lastSeenAt ?? now,
    expiresAt: options.expiresAt ?? new Date(now.getTime() + 8 * 60 * 60 * 1000),
  });

  return { ctx, db, token, userId };
}

describe("getSessionUser", () => {
  it("returns SessionResponse for a valid session", async () => {
    const { ctx, token } = await seedSession();

    const result = await getSessionUser(ctx, token);

    expect(result.status).toBe(200);
    expect(result.body.authenticated).toBe(true);
    expect(result.body.user.email).toBe("session@test.local");
  });

  it("returns SESSION_EXPIRED when cookie token is missing", async () => {
    const { ctx } = await createTestContext();

    await expect(getSessionUser(ctx, undefined)).rejects.toMatchObject({
      code: "SESSION_EXPIRED",
      message: AUTH_ERROR_MESSAGES.SESSION_EXPIRED,
    });
  });

  it("returns SESSION_EXPIRED for unknown token", async () => {
    const { ctx } = await createTestContext();

    await expect(getSessionUser(ctx, "unknown-session-token-value!!")).rejects.toMatchObject({
      code: "SESSION_EXPIRED",
    });
  });

  it("rejects idle-expired sessions", async () => {
    const idleExpired = new Date(Date.now() - 16 * 60 * 1000);
    const { ctx, token, db, userId } = await seedSession({ lastSeenAt: idleExpired });

    await expect(getSessionUser(ctx, token)).rejects.toMatchObject({
      code: "SESSION_EXPIRED",
    });

    const remaining = await db.select().from(sessions).where(eq(sessions.userId, userId));
    expect(remaining).toHaveLength(0);
  });

  it("rejects absolutely expired sessions", async () => {
    const past = new Date(Date.now() - 60_000);
    const { ctx, token, db, userId } = await seedSession({ expiresAt: past });

    await expect(getSessionUser(ctx, token)).rejects.toMatchObject({
      code: "SESSION_EXPIRED",
    });

    const remaining = await db.select().from(sessions).where(eq(sessions.userId, userId));
    expect(remaining).toHaveLength(0);
  });

  it("updates lastSeenAt on successful read", async () => {
    const lastSeenAt = new Date(Date.now() - 5 * 60 * 1000);
    const { ctx, token, db, userId } = await seedSession({ lastSeenAt });
    const before = new Date();

    await getSessionUser(ctx, token, before);

    const [row] = await db.select().from(sessions).where(eq(sessions.userId, userId));
    expect(row?.lastSeenAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
  });
});

describe("logoutUser", () => {
  it("invalidates session and records audit event", async () => {
    const { ctx, token, db, userId } = await seedSession();

    const result = await logoutUser(ctx, {
      token,
      ipAddress: "127.0.0.1",
    });

    expect(result.status).toBe(204);

    const remaining = await db.select().from(sessions).where(eq(sessions.userId, userId));
    expect(remaining).toHaveLength(0);

    const audits = await db.select().from(auditEvents).where(eq(auditEvents.userId, userId));
    expect(audits).toHaveLength(1);
    expect(audits[0]?.type).toBe("logout");
  });

  it("returns SESSION_EXPIRED without a valid session", async () => {
    const { ctx } = await createTestContext();

    await expect(
      logoutUser(ctx, { token: undefined, ipAddress: "127.0.0.1" }),
    ).rejects.toMatchObject({
      code: "SESSION_EXPIRED",
    });
  });
});

describe("session and logout route handlers", () => {
  it("session handler returns user snapshot", async () => {
    const { ctx, token } = await seedSession();
    const handler = createSessionHandler(ctx);

    const response = await handler(
      new Request("http://localhost/auth/session", {
        method: "GET",
        headers: { cookie: `${AUTH_SESSION_COOKIE_NAME}=${token}` },
      }),
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as { authenticated: boolean; user: { email: string } };
    expect(body.authenticated).toBe(true);
    expect(body.user.email).toBe("session@test.local");
  });

  it("session handler returns 401 without cookie", async () => {
    const { ctx } = await createTestContext();
    const handler = createSessionHandler(ctx);

    const response = await handler(new Request("http://localhost/auth/session", { method: "GET" }));

    expect(response.status).toBe(401);
    const body = (await response.json()) as { code: string };
    expect(body.code).toBe("SESSION_EXPIRED");
  });

  it("logout handler clears cookie and returns 204", async () => {
    const { ctx, token, db, userId } = await seedSession();
    const handler = createLogoutHandler(ctx);

    const response = await handler(
      new Request("http://localhost/auth/logout", {
        method: "POST",
        headers: { cookie: `${AUTH_SESSION_COOKIE_NAME}=${token}` },
      }),
    );

    expect(response.status).toBe(204);
    const setCookie = response.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain(`${AUTH_SESSION_COOKIE_NAME}=`);
    expect(setCookie).toContain("Max-Age=0");
    expect(setCookie).toContain("HttpOnly");

    const remaining = await db.select().from(sessions).where(eq(sessions.userId, userId));
    expect(remaining).toHaveLength(0);
  });
});
