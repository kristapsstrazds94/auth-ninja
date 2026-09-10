import { describe, expect, it } from "vitest";
import { CSRF_TOKEN_TTL_MS } from "./constants.js";
import { generateCsrfToken, verifyCsrfToken } from "./csrf.js";

const TEST_SECRET = "test-secret-min-32-chars-long!!";

describe("verifyCsrfToken", () => {
  it("accepts a freshly issued token", () => {
    const now = Date.now();
    const token = generateCsrfToken(TEST_SECRET, now);
    expect(verifyCsrfToken(TEST_SECRET, token, now)).toBe(true);
  });

  it("rejects expired tokens", () => {
    const issuedAt = Date.now();
    const token = generateCsrfToken(TEST_SECRET, issuedAt);
    const afterExpiry = issuedAt + CSRF_TOKEN_TTL_MS + 1;
    expect(verifyCsrfToken(TEST_SECRET, token, afterExpiry)).toBe(false);
  });

  it("rejects tokens signed with a different secret", () => {
    const token = generateCsrfToken(TEST_SECRET);
    expect(verifyCsrfToken("other-secret-min-32-characters!!", token)).toBe(false);
  });

  it("rejects tampered tokens", () => {
    const token = generateCsrfToken(TEST_SECRET);
    expect(verifyCsrfToken(TEST_SECRET, `${token}x`)).toBe(false);
  });
});
