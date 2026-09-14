import { describe, expect, it } from "vitest";
import {
  generatePasswordResetToken,
  hashPasswordResetToken,
} from "./password-reset-token.js";

describe("password reset token", () => {
  it("generates URL-safe tokens of sufficient length", () => {
    const token = generatePasswordResetToken();
    expect(token.length).toBeGreaterThanOrEqual(32);
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("hashes tokens deterministically", () => {
    const token = "test-reset-token-value";
    const hash1 = hashPasswordResetToken(token);
    const hash2 = hashPasswordResetToken(token);
    expect(hash1).toBe(hash2);
    expect(hash1).not.toBe(token);
  });
});
