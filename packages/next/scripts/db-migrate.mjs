import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) {
    return;
  }

  for (const line of readFileSync(filePath, "utf8").split("\n")) {
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

for (const dir of [process.cwd(), resolve(process.cwd(), "../..")]) {
  loadEnvFile(resolve(dir, ".env.local"));
  loadEnvFile(resolve(dir, ".env"));
}

const databaseUrl =
  process.env.AUTH_NINJA_DATABASE_URL ?? process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error(
    "AUTH_NINJA_DATABASE_URL is required.\n" +
      "Copy .env.example to .env at the repo root and set your PostgreSQL connection string.",
  );
  process.exit(1);
}

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const migrationsFolder = resolve(packageRoot, "drizzle");
const client = postgres(databaseUrl, { max: 1 });
const db = drizzle(client);

try {
  await migrate(db, { migrationsFolder });
  console.log("Auth-Ninja migrations applied.");
} catch (error) {
  if (error?.code === "28P01") {
    console.error(
      "PostgreSQL rejected the credentials in AUTH_NINJA_DATABASE_URL.\n" +
        "Use a full URL with user and password, e.g.:\n" +
        "  postgresql://postgres:yourpassword@localhost:5432/auth_ninja\n" +
        "If the URL has no user, the client defaults to your OS username on Windows.",
    );
  } else if (error?.code === "3D000") {
    console.error(
      "Database does not exist. Create it first, e.g.:\n" +
        "  createdb auth_ninja",
    );
  } else if (error?.code === "ECONNREFUSED") {
    console.error(
      "Could not connect to PostgreSQL. Is the server running on the host/port in AUTH_NINJA_DATABASE_URL?",
    );
  }
  throw error;
} finally {
  await client.end({ timeout: 5 });
}
