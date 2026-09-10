import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runInit } from "./commands/init.js";
import { detectStack } from "./detect-stack.js";
import { authLibImport, resolveProjectLayout } from "./project-layout.js";
import { scaffoldEnv } from "./scaffold-env.js";
import { wireNext } from "./wire-next.js";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

async function makeTempProject(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "auth-ninja-init-"));
  tempDirs.push(dir);
  return dir;
}

describe("detectStack", () => {
  it("detects Next.js from package.json dependencies", async () => {
    const cwd = await makeTempProject();
    await writeFile(
      join(cwd, "package.json"),
      JSON.stringify({ dependencies: { next: "^15.0.0" } }),
      "utf8",
    );

    const result = await detectStack(cwd);
    expect(result.stack).toBe("next");
    expect(result.hasNext).toBe(true);
  });

  it("detects Vite when Next is absent", async () => {
    const cwd = await makeTempProject();
    await writeFile(
      join(cwd, "package.json"),
      JSON.stringify({ devDependencies: { vite: "^6.0.0" } }),
      "utf8",
    );

    const result = await detectStack(cwd);
    expect(result.stack).toBe("vite");
  });

  it("detects .NET from Program.cs", async () => {
    const cwd = await makeTempProject();
    await writeFile(join(cwd, "Program.cs"), "// stub", "utf8");

    const result = await detectStack(cwd);
    expect(result.stack).toBe("dotnet");
    expect(result.hasDotnet).toBe(true);
  });
});

describe("scaffoldEnv", () => {
  it("creates .env and .env.example without overwriting existing .env", async () => {
    const cwd = await makeTempProject();
    await writeFile(join(cwd, ".env"), "EXISTING=1\n", "utf8");

    const first = await scaffoldEnv({ cwd });
    expect(first.envCreated).toBe(false);
    expect(first.envExampleCreated).toBe(true);

    const env = await readFile(join(cwd, ".env"), "utf8");
    expect(env).toBe("EXISTING=1\n");
  });

  it("does not include secrets in the template", async () => {
    const cwd = await makeTempProject();
    await scaffoldEnv({ cwd });

    const env = await readFile(join(cwd, ".env"), "utf8");
    expect(env).toContain("AUTH_NINJA_SECRET=");
    expect(env).not.toMatch(/AUTH_NINJA_SECRET=[a-zA-Z0-9+/=]{32}/);
  });
});

describe("wireNext", () => {
  it("scaffolds App Router routes and shared lib", async () => {
    const cwd = await makeTempProject();
    await writeFile(
      join(cwd, "package.json"),
      JSON.stringify({ name: "demo-app", dependencies: { next: "^15.0.0" } }),
      "utf8",
    );

    const result = await wireNext({ cwd });

    expect(result.filesCreated).toContain("lib/auth-ninja.ts");
    expect(result.filesCreated).toContain("app/auth/register/route.ts");
    expect(result.filesCreated).toContain("middleware.ts");
    expect(existsSync(join(cwd, "app/auth/login/route.ts"))).toBe(true);

    const registerRoute = await readFile(join(cwd, "app/auth/register/route.ts"), "utf8");
    expect(registerRoute).toContain("createRegisterHandler");
    expect(registerRoute).toContain('from "../../../lib/auth-ninja.js"');
  });

  it("skips existing files on re-run", async () => {
    const cwd = await makeTempProject();
    await writeFile(join(cwd, "package.json"), JSON.stringify({ name: "demo-app" }), "utf8");

    const first = await wireNext({ cwd });
    await wireNext({ cwd });
    const third = await wireNext({ cwd });

    expect(first.filesCreated).toContain("app/auth/register/route.ts");
    expect(third.filesCreated).toHaveLength(0);
    expect(third.filesSkipped).toContain("app/auth/register/route.ts");
  });
});

describe("project layout", () => {
  it("uses src/ layout when src/app exists", async () => {
    const cwd = await makeTempProject();
    await mkdir(join(cwd, "src", "app"), { recursive: true });
    await writeFile(join(cwd, "src/app/page.tsx"), "export default function Page() {}", "utf8");

    const layout = resolveProjectLayout(cwd);
    expect(layout.authLibRelative).toBe("src/lib/auth-ninja.ts");
    expect(authLibImport(["auth", "register"])).toBe("../../../lib/auth-ninja.js");
  });
});

describe("runInit", () => {
  it("wires Next stack end-to-end", async () => {
    const cwd = await makeTempProject();
    await writeFile(
      join(cwd, "package.json"),
      JSON.stringify({ name: "demo-app", dependencies: { next: "^15.0.0" } }),
      "utf8",
    );

    const result = await runInit({ cwd, stack: "next" });

    expect(result.stack).toBe("next");
    expect(result.env?.envCreated).toBe(true);
    expect(result.next?.filesCreated.length).toBeGreaterThan(0);
    expect(existsSync(join(cwd, ".env"))).toBe(true);
  });

  it("scaffolds env only for unknown stack", async () => {
    const cwd = await makeTempProject();

    const result = await runInit({ cwd });

    expect(result.stack).toBe("unknown");
    expect(result.env?.envCreated).toBe(true);
    expect(result.next).toBeNull();
  });
});
