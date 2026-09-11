import { describe, expect, it } from "vitest";
import { isWeakSecret } from "./env-loader.js";
import { generateAuthNinjaSecret } from "./secret.js";

describe("generateAuthNinjaSecret", () => {
  it("returns a secret that passes strength checks", () => {
    const secret = generateAuthNinjaSecret();
    expect(secret.length).toBeGreaterThanOrEqual(32);
    expect(isWeakSecret(secret)).toBe(false);
  });

  it("returns unique values on successive calls", () => {
    const first = generateAuthNinjaSecret();
    const second = generateAuthNinjaSecret();
    expect(first).not.toBe(second);
  });
});
