import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const productionDocPath = join(repoRoot, "docs/PRODUCTION.md");

const MUST_PASS_SECTIONS = [
  "Secrets and configuration",
  "Transport and cookies",
  "Session lifecycle",
  "CSRF and rate limiting",
  "Passwords and MFA",
  "Infrastructure (multi-instance)",
  "Code quality and contract",
  "Observability and operations",
] as const;

const REQUIRED_GATES = [
  "AUTH_NINJA_SECRET",
  "HTTPS",
  "HttpOnly",
  "SameSite=Strict",
  "AUTH_NINJA_CSRF_ENABLED",
  "Argon2id",
  "auth-ninja doctor",
  "semgrep",
  "Redis",
  "user enumeration",
  "OpenAPI",
] as const;

describe("docs/PRODUCTION.md", () => {
  it("exists at repo docs path", () => {
    expect(existsSync(productionDocPath)).toBe(true);
  });

  it("defines must-pass gate sections", () => {
    const content = readFileSync(productionDocPath, "utf8");
    for (const section of MUST_PASS_SECTIONS) {
      expect(content).toContain(section);
    }
  });

  it("documents required production gates", () => {
    const content = readFileSync(productionDocPath, "utf8");
    for (const gate of REQUIRED_GATES) {
      expect(content).toMatch(new RegExp(gate.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"));
    }
  });

  it("includes a pre-release checklist with checkboxes", () => {
    const content = readFileSync(productionDocPath, "utf8");
    expect(content).toContain("Pre-release checklist");
    expect(content).toMatch(/- \[ \]/);
  });

  it("references threat model and security policy", () => {
    const content = readFileSync(productionDocPath, "utf8");
    expect(content).toContain("THREAT-MODEL.md");
    expect(content).toContain("SECURITY.md");
  });

  it("documents verification commands", () => {
    const content = readFileSync(productionDocPath, "utf8");
    expect(content).toContain("auth-ninja doctor --production --strict");
    expect(content).toContain("semgrep-scan.mjs");
  });
});
