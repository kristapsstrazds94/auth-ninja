import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createAuthDb, runAuthMigrations } from "@auth-ninja/next";

export type MigrateDbOptions = {
  cwd?: string;
};

export type MigrateDbResult = {
  ok: boolean;
  message: string;
};

function loadEnvFile(cwd: string): void {
  for (const name of [".env.local", ".env"]) {
    const path = join(cwd, name);
    if (!existsSync(path)) {
      continue;
    }

    for (const line of readFileSync(path, "utf8").split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) {
        continue;
      }

      const separator = trimmed.indexOf("=");
      if (separator === -1) {
        continue;
      }

      const key = trimmed.slice(0, separator).trim();
      const value = trimmed.slice(separator + 1).trim();
      if (key.length > 0 && process.env[key] === undefined) {
        process.env[key] = value;
      }
    }
  }
}

function formatMigrationError(error: unknown): string {
  const err = error as { code?: string; message?: string };

  if (err.code === "28P01") {
    return (
      "PostgreSQL rejected the credentials in AUTH_NINJA_DATABASE_URL.\n" +
      "Use a full URL with user and password, e.g. postgresql://postgres:yourpassword@localhost:5432/auth_ninja"
    );
  }

  if (err.code === "3D000") {
    return "Database does not exist — create it first (e.g. createdb auth_ninja).";
  }

  if (err.code === "ECONNREFUSED") {
    return "Could not connect to PostgreSQL — check AUTH_NINJA_DATABASE_URL and that Postgres is running.";
  }

  return err.message ?? String(error);
}

/** Apply Auth-Ninja PostgreSQL migrations (shared by Next.js and .NET adapters). */
export async function migrateDb(options: MigrateDbOptions = {}): Promise<MigrateDbResult> {
  const cwd = options.cwd ?? process.cwd();
  loadEnvFile(cwd);

  const databaseUrl = process.env.AUTH_NINJA_DATABASE_URL?.trim();
  if (!databaseUrl) {
    return {
      ok: false,
      message:
        "AUTH_NINJA_DATABASE_URL is not set — update .env and run: pnpm dlx @auth-ninja/cli db migrate",
    };
  }

  try {
    const handle = createAuthDb(databaseUrl);
    try {
      await runAuthMigrations(handle);
    } finally {
      await handle.client.end({ timeout: 5 });
    }

    return {
      ok: true,
      message: "Database migrations applied (users, sessions, credentials, audit_events).",
    };
  } catch (error) {
    return {
      ok: false,
      message: formatMigrationError(error),
    };
  }
}
