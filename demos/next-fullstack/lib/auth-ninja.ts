import { loadAuthNinjaConfig } from "@auth-ninja/core";
import {
  createAuthDb,
  createAuthNinjaContext,
  runAuthMigrations,
  type AuthNinjaContext,
} from "@auth-ninja/next";

let authPromise: Promise<AuthNinjaContext> | undefined;

/** Shared Auth-Ninja context — migrations run once per process. */
export async function getAuthNinja(): Promise<AuthNinjaContext> {
  if (!authPromise) {
    authPromise = (async () => {
      const config = loadAuthNinjaConfig();
      const { db, client } = createAuthDb(config.databaseUrl);
      await runAuthMigrations({ db, client });
      return createAuthNinjaContext({ config, db });
    })();
  }
  return authPromise;
}
