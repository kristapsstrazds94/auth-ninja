import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");

const PUBLISHABLE_PACKAGES = [
  { name: "@auth-ninja/core", dir: "packages/core", files: ["dist", "README.md"] },
  {
    name: "@auth-ninja/protocol",
    dir: "packages/protocol",
    files: ["dist", "openapi.json", "README.md"],
  },
  { name: "@auth-ninja/react", dir: "packages/react", files: ["dist", "README.md"] },
  {
    name: "@auth-ninja/next",
    dir: "packages/next",
    files: ["dist", "drizzle", "README.md"],
  },
  { name: "@auth-ninja/cli", dir: "packages/cli", files: ["dist", "README.md"] },
] as const;

const RELEASE_VERSION = "1.0.0";

function readJson(path: string): Record<string, unknown> {
  return JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
}

describe("release readiness (task 7.3)", () => {
  it("has changesets config with fixed publishable group", () => {
    const configPath = join(repoRoot, ".changeset/config.json");
    expect(existsSync(configPath)).toBe(true);
    const config = readJson(configPath);
    const fixed = config.fixed as string[][];
    expect(fixed).toBeDefined();
    const group = fixed[0];
    for (const pkg of PUBLISHABLE_PACKAGES) {
      expect(group).toContain(pkg.name);
    }
  });

  it("root package.json defines version and release scripts", () => {
    const root = readJson(join(repoRoot, "package.json"));
    const scripts = root.scripts as Record<string, string>;
    expect(scripts["version-packages"]).toBe("changeset version");
    expect(scripts.release).toContain("pnpm build");
    expect(scripts.release).toContain("scripts/publish-oidc.mjs");
  });

  it("release GitHub workflow and publish scripts exist", () => {
    expect(existsSync(join(repoRoot, ".github/workflows/release.yml"))).toBe(true);
    expect(existsSync(join(repoRoot, "scripts/publish-oidc.mjs"))).toBe(true);
    expect(existsSync(join(repoRoot, "scripts/create-github-release.mjs"))).toBe(true);
    const workflow = readFileSync(join(repoRoot, ".github/workflows/release.yml"), "utf8");
    expect(workflow).toContain("scripts/publish-oidc.mjs");
    expect(workflow).toContain("scripts/create-github-release.mjs");
    expect(workflow).toContain("id-token: write");
    expect(workflow).toContain("hasChangesets == 'false'");
    expect(workflow).toMatch(/NPM_TOKEN|trusted publishing \(OIDC\)/);
    expect(workflow).not.toMatch(/changesets\/action@v1[\s\S]*publish:/);
  });

  describe.each(PUBLISHABLE_PACKAGES)("$name", ({ dir, files }) => {
    const pkgDir = join(repoRoot, dir);

    it(`is version ${RELEASE_VERSION}`, () => {
      const pkg = readJson(join(pkgDir, "package.json"));
      expect(pkg.version).toBe(RELEASE_VERSION);
    });

    it("has CHANGELOG with release version", () => {
      const changelogPath = join(pkgDir, "CHANGELOG.md");
      expect(existsSync(changelogPath)).toBe(true);
      const content = readFileSync(changelogPath, "utf8");
      expect(content).toMatch(new RegExp(`## ${RELEASE_VERSION.replace(/\./g, "\\.")}`));
    });

    it("is publishable (files, access, prepublishOnly, repository)", () => {
      const pkg = readJson(join(pkgDir, "package.json"));
      expect(pkg.private).toBeUndefined();
      expect(pkg.files).toEqual(files);
      const publishConfig = pkg.publishConfig as { access: string };
      expect(publishConfig.access).toBe("public");
      const scripts = pkg.scripts as Record<string, string>;
      expect(scripts.prepublishOnly).toBe("pnpm run build");
      const repository = pkg.repository as { directory: string };
      expect(repository.directory).toBe(dir);
    });

    it("README exists for npm package page", () => {
      expect(existsSync(join(pkgDir, "README.md"))).toBe(true);
    });
  });

  it("contract-tests and demos stay private (not published)", () => {
    const contractTests = readJson(join(repoRoot, "packages/contract-tests/package.json"));
    expect(contractTests.private).toBe(true);
    const demo = readJson(join(repoRoot, "demos/vite-react/package.json"));
    expect(demo.private).toBe(true);
  });
});
