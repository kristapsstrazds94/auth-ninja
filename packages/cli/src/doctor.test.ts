import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AuthNinjaConfig } from "@auth-ninja/core";
import { afterEach, describe, expect, it } from "vitest";
import {
  evaluateConfigChecks,
  runDoctor,
  runDoctorChecks,
} from "./commands/doctor.js";

const VALID_SECRET = "test-secret-min-32-chars-long-!!";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

async function makeTempProject(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "auth-ninja-doctor-"));
  tempDirs.push(dir);
  return dir;
}

function baseConfig(overrides: Partial<AuthNinjaConfig> = {}): AuthNinjaConfig {
  return {
    secret: VALID_SECRET,
    baseUrl: "https://app.example.com",
    databaseUrl: "postgresql://localhost:5432/auth_ninja",
    sessionIdleMinutes: 15,
    sessionAbsoluteHours: 8,
    lockoutMaxAttempts: 5,
    lockoutWindowMinutes: 15,
    lockoutDurationMinutes: 30,
    require2fa: false,
    twoFaIssuer: "AuthNinja",
    passkeysEnabled: true,
    passkeyRpId: "app.example.com",
    ipAuditEnabled: true,
    csrfEnabled: true,
    apiRateLimitPerMinute: 100,
    passwordMinScore: 2,
    ...overrides,
  };
}

async function writeEnv(
  cwd: string,
  lines: Record<string, string>,
): Promise<void> {
  const content = Object.entries(lines)
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
  await writeFile(join(cwd, ".env"), content, "utf8");
}

describe("evaluateConfigChecks", () => {
  it("passes HTTPS and Secure cookie checks for production URLs", () => {
    const checks = evaluateConfigChecks(baseConfig());
    expect(checks.find((check) => check.id === "https")?.status).toBe("pass");
    expect(checks.find((check) => check.id === "cookies")?.status).toBe("pass");
  });

  it("warns for HTTP localhost in development mode", () => {
    const checks = evaluateConfigChecks(
      baseConfig({ baseUrl: "http://localhost:3000", passkeyRpId: "localhost" }),
    );
    expect(checks.find((check) => check.id === "https")?.status).toBe("warn");
    expect(checks.find((check) => check.id === "cookies")?.status).toBe("warn");
  });

  it("fails for HTTP non-localhost base URLs", () => {
    const checks = evaluateConfigChecks(
      baseConfig({ baseUrl: "http://app.example.com", passkeyRpId: "app.example.com" }),
    );
    expect(checks.find((check) => check.id === "https")?.status).toBe("fail");
    expect(checks.find((check) => check.id === "cookies")?.status).toBe("fail");
  });

  it("fails when session absolute lifetime exceeds 8 hours", () => {
    const checks = evaluateConfigChecks(baseConfig({ sessionAbsoluteHours: 9 }));
    expect(checks.find((check) => check.id === "session-absolute")?.status).toBe("fail");
  });

  it("fails HTTP localhost when production mode is enabled", () => {
    const checks = evaluateConfigChecks(
      baseConfig({ baseUrl: "http://localhost:3000", passkeyRpId: "localhost" }),
      { production: true },
    );
    expect(checks.find((check) => check.id === "https")?.status).toBe("fail");
  });
});

describe("runDoctorChecks", () => {
  it("includes a secret pass check when config is valid", () => {
    const checks = runDoctorChecks(baseConfig());
    expect(checks.find((check) => check.id === "secret")?.status).toBe("pass");
  });
});

describe("runDoctor", () => {
  it("passes for a valid .env file", async () => {
    const cwd = await makeTempProject();
    await writeEnv(cwd, {
      AUTH_NINJA_SECRET: VALID_SECRET,
      AUTH_NINJA_BASE_URL: "https://app.example.com",
      AUTH_NINJA_DATABASE_URL: "postgresql://localhost:5432/auth_ninja",
      AUTH_NINJA_PASSKEY_RP_ID: "app.example.com",
    });

    const result = await runDoctor({ cwd });
    expect(result.ok).toBe(true);
    expect(result.config?.baseUrl).toBe("https://app.example.com");
  });

  it("fails when AUTH_NINJA_SECRET is missing", async () => {
    const cwd = await makeTempProject();
    await writeEnv(cwd, {
      AUTH_NINJA_SECRET: "",
      AUTH_NINJA_BASE_URL: "https://app.example.com",
      AUTH_NINJA_DATABASE_URL: "postgresql://localhost:5432/auth_ninja",
    });

    const result = await runDoctor({ cwd });
    expect(result.ok).toBe(false);
    expect(result.checks.find((check) => check.id === "secret")?.message).toContain(
      "not set",
    );
  });

  it("fails when AUTH_NINJA_SECRET is too weak", async () => {
    const cwd = await makeTempProject();
    await writeEnv(cwd, {
      AUTH_NINJA_SECRET: "changeme",
      AUTH_NINJA_BASE_URL: "https://app.example.com",
      AUTH_NINJA_DATABASE_URL: "postgresql://localhost:5432/auth_ninja",
    });

    const result = await runDoctor({ cwd });
    expect(result.ok).toBe(false);
    expect(result.checks.find((check) => check.id === "secret")?.message).toContain(
      "too weak",
    );
  });

  it("does not print the secret value in failure messages", async () => {
    const cwd = await makeTempProject();
    await writeEnv(cwd, {
      AUTH_NINJA_SECRET: "changeme",
      AUTH_NINJA_BASE_URL: "https://app.example.com",
      AUTH_NINJA_DATABASE_URL: "postgresql://localhost:5432/auth_ninja",
    });

    const result = await runDoctor({ cwd });
    for (const check of result.checks) {
      expect(check.message).not.toContain("changeme");
    }
  });
});
