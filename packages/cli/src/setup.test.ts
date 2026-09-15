import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { detectStack } from "./detect-stack.js";
import { migrateDb } from "./migrate-db.js";
import { scaffoldEnv } from "./scaffold-env.js";
import { generateAuthNinjaSecret } from "@auth-ninja/core";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
  vi.restoreAllMocks();
});

async function makeTempProject(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "auth-ninja-setup-"));
  tempDirs.push(dir);
  return dir;
}

describe("detectStack", () => {
  it("detects Next.js full-stack", async () => {
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

  it("detects .NET full-stack from Program.cs", async () => {
    const cwd = await makeTempProject();
    await writeFile(join(cwd, "Program.cs"), "// stub", "utf8");

    const result = await detectStack(cwd);
    expect(result.stack).toBe("dotnet");
    expect(result.hasDotnet).toBe(true);
  });

  it("returns unknown for frontend-only projects", async () => {
    const cwd = await makeTempProject();
    await writeFile(
      join(cwd, "package.json"),
      JSON.stringify({ devDependencies: { vite: "^6.0.0", react: "^19.0.0" } }),
      "utf8",
    );

    const result = await detectStack(cwd);
    expect(result.stack).toBe("unknown");
  });
});

describe("scaffoldEnv", () => {
  it("creates .env with an embedded secret", async () => {
    const cwd = await makeTempProject();
    const secret = generateAuthNinjaSecret();

    const result = await scaffoldEnv({ cwd, stack: "next", secret });
    expect(result.envCreated).toBe(true);
    expect(result.envExampleCreated).toBe(true);

    const env = await readFile(join(cwd, ".env"), "utf8");
    expect(env).toContain(`AUTH_NINJA_SECRET=${secret}`);
    expect(env).toContain("AUTH_NINJA_DATABASE_URL=");
  });

  it("does not replace an existing .env but injects a missing secret", async () => {
    const cwd = await makeTempProject();
    await writeFile(join(cwd, ".env"), "EXISTING=1\n", "utf8");

    const result = await scaffoldEnv({ cwd, stack: "next", secret: generateAuthNinjaSecret() });
    expect(result.envCreated).toBe(false);
    expect(result.secretInjected).toBe(true);

    const env = await readFile(join(cwd, ".env"), "utf8");
    expect(env).toContain("EXISTING=1");
    expect(env).toMatch(/^AUTH_NINJA_SECRET=.{32,}/m);
  });

  it("appends Vite client vars for dotnet stack", async () => {
    const cwd = await makeTempProject();
    const secret = generateAuthNinjaSecret();

    await scaffoldEnv({ cwd, stack: "dotnet", secret });
    const env = await readFile(join(cwd, ".env"), "utf8");
    expect(env).toContain("VITE_AUTH_BASE_URL=");
  });
});

describe("migrateDb", () => {
  it("fails gracefully when DATABASE_URL is missing", async () => {
    const cwd = await makeTempProject();
    const result = await migrateDb({ cwd });
    expect(result.ok).toBe(false);
    expect(result.message).toContain("AUTH_NINJA_DATABASE_URL");
  });
});
