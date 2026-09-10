import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const threatModelPath = join(repoRoot, "docs/THREAT-MODEL.md");

const STRIDE_CATEGORIES = [
  "Spoofing",
  "Tampering",
  "Repudiation",
  "Information disclosure",
  "Denial of service",
  "Elevation of privilege",
] as const;

const REQUIRED_FLOWS = [
  "Register",
  "Login",
  "Session",
  "Logout",
  "Password reset",
  "TOTP",
  "Passkey",
  "CSRF",
  "Rate limit",
  "Lockout",
  "IP audit",
] as const;

const KEY_THREATS = [
  "credential stuffing",
  "session hijacking",
  "user enumeration",
  "passkey origin",
  "session fixation",
] as const;

describe("docs/THREAT-MODEL.md", () => {
  it("exists at repo docs path", () => {
    expect(existsSync(threatModelPath)).toBe(true);
  });

  it("covers all STRIDE categories", () => {
    const content = readFileSync(threatModelPath, "utf8").toLowerCase();
    for (const category of STRIDE_CATEGORIES) {
      expect(content).toContain(category.toLowerCase());
    }
  });

  it("documents required auth flows", () => {
    const content = readFileSync(threatModelPath, "utf8");
    for (const flow of REQUIRED_FLOWS) {
      expect(content).toMatch(new RegExp(flow, "i"));
    }
  });

  it("names key threats referenced in SECURITY.md", () => {
    const content = readFileSync(threatModelPath, "utf8").toLowerCase();
    for (const threat of KEY_THREATS) {
      expect(content).toContain(threat);
    }
  });

  it("requires HttpOnly cookies and generic auth errors", () => {
    const content = readFileSync(threatModelPath, "utf8").toLowerCase();
    expect(content).toContain("httponly");
    expect(content).toContain("generic");
    expect(content).toContain("argon2id");
  });
});
