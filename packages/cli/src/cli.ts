#!/usr/bin/env node

import { runInit } from "./commands/init.js";
import type { AuthStack } from "./detect-stack.js";

const args = process.argv.slice(2);
const command = args[0] ?? "help";

const HELP = `
auth-ninja — secure authentication toolkit

Usage:
  auth-ninja init [--stack next|vite|dotnet] [--cwd <path>] [--dry-run]
  auth-ninja doctor     Validate configuration (task 5.2)
  auth-ninja demo       Start local demo stack (task 6.1)
  auth-ninja keys       Generate secrets (task 5.3)

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
