#!/usr/bin/env node

import { runDoctorCli, type DoctorOptions } from "./commands/doctor.js";
import { runMigrateCli } from "./commands/migrate.js";
import { runKeysGenerate } from "./commands/keys.js";
import { runSetup, type SetupOptions } from "./commands/setup.js";
import type { FullStack } from "./detect-stack.js";

const args = process.argv.slice(2);
const command = args[0] ?? "help";
const subcommand = args[1];

const HELP = `
auth-ninja — secure full-stack authentication

Usage:
  pnpm dlx @auth-ninja/cli setup [--stack next|dotnet] [--cwd <path>]
  pnpm dlx @auth-ninja/cli db migrate [--cwd <path>]
  pnpm dlx @auth-ninja/cli doctor [--cwd <path>] [--production] [--strict]
  pnpm dlx @auth-ninja/cli keys generate

setup installs packages, creates .env, migrates PostgreSQL, and validates config.
Application code is never modified — copy integration steps from the README.
`.trim();

function parseCwd(argv: string[]): string | undefined {
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--cwd") {
      return argv[index + 1];
    }
  }
  return undefined;
}

function parseSetupArgs(argv: string[]): SetupOptions {
  const options: SetupOptions = { cwd: parseCwd(argv) };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--skip-install") {
      options.skipInstall = true;
      continue;
    }
    if (arg === "--skip-migrate") {
      options.skipMigrate = true;
      continue;
    }
    if (arg === "--stack") {
      const value = argv[index + 1] as FullStack | undefined;
      if (value === "next" || value === "dotnet") {
        options.stack = value;
      }
      index += 1;
    }
  }

  return options;
}

function parseDoctorArgs(argv: string[]): DoctorOptions {
  const options: DoctorOptions = { cwd: parseCwd(argv) };

  for (const arg of argv) {
    if (arg === "--production") {
      options.production = true;
    }
    if (arg === "--strict") {
      options.strict = true;
    }
  }

  return options;
}

async function main(): Promise<void> {
  switch (command) {
    case "help":
    case "--help":
    case "-h":
      console.log(HELP);
      break;
    case "setup":
      await runSetup(parseSetupArgs(args.slice(1)));
      break;
    case "init":
      console.warn("auth-ninja init is deprecated — use: pnpm dlx @auth-ninja/cli setup\n");
      await runSetup(parseSetupArgs(args.slice(1)));
      break;
    case "db":
      if (subcommand === "migrate") {
        const exitCode = await runMigrateCli({ cwd: parseCwd(args.slice(2)) });
        process.exit(exitCode);
      }
      console.error(`Unknown db subcommand: ${subcommand ?? "(none)"}\n`);
      console.log(HELP);
      process.exit(1);
      break;
    case "doctor": {
      const exitCode = await runDoctorCli(parseDoctorArgs(args.slice(1)));
      process.exit(exitCode);
      break;
    }
    case "keys": {
      if (subcommand === "generate") {
        runKeysGenerate();
        break;
      }
      console.error(`Unknown keys subcommand: ${subcommand ?? "(none)"}\n`);
      console.log(HELP);
      process.exit(1);
      break;
    }
    default:
      console.error(`Unknown command: ${command}\n`);
      console.log(HELP);
      process.exit(1);
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`auth-ninja: ${message}`);
  process.exit(1);
});
