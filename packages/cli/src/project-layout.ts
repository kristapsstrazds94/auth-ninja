import { existsSync } from "node:fs";
import { join } from "node:path";

export type ProjectLayout = {
  /** Directory containing the Next.js `app/` router folder. */
  appRoot: string;
  /** Shared auth context module path relative to project root. */
  authLibRelative: string;
  /** Middleware file path relative to project root. */
  middlewareRelative: string;
};

/** Resolve App Router and lib paths for a consumer project. */
export function resolveProjectLayout(cwd: string): ProjectLayout {
  const hasSrcApp = existsSync(join(cwd, "src", "app"));
  const hasRootApp = existsSync(join(cwd, "app"));
  const hasSrc = existsSync(join(cwd, "src"));
  const useSrcLayout = hasSrcApp || (hasSrc && !hasRootApp);

  const appRoot = useSrcLayout ? join(cwd, "src", "app") : join(cwd, "app");
  const authLibRelative = useSrcLayout ? "src/lib/auth-ninja.ts" : "lib/auth-ninja.ts";
  const middlewareRelative = useSrcLayout ? "src/middleware.ts" : "middleware.ts";

  return { appRoot, authLibRelative, middlewareRelative };
}

/** Relative import from a route folder to the shared auth lib module. */
export function authLibImport(routeSegments: string[]): string {
  const depth = routeSegments.length + 1;
  return `${"../".repeat(depth)}lib/auth-ninja.js`;
}
