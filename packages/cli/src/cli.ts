#!/usr/bin/env node

const args = process.argv.slice(2);
const command = args[0] ?? "help";

const HELP = `
auth-ninja — secure authentication toolkit

Usage:
  auth-ninja init       Scaffold auth into a project (task 5.1)
  auth-ninja doctor     Validate configuration (task 5.2)
  auth-ninja demo       Start local demo stack (task 6.1)
  auth-ninja keys       Generate secrets (task 5.3)

Run /next in Cursor to implement these commands.
`.trim();

switch (command) {
  case "help":
  case "--help":
  case "-h":
    console.log(HELP);
    break;
  default:
    console.error(`Unknown command: ${command}\n`);
    console.log(HELP);
    process.exit(1);
}
