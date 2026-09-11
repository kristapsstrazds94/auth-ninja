import { spawnSync } from "node:child_process";

const DOCKER_USER = "auth_ninja";
const DOCKER_PASSWORD = "auth_ninja";
const DOCKER_DB = "auth_ninja_e2e";

function runDocker(args, packageRoot, options = {}) {
  return spawnSync("docker", args, {
    cwd: packageRoot,
    encoding: "utf8",
    shell: process.platform === "win32",
    ...options,
  });
}

export function buildDockerDatabaseUrl(hostPort) {
  return `postgresql://${DOCKER_USER}:${DOCKER_PASSWORD}@localhost:${hostPort}/${DOCKER_DB}`;
}

/** Read the host port mapped to container 5432 for the compose postgres service. */
export function getComposePostgresPort(packageRoot) {
  const result = runDocker(["compose", "port", "postgres", "5432"], packageRoot);
  if (result.status !== 0) {
    return null;
  }

  const line = result.stdout.trim().split("\n").at(-1) ?? "";
  const match = line.match(/:(\d+)\s*$/);
  return match?.[1] ?? null;
}

export async function tryComposeDatabaseUrl(packageRoot, canConnect) {
  const port = getComposePostgresPort(packageRoot);
  if (!port) {
    return null;
  }

  const url = buildDockerDatabaseUrl(port);
  if (await canConnect(url)) {
    return url;
  }

  return null;
}

export async function startDockerPostgres(packageRoot, canConnect) {
  console.log("PostgreSQL unavailable — starting demos/e2e/docker-compose.yml …");

  let result = runDocker(["compose", "up", "-d", "--wait"], packageRoot, {
    stdio: "inherit",
    encoding: undefined,
  });

  if (result.status !== 0) {
    console.warn("Compose up failed — recreating E2E Postgres container …");
    runDocker(["compose", "down", "-v"], packageRoot, { stdio: "inherit", encoding: undefined });
    result = runDocker(["compose", "up", "-d", "--wait"], packageRoot, {
      stdio: "inherit",
      encoding: undefined,
    });
  }

  if (result.status !== 0) {
    console.error(
      "Could not start PostgreSQL via Docker. Either:\n" +
        "  • Fix AUTH_NINJA_DATABASE_URL in demos/e2e/.env, or\n" +
        "  • Free a host port / stop conflicting containers, or\n" +
        "  • Run: pnpm --filter @auth-ninja/demo-e2e postgres:down && pnpm --filter @auth-ninja/demo-e2e test",
    );
    process.exit(1);
  }

  const port = getComposePostgresPort(packageRoot);
  if (!port) {
    console.error("Docker Postgres started but the host port could not be resolved.");
    process.exit(1);
  }

  const url = buildDockerDatabaseUrl(port);
  if (!(await canConnect(url))) {
    console.error(`Docker Postgres is up on port ${port} but the connection still failed.`);
    process.exit(1);
  }

  console.log(`Using Docker E2E database at ${url}`);
  return url;
}
