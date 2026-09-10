import { existsSync, readdirSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export type AuthStack = "next" | "vite" | "dotnet" | "unknown";

export type DetectStackResult = {
  stack: AuthStack;
  /** True when package.json lists `next`. */
  hasNext: boolean;
  /** True when package.json lists `vite`. */
  hasVite: boolean;
  /** True when a `.csproj` file exists under cwd (depth ≤ 2). */
  hasDotnet: boolean;
};

function dependencyNames(packageJson: Record<string, unknown>): Set<string> {
  const names = new Set<string>();
  for (const field of ["dependencies", "devDependencies", "peerDependencies"] as const) {
    const block = packageJson[field];
    if (block && typeof block === "object") {
      for (const key of Object.keys(block as Record<string, string>)) {
        names.add(key);
      }
    }
  }
  return names;
}

async function readPackageJson(cwd: string): Promise<Record<string, unknown> | null> {
  const path = join(cwd, "package.json");
  if (!existsSync(path)) {
    return null;
  }

  try {
    const raw = await readFile(path, "utf8");
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function directoryHasCsproj(dir: string): boolean {
  if (!existsSync(dir)) {
    return false;
  }

  try {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isFile() && entry.name.endsWith(".csproj")) {
        return true;
      }
    }
  } catch {
    return false;
  }

  return false;
}

function findCsproj(cwd: string): boolean {
  if (existsSync(join(cwd, "Program.cs")) || existsSync(join(cwd, "Startup.cs"))) {
    return true;
  }

  return directoryHasCsproj(cwd) || directoryHasCsproj(join(cwd, "src"));
}

/** Detect the primary Auth-Ninja integration stack for a consumer project. */
export async function detectStack(cwd: string): Promise<DetectStackResult> {
  const packageJson = await readPackageJson(cwd);
  const deps = packageJson ? dependencyNames(packageJson) : new Set<string>();
  const hasNext = deps.has("next");
  const hasVite = deps.has("vite");
  const hasDotnet = findCsproj(cwd);

  let stack: AuthStack = "unknown";
  if (hasNext) {
    stack = "next";
  } else if (hasVite) {
    stack = "vite";
  } else if (hasDotnet) {
    stack = "dotnet";
  }

  return { stack, hasNext, hasVite, hasDotnet };
}
