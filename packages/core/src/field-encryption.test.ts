import { describe, expect, it } from "vitest";
import { decryptField, encryptField } from "./field-encryption.js";

const TEST_SECRET = "test-secret-min-32-chars-long!!";

describe("field encryption", () => {
  it("round-trips a TOTP secret", () => {
    const plaintext = "JBSWY3DPEHPK3PXP";
    const encrypted = encryptField(plaintext, TEST_SECRET);
    expect(encrypted.startsWith("v1:")).toBe(true);
    expect(encrypted).not.toContain(plaintext);
    expect(decryptField(encrypted, TEST_SECRET)).toBe(plaintext);
  });

  it("returns legacy plaintext values unchanged", () => {
    const legacy = "JBSWY3DPEHPK3PXP";
    expect(decryptField(legacy, TEST_SECRET)).toBe(legacy);
  });

  it("rejects tampered ciphertext", () => {
    const encrypted = encryptField("secret-value", TEST_SECRET);
    const payload = Buffer.from(encrypted.slice("v1:".length), "base64url");
    expect(payload.length).toBeGreaterThan(0);
    const lastIndex = payload.length - 1;
    payload[lastIndex] = (payload[lastIndex] ?? 0) ^ 0xff;
    const tampered = `v1:${payload.toString("base64url")}`;
    expect(() => decryptField(tampered, TEST_SECRET)).toThrow();
  });
});
