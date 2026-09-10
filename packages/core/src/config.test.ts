import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { authNinjaConfigSchema } from "./config.js";
import {
  envRecordToAuthNinjaConfig,
  isWeakSecret,
  loadAuthNinjaConfig,
} from "./env-loader.js";
import { AuthNinjaError } from "./errors.js";

const VALID_SECRET = "test-secret-min-32-chars-long-!!";

const validEnv = {
  AUTH_NINJA_SECRET: VALID_SECRET,
  AUTH_NINJA_BASE_URL: "http://localhost:3000",
  AUTH_NINJA_DATABASE_URL: "postgresql://localhost:5432/auth_ninja",
};

describe("authNinjaConfigSchema", () => {
  it("rejects secrets shorter than 32 characters", () => {
    const result = authNinjaConfigSchema.safeParse({
      secret: "too-short",
      baseUrl: "https://app.example.com",
      databaseUrl: "postgresql://localhost/db",
    });
    expect(result.success).toBe(false);
  });

  it("accepts valid minimal config with defaults", () => {
    const result = authNinjaConfigSchema.safeParse({
      secret: "a".repeat(32),
      baseUrl: "https://app.example.com",
      databaseUrl: "postgresql://localhost/db",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.sessionIdleMinutes).toBe(15);
      expect(result.data.csrfEnabled).toBe(true);
      expect(result.data.twoFaIssuer).toBe("AuthNinja");
    }
  });
});

describe("isWeakSecret", () => {
  it("rejects secrets shorter than 32 characters", () => {
    expect(isWeakSecret("short")).toBe(true);
  });

  it("rejects repeated single-character secrets", () => {
    expect(isWeakSecret("a".repeat(32))).toBe(true);
  });

  it("rejects exact placeholder values", () => {
    expect(isWeakSecret("change-me")).toBe(true);
    expect(isWeakSecret("your-secret-here")).toBe(true);
  });

  it("rejects low-entropy secrets", () => {
    expect(isWeakSecret("abababababababababababababababab")).toBe(true);
  });

  it("accepts test fixture secret with sufficient entropy", () => {
    expect(isWeakSecret(VALID_SECRET)).toBe(false);
  });
});

describe("envRecordToAuthNinjaConfig", () => {
  it("maps env vars and applies defaults", () => {
    const config = envRecordToAuthNinjaConfig(validEnv);
    expect(config.secret).toBe(VALID_SECRET);
    expect(config.baseUrl).toBe("http://localhost:3000");
    expect(config.databaseUrl).toBe("postgresql://localhost:5432/auth_ninja");
    expect(config.sessionIdleMinutes).toBe(15);
    expect(config.require2fa).toBe(false);
    expect(config.passkeysEnabled).toBe(true);
  });

  it("parses boolean and numeric overrides", () => {
    const config = envRecordToAuthNinjaConfig({
      ...validEnv,
      AUTH_NINJA_REQUIRE_2FA: "true",
      AUTH_NINJA_SESSION_IDLE_MINUTES: "30",
      AUTH_NINJA_PASSKEYS_ENABLED: "false",
      AUTH_NINJA_IP_ALLOWLIST: "10.0.0.0/8, 192.168.0.0/16",
    });
    expect(config.require2fa).toBe(true);
    expect(config.sessionIdleMinutes).toBe(30);
    expect(config.passkeysEnabled).toBe(false);
    expect(config.ipAllowlist).toEqual(["10.0.0.0/8", "192.168.0.0/16"]);
  });

  it("throws AuthNinjaError when secret is missing", () => {
    expect(() =>
      envRecordToAuthNinjaConfig({
        AUTH_NINJA_BASE_URL: "http://localhost:3000",
        AUTH_NINJA_DATABASE_URL: "postgresql://localhost/db",
      }),
    ).toThrow(AuthNinjaError);
  });

  it("throws AuthNinjaError for weak secrets", () => {
    expect(() =>
      envRecordToAuthNinjaConfig({
        ...validEnv,
        AUTH_NINJA_SECRET: "a".repeat(32),
      }),
    ).toThrow(/too weak/i);
  });

  it("throws AuthNinjaError for invalid base URL", () => {
    expect(() =>
      envRecordToAuthNinjaConfig({
        ...validEnv,
        AUTH_NINJA_BASE_URL: "not-a-url",
      }),
    ).toThrow(AuthNinjaError);
  });
});

describe("loadAuthNinjaConfig", () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    while (tempDirs.length > 0) {
      tempDirs.pop();
    }
  });

  it("loads configuration from a .env file", () => {
    const dir = mkdtempSync(join(tmpdir(), "auth-ninja-config-"));
    tempDirs.push(dir);
    writeFileSync(
      join(dir, ".env"),
      [
        `AUTH_NINJA_SECRET=${VALID_SECRET}`,
        "AUTH_NINJA_BASE_URL=http://localhost:3000",
        "AUTH_NINJA_DATABASE_URL=postgresql://localhost:5432/auth_ninja",
        "AUTH_NINJA_SESSION_IDLE_MINUTES=20",
      ].join("\n"),
      "utf8",
    );

    const config = loadAuthNinjaConfig({ cwd: dir, skipFile: false, env: {} });
    expect(config.sessionIdleMinutes).toBe(20);
    expect(config.secret).toBe(VALID_SECRET);
  });

  it("prefers explicit env overrides over file values", () => {
    const dir = mkdtempSync(join(tmpdir(), "auth-ninja-config-"));
    tempDirs.push(dir);
    writeFileSync(
      join(dir, ".env"),
      [
        `AUTH_NINJA_SECRET=${VALID_SECRET}`,
        "AUTH_NINJA_BASE_URL=http://localhost:3000",
        "AUTH_NINJA_DATABASE_URL=postgresql://localhost:5432/auth_ninja",
        "AUTH_NINJA_SESSION_IDLE_MINUTES=20",
      ].join("\n"),
      "utf8",
    );

    const config = loadAuthNinjaConfig({
      cwd: dir,
      env: { AUTH_NINJA_SESSION_IDLE_MINUTES: "45" },
    });
    expect(config.sessionIdleMinutes).toBe(45);
  });

  it("loads from process env when skipFile is true", () => {
    const config = loadAuthNinjaConfig({
      skipFile: true,
      env: {
        ...validEnv,
        AUTH_NINJA_2FA_ISSUER: "MyApp",
      },
    });
    expect(config.twoFaIssuer).toBe("MyApp");
  });
});
