import pg from "pg";

const { Client } = pg;

/** Returns true when PostgreSQL accepts a connection with the given URL. */
export async function canConnect(databaseUrl) {
  const client = new Client({ connectionString: databaseUrl });
  try {
    await client.connect();
    await client.query("SELECT 1");
    return true;
  } catch {
    return false;
  } finally {
    await client.end().catch(() => {});
  }
}
