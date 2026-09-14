import { randomUUID } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  AUTH_GENERIC_MESSAGES,
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
import { authNinjaSchema, sessions, users } from "../db/schema.js";
import { AUTH_SESSION_COOKIE_NAME } from "../session/constants.js";
import { hashSessionToken } from "../session/token.js";
import { createLoginHandler } from "../routes/login.js";
import { createRegisterHandler } from "../routes/register.js";
import { loginUser } from "./login.js";
import { registerUser } from "./register.js";

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
  passwordMinScore: 2,
};

async function createTestContext() {
  const client = new PGlite();
  const db = drizzle(client, { schema: authNinjaSchema });
  await migrate(db, { migrationsFolder });
  const ctx = createAuthNinjaContext({ config: testConfig, db: db as unknown as AuthDb });
  return { ctx, db, client };
}

function jsonRequest(url: string, body: unknown, cookie?: string): Request {
  const headers: Record<string, string> = {
    "content-type": "application/json",
  };
  if (cookie) {
    headers.cookie = cookie;
  }
  return new Request(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

describe("registerUser", () => {
  it("creates user, session, and returns SessionResponse", async () => {
    const { ctx, db } = await createTestContext();

    const result = await registerUser(ctx, {
      email: "new@test.local",
      password: TEST_PASSWORD,
      ipAddress: "127.0.0.1",
    });

    expect(result.status).toBe(201);
    if (result.status !== 201) return;

    expect(result.body.authenticated).toBe(true);
    expect(result.body.user.email).toBe("new@test.local");
    expect(result.session.token.length).toBeGreaterThan(20);

    const stored = await db.select().from(users);
    expect(stored).toHaveLength(1);

    const storedSessions = await db.select().from(sessions);
    expect(storedSessions).toHaveLength(1);
    expect(storedSessions[0]?.tokenHash).toBe(hashSessionToken(result.session.token));
  });

  it("returns generic failure for duplicate email", async () => {
    const { ctx } = await createTestContext();

    await registerUser(ctx, {
      email: "dup@test.local",
      password: TEST_PASSWORD,
      ipAddress: "127.0.0.1",
    });

    const duplicate = await registerUser(ctx, {
      email: "DUP@test.local",
      password: TEST_PASSWORD,
      ipAddress: "127.0.0.1",
    });

    expect(duplicate.status).toBe(409);
    if (duplicate.status === 409) {
      expect(duplicate.body.message).toBe(AUTH_GENERIC_MESSAGES.REGISTRATION_FAILED);
    }
  });
});

describe("loginUser", () => {
  async function seedUser(email: string, password: string, mfaEnabled = false) {
    const { ctx, db } = await createTestContext();
    const passwordHash = await hashPassword(password);
    const [user] = await db
      .insert(users)
      .values({
        email,
        emailNormalized: email.toLowerCase(),
        passwordHash,
        mfaEnabled,
      })
      .returning();
    return { ctx, db, user: user! };
  }

  it("authenticates valid credentials and rotates session", async () => {
    const { ctx, db } = await seedUser("login@test.local", TEST_PASSWORD);
    const oldToken = "old-session-token-value-32chars!!";

    await db.insert(sessions).values({
      tokenHash: hashSessionToken(oldToken),
      userId: (await db.select().from(users))[0]!.id,
      expiresAt: new Date(Date.now() + 60_000),
    });

    const result = await loginUser(ctx, {
      email: "login@test.local",
      password: TEST_PASSWORD,
      ipAddress: "127.0.0.1",
      existingSessionToken: oldToken,
    });

    expect(result.status).toBe(200);
    if (result.status !== 200 || !("session" in result)) return;

    expect(result.body.user.email).toBe("login@test.local");

    const allSessions = await db.select().from(sessions);
    expect(allSessions).toHaveLength(1);
    expect(allSessions[0]?.tokenHash).toBe(hashSessionToken(result.session.token));
    expect(allSessions[0]?.tokenHash).not.toBe(hashSessionToken(oldToken));
  });

  it("returns generic INVALID_CREDENTIALS for wrong password", async () => {
    const { ctx } = await seedUser("bad-pass@test.local", TEST_PASSWORD);

    const result = await loginUser(ctx, {
      email: "bad-pass@test.local",
      password: "wrong-password-value",
      ipAddress: "127.0.0.1",
    });

    expect(result.status).toBe(401);
    if (result.status === 401) {
      expect(result.body.code).toBe("INVALID_CREDENTIALS");
      expect(result.body.message).toBe(AUTH_ERROR_MESSAGES.INVALID_CREDENTIALS);
    }
  });

  it("returns MFA challenge when user has MFA enabled", async () => {
    const { ctx } = await seedUser("mfa@test.local", TEST_PASSWORD, true);

    const result = await loginUser(ctx, {
      email: "mfa@test.local",
      password: TEST_PASSWORD,
      ipAddress: "127.0.0.1",
    });

    expect(result.status).toBe(200);
    if (result.status !== 200) return;
    expect("loginToken" in result.body).toBe(true);
    if ("loginToken" in result.body) {
      expect(result.body.loginToken.length).toBeGreaterThan(10);
    }
  });

  it("locks account after repeated failures", async () => {
    const { ctx } = await seedUser("lockout@test.local", TEST_PASSWORD);

    for (let i = 0; i < testConfig.lockoutMaxAttempts; i += 1) {
      await loginUser(ctx, {
        email: "lockout@test.local",
        password: "wrong-password-value",
        ipAddress: "127.0.0.1",
      });
    }

    const locked = await loginUser(ctx, {
      email: "lockout@test.local",
      password: TEST_PASSWORD,
      ipAddress: "127.0.0.1",
    });

    expect(locked.status).toBe(423);
    if (locked.status === 423) {
      expect(locked.body.code).toBe("ACCOUNT_LOCKED");
    }
  });
});

describe("route handlers", () => {
  it("register handler sets HttpOnly session cookie", async () => {
    const { ctx } = await createTestContext();
    const handler = createRegisterHandler(ctx);

    const response = await handler(
      jsonRequest("http://localhost/auth/register", {
        email: "route@test.local",
        password: TEST_PASSWORD,
      }),
    );

    expect(response.status).toBe(201);
    const setCookie = response.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain(`${AUTH_SESSION_COOKIE_NAME}=`);
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("SameSite=Strict");
  });

  it("login handler rejects invalid JSON body", async () => {
    const { ctx } = await createTestContext();
    const handler = createLoginHandler(ctx);

    const response = await handler(
      new Request("http://localhost/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "not-json",
      }),
    );

    expect(response.status).toBe(400);
    const body = (await response.json()) as { code: string };
    expect(body.code).toBe("VALIDATION_ERROR");
  });

  it("login handler rotates session cookie on success", async () => {
    const { ctx, db } = await createTestContext();
    const passwordHash = await hashPassword(TEST_PASSWORD);
    const userId = randomUUID();
    const oldToken = "prior-session-token-for-rotation";

    await db.insert(users).values({
      id: userId,
      email: "rotate@test.local",
      emailNormalized: "rotate@test.local",
      passwordHash,
    });

    await db.insert(sessions).values({
      tokenHash: hashSessionToken(oldToken),
      userId,
      expiresAt: new Date(Date.now() + 60_000),
    });

    const handler = createLoginHandler(ctx);
    const response = await handler(
      jsonRequest(
        "http://localhost/auth/login",
        { email: "rotate@test.local", password: TEST_PASSWORD },
        `${AUTH_SESSION_COOKIE_NAME}=${oldToken}`,
      ),
    );

    expect(response.status).toBe(200);
    const setCookie = response.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain(`${AUTH_SESSION_COOKIE_NAME}=`);
    expect(setCookie).not.toContain(oldToken);

    const remaining = await db.select().from(sessions).where(eq(sessions.userId, userId));
    expect(remaining).toHaveLength(1);
    expect(remaining[0]?.tokenHash).not.toBe(hashSessionToken(oldToken));
  });
});
