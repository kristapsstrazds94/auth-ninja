import { existsSync } from "node:fs";
import { join } from "node:path";
import {
  type AuthNinjaConfig,
  AuthNinjaError,
  loadAuthNinjaConfig,
} from "@auth-ninja/core";

export type DoctorCheckStatus = "pass" | "warn" | "fail";

export type DoctorCheck = {
  id: string;
  status: DoctorCheckStatus;
  message: string;
};

export type DoctorOptions = {
  cwd?: string;
  /** When true, HTTP base URLs fail even on localhost. */
  production?: boolean;
  /** When true, warnings also fail the command. */
  strict?: boolean;
};

export type DoctorResult = {
  checks: DoctorCheck[];
  ok: boolean;
  config: AuthNinjaConfig | null;
};

const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "[::1]"]);

function isLocalHttpUrl(baseUrl: string): boolean {
  try {
    const url = new URL(baseUrl);
    return url.protocol === "http:" && LOCAL_HOSTNAMES.has(url.hostname);
  } catch {
    return false;
  }
}

function sessionCookieSecure(config: AuthNinjaConfig): boolean {
  return config.baseUrl.startsWith("https://");
}

/** Evaluate HTTPS, cookie, and session checks for a loaded config. */
export function evaluateConfigChecks(
  config: AuthNinjaConfig,
  options: Pick<DoctorOptions, "production"> = {},
): DoctorCheck[] {
  const checks: DoctorCheck[] = [];
  const production = options.production ?? false;
  const isHttps = config.baseUrl.startsWith("https://");
  const isLocalHttp = isLocalHttpUrl(config.baseUrl);

  if (isHttps) {
    checks.push({
      id: "https",
      status: "pass",
      message: "AUTH_NINJA_BASE_URL uses HTTPS",
    });
  } else if (isLocalHttp && !production) {
    checks.push({
      id: "https",
      status: "warn",
      message:
        "AUTH_NINJA_BASE_URL uses HTTP on localhost — use HTTPS in production",
    });
  } else {
    checks.push({
      id: "https",
      status: "fail",
      message: production
        ? "AUTH_NINJA_BASE_URL must use HTTPS in production"
        : "AUTH_NINJA_BASE_URL uses HTTP outside localhost — cookies cannot be Secure",
    });
  }

  const secure = sessionCookieSecure(config);
  if (secure) {
    checks.push({
      id: "cookies",
      status: "pass",
      message: "Session cookies will include Secure, HttpOnly, and SameSite=Strict",
    });
  } else if (isLocalHttp && !production) {
    checks.push({
      id: "cookies",
      status: "warn",
      message:
        "Session cookies omit Secure flag over HTTP — expected for local dev only",
    });
  } else {
    checks.push({
      id: "cookies",
      status: "fail",
      message:
        "Session cookies cannot be Secure without HTTPS — set AUTH_NINJA_BASE_URL to https://",
    });
  }

  if (config.sessionIdleMinutes > 15) {
    checks.push({
      id: "session-idle",
      status: "warn",
      message: `AUTH_NINJA_SESSION_IDLE_MINUTES is ${config.sessionIdleMinutes} — recommended max is 15`,
    });
  } else {
    checks.push({
      id: "session-idle",
      status: "pass",
      message: "Session idle timeout within recommended 15-minute limit",
    });
  }

  if (config.sessionAbsoluteHours > 8) {
    checks.push({
      id: "session-absolute",
      status: "fail",
      message: `AUTH_NINJA_SESSION_ABSOLUTE_HOURS is ${config.sessionAbsoluteHours} — maximum is 8 hours`,
    });
  } else {
    checks.push({
      id: "session-absolute",
      status: "pass",
      message: "Session absolute lifetime within 8-hour maximum",
    });
  }

  if (!config.csrfEnabled) {
    checks.push({
      id: "csrf",
      status: production ? "fail" : "warn",
      message: "AUTH_NINJA_CSRF_ENABLED is false — CSRF protection should stay enabled",
    });
  } else {
    checks.push({
      id: "csrf",
      status: "pass",
      message: "CSRF protection enabled",
    });
  }

  if (config.passkeysEnabled) {
    try {
      const host = new URL(config.baseUrl).hostname;
      if (
        config.passkeyRpId !== host &&
        !(config.passkeyRpId === "localhost" && LOCAL_HOSTNAMES.has(host))
      ) {
        checks.push({
          id: "passkey-rp-id",
          status: "warn",
          message: `AUTH_NINJA_PASSKEY_RP_ID (${config.passkeyRpId}) does not match base URL host (${host})`,
        });
      } else {
        checks.push({
          id: "passkey-rp-id",
          status: "pass",
          message: "Passkey relying party ID matches deployment host",
        });
      }
    } catch {
      // baseUrl already validated by config loader
    }
  }

  if (production && !config.redisUrl) {
    checks.push({
      id: "redis",
      status: "warn",
      message:
        "AUTH_NINJA_REDIS_URL is unset — recommended for multi-instance production",
    });
  }

  return checks;
}

