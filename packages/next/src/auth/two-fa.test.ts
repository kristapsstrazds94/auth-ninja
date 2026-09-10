import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  AUTH_ERROR_MESSAGES,
  generateTotpCode,
  generateTotpSecret,
  hashBackupCodes,
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
import { authNinjaSchema, credentials, sessions, users } from "../db/schema.js";
import { AUTH_SESSION_COOKIE_NAME, LOGIN_CHALLENGE_TTL_MS } from "../session/constants.js";
import { createSession } from "../session/service.js";
import { hashSessionToken } from "../session/token.js";
import { createLoginChallengeToken } from "./login-token.js";
import { createTwoFaConfirmHandler, createTwoFaEnrollHandler } from "../routes/two-fa.js";
import {
  confirmTwoFa,
  disableTwoFa,
  enrollTwoFa,
  regenerateBackupCodes,
  verifyTwoFaLogin,
} from "./two-fa.js";

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

async function seedUserWithSession(
  db: ReturnType<typeof drizzle<typeof authNinjaSchema>>,
  ctx: ReturnType<typeof createAuthNinjaContext>,
  options: { mfaEnabled?: boolean; totpSecret?: string } = {},
) {
  const passwordHash = await hashPassword(TEST_PASSWORD);
  const [user] = await db
    .insert(users)
    .values({
      email: "2fa@test.local",
      emailNormalized: "2fa@test.local",
      passwordHash,
      mfaEnabled: options.mfaEnabled ?? false,
      totpSecret: options.totpSecret,
    })
    .returning();

  const session = await createSession(db as unknown as AuthDb, testConfig, user!.id);
  return { user: user!, sessionToken: session.token };
}

describe("enrollTwoFa", () => {
  it("returns secret and otpauth URL for authenticated user", async () => {
    const { ctx, db } = await createTestContext();
    const { sessionToken } = await seedUserWithSession(db, ctx);

    const result = await enrollTwoFa(ctx, sessionToken);

    expect(result.status).toBe(200);
    if (result.status !== 200) return;

    expect(result.body.secret.length).toBeGreaterThan(10);
    expect(result.body.otpauthUrl).toContain("otpauth://totp/");

    const [stored] = await db.select().from(users);
    expect(stored?.totpSecret).toBe(result.body.secret);
    expect(stored?.mfaEnabled).toBe(false);
  });

  it("returns 409 when MFA is already enabled", async () => {
    const { ctx, db } = await createTestContext();
    const { secret } = generateTotpSecret();
    const { sessionToken } = await seedUserWithSession(db, ctx, {
      mfaEnabled: true,
      totpSecret: secret,
    });

    const result = await enrollTwoFa(ctx, sessionToken);

    expect(result.status).toBe(409);
    if (result.status === 409) {
      expect(result.body.code).toBe("FORBIDDEN");
      expect(result.body.message).toContain("already enabled");
    }
  });
});

describe("confirmTwoFa", () => {
  it("enables MFA and returns backup codes", async () => {
    const { ctx, db } = await createTestContext();
    const { secret } = generateTotpSecret();
    const { sessionToken } = await seedUserWithSession(db, ctx, { totpSecret: secret });
    const code = generateTotpCode(secret);

    const result = await confirmTwoFa(ctx, sessionToken, { code });

    expect(result.status).toBe(200);
    if (result.status !== 200) return;

    expect(result.body.mfaEnabled).toBe(true);
    expect(result.body.backupCodes.length).toBeGreaterThan(0);

    const [stored] = await db.select().from(users);
    expect(stored?.mfaEnabled).toBe(true);

    const storedCodes = await db.select().from(credentials);
    expect(storedCodes.length).toBe(result.body.backupCodes.length);
  });

  it("returns MFA_INVALID for wrong TOTP code", async () => {
    const { ctx, db } = await createTestContext();
    const { secret } = generateTotpSecret();
    const { sessionToken } = await seedUserWithSession(db, ctx, { totpSecret: secret });

    const result = await confirmTwoFa(ctx, sessionToken, { code: "000000" });

    expect(result.status).toBe(400);
    if (result.status === 400) {
      expect(result.body.code).toBe("MFA_INVALID");
      expect(result.body.message).toBe(AUTH_ERROR_MESSAGES.MFA_INVALID);
    }
  });
});

