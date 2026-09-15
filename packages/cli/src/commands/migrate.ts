import { migrateDb } from "../migrate-db.js";

export type MigrateCommandOptions = {
  cwd?: string;
};

/** CLI entry for `auth-ninja db migrate`. */
export async function runMigrateCli(options: MigrateCommandOptions = {}): Promise<number> {
  console.log("auth-ninja db migrate\n");
  const result = await migrateDb(options);

  if (result.ok) {
    console.log(result.message);
    return 0;
  }

  console.error(result.message);
  return 1;
}
