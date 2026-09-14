import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  generateTotpCode,
  type AuthNinjaConfig,
} from "@auth-ninja/core";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createAuthNinjaContext } from "../context.js";
import type { AuthDb } from "../db/client.js";
import { authNinjaSchema } from "../db/schema.js";
import { AUTH_SESSION_COOKIE_NAME } from "../session/constants.js";
import {
  createAuthApiRouter,
  csrfHeader,
  extractSessionCookie,
  jsonRequestInit,
  sessionCookieHeader,
} from "../testing/auth-api-router.js";

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
const TEST_EMAIL = "cycle@test.local";

const migrationsFolder = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../drizzle",
);

function baseConfig(overrides: Partial<AuthNinjaConfig> = {}): AuthNinjaConfig {
  return {
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
    ...overrides,
  };
}

async function createIntegrationContext(configOverrides: Partial<AuthNinjaConfig> = {}) {
  const client = new PGlite();
  const db = drizzle(client, { schema: authNinjaSchema });
  await migrate(db, { migrationsFolder });
  const config = baseConfig(configOverrides);
  const ctx = createAuthNinjaContext({ config, db: db as unknown as AuthDb });
  return { ctx, db, client, config };
}

function buildClientDataJSON(challenge: string, type: "create" | "get"): string {
  return Buffer.from(
    JSON.stringify({
      type: type === "create" ? "webauthn.create" : "webauthn.get",
      challenge,
      origin: "http://localhost:3000",
    }),
  ).toString("base64url");
}

