import { detectStack, type FullStack } from "../detect-stack.js";
import { installPackages } from "../install-packages.js";
import { migrateDb } from "../migrate-db.js";
import { printIntegrationGuide } from "../print-integration-guide.js";
import { scaffoldEnv } from "../scaffold-env.js";
import { runDoctorCli } from "./doctor.js";
import { generateAuthNinjaSecret } from "@auth-ninja/core";

export type SetupOptions = {
  cwd?: string;
  stack?: FullStack;
  skipInstall?: boolean;
  skipMigrate?: boolean;
};

export type SetupResult = {
  stack: FullStack;
  envCreated: boolean;
  migrateOk: boolean;
  doctorExitCode: number;
};

function log(message: string): void {
  console.log(message);
}

function resolveStack(
  requested: FullStack | undefined,
  detected: Awaited<ReturnType<typeof detectStack>>,
): FullStack {
  if (requested) {
    return requested;
  }

  if (detected.stack === "next" || detected.stack === "dotnet") {
    return detected.stack;
  }

  throw new Error(
    "Could not detect a full-stack project.\n" +
      "Run from a Next.js app (React + Next.js) or an ASP.NET Core API (React + .NET),\n" +
      "or pass --stack next or --stack dotnet.",
  );
}

/** One-command full-stack setup: install packages, env, migrate, validate. */
export async function runSetup(options: SetupOptions = {}): Promise<SetupResult> {
  const cwd = options.cwd ?? process.cwd();
  const detected = await detectStack(cwd);
  const stack = resolveStack(options.stack, detected);

  log("auth-ninja setup\n");
  log(`Stack: ${stack === "next" ? "React + Next.js" : "React + .NET"}`);

  if (!options.skipInstall) {
    log("\nInstalling packages…");
    const installed = await installPackages({ cwd, stack });
    for (const command of installed.commands) {
      log(`  ${command}`);
    }
    for (const warning of installed.warnings) {
      log(`  [warn] ${warning}`);
    }
  }

  log("\nConfiguring environment…");
  const secret = generateAuthNinjaSecret();
  const env = await scaffoldEnv({ cwd, stack, secret });
  if (env.envCreated) {
    log("  Created .env with a generated AUTH_NINJA_SECRET");
  } else if (env.secretInjected) {
    log("  Added AUTH_NINJA_SECRET to existing .env");
  } else {
    log("  Using existing .env (not modified)");
  }
  if (env.envExampleCreated) {
    log("  Created .env.example");
  }
  log("  Set AUTH_NINJA_DATABASE_URL in .env to your PostgreSQL connection string");

  let migrateOk = false;
  if (!options.skipMigrate) {
    log("\nApplying database migrations…");
    const migrate = await migrateDb({ cwd });
    if (migrate.ok) {
      log(`  ${migrate.message}`);
      migrateOk = true;
    } else {
      log(`  [skip] ${migrate.message}`);
    }
  }

  log("\nValidating configuration…");
  const doctorExitCode = await runDoctorCli({ cwd });

  printIntegrationGuide(stack);

  log("\nSetup complete.");
  if (!migrateOk && !options.skipMigrate) {
    log("After PostgreSQL is ready, run: pnpm dlx @auth-ninja/cli db migrate");
  }

  return {
    stack,
    envCreated: env.envCreated,
    migrateOk,
    doctorExitCode,
  };
}
