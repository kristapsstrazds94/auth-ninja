import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseDemoArgs } from "./commands/demo.js";
import { buildDemoServerEnv, resolveDemoPlan } from "./demo/stacks.js";
import { buildDockerDatabaseUrl } from "./demo/postgres.js";
import { findAuthNinjaRepoRoot, resolveAuthNinjaRepoRoot } from "./find-repo-root.js";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = join(packageRoot, "..", "..");

describe("findAuthNinjaRepoRoot", () => {
  it("finds the monorepo from the CLI package directory", () => {
    expect(findAuthNinjaRepoRoot(packageRoot)).toBe(repoRoot);
  });

  it("finds the monorepo from demos/next-fullstack", () => {
    expect(findAuthNinjaRepoRoot(join(repoRoot, "demos", "next-fullstack"))).toBe(repoRoot);
  });

  it("returns null outside the monorepo", () => {
    expect(findAuthNinjaRepoRoot(dirname(repoRoot))).toBeNull();
  });
});

describe("resolveAuthNinjaRepoRoot", () => {
  it("resolves from the installed CLI package location", () => {
    expect(resolveAuthNinjaRepoRoot("/tmp/unrelated")).toBe(repoRoot);
  });
});

describe("parseDemoArgs", () => {
  it("defaults stack when no flags are passed", () => {
    expect(parseDemoArgs([])).toEqual({});
  });

  it("parses --stack and --cwd", () => {
    expect(parseDemoArgs(["--stack", "vite", "--cwd", "./app"])).toEqual({
      stack: "vite",
      cwd: "./app",
    });
  });

  it("ignores invalid stack values", () => {
    expect(parseDemoArgs(["--stack", "angular"])).toEqual({});
  });
});

describe("resolveDemoPlan", () => {
  it("starts a single Next.js process by default", () => {
    const plan = resolveDemoPlan("next");
    expect(plan.processes).toHaveLength(1);
    expect(plan.processes[0]?.filter).toBe("@auth-ninja/demo-next-fullstack");
    expect(plan.urls).toEqual(["http://localhost:3000"]);
  });

  it("starts backend + Vite for the vite stack", () => {
    const plan = resolveDemoPlan("vite");
    expect(plan.processes).toHaveLength(2);
    expect(plan.processes.map((proc) => proc.filter)).toEqual([
      "@auth-ninja/demo-next-fullstack",
      "@auth-ninja/demo-vite-react",
    ]);
    expect(plan.urls).toEqual(["http://localhost:5173"]);
  });

  it("starts API + SPA for the dotnet stack", () => {
    const plan = resolveDemoPlan("dotnet");
    expect(plan.processes).toHaveLength(2);
    expect(plan.processes[0]?.script).toBe("dev:api");
    expect(plan.processes[1]?.env?.AUTH_NINJA_PROXY_TARGET).toBe("http://localhost:5280");
  });
});

describe("buildDemoServerEnv", () => {
  it("uses the demo test secret and never leaves database URL empty", () => {
    const env = buildDemoServerEnv({
      databaseUrl: "postgresql://localhost:5432/auth_ninja",
      baseUrl: "http://localhost:3000",
    });

    expect(env.AUTH_NINJA_SECRET).toBe("test-secret-min-32-chars-long-!!");
    expect(env.AUTH_NINJA_DATABASE_URL).toBe("postgresql://localhost:5432/auth_ninja");
    expect(env.AUTH_NINJA_CSRF_ENABLED).toBe("true");
  });
});

describe("buildDockerDatabaseUrl", () => {
  it("builds a postgres URL from the mapped host port", () => {
    expect(buildDockerDatabaseUrl("55432")).toBe(
      "postgresql://auth_ninja:auth_ninja@localhost:55432/auth_ninja_e2e",
    );
  });
});
