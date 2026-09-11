import { spawnSync } from "node:child_process";

export function resolveSemgrepCommand() {
  if (process.env.SEMGREP) {
    return process.env.SEMGREP;
  }

  if (spawnSync("semgrep", ["--version"], { stdio: "ignore" }).status === 0) {
    return "semgrep";
  }

  if (
    spawnSync("py", ["-m", "pipx", "run", "semgrep", "--version"], {
      stdio: "ignore",
    }).status === 0
  ) {
    return "py -m pipx run semgrep";
  }

  throw new Error(
    "semgrep not found. Install with: pipx install semgrep (or py -m pipx install semgrep)",
  );
}
