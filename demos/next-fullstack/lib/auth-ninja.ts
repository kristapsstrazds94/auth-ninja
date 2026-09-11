import { loadAuthNinjaConfig } from "@auth-ninja/core";
import {
  createAuthDb,
  createAuthNinjaContext,
  runAuthMigrations,
  type AuthNinjaContext,
} from "@auth-ninja/next";

type AuthNinjaGlobal = typeof globalThis & {
  __authNinjaPromise?: Promise<AuthNinjaContext>;
};

const globalForAuth = globalThis as AuthNinjaGlobal;

/** Shared Auth-Ninja context — survives Next.js per-route webpack bundles in dev. */
export async function getAuthNinja(): Promise<AuthNinjaContext> {
  if (!globalForAuth.__authNinjaPromise) {
    globalForAuth.__authNinjaPromise = (async () => {
      const config = loadAuthNinjaConfig();
      const { db, client } = createAuthDb(config.databaseUrl);
      await runAuthMigrations({ db, client });
      return createAuthNinjaContext({ config, db });
    })();
  }
  return globalForAuth.__authNinjaPromise;
}
