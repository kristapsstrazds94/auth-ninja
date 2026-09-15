import { spawnSync } from "node:child_process";
import { join } from "node:path";
import pg from "pg";

const { Client } = pg;

const DOCKER_USER = "auth_ninja";
const DOCKER_PASSWORD = "auth_ninja";
const DOCKER_DB = "auth_ninja_e2e";

export type DemoStackId = "next" | "dotnet";

const DEMO_DATABASE_NAMES: Record<DemoStackId, string> = {
  next: "auth_ninja_e2e_next",
  dotnet: "auth_ninja_e2e_dotnet",
};

export const DEFAULT_DEMO_DATABASE_URL =
  "postgresql://auth_ninja:auth_ninja@localhost:5432/auth_ninja_e2e";

/** Per-stack demo DB so Drizzle (Next) and EF Core (.NET) migrations do not fight. */
export function resolveDemoDatabaseName(stack: DemoStackId): string {
  return DEMO_DATABASE_NAMES[stack];
}

/** Returns true when PostgreSQL accepts a connection with the given URL. */
export async function canConnect(databaseUrl: string): Promise<boolean> {
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

export function buildDockerDatabaseUrl(hostPort: string): string {
  return `postgresql://${DOCKER_USER}:${DOCKER_PASSWORD}@localhost:${hostPort}/${DOCKER_DB}`;
}

function replaceDatabaseName(connectionUrl: string, dbName: string): string {
  const url = new URL(connectionUrl);
  url.pathname = `/${dbName}`;
  return url.toString();
}

function assertValidDatabaseName(dbName: string): void {
  if (!/^[a-z_][a-z0-9_]*$/i.test(dbName)) {
    throw new Error(`Invalid database name: ${dbName}`);
  }
}

/** Create the stack database on the server if needed and return its URL. */
export async function ensureDatabaseExists(
  serverUrl: string,
  dbName: string,
): Promise<string> {
  assertValidDatabaseName(dbName);
  const targetUrl = replaceDatabaseName(serverUrl, dbName);

  if (await canConnect(targetUrl)) {
    return targetUrl;
  }

  const admin = new Client({ connectionString: serverUrl });
  try {
    await admin.connect();
    const exists = await admin.query("SELECT 1 FROM pg_database WHERE datname = $1", [
      dbName,
    ]);
    if ((exists.rowCount ?? 0) === 0) {
      await admin.query(`CREATE DATABASE "${dbName}"`);
      console.log(`Created demo database ${dbName}`);
    }
  } finally {
    await admin.end().catch(() => {});
  }

  if (!(await canConnect(targetUrl))) {
    throw new Error(`Could not connect to demo database ${dbName}.`);
  }

  return targetUrl;
}

function runDocker(args: string[], cwd: string, options: { stdio?: "inherit" | "pipe" } = {}) {
  return spawnSync("docker", args, {
    cwd,
    encoding: "utf8",
    stdio: options.stdio ?? "pipe",
  });
}

/** Read the host port mapped to container 5432 for the compose postgres service. */
export function getComposePostgresPort(e2eRoot: string): string | null {
  const result = runDocker(["compose", "port", "postgres", "5432"], e2eRoot);
  if (result.status !== 0) {
    return null;
  }

  const line = result.stdout.trim().split("\n").at(-1) ?? "";
  const match = line.match(/:(\d+)\s*$/);
  return match?.[1] ?? null;
}

export async function tryComposeDatabaseUrl(e2eRoot: string): Promise<string | null> {
  const port = getComposePostgresPort(e2eRoot);
  if (!port) {
    return null;
  }

  const url = buildDockerDatabaseUrl(port);
  if (await canConnect(url)) {
    return url;
  }

  return null;
}

export async function startDockerPostgres(e2eRoot: string): Promise<string> {
  console.log("PostgreSQL unavailable — starting demos/e2e/docker-compose.yml …");

  let result = runDocker(["compose", "up", "-d", "--wait"], e2eRoot, { stdio: "inherit" });

  if (result.status !== 0) {
    console.warn("Compose up failed — recreating E2E Postgres container …");
    runDocker(["compose", "down", "-v"], e2eRoot, { stdio: "inherit" });
    result = runDocker(["compose", "up", "-d", "--wait"], e2eRoot, { stdio: "inherit" });
  }

  if (result.status !== 0) {
    throw new Error(
      "Could not start PostgreSQL via Docker. Either:\n" +
        "  • Set AUTH_NINJA_DATABASE_URL to a reachable Postgres URL, or\n" +
        "  • Free a host port / stop conflicting containers, or\n" +
        "  • Run: pnpm --filter @auth-ninja/demo-e2e postgres:down && pnpm demo",
    );
  }

  const port = getComposePostgresPort(e2eRoot);
  if (!port) {
    throw new Error("Docker Postgres started but the host port could not be resolved.");
  }

  const url = buildDockerDatabaseUrl(port);
  if (!(await canConnect(url))) {
    throw new Error(`Docker Postgres is up on port ${port} but the connection still failed.`);
  }

  console.log(`Using Docker E2E Postgres at localhost:${port}`);
  return url;
}

async function resolvePostgresServerUrl(
  repoRoot: string,
  configured?: string,
): Promise<string> {
  const trimmed = configured?.trim();
  if (trimmed && (await canConnect(trimmed))) {
    return trimmed;
  }

  if (trimmed) {
    console.warn(`PostgreSQL connection failed for AUTH_NINJA_DATABASE_URL (${trimmed}).`);
  }

  const e2eRoot = join(repoRoot, "demos", "e2e");
  const existingCompose = await tryComposeDatabaseUrl(e2eRoot);
  if (existingCompose) {
    const port = getComposePostgresPort(e2eRoot);
    console.log(
      `Using existing Docker E2E Postgres${port ? ` at localhost:${port}` : ""}`,
    );
    return existingCompose;
  }

  return startDockerPostgres(e2eRoot);
}

/** Resolve a working Postgres URL for a demo stack, falling back to Docker Compose when needed. */
export async function ensureDemoDatabase(
  repoRoot: string,
  stack: DemoStackId,
  configured?: string,
): Promise<string> {
  const serverUrl = await resolvePostgresServerUrl(repoRoot, configured);
  const dbName = resolveDemoDatabaseName(stack);
  const databaseUrl = await ensureDatabaseExists(serverUrl, dbName);
  console.log(`Demo database (${stack}): ${databaseUrl}`);
  return databaseUrl;
}
