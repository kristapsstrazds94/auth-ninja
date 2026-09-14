import { describe, expect, it } from "vitest";
import {
  hashPassword,
  verifyPasswordWithTimingProtection,
} from "./password.js";

const TEST_PASSWORD = "secure-password-1";

describe("verifyPasswordWithTimingProtection", () => {
  it("returns false for unknown users while still running Argon2", async () => {
    const unknown = await verifyPasswordWithTimingProtection(TEST_PASSWORD, undefined);
    expect(unknown).toBe(false);
  });

  it("returns true for valid password hash", async () => {
    const hash = await hashPassword(TEST_PASSWORD);
    expect(await verifyPasswordWithTimingProtection(TEST_PASSWORD, hash)).toBe(true);
  });
});
