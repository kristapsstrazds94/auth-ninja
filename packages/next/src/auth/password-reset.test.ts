import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  AUTH_GENERIC_MESSAGES,
  hashPassword,
  verifyPassword,
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
import { confirmPasswordReset, requestPasswordReset } from "./password-reset.js";

const TEST_SECRET = "test-secret-min-32-chars-long!!";
const TEST_PASSWORD = "secure-password-1";
const NEW_PASSWORD = "correct-horse-battery-staple";

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
  lockoutMaxAttempts: 5,
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

describe("password reset", () => {
  it("returns the same generic message for known and unknown emails", async () => {
    const { ctx, db } = await createTestContext();
    const passwordHash = await hashPassword(TEST_PASSWORD);
    await db.insert(users).values({
      email: "known@test.local",
      emailNormalized: "known@test.local",
      passwordHash,
    });

    const known = await requestPasswordReset(ctx, { email: "known@test.local" });
    const unknown = await requestPasswordReset(ctx, { email: "unknown@test.local" });

    expect(known.body.message).toBe(AUTH_GENERIC_MESSAGES.PASSWORD_RESET_REQUESTED);
    expect(unknown.body.message).toBe(AUTH_GENERIC_MESSAGES.PASSWORD_RESET_REQUESTED);
    expect(known.resetToken).toBeDefined();
    expect(unknown.resetToken).toBeUndefined();
  });

  it("resets password and invalidates sessions", async () => {
    const { ctx, db } = await createTestContext();
    const passwordHash = await hashPassword(TEST_PASSWORD);
    const [user] = await db
      .insert(users)
      .values({
        email: "reset@test.local",
        emailNormalized: "reset@test.local",
        passwordHash,
      })
      .returning();

    await db.insert(sessions).values({
      tokenHash: "abc123",
      userId: user!.id,
      expiresAt: new Date(Date.now() + 60_000),
      lastSeenAt: new Date(),
    });

    const request = await requestPasswordReset(ctx, { email: "reset@test.local" });
    expect(request.resetToken).toBeDefined();

    const confirm = await confirmPasswordReset(ctx, {
      token: request.resetToken!,
      password: NEW_PASSWORD,
    });

    expect(confirm.status).toBe(200);
    expect(confirm.body.message).toBe(AUTH_GENERIC_MESSAGES.PASSWORD_RESET_SUCCESS);

    const [updated] = await db.select().from(users).where(eq(users.id, user!.id));
    expect(await verifyPassword(NEW_PASSWORD, updated!.passwordHash)).toBe(true);
    expect(await verifyPassword(TEST_PASSWORD, updated!.passwordHash)).toBe(false);

    const remainingSessions = await db.select().from(sessions).where(eq(sessions.userId, user!.id));
    expect(remainingSessions).toHaveLength(0);
  });

  it("rejects invalid reset tokens with generic failure", async () => {
    const { ctx } = await createTestContext();

    const result = await confirmPasswordReset(ctx, {
      token: "invalid-token-that-does-not-exist-in-db",
      password: NEW_PASSWORD,
    });

    expect(result.status).toBe(400);
    expect(result.body.message).toBe(AUTH_GENERIC_MESSAGES.PASSWORD_RESET_FAILED);
  });
});
