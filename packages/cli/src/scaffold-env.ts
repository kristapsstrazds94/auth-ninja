import { existsSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";

/** Default server env template — mirrors repo `.env.example` (no real secrets). */
export const AUTH_NINJA_ENV_TEMPLATE = `# Auth-Ninja configuration (copy to .env — never commit .env)

AUTH_NINJA_SECRET=                          # min 32 chars — use: auth-ninja keys generate
AUTH_NINJA_BASE_URL=http://localhost:3000
AUTH_NINJA_DATABASE_URL=postgresql://localhost:5432/auth_ninja

# Sessions
AUTH_NINJA_SESSION_IDLE_MINUTES=15
AUTH_NINJA_SESSION_ABSOLUTE_HOURS=8

# Lockout
AUTH_NINJA_LOCKOUT_MAX_ATTEMPTS=5
AUTH_NINJA_LOCKOUT_WINDOW_MINUTES=15
AUTH_NINJA_LOCKOUT_DURATION_MINUTES=30

# 2FA
AUTH_NINJA_REQUIRE_2FA=false
AUTH_NINJA_2FA_ISSUER=AuthNinja

# Passkeys
AUTH_NINJA_PASSKEYS_ENABLED=true
AUTH_NINJA_PASSKEY_RP_ID=localhost

# IP audit
AUTH_NINJA_IP_AUDIT_ENABLED=true
# AUTH_NINJA_IP_ALLOWLIST=10.0.0.0/8

# API guard
AUTH_NINJA_API_RATE_LIMIT=100
AUTH_NINJA_CSRF_ENABLED=true

# Optional Redis (required for multi-instance production)
# AUTH_NINJA_REDIS_URL=redis://localhost:6379
`;

export const VITE_AUTH_ENV_LINES = `
# Vite client (public — no secrets)
VITE_AUTH_BASE_URL=http://localhost:3000
`;

export type ScaffoldEnvOptions = {
  cwd?: string;
  includeViteClient?: boolean;
};

export type ScaffoldEnvResult = {
  envCreated: boolean;
  envExampleCreated: boolean;
  viteLinesAppended: boolean;
};

async function writeIfMissing(path: string, content: string): Promise<boolean> {
  if (existsSync(path)) {
    return false;
  }

  await writeFile(path, content, "utf8");
  return true;
}

/** Create `.env` and `.env.example` when missing; optionally append Vite client vars. */
export async function scaffoldEnv(
  options: ScaffoldEnvOptions = {},
): Promise<ScaffoldEnvResult> {
  const cwd = options.cwd ?? process.cwd();
  const envPath = join(cwd, ".env");
  const envExamplePath = join(cwd, ".env.example");

  const envCreated = await writeIfMissing(envPath, AUTH_NINJA_ENV_TEMPLATE);
  const envExampleCreated = await writeIfMissing(envExamplePath, AUTH_NINJA_ENV_TEMPLATE);

  let viteLinesAppended = false;
  if (options.includeViteClient && existsSync(envPath)) {
    const { readFile, appendFile } = await import("node:fs/promises");
    const current = await readFile(envPath, "utf8");
    if (!current.includes("VITE_AUTH_BASE_URL")) {
      await appendFile(envPath, VITE_AUTH_ENV_LINES, "utf8");
      viteLinesAppended = true;
    }
  } else if (options.includeViteClient && envCreated) {
    await writeFile(envPath, AUTH_NINJA_ENV_TEMPLATE + VITE_AUTH_ENV_LINES, "utf8");
    viteLinesAppended = true;
  }

  return { envCreated, envExampleCreated, viteLinesAppended };
}
