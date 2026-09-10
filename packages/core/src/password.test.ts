import { describe, expect, it } from "vitest";
import { timingSafeEqualUtf8 } from "./crypto/timing.js";
import { AuthNinjaError } from "./errors.js";
import { hashPassword, verifyPassword } from "./password.js";

const TEST_PASSWORD = "correct-horse-battery-staple";

describe("timingSafeEqualUtf8", () => {
  it("returns true for equal strings", () => {
    expect(timingSafeEqualUtf8("secret-value", "secret-value")).toBe(true);
  });

  it("returns false for unequal strings of the same length", () => {
    expect(timingSafeEqualUtf8("secret-value", "secret-valuX")).toBe(false);
  });

  it("returns false when lengths differ", () => {
    expect(timingSafeEqualUtf8("short", "much-longer-value")).toBe(false);
  });
});

describe("hashPassword", () => {
  it("returns an Argon2id PHC string", async () => {
    const passwordHash = await hashPassword(TEST_PASSWORD);
    expect(passwordHash.startsWith("$argon2id$")).toBe(true);
  });

  it("produces distinct hashes for the same password", async () => {
    const first = await hashPassword(TEST_PASSWORD);
    const second = await hashPassword(TEST_PASSWORD);
    expect(first).not.toBe(second);
  });

  it("rejects empty passwords", async () => {
    await expect(hashPassword("")).rejects.toThrow(AuthNinjaError);
  });
});

describe("verifyPassword", () => {
  it("returns true for the correct password", async () => {
    const passwordHash = await hashPassword(TEST_PASSWORD);
    await expect(verifyPassword(TEST_PASSWORD, passwordHash)).resolves.toBe(
      true,
    );
  });

  it("returns false for an incorrect password", async () => {
    const passwordHash = await hashPassword(TEST_PASSWORD);
    await expect(
      verifyPassword("wrong-password-value", passwordHash),
    ).resolves.toBe(false);
  });

  it("returns false for malformed hashes without throwing", async () => {
    await expect(
      verifyPassword(TEST_PASSWORD, "not-a-valid-argon2-hash"),
    ).resolves.toBe(false);
  });

  it("returns false for empty password or hash", async () => {
    const passwordHash = await hashPassword(TEST_PASSWORD);
    await expect(verifyPassword("", passwordHash)).resolves.toBe(false);
    await expect(verifyPassword(TEST_PASSWORD, "")).resolves.toBe(false);
  });
});