describe("auth cycle integration", () => {
  describe("register → session → logout", () => {
    it("completes the basic auth lifecycle through route handlers", async () => {
      const { ctx } = await createIntegrationContext();
      const api = createAuthApiRouter(ctx);

      const register = await api.dispatch(
        "POST",
        "/auth/register",
        jsonRequestInit({ email: TEST_EMAIL, password: TEST_PASSWORD }),
      );
      expect(register.status).toBe(201);
      const sessionToken = extractSessionCookie(register);
      expect(sessionToken).toBeTruthy();

      const session = await api.dispatch(
        "GET",
        "/auth/session",
        { headers: sessionCookieHeader(sessionToken!) },
      );
      expect(session.status).toBe(200);
      const sessionBody = (await session.json()) as { authenticated: boolean; user: { email: string } };
      expect(sessionBody.authenticated).toBe(true);
      expect(sessionBody.user.email).toBe(TEST_EMAIL);

      const logout = await api.dispatch(
        "POST",
        "/auth/logout",
        { headers: sessionCookieHeader(sessionToken!) },
      );
      expect(logout.status).toBe(204);
      const clearedCookie = logout.headers.get("set-cookie") ?? "";
      expect(clearedCookie).toContain(`${AUTH_SESSION_COOKIE_NAME}=`);
      expect(clearedCookie).toContain("Max-Age=0");

      const afterLogout = await api.dispatch(
        "GET",
        "/auth/session",
        { headers: sessionCookieHeader(sessionToken!) },
      );
      expect(afterLogout.status).toBe(401);
      const expiredBody = (await afterLogout.json()) as { code: string };
      expect(expiredBody.code).toBe("SESSION_EXPIRED");
    });
  });

  describe("register → logout → login → session", () => {
    it("re-authenticates after explicit logout", async () => {
      const { ctx } = await createIntegrationContext();
      const api = createAuthApiRouter(ctx);

      const register = await api.dispatch(
        "POST",
        "/auth/register",
        jsonRequestInit({ email: "relogin@test.local", password: TEST_PASSWORD }),
      );
      const firstToken = extractSessionCookie(register)!;

      await api.dispatch("POST", "/auth/logout", { headers: sessionCookieHeader(firstToken) });

      const login = await api.dispatch(
        "POST",
        "/auth/login",
        jsonRequestInit({ email: "relogin@test.local", password: TEST_PASSWORD }),
      );
      expect(login.status).toBe(200);
      const secondToken = extractSessionCookie(login)!;
      expect(secondToken).toBeTruthy();
      expect(secondToken).not.toBe(firstToken);

      const session = await api.dispatch(
        "GET",
        "/auth/session",
        { headers: sessionCookieHeader(secondToken) },
      );
      expect(session.status).toBe(200);
      const body = (await session.json()) as { user: { email: string } };
      expect(body.user.email).toBe("relogin@test.local");
    });
  });

  describe("2FA full cycle", () => {
    it("enrolls, confirms, logs out, and completes MFA login via handlers", async () => {
      const { ctx } = await createIntegrationContext();
      const api = createAuthApiRouter(ctx);

      const register = await api.dispatch(
        "POST",
        "/auth/register",
        jsonRequestInit({ email: "2fa-cycle@test.local", password: TEST_PASSWORD }),
      );
      const sessionToken = extractSessionCookie(register)!;

      const enroll = await api.dispatch(
        "POST",
        "/auth/2fa/enroll",
        { headers: sessionCookieHeader(sessionToken) },
      );
      expect(enroll.status).toBe(200);
      const enrollBody = (await enroll.json()) as { secret: string };
      const totpCode = generateTotpCode(enrollBody.secret);

      const confirm = await api.dispatch(
        "POST",
        "/auth/2fa/confirm",
        jsonRequestInit({ code: totpCode }, sessionCookieHeader(sessionToken)),
      );
      expect(confirm.status).toBe(200);
      const confirmBody = (await confirm.json()) as { mfaEnabled: boolean; backupCodes: string[] };
      expect(confirmBody.mfaEnabled).toBe(true);
      expect(confirmBody.backupCodes.length).toBeGreaterThan(0);

      await api.dispatch("POST", "/auth/logout", { headers: sessionCookieHeader(sessionToken) });

      const login = await api.dispatch(
        "POST",
        "/auth/login",
        jsonRequestInit({ email: "2fa-cycle@test.local", password: TEST_PASSWORD }),
      );
      expect(login.status).toBe(200);
      const loginBody = (await login.json()) as { loginToken: string };
      expect(loginBody.loginToken.length).toBeGreaterThan(10);

      const verify = await api.dispatch(
        "POST",
        "/auth/2fa/verify",
        jsonRequestInit({ loginToken: loginBody.loginToken, code: generateTotpCode(enrollBody.secret) }),
      );
      expect(verify.status).toBe(200);
      const mfaSessionToken = extractSessionCookie(verify)!;

      const session = await api.dispatch(
        "GET",
        "/auth/session",
        { headers: sessionCookieHeader(mfaSessionToken) },
      );
      expect(session.status).toBe(200);
      const sessionBody = (await session.json()) as { user: { email: string; mfaEnabled: boolean } };
      expect(sessionBody.user.email).toBe("2fa-cycle@test.local");
      expect(sessionBody.user.mfaEnabled).toBe(true);
    });
  });

  describe("passkey full cycle", () => {
    beforeEach(() => {
      vi.mocked(verifyRegistrationResponse).mockReset();
      vi.mocked(verifyAuthenticationResponse).mockReset();
    });

    it("registers a passkey and logs in with it through route handlers", async () => {
      const { ctx } = await createIntegrationContext();
      const api = createAuthApiRouter(ctx);

      const register = await api.dispatch(
        "POST",
        "/auth/register",
        jsonRequestInit({ email: "passkey-cycle@test.local", password: TEST_PASSWORD }),
      );
      const sessionToken = extractSessionCookie(register)!;

      const beginRegister = await api.dispatch(
        "POST",
        "/auth/passkeys/register/begin",
        { headers: sessionCookieHeader(sessionToken) },
      );
      expect(beginRegister.status).toBe(200);
      const beginBody = (await beginRegister.json()) as { options: { challenge: string } };
      const registerChallenge = beginBody.options.challenge;

      vi.mocked(verifyRegistrationResponse).mockResolvedValue({
        verified: true,
        registrationInfo: {
          fmt: "none",
          aaguid: "00000000-0000-0000-0000-000000000000",
          credential: {
            id: "cred-cycle-id",
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

      const finishRegister = await api.dispatch(
        "POST",
        "/auth/passkeys/register/finish",
        jsonRequestInit(
          {
            response: {
              id: "cred-cycle-id",
              rawId: "cred-cycle-id",
              type: "public-key",
              response: {
                clientDataJSON: buildClientDataJSON(registerChallenge, "create"),
                attestationObject: "mock",
              },
            },
          },
          sessionCookieHeader(sessionToken),
        ),
      );
      expect(finishRegister.status).toBe(201);

      await api.dispatch("POST", "/auth/logout", { headers: sessionCookieHeader(sessionToken) });

      const beginLogin = await api.dispatch(
        "POST",
        "/auth/passkeys/login/begin",
        jsonRequestInit({ email: "passkey-cycle@test.local" }),
      );
      expect(beginLogin.status).toBe(200);
      const loginBeginBody = (await beginLogin.json()) as { options: { challenge: string } };
      const loginChallenge = loginBeginBody.options.challenge;

      vi.mocked(verifyAuthenticationResponse).mockResolvedValue({
        verified: true,
        authenticationInfo: {
          newCounter: 1,
          credentialID: "cred-cycle-id",
          userVerified: true,
          credentialDeviceType: "singleDevice",
          credentialBackedUp: false,
          origin: "http://localhost:3000",
          rpID: "localhost",
        },
      });

      const finishLogin = await api.dispatch(
        "POST",
        "/auth/passkeys/login/finish",
        jsonRequestInit({
          response: {
            id: "cred-cycle-id",
            rawId: "cred-cycle-id",
            type: "public-key",
            response: {
              clientDataJSON: buildClientDataJSON(loginChallenge, "get"),
              authenticatorData: "mock",
              signature: "mock",
            },
          },
        }),
      );
      expect(finishLogin.status).toBe(200);
      const passkeySessionToken = extractSessionCookie(finishLogin)!;

      const session = await api.dispatch(
        "GET",
        "/auth/session",
        { headers: sessionCookieHeader(passkeySessionToken) },
      );
      expect(session.status).toBe(200);
      const sessionBody = (await session.json()) as { user: { email: string } };
      expect(sessionBody.user.email).toBe("passkey-cycle@test.local");
    });
  });

  describe("middleware guard integration", () => {
    it("rejects state-changing requests without CSRF when guard is enabled", async () => {
      const { ctx } = await createIntegrationContext({ csrfEnabled: true });
      const api = createAuthApiRouter(ctx, { guard: true });

      const blocked = await api.dispatch(
        "POST",
        "/auth/register",
        jsonRequestInit({ email: "csrf-blocked@test.local", password: TEST_PASSWORD }),
      );
      expect(blocked.status).toBe(403);
      const blockedBody = (await blocked.json()) as { code: string };
      expect(blockedBody.code).toBe("CSRF_INVALID");
    });

    it("allows protected requests with a valid CSRF token from /auth/csrf", async () => {
      const { ctx } = await createIntegrationContext({ csrfEnabled: true });
      const api = createAuthApiRouter(ctx, { guard: true });

      const csrf = await api.dispatch("GET", "/auth/csrf");
      expect(csrf.status).toBe(200);
      const csrfBody = (await csrf.json()) as { token: string };

      const register = await api.dispatch(
        "POST",
        "/auth/register",
        jsonRequestInit(
          { email: "csrf-ok@test.local", password: TEST_PASSWORD },
          csrfHeader(csrfBody.token),
        ),
      );
      expect(register.status).toBe(201);
      expect(extractSessionCookie(register)).toBeTruthy();
    });
  });
});
