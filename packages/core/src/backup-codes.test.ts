import { describe, expect, it } from "vitest";
import {
  BACKUP_CODE_LENGTH,
  DEFAULT_BACKUP_CODE_COUNT,
  generateBackupCodes,
  hashBackupCode,
  hashBackupCodes,
  normalizeBackupCode,
  verifyBackupCode,
} from "./backup-codes.js";
import { AuthNinjaError } from "./errors.js";

function oneBackupCode(): string {
  const [code] = generateBackupCodes(1);
  if (!code) {
    throw new Error("expected one backup code");
  }
  return code;
}

describe("generateBackupCodes", () => {
  it("returns the default count of unique codes", () => {
    const codes = generateBackupCodes();
    expect(codes).toHaveLength(DEFAULT_BACKUP_CODE_COUNT);
    expect(new Set(codes).size).toBe(DEFAULT_BACKUP_CODE_COUNT);
  });

  it("returns codes within OpenAPI length bounds", () => {
    const codes = generateBackupCodes(5);
    for (const code of codes) {
      expect(code.length).toBe(BACKUP_CODE_LENGTH);
      expect(code.length).toBeGreaterThanOrEqual(8);
      expect(code.length).toBeLessThanOrEqual(32);
    }
  });

  it("rejects invalid counts", () => {
    expect(() => generateBackupCodes(0)).toThrow(AuthNinjaError);
    expect(() => generateBackupCodes(-1)).toThrow(AuthNinjaError);
  });
});

describe("normalizeBackupCode", () => {
  it("uppercases and strips dashes", () => {
    expect(normalizeBackupCode(" abcd-efgh ")).toBe("ABCDEFGH");
  });
});

describe("hashBackupCode / verifyBackupCode", () => {
  it("round-trips a generated backup code", async () => {
    const code = oneBackupCode();
    const codeHash = await hashBackupCode(code);
    await expect(verifyBackupCode(code, codeHash)).resolves.toBe(true);
  });

  it("accepts normalized user input", async () => {
    const code = oneBackupCode();
    const codeHash = await hashBackupCode(code);
    const formatted = `${code.slice(0, 5)}-${code.slice(5)}`.toLowerCase();
    await expect(verifyBackupCode(formatted, codeHash)).resolves.toBe(true);
  });

  it("rejects incorrect codes without throwing", async () => {
    const code = oneBackupCode();
    const codeHash = await hashBackupCode(code);
    await expect(verifyBackupCode("WRONGCODE1", codeHash)).resolves.toBe(false);
  });

  it("rejects empty input", async () => {
    const code = oneBackupCode();
    const codeHash = await hashBackupCode(code);
    await expect(verifyBackupCode("", codeHash)).resolves.toBe(false);
    await expect(verifyBackupCode(code, "")).resolves.toBe(false);
  });

  it("rejects codes outside length bounds", async () => {
    await expect(hashBackupCode("short")).rejects.toThrow(AuthNinjaError);
    await expect(verifyBackupCode("short", "ignored")).resolves.toBe(false);
  });
});

describe("hashBackupCodes", () => {
  it("hashes every code in a batch", async () => {
    const codes = generateBackupCodes(3);
    const hashes = await hashBackupCodes(codes);
    expect(hashes).toHaveLength(3);
    await expect(verifyBackupCode(codes[0]!, hashes[0]!)).resolves.toBe(true);
  });
});
