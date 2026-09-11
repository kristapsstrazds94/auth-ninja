import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { canConnect } from "./check-db.mjs";
import {
  startDockerPostgres,
  tryComposeDatabaseUrl,
} from "./docker-postgres.mjs";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

/** Load demos/e2e/.env when present (does not override existing env vars). */
function loadDotEnv() {
  const envPath = join(packageRoot, ".env");
  if (!existsSync(envPath)) {
    return;
  }

  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separator = trimmed.indexOf("=");
    if (separator === -1) {
      continue;
    }

    const key = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

async function ensureDatabaseUrl() {
  const configured = process.env.AUTH_NINJA_DATABASE_URL?.trim();
  if (configured && (await canConnect(configured))) {
    return configured;
  }

  if (configured) {
    console.warn(
      `PostgreSQL connection failed for AUTH_NINJA_DATABASE_URL (${configured}).`,
    );
  }

  const existingCompose = await tryComposeDatabaseUrl(packageRoot, canConnect);
  if (existingCompose) {
    console.log(`Using existing Docker E2E database at ${existingCompose}`);
    return existingCompose;
  }

  return startDockerPostgres(packageRoot, canConnect);
}

loadDotEnv();

if (!process.env.AUTH_NINJA_DATABASE_URL) {
  console.log(
    "Skipping E2E: set AUTH_NINJA_DATABASE_URL or copy .env.example to demos/e2e/.env.",
  );
  process.exit(0);
}

const { isWeakSecret } = await import("@auth-ninja/core");
const secret = process.env.AUTH_NINJA_SECRET ?? "";
if (isWeakSecret(secret)) {
  console.error(
    "AUTH_NINJA_SECRET in demos/e2e/.env is missing or too weak (min 32 chars).",
  );
  console.error("Re-copy demos/e2e/.env.example to demos/e2e/.env and retry.");
  process.exit(1);
}

process.env.AUTH_NINJA_DATABASE_URL = await ensureDatabaseUrl();

if (!(await canConnect(process.env.AUTH_NINJA_DATABASE_URL))) {
  console.error("PostgreSQL is still unreachable after setup.");
  process.exit(1);
}

const result = spawnSync("pnpm", ["exec", "playwright", "test"], {
  cwd: packageRoot,
  stdio: "inherit",
  env: process.env,
  shell: process.platform === "win32",
});

process.exit(result.status ?? 1);
