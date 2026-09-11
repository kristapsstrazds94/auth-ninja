import { isWeakSecret } from "@auth-ninja/core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { runKeysGenerate } from "./commands/keys.js";

describe("runKeysGenerate", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("prints a strong AUTH_NINJA_SECRET line", () => {
    const logs: string[] = [];
    vi.spyOn(console, "log").mockImplementation((message: string) => {
      logs.push(message);
    });

    const result = runKeysGenerate();

    expect(logs[0]).toBe(result.line);
    expect(result.line).toMatch(/^AUTH_NINJA_SECRET=[A-Za-z0-9_-]{43}$/);
    expect(isWeakSecret(result.secret)).toBe(false);
    expect(logs[1]).toContain("do not commit");
  });
});
