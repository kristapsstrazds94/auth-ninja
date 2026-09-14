import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig } from "drizzle-kit";

function loadEnvFile(filePath: string): void {
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
  throw new Error(
    "AUTH_NINJA_DATABASE_URL is required for Drizzle CLI. Copy .env.example to .env and set your PostgreSQL URL.",
  );
}

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: databaseUrl,
  },
});
