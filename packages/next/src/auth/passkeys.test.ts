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
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createAuthNinjaContext } from "../context.js";
import type { AuthDb } from "../db/client.js";
import { authNinjaSchema, credentials, sessions, users } from "../db/schema.js";
import { AUTH_SESSION_COOKIE_NAME } from "../session/constants.js";
import { createSession } from "../session/service.js";
import { hashSessionToken } from "../session/token.js";
import {
  createPasskeyListHandler,
  createPasskeyRegisterBeginHandler,
} from "../routes/passkeys.js";
import {
  deletePasskey,
  listPasskeys,
  passkeyLoginBegin,
  passkeyLoginFinish,
  passkeyRegisterBegin,
  passkeyRegisterFinish,
} from "./passkeys.js";
import { InMemoryWebAuthnChallengeStore } from "./webauthn-challenge-store.js";

vi.mock("@simplewebauthn/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@simplewebauthn/server")>();
  return {
    ...actual,
    verifyRegistrationResponse: vi.fn(),
    verifyAuthenticationResponse: vi.fn(),
  };
});

import {
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from "@simplewebauthn/server";

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

function buildClientDataJSON(challenge: string, type: "create" | "get"): string {
  return Buffer.from(
    JSON.stringify({
      type: type === "create" ? "webauthn.create" : "webauthn.get",
      challenge,
      origin: "http://localhost:3000",
    }),
  ).toString("base64url");
}

async function createTestContext(challengeStore = new InMemoryWebAuthnChallengeStore()) {
  const client = new PGlite();
  const db = drizzle(client, { schema: authNinjaSchema });
  await migrate(db, { migrationsFolder });
  const ctx = createAuthNinjaContext({
    config: { ...testConfig },
    db: db as unknown as AuthDb,
    webAuthnChallengeStore: challengeStore,
  });
  return { ctx, db, client, challengeStore };
}

async function seedUserWithSession(
  db: ReturnType<typeof drizzle<typeof authNinjaSchema>>,
  ctx: ReturnType<typeof createAuthNinjaContext>,
) {
  const passwordHash = await hashPassword(TEST_PASSWORD);
  const [user] = await db
    .insert(users)
    .values({
      email: "passkey@test.local",
      emailNormalized: "passkey@test.local",
      passwordHash,
    })
    .returning();

  const session = await createSession(db as unknown as AuthDb, testConfig, user!.id);
  return { user: user!, sessionToken: session.token };
}

async function seedPasskeyCredential(
  db: ReturnType<typeof drizzle<typeof authNinjaSchema>>,
  userId: string,
  credentialId = "cred-test-id",
) {
  await db.insert(credentials).values({
    userId,
    type: "passkey",
    credentialId,
    publicKey: Buffer.from([1, 2, 3]).toString("base64"),
    counter: 0,
  });
  return credentialId;
}

describe("passkeyRegisterBegin", () => {
  it("returns WebAuthn registration options for authenticated user", async () => {
    const { ctx, db } = await createTestContext();
    const { sessionToken } = await seedUserWithSession(db, ctx);

    const result = await passkeyRegisterBegin(ctx, sessionToken);

    expect(result.status).toBe(200);
    if (result.status !== 200) return;

    expect(result.body.options.challenge).toBeTruthy();
    expect(result.body.options.rp).toMatchObject({ id: "localhost", name: "AuthNinja" });
  });

  it("throws SESSION_EXPIRED without session cookie", async () => {
    const { ctx } = await createTestContext();

    await expect(passkeyRegisterBegin(ctx, undefined)).rejects.toMatchObject({
      code: "SESSION_EXPIRED",
    });
  });

  it("throws FORBIDDEN when passkeys are disabled", async () => {
    const { ctx, db } = await createTestContext();
    const { sessionToken } = await seedUserWithSession(db, ctx);
    ctx.config.passkeysEnabled = false;

    await expect(passkeyRegisterBegin(ctx, sessionToken)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
});

describe("passkeyRegisterFinish", () => {
  beforeEach(() => {
    vi.mocked(verifyRegistrationResponse).mockReset();
  });

  it("persists credential after successful verification", async () => {
    const challengeStore = new InMemoryWebAuthnChallengeStore();
    const { ctx, db } = await createTestContext(challengeStore);
    const { user, sessionToken } = await seedUserWithSession(db, ctx);

    const begin = await passkeyRegisterBegin(ctx, sessionToken);
    const challenge = begin.body.options.challenge as string;

    vi.mocked(verifyRegistrationResponse).mockResolvedValue({
      verified: true,
      registrationInfo: {
        fmt: "none",
        aaguid: "00000000-0000-0000-0000-000000000000",
        credential: {
          id: "cred-new-id",
          publicKey: new Uint8Array([4, 5, 6]),
          counter: 0,
          transports: ["internal"],
        },
        credentialType: "public-key",
        attestationObject: new Uint8Array(),
        userVerified: true,
        credentialDeviceType: "singleDevice",
        credentialBackedUp: false,
        origin: "http://localhost:3000",
        rpID: "localhost",
      },
    });

    const result = await passkeyRegisterFinish(ctx, sessionToken, {
      response: {
        id: "cred-new-id",
        rawId: "cred-new-id",
        type: "public-key",
        response: {
          clientDataJSON: buildClientDataJSON(challenge, "create"),
          attestationObject: "mock",
        },
      },
    });

    expect(result.status).toBe(201);
    if (result.status !== 201) return;

    expect(result.body.credentialId).toBe("cred-new-id");

    const stored = await db
      .select()
      .from(credentials)
      .where(eq(credentials.userId, user.id));
    expect(stored).toHaveLength(1);
    expect(stored[0]?.credentialId).toBe("cred-new-id");
  });

  it("returns VALIDATION_ERROR when challenge is missing or expired", async () => {
    const { ctx, db } = await createTestContext();
    const { sessionToken } = await seedUserWithSession(db, ctx);

    const result = await passkeyRegisterFinish(ctx, sessionToken, {
      response: {
        id: "cred-new-id",
        response: {
          clientDataJSON: buildClientDataJSON("unknown-challenge", "create"),
          attestationObject: "mock",
        },
      },
    });

    expect(result.status).toBe(400);
    if (result.status === 400) {
      expect(result.body.code).toBe("VALIDATION_ERROR");
    }
  });
});

describe("passkeyLoginBegin", () => {
  it("returns authentication options without email", async () => {
    const { ctx } = await createTestContext();

    const result = await passkeyLoginBegin(ctx, {});

    expect(result.status).toBe(200);
    if (result.status !== 200) return;

    expect(result.body.options.challenge).toBeTruthy();
  });

  it("returns authentication options when user has passkeys", async () => {
    const { ctx, db } = await createTestContext();
    const passwordHash = await hashPassword(TEST_PASSWORD);
    const [user] = await db
      .insert(users)
      .values({
        email: "login@test.local",
        emailNormalized: "login@test.local",
        passwordHash,
      })
      .returning();
    await seedPasskeyCredential(db, user!.id);

    const result = await passkeyLoginBegin(ctx, { email: "login@test.local" });

    expect(result.status).toBe(200);
    if (result.status !== 200) return;

    expect(Array.isArray(result.body.options.allowCredentials)).toBe(true);
  });

  it("returns generic validation error for unknown email", async () => {
    const { ctx } = await createTestContext();

    const result = await passkeyLoginBegin(ctx, { email: "missing@test.local" });

    expect(result.status).toBe(400);
    if (result.status === 400) {
      expect(result.body.message).toBe(AUTH_ERROR_MESSAGES.VALIDATION_ERROR);
    }
  });
});

describe("passkeyLoginFinish", () => {
  beforeEach(() => {
    vi.mocked(verifyAuthenticationResponse).mockReset();
  });

  it("creates session on valid passkey assertion", async () => {
    const { ctx, db } = await createTestContext();
    const passwordHash = await hashPassword(TEST_PASSWORD);
    const [user] = await db
      .insert(users)
      .values({
        email: "finish@test.local",
        emailNormalized: "finish@test.local",
        passwordHash,
      })
      .returning();
    const credentialId = await seedPasskeyCredential(db, user!.id);

    const begin = await passkeyLoginBegin(ctx, { email: "finish@test.local" });
    expect(begin.status).toBe(200);
    if (begin.status !== 200) return;
    const challenge = begin.body.options.challenge as string;

    vi.mocked(verifyAuthenticationResponse).mockResolvedValue({
      verified: true,
      authenticationInfo: {
        newCounter: 1,
        credentialID: credentialId,
        userVerified: true,
        credentialDeviceType: "singleDevice",
        credentialBackedUp: false,
        origin: "http://localhost:3000",
        rpID: "localhost",
      },
    });

    const result = await passkeyLoginFinish(ctx, {
      response: {
        id: credentialId,
        rawId: credentialId,
        type: "public-key",
        response: {
          clientDataJSON: buildClientDataJSON(challenge, "get"),
          authenticatorData: "mock",
          signature: "mock",
        },
      },
      ipAddress: "127.0.0.1",
    });

    expect(result.status).toBe(200);
    if (result.status !== 200 || !("session" in result)) return;

    expect(result.body.user.email).toBe("finish@test.local");
    expect(result.session.token.length).toBeGreaterThan(20);

    const storedSessions = await db.select().from(sessions);
    expect(storedSessions).toHaveLength(1);
    expect(storedSessions[0]?.tokenHash).toBe(hashSessionToken(result.session.token));
  });

  it("returns INVALID_CREDENTIALS on verification failure", async () => {
    const { ctx, db } = await createTestContext();
    const passwordHash = await hashPassword(TEST_PASSWORD);
    const [user] = await db
      .insert(users)
      .values({
        email: "fail@test.local",
        emailNormalized: "fail@test.local",
        passwordHash,
      })
      .returning();
    const credentialId = await seedPasskeyCredential(db, user!.id);

    const begin = await passkeyLoginBegin(ctx, { email: "fail@test.local" });
    expect(begin.status).toBe(200);
    if (begin.status !== 200) return;
    const challenge = begin.body.options.challenge as string;

    vi.mocked(verifyAuthenticationResponse).mockRejectedValue(new Error("invalid"));

    const result = await passkeyLoginFinish(ctx, {
      response: {
        id: credentialId,
        response: {
          clientDataJSON: buildClientDataJSON(challenge, "get"),
          authenticatorData: "mock",
          signature: "mock",
        },
      },
      ipAddress: "127.0.0.1",
    });

    expect(result.status).toBe(401);
    if (result.status === 401) {
      expect(result.body.code).toBe("INVALID_CREDENTIALS");
    }
  });

  it("locks account after repeated passkey failures", async () => {
    const { ctx, db } = await createTestContext();
    const passwordHash = await hashPassword(TEST_PASSWORD);
    const [user] = await db
      .insert(users)
      .values({
        email: "lock@test.local",
        emailNormalized: "lock@test.local",
        passwordHash,
      })
      .returning();
    const credentialId = await seedPasskeyCredential(db, user!.id);

    vi.mocked(verifyAuthenticationResponse).mockRejectedValue(new Error("invalid"));

    for (let i = 0; i < testConfig.lockoutMaxAttempts; i += 1) {
      const begin = await passkeyLoginBegin(ctx, { email: "lock@test.local" });
      if (begin.status !== 200) return;
      const challenge = begin.body.options.challenge as string;

      await passkeyLoginFinish(ctx, {
        response: {
          id: credentialId,
          response: {
            clientDataJSON: buildClientDataJSON(challenge, "get"),
            authenticatorData: "mock",
            signature: "mock",
          },
        },
        ipAddress: "127.0.0.1",
      });
    }

    const begin = await passkeyLoginBegin(ctx, { email: "lock@test.local" });
    expect(begin.status).toBe(200);
    if (begin.status !== 200) return;
    const challenge = begin.body.options.challenge as string;

    const locked = await passkeyLoginFinish(ctx, {
      response: {
        id: credentialId,
        response: {
          clientDataJSON: buildClientDataJSON(challenge, "get"),
          authenticatorData: "mock",
          signature: "mock",
        },
      },
      ipAddress: "127.0.0.1",
    });

    expect(locked.status).toBe(423);
    if (locked.status === 423) {
      expect(locked.body.code).toBe("ACCOUNT_LOCKED");
    }
  });
});

describe("listPasskeys and deletePasskey", () => {
  it("lists passkeys for authenticated user", async () => {
    const { ctx, db } = await createTestContext();
    const { user, sessionToken } = await seedUserWithSession(db, ctx);
    await seedPasskeyCredential(db, user.id, "cred-a");

    const result = await listPasskeys(ctx, sessionToken);

    expect(result.status).toBe(200);
    expect(result.body.passkeys).toHaveLength(1);
    expect(result.body.passkeys[0]?.credentialId).toBe("cred-a");
  });

  it("deletes owned passkey", async () => {
    const { ctx, db } = await createTestContext();
    const { user, sessionToken } = await seedUserWithSession(db, ctx);
    await seedPasskeyCredential(db, user.id, "cred-del");

    const result = await deletePasskey(ctx, sessionToken, "cred-del");

    expect(result.status).toBe(204);

    const remaining = await db.select().from(credentials).where(eq(credentials.userId, user.id));
    expect(remaining).toHaveLength(0);
  });

  it("returns 404 for passkey not owned by user", async () => {
    const { ctx, db } = await createTestContext();
    const { sessionToken } = await seedUserWithSession(db, ctx);

    const result = await deletePasskey(ctx, sessionToken, "missing-cred");

    expect(result.status).toBe(404);
    if (result.status === 404) {
      expect(result.body.message).toBe("Unable to remove passkey.");
    }
  });
});

describe("passkey route handlers", () => {
  it("register begin handler requires authenticated session", async () => {
    const { ctx } = await createTestContext();
    const handler = createPasskeyRegisterBeginHandler(ctx);

    const response = await handler(
      new Request("http://localhost/auth/passkeys/register/begin", { method: "POST" }),
    );

    expect(response.status).toBe(401);
    const body = (await response.json()) as { code: string };
    expect(body.code).toBe("SESSION_EXPIRED");
  });

  it("list handler returns passkeys for session", async () => {
    const { ctx, db } = await createTestContext();
    const { user, sessionToken } = await seedUserWithSession(db, ctx);
    await seedPasskeyCredential(db, user.id, "cred-list");

    const handler = createPasskeyListHandler(ctx);
    const response = await handler(
      new Request("http://localhost/auth/passkeys", {
        method: "GET",
        headers: { cookie: `${AUTH_SESSION_COOKIE_NAME}=${sessionToken}` },
      }),
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as { passkeys: Array<{ credentialId: string }> };
    expect(body.passkeys[0]?.credentialId).toBe("cred-list");
  });
});
