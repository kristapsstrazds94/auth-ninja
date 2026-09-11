#!/usr/bin/env node

import { runDoctorCli, type DoctorOptions } from "./commands/doctor.js";
import { runInit } from "./commands/init.js";
import { runKeysGenerate } from "./commands/keys.js";
import type { AuthStack } from "./detect-stack.js";

const args = process.argv.slice(2);
const command = args[0] ?? "help";

const HELP = `
auth-ninja — secure authentication toolkit

Usage:
  auth-ninja init [--stack next|vite|dotnet] [--cwd <path>] [--dry-run]
  auth-ninja doctor [--cwd <path>] [--production] [--strict]
  auth-ninja demo              Start local demo stack (task 6.1)
  auth-ninja keys generate     Output a secure AUTH_NINJA_SECRET

Run auth-ninja init in your app root to scaffold .env and wire adapters.
`.trim();

function parseInitArgs(argv: string[]): {
  cwd?: string;
  stack?: AuthStack;
  dryRun?: boolean;
} {
  const options: { cwd?: string; stack?: AuthStack; dryRun?: boolean } = {};

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--dry-run") {
      options.dryRun = true;
      continue;
    }
    if (arg === "--cwd") {
      options.cwd = argv[index + 1];
      index += 1;
      continue;
    }
    if (arg === "--stack") {
      const value = argv[index + 1] as AuthStack | undefined;
      if (value === "next" || value === "vite" || value === "dotnet" || value === "unknown") {
        options.stack = value;
      }
      index += 1;
    }
  }

  return options;
}

function parseDoctorArgs(argv: string[]): DoctorOptions {
  const options: DoctorOptions = {};

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--cwd") {
      options.cwd = argv[index + 1];
      index += 1;
      continue;
    }
    if (arg === "--production") {
      options.production = true;
      continue;
    }
    if (arg === "--strict") {
      options.strict = true;
      continue;
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
    case "init":
      await runInit(parseInitArgs(args.slice(1)));
      break;
    case "doctor": {
      const exitCode = await runDoctorCli(parseDoctorArgs(args.slice(1)));
      process.exit(exitCode);
      break;
    }
    case "keys": {
      const subcommand = args[1] ?? "generate";
      if (subcommand === "generate") {
        runKeysGenerate();
        break;
      }
      console.error(`Unknown keys subcommand: ${subcommand}\n`);
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
