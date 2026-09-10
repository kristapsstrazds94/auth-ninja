import { describe, expect, it } from "vitest";
import { SHARED_CONTRACT_SCENARIOS, loadScenarios } from "./index.js";

describe("shared contract scenarios", () => {
  it("loads valid scenario definitions", () => {
    const scenarios = loadScenarios(SHARED_CONTRACT_SCENARIOS);
    expect(scenarios.length).toBeGreaterThanOrEqual(5);
    expect(scenarios.map((s) => s.id)).toEqual(
      expect.arrayContaining([
        "auth-lifecycle",
        "relogin",
        "invalid-credentials",
        "duplicate-email",
        "csrf-guard",
        "two-fa-cycle",
      ]),
    );
  });
});
