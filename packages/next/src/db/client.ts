import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres, { type Sql } from "postgres";
import * as schema from "./schema.js";

export type AuthDb = PostgresJsDatabase<typeof schema>;

export type AuthDbHandle = {
  db: AuthDb;
  client: Sql;
};

export type CreateAuthDbOptions = {
  /** Maximum connections in the pool (default 1 for serverless-friendly usage). */
  maxConnections?: number;
};

/** Open a Drizzle client backed by postgres.js. Caller must call `closeAuthDb` when done. */
export function createAuthDb(
  databaseUrl: string,
  options: CreateAuthDbOptions = {},
): AuthDbHandle {
  const client = postgres(databaseUrl, {
    max: options.maxConnections ?? 1,
  });

  return {
    db: drizzle(client, { schema }),
    client,
  };
}

/** Close the underlying postgres.js pool. */
export async function closeAuthDb(client: Sql): Promise<void> {
  await client.end({ timeout: 5 });
}
