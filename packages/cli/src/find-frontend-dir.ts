import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

async function hasReactPackageJson(dir: string): Promise<boolean> {
  const packagePath = join(dir, "package.json");
  if (!existsSync(packagePath)) {
    return false;
  }

  try {
    const raw = await readFile(packagePath, "utf8");
    const pkg = JSON.parse(raw) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    return Boolean(deps.react);
  } catch {
    return false;
  }
}

/** Locate a React frontend folder for React + .NET full-stack projects. */
export async function findFrontendDir(cwd: string): Promise<string | null> {
  const candidates = [cwd, join(cwd, "client"), join(cwd, "web"), join(cwd, "frontend"), join(cwd, "spa")];

  for (const candidate of candidates) {
    if (await hasReactPackageJson(candidate)) {
      return candidate === cwd ? "." : candidate.replace(/\\/g, "/");
    }
  }

  return null;
}
