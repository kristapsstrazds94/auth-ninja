import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  generateTotpCode,
  type AuthNinjaConfig,
} from "@auth-ninja/core";
import {
  SHARED_CONTRACT_SCENARIOS,
  runContractScenario,
} from "@auth-ninja/contract-tests";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { describe, expect, it } from "vitest";
import { createAuthNinjaContext } from "../context.js";
import type { AuthDb } from "../db/client.js";
import { authNinjaSchema } from "../db/schema.js";
import { AUTH_CSRF_HEADER } from "../middleware/constants.js";
import { createAuthApiRouter } from "../testing/auth-api-router.js";
import { AUTH_SESSION_COOKIE_NAME } from "../session/constants.js";

const TEST_SECRET = "test-secret-min-32-chars-long!!";

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
    csrfEnabled: true,
    apiRateLimitPerMinute: 100,
    ...overrides,
  };
}

async function createContractContext() {
  const client = new PGlite();
  const db = drizzle(client, { schema: authNinjaSchema });
  await migrate(db, { migrationsFolder });
  const config = baseConfig();
  const ctx = createAuthNinjaContext({ config, db: db as unknown as AuthDb });
  const api = createAuthApiRouter(ctx, { guard: true });
  return { api, client };
}

describe("shared contract scenarios (Next adapter)", () => {
  for (const scenario of SHARED_CONTRACT_SCENARIOS) {
    it(`runs scenario: ${scenario.id}`, async () => {
      const { api, client } = await createContractContext();

      await runContractScenario(
        scenario,
        async (method, pathname, init) => {
          const headers: Record<string, string> = { ...(init?.headers ?? {}) };
          let body: string | undefined;
          if (init?.body !== undefined) {
            body = JSON.stringify(init.body);
          }
          return api.dispatch(method, pathname, { headers, body });
        },
        {
          sessionCookieName: AUTH_SESSION_COOKIE_NAME,
          csrfHeaderName: AUTH_CSRF_HEADER,
          generateTotp: generateTotpCode,
        },
      );

      await client.close();
      expect(true).toBe(true);
    });
  }
});