describe("verifyTwoFaLogin", () => {
  async function seedMfaUser() {
    const { ctx, db } = await createTestContext();
    const { secret } = generateTotpSecret();
    const passwordHash = await hashPassword(TEST_PASSWORD);
    const [user] = await db
      .insert(users)
      .values({
        email: "mfa-login@test.local",
        emailNormalized: "mfa-login@test.local",
        passwordHash,
        mfaEnabled: true,
        totpSecret: secret,
      })
      .returning();

    const loginToken = createLoginChallengeToken(user!.id, TEST_SECRET);
    return { ctx, db, user: user!, secret, loginToken };
  }

  it("creates session on valid TOTP code", async () => {
    const { ctx, db, user, secret, loginToken } = await seedMfaUser();
    const code = generateTotpCode(secret);

    const result = await verifyTwoFaLogin(ctx, {
      loginToken,
      code,
      ipAddress: "127.0.0.1",
    });

    expect(result.status).toBe(200);
    if (result.status !== 200 || !("session" in result)) return;

    expect(result.body.user.email).toBe(user.email);
    expect(result.session.token.length).toBeGreaterThan(20);

    const storedSessions = await db.select().from(sessions);
    expect(storedSessions).toHaveLength(1);
    expect(storedSessions[0]?.tokenHash).toBe(hashSessionToken(result.session.token));
  });

  it("returns MFA_INVALID for wrong code", async () => {
    const { ctx, loginToken } = await seedMfaUser();

    const result = await verifyTwoFaLogin(ctx, {
      loginToken,
      code: "000000",
      ipAddress: "127.0.0.1",
    });

    expect(result.status).toBe(400);
    if (result.status === 400) {
      expect(result.body.code).toBe("MFA_INVALID");
    }
  });

  it("returns INVALID_CREDENTIALS for expired login token", async () => {
    const { ctx, user, secret } = await seedMfaUser();
    const expiredToken = createLoginChallengeToken(
      user.id,
      TEST_SECRET,
      new Date(Date.now() - LOGIN_CHALLENGE_TTL_MS - 1_000),
    );
    const code = generateTotpCode(secret);

    const result = await verifyTwoFaLogin(ctx, {
      loginToken: expiredToken,
      code,
      ipAddress: "127.0.0.1",
    });

    expect(result.status).toBe(401);
    if (result.status === 401) {
      expect(result.body.code).toBe("INVALID_CREDENTIALS");
    }
  });

  it("locks account after repeated MFA failures", async () => {
    const { ctx, loginToken } = await seedMfaUser();

    for (let i = 0; i < testConfig.lockoutMaxAttempts; i += 1) {
      await verifyTwoFaLogin(ctx, {
        loginToken,
        code: "000000",
        ipAddress: "127.0.0.1",
      });
    }

    const locked = await verifyTwoFaLogin(ctx, {
      loginToken,
      code: "000000",
      ipAddress: "127.0.0.1",
    });

    expect(locked.status).toBe(423);
    if (locked.status === 423) {
      expect(locked.body.code).toBe("ACCOUNT_LOCKED");
    }
  });
});

