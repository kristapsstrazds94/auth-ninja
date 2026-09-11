import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // PGlite migrate + Argon2 hash can exceed 5s on cold CI runners.
    testTimeout: 15_000,
  },
});
