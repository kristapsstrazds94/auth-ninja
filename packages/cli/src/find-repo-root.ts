import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const MARKERS = ["pnpm-workspace.yaml", join("demos", "next-fullstack", "package.json")] as const;

function hasRepoMarkers(dir: string): boolean {
  return MARKERS.every((marker) => existsSync(join(dir, marker)));
}

/** Walk upward from `startDir` looking for the Auth-Ninja monorepo root. */
export function findAuthNinjaRepoRoot(startDir: string): string | null {
  let dir = resolve(startDir);

  while (true) {
    if (hasRepoMarkers(dir)) {
      return dir;
    }

    const parent = dirname(dir);
    if (parent === dir) {
      return null;
    }
    dir = parent;
  }
}

/** Resolve monorepo root from cwd and the installed CLI package location. */
export function resolveAuthNinjaRepoRoot(cwd = process.cwd()): string | null {
  const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
  const candidates = [cwd, packageRoot];

  for (const candidate of candidates) {
    const found = findAuthNinjaRepoRoot(candidate);
    if (found) {
      return found;
    }
  }

  return null;
}
