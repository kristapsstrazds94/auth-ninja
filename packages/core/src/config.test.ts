import { describe, it, expect } from "vitest";
import { authNinjaConfigSchema } from "./config.js";

describe("authNinjaConfigSchema", () => {
  it("rejects secrets shorter than 32 characters", () => {
    const result = authNinjaConfigSchema.safeParse({
      secret: "too-short",
      baseUrl: "https://app.example.com",
    });
    expect(result.success).toBe(false);
  });

  it("accepts valid minimal config with defaults", () => {
    const result = authNinjaConfigSchema.safeParse({
      secret: "a".repeat(32),
      baseUrl: "https://app.example.com",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.sessionIdleMinutes).toBe(15);
      expect(result.data.csrfEnabled).toBe(true);
    }
  });
});
