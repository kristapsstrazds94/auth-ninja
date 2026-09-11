import { existsSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";

const VITE_PLUGIN_SNIPPET = `// Auth-Ninja — add to vite.config.ts plugins array
import { authNinjaViteEnvPlugin } from "@auth-ninja/react/vite";

export default defineConfig({
  plugins: [
    authNinjaViteEnvPlugin(),
    // ...existing plugins
  ],
});
`;

const VITE_CLIENT_SNIPPET = `// Auth-Ninja — wrap your app root (e.g. main.tsx)
import { AuthProvider, readViteAuthClientConfig } from "@auth-ninja/react";

const authConfig = readViteAuthClientConfig(import.meta.env);

export function AppWithAuth({ children }: { children: React.ReactNode }) {
  return <AuthProvider {...authConfig}>{children}</AuthProvider>;
}
`;

export type WireViteOptions = {
  cwd?: string;
};

export type WireViteResult = {
  filesCreated: string[];
  filesSkipped: string[];
  dependenciesAdded: string[];
};

async function writeIfMissing(
  cwd: string,
  relativePath: string,
  content: string,
): Promise<"created" | "skipped"> {
  const fullPath = join(cwd, relativePath);
  if (existsSync(fullPath)) {
    return "skipped";
  }

  await writeFile(fullPath, content, "utf8");
  return "created";
}

async function mergeDependencies(cwd: string): Promise<string[]> {
  const packagePath = join(cwd, "package.json");
  if (!existsSync(packagePath)) {
    return [];
  }

  const { readFile } = await import("node:fs/promises");
  const raw = await readFile(packagePath, "utf8");
  const pkg = JSON.parse(raw) as { dependencies?: Record<string, string> };
  const added: string[] = [];
  const deps = (pkg.dependencies ??= {});

  for (const name of ["@auth-ninja/core", "@auth-ninja/react"]) {
    if (!deps[name]) {
      deps[name] = "^0.0.0";
      added.push(name);
    }
  }

  if (added.length > 0) {
    await writeFile(packagePath, `${JSON.stringify(pkg, null, 2)}\n`, "utf8");
  }

  return added;
}

/** Write Vite integration snippets and ensure client dependencies. */
export async function wireVite(options: WireViteOptions = {}): Promise<WireViteResult> {
  const cwd = options.cwd ?? process.cwd();
  const filesCreated: string[] = [];
  const filesSkipped: string[] = [];

  for (const [relativePath, content] of [
    ["auth-ninja.vite.config.snippet.ts", VITE_PLUGIN_SNIPPET],
    ["auth-ninja.client.snippet.tsx", VITE_CLIENT_SNIPPET],
  ] as const) {
    const result = await writeIfMissing(cwd, relativePath, content);
    if (result === "created") {
      filesCreated.push(relativePath);
    } else {
      filesSkipped.push(relativePath);
    }
  }

  const dependenciesAdded = await mergeDependencies(cwd);

  return { filesCreated, filesSkipped, dependenciesAdded };
}
