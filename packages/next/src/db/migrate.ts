import path from "node:path";
import { fileURLToPath } from "node:url";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import type { AuthDbHandle } from "./client.js";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

/** SQL migrations shipped with `@auth-ninja/next` (`packages/next/drizzle`). */
export const authMigrationsFolder = path.join(packageRoot, "drizzle");

/** Apply pending Drizzle migrations. Safe to call on startup. */
export async function runAuthMigrations({ db }: AuthDbHandle): Promise<void> {
  await migrate(db, { migrationsFolder: authMigrationsFolder });
}
