import path from "node:path";
import { fileURLToPath } from "node:url";
import { type AuthNinjaConfig } from "@auth-ninja/core";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import type { AuthDb } from "../db/client.js";
import { auditEvents, authNinjaSchema } from "../db/schema.js";
import { AUTH_CSRF_HEADER } from "./constants.js";
import { generateCsrfToken } from "./csrf.js";
import { guardAuthApiRequest } from "./guard.js";
import { InMemoryRateLimiter } from "./rate-limit.js";

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
    lockoutMaxAttempts: 5,
    lockoutWindowMinutes: 15,
    lockoutDurationMinutes: 30,
    require2fa: false,
    twoFaIssuer: "AuthNinja",
    passkeysEnabled: true,
    passkeyRpId: "localhost",
    ipAuditEnabled: true,
    csrfEnabled: true,
    apiRateLimitPerMinute: 3,
    passwordMinScore: 2,
    ...overrides,
  };
}

async function createTestDb() {
  const client = new PGlite();
  const db = drizzle(client, { schema: authNinjaSchema });
  await migrate(db, { migrationsFolder });
  return { db: db as unknown as AuthDb, client };
}

function authRequest(
  pathname: string,
  init: RequestInit & { ip?: string } = {},
): Request {
  const headers = new Headers(init.headers);
  if (init.ip) {
    headers.set("x-forwarded-for", init.ip);
  }
  return new Request(`http://localhost:3000${pathname}`, {
    ...init,
    headers,
  });
}

describe("guardAuthApiRequest", () => {
  it("passes through non-auth paths", async () => {
    const { db } = await createTestDb();
    const response = await guardAuthApiRequest(
      { config: baseConfig(), db },
      authRequest("/api/health"),
    );
    expect(response).toBeUndefined();
  });

  it("rejects state-changing requests without a valid CSRF token", async () => {
    const { db } = await createTestDb();
    const response = await guardAuthApiRequest(
      { config: baseConfig(), db },
      authRequest("/auth/login", { method: "POST" }),
    );

    expect(response?.status).toBe(403);
    const body = await response?.json();
    expect(body.code).toBe("CSRF_INVALID");
  });

  it("allows state-changing requests with a valid CSRF token", async () => {
    const { db } = await createTestDb();
    const token = generateCsrfToken(TEST_SECRET);
    const response = await guardAuthApiRequest(
      { config: baseConfig(), db },
      authRequest("/auth/login", {
        method: "POST",
        headers: { [AUTH_CSRF_HEADER]: token },
      }),
    );

    expect(response).toBeUndefined();
  });

  it("does not require CSRF on GET /auth/session", async () => {
    const { db } = await createTestDb();
    const response = await guardAuthApiRequest(
      { config: baseConfig(), db },
      authRequest("/auth/session", { method: "GET" }),
    );

    expect(response).toBeUndefined();
  });

  it("returns 429 when the per-IP rate limit is exceeded", async () => {
    const { db } = await createTestDb();
    const config = baseConfig({ apiRateLimitPerMinute: 2 });
    const rateLimiter = new InMemoryRateLimiter();
    const ctx = { config, db, rateLimiter };
    const ip = "203.0.113.10";

    await guardAuthApiRequest(ctx, authRequest("/auth/session", { method: "GET", ip }));
    await guardAuthApiRequest(ctx, authRequest("/auth/session", { method: "GET", ip }));

    const blocked = await guardAuthApiRequest(
      ctx,
      authRequest("/auth/session", { method: "GET", ip }),
    );

    expect(blocked?.status).toBe(429);
    expect(blocked?.headers.get("Retry-After")).toBeTruthy();
    const body = await blocked?.json();
    expect(body.code).toBe("RATE_LIMITED");
  });

  it("blocks allowlisted IPs and records an IP audit event", async () => {
    const { db } = await createTestDb();
    const config = baseConfig({
      ipAllowlist: ["198.51.100.1"],
      csrfEnabled: false,
    });
    const ip = "203.0.113.55";

    const response = await guardAuthApiRequest(
      { config, db },
      authRequest("/auth/session", { method: "GET", ip }),
    );

    expect(response?.status).toBe(403);
    const body = await response?.json();
    expect(body.code).toBe("FORBIDDEN");

    const audits = await db
      .select()
      .from(auditEvents)
      .where(eq(auditEvents.ipAddress, ip));
    expect(audits).toHaveLength(1);
    expect(audits[0]?.type).toBe("ip");
    expect(audits[0]?.payload).toEqual({ reason: "allowlist_violation" });
  });

  it("records suspicious_activity audit on rate-limit breach", async () => {
    const { db } = await createTestDb();
    const config = baseConfig({ apiRateLimitPerMinute: 1, csrfEnabled: false });
    const rateLimiter = new InMemoryRateLimiter();
    const ctx = { config, db, rateLimiter };
    const ip = "203.0.113.77";

    await guardAuthApiRequest(ctx, authRequest("/auth/csrf", { method: "GET", ip }));
    await guardAuthApiRequest(ctx, authRequest("/auth/csrf", { method: "GET", ip }));

    const audits = await db
      .select()
      .from(auditEvents)
      .where(eq(auditEvents.ipAddress, ip));
    expect(audits.some((row) => row.payload?.reason === "suspicious_activity")).toBe(true);
  });
});

describe("generateCsrfToken", () => {
  it("produces tokens of at least 32 characters", () => {
    const token = generateCsrfToken(TEST_SECRET);
    expect(token.length).toBeGreaterThanOrEqual(32);
  });
});