export function runDoctorChecks(
  config: AuthNinjaConfig,
  options: Pick<DoctorOptions, "production"> = {},
): DoctorCheck[] {
  return [
    {
      id: "secret",
      status: "pass",
      message: "AUTH_NINJA_SECRET meets minimum strength requirements",
    },
    ...evaluateConfigChecks(config, options),
  ];
}

function summarizeOk(checks: DoctorCheck[], strict: boolean): boolean {
  if (checks.some((check) => check.status === "fail")) {
    return false;
  }
  if (strict && checks.some((check) => check.status === "warn")) {
    return false;
  }
  return true;
}

function validationFailureCheck(message: string): DoctorCheck {
  if (message.includes("AUTH_NINJA_SECRET")) {
    if (message.includes("required")) {
      return {
        id: "secret",
        status: "fail",
        message: "AUTH_NINJA_SECRET is not set — run: pnpm dlx @auth-ninja/cli setup",
      };
    }
    return {
      id: "secret",
      status: "fail",
      message:
        "AUTH_NINJA_SECRET is too weak — run: pnpm dlx @auth-ninja/cli keys generate",
    };
  }

  return {
    id: "config",
    status: "fail",
    message,
  };
}

/** Run all doctor checks against the project environment. */
export async function runDoctor(options: DoctorOptions = {}): Promise<DoctorResult> {
  const cwd = options.cwd ?? process.cwd();
  const envPath = join(cwd, ".env");
  const checks: DoctorCheck[] = [];

  if (!existsSync(envPath)) {
    checks.push({
      id: "env-file",
      status: "warn",
      message: "No .env file found — using process environment only",
    });
  } else {
    checks.push({
      id: "env-file",
      status: "pass",
      message: "Found .env configuration file",
    });
  }

  let config: AuthNinjaConfig | null = null;

  try {
    config = loadAuthNinjaConfig({ cwd });
    checks.push(...runDoctorChecks(config, { production: options.production }));
  } catch (error) {
    if (error instanceof AuthNinjaError && error.code === "VALIDATION_ERROR") {
      checks.push(validationFailureCheck(error.message));
    } else {
      throw error;
    }
  }

  return {
    checks,
    ok: summarizeOk(checks, options.strict ?? false),
    config,
  };
}

function formatCheck(check: DoctorCheck): string {
  const prefix =
    check.status === "pass" ? "[ok]" : check.status === "warn" ? "[warn]" : "[fail]";
  return `${prefix} ${check.message}`;
}

/** CLI entry — prints results and returns a process exit code. */
export async function runDoctorCli(options: DoctorOptions = {}): Promise<number> {
  console.log("auth-ninja doctor\n");
  const result = await runDoctor(options);

  for (const check of result.checks) {
    console.log(formatCheck(check));
  }

  console.log("");
  if (result.ok) {
    console.log("All checks passed.");
    return 0;
  }

  console.log("Some checks failed — fix issues above before deploying.");
  return 1;
}
