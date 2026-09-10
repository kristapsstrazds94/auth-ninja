import { config as loadDotenv } from "dotenv";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { AuthNinjaError } from "./errors.js";
import { authNinjaConfigSchema, type AuthNinjaConfig } from "./config.js";

const WEAK_SECRET_PLACEHOLDERS = [
  "changeme",
  "change-me",
  "your-secret-here",
  "replace-me",
  "secret",
  "password",
  "auth-ninja-secret",
];

export type LoadAuthNinjaConfigOptions = {
  /** Path to `.env` file. Defaults to `.env` in `cwd`. */
  envPath?: string;
  /** Working directory for resolving `envPath`. Defaults to `process.cwd()`. */
  cwd?: string;
  /** Skip reading a `.env` file; use `process.env` (and `env` overrides) only. */
  skipFile?: boolean;
  /** Extra or override env entries (useful in tests). Applied after file/process env. */
  env?: Record<string, string | undefined>;
};

export function isWeakSecret(secret: string): boolean {
  if (secret.length < 32) {
    return true;
  }

  const normalized = secret.trim().toLowerCase();

  if (WEAK_SECRET_PLACEHOLDERS.some((placeholder) => normalized === placeholder)) {
    return true;
  }

  if (/^(.)\1+$/.test(secret)) {
    return true;
  }

  if (new Set(secret).size < 8) {
    return true;
  }

  const sequential =
    "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
  for (let start = 0; start < sequential.length; start++) {
    let pattern = "";
    while (pattern.length < secret.length) {
      pattern += sequential.slice(start);
    }
    if (secret === pattern.slice(0, secret.length)) {
      return true;
    }
  }

  return false;
}

function parseBool(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined || value.trim() === "") {
    return defaultValue;
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === "true" || normalized === "1") {
    return true;
  }
  if (normalized === "false" || normalized === "0") {
    return false;
  }
  return defaultValue;
}

function parsePositiveInt(value: string | undefined): number | undefined {
  if (value === undefined || value.trim() === "") {
    return undefined;
  }
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return undefined;
  }
  return parsed;
}

function parseOptionalString(value: string | undefined): string | undefined {
  if (value === undefined || value.trim() === "") {
    return undefined;
  }
  return value.trim();
}

function parseAllowlist(value: string | undefined): string[] | undefined {
  const raw = parseOptionalString(value);
  if (!raw) {
    return undefined;
  }
  const entries = raw
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
  return entries.length > 0 ? entries : undefined;
}

export function envRecordToAuthNinjaConfig(
  env: Record<string, string | undefined>,
): AuthNinjaConfig {
  const secret = env.AUTH_NINJA_SECRET?.trim();
  if (!secret) {
    throw new AuthNinjaError("VALIDATION_ERROR", "AUTH_NINJA_SECRET is required");
  }
  if (isWeakSecret(secret)) {
    throw new AuthNinjaError(
      "VALIDATION_ERROR",
      "AUTH_NINJA_SECRET is too weak — use at least 32 random characters",
    );
  }

  const baseUrl = env.AUTH_NINJA_BASE_URL?.trim();
  if (!baseUrl) {
    throw new AuthNinjaError("VALIDATION_ERROR", "AUTH_NINJA_BASE_URL is required");
  }

  const databaseUrl = env.AUTH_NINJA_DATABASE_URL?.trim();
  if (!databaseUrl) {
    throw new AuthNinjaError(
      "VALIDATION_ERROR",
      "AUTH_NINJA_DATABASE_URL is required",
    );
  }

  const raw = {
    secret,
    baseUrl,
    databaseUrl,
    sessionIdleMinutes: parsePositiveInt(env.AUTH_NINJA_SESSION_IDLE_MINUTES),
    sessionAbsoluteHours: parsePositiveInt(env.AUTH_NINJA_SESSION_ABSOLUTE_HOURS),
    lockoutMaxAttempts: parsePositiveInt(env.AUTH_NINJA_LOCKOUT_MAX_ATTEMPTS),
    lockoutWindowMinutes: parsePositiveInt(env.AUTH_NINJA_LOCKOUT_WINDOW_MINUTES),
    lockoutDurationMinutes: parsePositiveInt(
      env.AUTH_NINJA_LOCKOUT_DURATION_MINUTES,
    ),
    require2fa: parseBool(env.AUTH_NINJA_REQUIRE_2FA, false),
    twoFaIssuer: parseOptionalString(env.AUTH_NINJA_2FA_ISSUER),
    passkeysEnabled: parseBool(env.AUTH_NINJA_PASSKEYS_ENABLED, true),
    passkeyRpId: parseOptionalString(env.AUTH_NINJA_PASSKEY_RP_ID),
    ipAuditEnabled: parseBool(env.AUTH_NINJA_IP_AUDIT_ENABLED, true),
    ipAllowlist: parseAllowlist(env.AUTH_NINJA_IP_ALLOWLIST),
    apiRateLimitPerMinute: parsePositiveInt(env.AUTH_NINJA_API_RATE_LIMIT),
    csrfEnabled: parseBool(env.AUTH_NINJA_CSRF_ENABLED, true),
    redisUrl: parseOptionalString(env.AUTH_NINJA_REDIS_URL),
  };

  const result = authNinjaConfigSchema.safeParse(raw);
  if (!result.success) {
    const message = result.error.issues.map((issue) => issue.message).join("; ");
    throw new AuthNinjaError("VALIDATION_ERROR", message);
  }

  return result.data;
}

export function loadAuthNinjaConfig(
  options: LoadAuthNinjaConfigOptions = {},
): AuthNinjaConfig {
  const cwd = options.cwd ?? process.cwd();
  const envPath = resolve(cwd, options.envPath ?? ".env");

  const merged: Record<string, string | undefined> = {};

  if (!options.skipFile && existsSync(envPath)) {
    const { parsed, error } = loadDotenv({ path: envPath, processEnv: {} });
    if (error) {
      throw new AuthNinjaError(
        "VALIDATION_ERROR",
        `Failed to read ${envPath}: ${error.message}`,
      );
    }
    if (parsed) {
      Object.assign(merged, parsed);
    }
  }

  Object.assign(merged, process.env);

  if (options.env) {
    Object.assign(merged, options.env);
  }

  return envRecordToAuthNinjaConfig(merged);
}
