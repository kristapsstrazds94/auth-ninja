import { execSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { resolveSemgrepCommand } from "./semgrep-utils.mjs";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const semgrep = resolveSemgrepCommand();
const command = `${semgrep} --config .semgrep/auth-ninja.yml --config .semgrep/auth-ninja-dotnet.yml --error packages adapters`;

execSync(command, { cwd: repoRoot, stdio: "inherit", shell: true });