describe("regenerateBackupCodes", () => {
  it("replaces backup codes after password verification", async () => {
    const { ctx, db } = await createTestContext();
    const { secret } = generateTotpSecret();
    const { sessionToken } = await seedUserWithSession(db, ctx, {
      mfaEnabled: true,
      totpSecret: secret,
    });

    const oldHashes = await hashBackupCodes(["OLDCODE123"]);
    await db.insert(credentials).values({
      userId: (await db.select().from(users))[0]!.id,
      type: "totp_backup",
      codeHash: oldHashes[0]!,
    });

    const result = await regenerateBackupCodes(ctx, sessionToken, {
      password: TEST_PASSWORD,
    });

    expect(result.status).toBe(200);
    if (result.status !== 200) return;

    expect(result.body.backupCodes.length).toBeGreaterThan(0);

    const storedCodes = await db.select().from(credentials);
    expect(storedCodes).toHaveLength(result.body.backupCodes.length);
    expect(storedCodes.some((row) => row.codeHash === oldHashes[0])).toBe(false);
  });

  it("returns INVALID_CREDENTIALS for wrong password", async () => {
    const { ctx, db } = await createTestContext();
    const { secret } = generateTotpSecret();
    const { sessionToken } = await seedUserWithSession(db, ctx, {
      mfaEnabled: true,
      totpSecret: secret,
    });

    const result = await regenerateBackupCodes(ctx, sessionToken, {
      password: "wrong-password-value",
    });

    expect(result.status).toBe(401);
    if (result.status === 401) {
      expect(result.body.code).toBe("INVALID_CREDENTIALS");
    }
  });
});

describe("disableTwoFa", () => {
  it("disables MFA with password and TOTP code", async () => {
    const { ctx, db } = await createTestContext();
    const { secret } = generateTotpSecret();
    const { sessionToken } = await seedUserWithSession(db, ctx, {
      mfaEnabled: true,
      totpSecret: secret,
    });
    const code = generateTotpCode(secret);

    const result = await disableTwoFa(ctx, sessionToken, {
      password: TEST_PASSWORD,
      code,
    });

    expect(result.status).toBe(204);

    const [stored] = await db.select().from(users);
    expect(stored?.mfaEnabled).toBe(false);
    expect(stored?.totpSecret).toBeNull();

    const storedCodes = await db.select().from(credentials);
    expect(storedCodes).toHaveLength(0);
  });

  it("disables MFA with password and backup code", async () => {
    const { ctx, db } = await createTestContext();
    const { secret } = generateTotpSecret();
    const backupCode = "BACKUPCODE1";
    const { sessionToken, user } = await seedUserWithSession(db, ctx, {
      mfaEnabled: true,
      totpSecret: secret,
    });
    const [codeHash] = await hashBackupCodes([backupCode]);
    await db.insert(credentials).values({
      userId: user.id,
      type: "totp_backup",
      codeHash: codeHash!,
    });

    const result = await disableTwoFa(ctx, sessionToken, {
      password: TEST_PASSWORD,
      backupCode,
    });

    expect(result.status).toBe(204);

    const [stored] = await db.select().from(users);
    expect(stored?.mfaEnabled).toBe(false);
  });
});

describe("2FA route handlers", () => {
  it("enroll handler requires authenticated session", async () => {
    const { ctx } = await createTestContext();
    const handler = createTwoFaEnrollHandler(ctx);

    const response = await handler(
      new Request("http://localhost/auth/2fa/enroll", { method: "POST" }),
    );

    expect(response.status).toBe(401);
    const body = (await response.json()) as { code: string };
    expect(body.code).toBe("SESSION_EXPIRED");
  });

  it("confirm handler sets session cookie context from existing session", async () => {
    const { ctx, db } = await createTestContext();
    const { secret } = generateTotpSecret();
    const { sessionToken } = await seedUserWithSession(db, ctx, { totpSecret: secret });
    const code = generateTotpCode(secret);
    const handler = createTwoFaConfirmHandler(ctx);

    const response = await handler(
      new Request("http://localhost/auth/2fa/confirm", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: `${AUTH_SESSION_COOKIE_NAME}=${sessionToken}`,
        },
        body: JSON.stringify({ code }),
      }),
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as { mfaEnabled: boolean; backupCodes: string[] };
    expect(body.mfaEnabled).toBe(true);
    expect(body.backupCodes.length).toBeGreaterThan(0);
  });
});
