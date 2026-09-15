#!/usr/bin/env node
/**
 * Local monorepo demo runner — not published to npm.
 * Usage: node scripts/run-demo.mjs [next|dotnet]
 */
import { spawn, spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const stack = process.argv[2] === "dotnet" ? "dotnet" : "next";

const { buildDemoServerEnv, resolveDemoPlan } = await import(
  "../packages/cli/dist/demo/stacks.js"
);
const { DEFAULT_DEMO_DATABASE_URL, ensureDemoDatabase } = await import(
  "../packages/cli/dist/demo/postgres.js"
);

const plan = resolveDemoPlan(stack);
const databaseUrl = await ensureDemoDatabase(repoRoot, stack, DEFAULT_DEMO_DATABASE_URL);
const serverEnv = buildDemoServerEnv({
  databaseUrl,
  baseUrl: plan.serverBaseUrl,
  corsOrigins:
    stack === "dotnet"
      ? "http://localhost:5174,http://127.0.0.1:5174"
      : undefined,
});

console.log(`auth-ninja demo (${stack})\nOpen: ${plan.urls.join(", ")}\n`);

const children = [];

function cleanup() {
  for (const child of children) {
    if (!child.killed) {
      child.kill("SIGTERM");
    }
  }
}

process.on("SIGINT", () => {
  cleanup();
  process.exit(130);
});

/** Spawn pnpm on Windows (Git Bash / CMD) and Unix. */
function spawnPnpm(filter, script, options) {
  const args = ["--filter", filter, script];
  if (process.platform === "win32") {
    // cmd.exe resolves pnpm on PATH — avoids spaced paths like "Program Files".
    return spawn("cmd.exe", ["/d", "/s", "/c", "pnpm", ...args], {
      ...options,
      windowsHide: true,
    });
  }
  return spawn("pnpm", args, options);
}

function runPnpmAndWait(filter, script, env) {
  return new Promise((resolve, reject) => {
    const child = spawnPnpm(filter, script, {
      cwd: repoRoot,
      env: { ...process.env, ...env },
      stdio: "inherit",
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${script} exited with code ${code ?? "unknown"}`));
    });
  });
}

function startProcess(proc) {
  const env = {
    ...process.env,
    ...(proc.needsServerEnv ? serverEnv : {}),
    ...proc.env,
  };

  console.log(`Starting ${proc.label}…`);
  const child = spawnPnpm(proc.filter, proc.script, {
    cwd: repoRoot,
    env,
    stdio: "inherit",
  });
  child.on("error", (error) => {
    console.error(`Failed to start ${proc.label}: ${error.message}`);
    cleanup();
    process.exit(1);
  });
  children.push(child);
  return child;
}

async function waitForHttp(url, timeoutMs = 90_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url, { redirect: "manual" });
      if (response.ok || response.status < 500) {
        return;
      }
    } catch {
      // API still starting
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(`Timed out waiting for ${url}`);
}

/** Collect dev/API ports from the demo plan so we can free them before starting. */
function resolvePortsToFree(plan) {
  const ports = new Set();

  const addPort = (url) => {
    try {
      const parsed = new URL(url);
      const port = parsed.port
        ? Number(parsed.port)
        : parsed.protocol === "https:"
          ? 443
          : 80;
      if (port > 0) {
        ports.add(port);
      }
    } catch {
      // ignore invalid URLs
    }
  };

  addPort(plan.serverBaseUrl);
  if (plan.apiHealthUrl) {
    addPort(plan.apiHealthUrl);
  }
  for (const url of plan.urls) {
    addPort(url);
  }

  return [...ports];
}

/** Stop processes still listening on demo ports from a prior run. */
function stopStalePorts(ports) {
  for (const port of ports) {
    stopStalePort(port);
  }
}

function stopStalePort(port) {
  if (process.platform === "win32") {
    const result = spawnSync("netstat", ["-ano"], { encoding: "utf8" });
    if (result.status !== 0) {
      return;
    }

    const pattern = new RegExp(`:${port}\\s+\\S+\\s+LISTENING\\s+(\\d+)`);
    const pids = new Set();
    for (const line of result.stdout.split("\n")) {
      const match = line.match(pattern);
      if (match) {
        pids.add(match[1]);
      }
    }

    for (const pid of pids) {
      spawnSync("taskkill", ["/F", "/PID", pid], { stdio: "ignore" });
    }
    return;
  }

  spawnSync(
    "sh",
    ["-c", `lsof -ti tcp:${port} -sTCP:LISTEN | xargs -r kill -9 2>/dev/null`],
    { stdio: "ignore" },
  );
}

const portsToFree = resolvePortsToFree(plan);
if (portsToFree.length > 0) {
  stopStalePorts(portsToFree);
}

if (stack === "dotnet") {
  console.log("Building .NET API…");
  await runPnpmAndWait("@auth-ninja/demo-dotnet-spa", "build:api", serverEnv);
}

for (const proc of plan.processes) {
  startProcess(proc);

  if (stack === "dotnet" && proc.script === "dev:api") {
    const healthUrl = `${plan.apiHealthUrl ?? plan.serverBaseUrl}/auth/csrf`;
    console.log(`Waiting for API at ${healthUrl}…`);
    await waitForHttp(healthUrl);
    console.log("API ready.");
  }
}

await new Promise(() => {});
