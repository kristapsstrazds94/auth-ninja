import { existsSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";

function listCsprojFiles(dir: string): string[] {
  if (!existsSync(dir)) {
    return [];
  }

  try {
    return readdirSync(dir, { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.endsWith(".csproj"))
      .map((entry) => join(dir, entry.name));
  } catch {
    return [];
  }
}

/** Find the first ASP.NET Core project file under `cwd` (depth ≤ 2). */
export function findCsprojPath(cwd: string): string | null {
  const candidates = [
    ...listCsprojFiles(cwd),
    ...listCsprojFiles(join(cwd, "src")),
    ...listCsprojFiles(join(cwd, "api")),
  ];

  for (const candidate of candidates) {
    const rel = relative(cwd, candidate).replace(/\\/g, "/");
    if (!rel.includes("/tests/") && !rel.endsWith(".Tests.csproj")) {
      return rel;
    }
  }

  return candidates[0] ? relative(cwd, candidates[0]).replace(/\\/g, "/") : null;
}
