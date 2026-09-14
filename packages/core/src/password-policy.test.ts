import { describe, expect, it } from "vitest";
import { assessPasswordStrength, isPasswordStrongEnough } from "./password-policy.js";

describe("password policy", () => {
  it("rejects common weak passwords", () => {
    expect(isPasswordStrongEnough("password", 2)).toBe(false);
    expect(isPasswordStrongEnough("12345678", 2)).toBe(false);
  });

  it("accepts strong passphrases", () => {
    expect(isPasswordStrongEnough("correct-horse-battery-staple", 2)).toBe(true);
    expect(isPasswordStrongEnough("secure-password-1", 2)).toBe(true);
  });

  it("returns zxcvbn score", () => {
    const weak = assessPasswordStrength("abc123", 2);
    const strong = assessPasswordStrength("correct-horse-battery-staple", 2);
    expect(weak.score).toBeLessThan(strong.score);
  });
});
