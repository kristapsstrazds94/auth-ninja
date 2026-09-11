import { spawn, type ChildProcess } from "node:child_process";
import {
  buildDemoServerEnv,
  resolveDemoPlan,
  type DemoProcess,
  type DemoStack,
} from "../demo/stacks.js";
import { DEFAULT_DEMO_DATABASE_URL, ensureDemoDatabase } from "../demo/postgres.js";
import { resolveAuthNinjaRepoRoot } from "../find-repo-root.js";

export type DemoOptions = {
  cwd?: string;
  stack?: DemoStack;
};

function log(message: string): void {
  console.log(message);
}

export function parseDemoArgs(argv: string[]): DemoOptions {
  const options: DemoOptions = {};

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--cwd") {
      options.cwd = argv[index + 1];
      index += 1;
      continue;
    }
    if (arg === "--stack") {
      const value = argv[index + 1];
      if (value === "next" || value === "vite" || value === "dotnet") {
        options.stack = value;
      }
      index += 1;
    }
  }

  return options;
}

function spawnDemoProcess(
  repoRoot: string,
  proc: DemoProcess,
  env: NodeJS.ProcessEnv,
): ChildProcess {
  return spawn("pnpm", ["--filter", proc.filter, proc.script], {
    cwd: repoRoot,
    env,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
}

async function runDemoProcesses(
  repoRoot: string,
  processes: Array<DemoProcess & { runtimeEnv: NodeJS.ProcessEnv }>,
): Promise<void> {
  const children: ChildProcess[] = [];
  let shuttingDown = false;

  const cleanup = (signal: NodeJS.Signals = "SIGTERM") => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;
    for (const child of children) {
      if (!child.killed) {
        child.kill(signal);
      }
    }
  };

  process.on("SIGINT", () => {
    cleanup("SIGINT");
    process.exit(130);
  });
  process.on("SIGTERM", () => {
    cleanup("SIGTERM");
    process.exit(143);
  });

  for (const proc of processes) {
    log(`Starting ${proc.label}…`);
    const child = spawnDemoProcess(repoRoot, proc, proc.runtimeEnv);
    children.push(child);

    child.on("exit", (code, signal) => {
      if (shuttingDown) {
        return;
      }
      if (signal) {
        cleanup("SIGTERM");
        process.exit(1);
        return;
      }
      if (code !== 0 && code !== null) {
        console.error(`${proc.label} exited with code ${code}.`);
        cleanup("SIGTERM");
        process.exit(code);
      }
    });
  }

  await new Promise<void>(() => {});
}

/** Start the Auth-Ninja demo stack for local manual testing. */
export async function runDemo(options: DemoOptions = {}): Promise<void> {
  const cwd = options.cwd ?? process.cwd();
  const stack = options.stack ?? "next";
  const repoRoot = resolveAuthNinjaRepoRoot(cwd);

  if (!repoRoot) {
    throw new Error(
      "Could not find the Auth-Ninja monorepo (demos/ missing).\n" +
        "Run auth-ninja demo from a clone of the auth-ninja repository after pnpm install && pnpm build.",
    );
  }

  const plan = resolveDemoPlan(stack);
  const configuredDatabaseUrl =
    process.env.AUTH_NINJA_DATABASE_URL?.trim() || DEFAULT_DEMO_DATABASE_URL;
  const databaseUrl = await ensureDemoDatabase(repoRoot, configuredDatabaseUrl);

  const serverEnv = buildDemoServerEnv({
    databaseUrl,
    baseUrl: plan.serverBaseUrl,
  });

  const processes = plan.processes.map((proc) => ({
    ...proc,
    runtimeEnv: {
      ...process.env,
      ...(proc.needsServerEnv ? serverEnv : {}),
      ...proc.env,
    },
  }));

  log("auth-ninja demo\n");
  log(`Stack: ${stack}`);
  log(`Open: ${plan.urls.join(", ")}`);
  log("Press Ctrl+C to stop.\n");

  await runDemoProcesses(repoRoot, processes);
}
