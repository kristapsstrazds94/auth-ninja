import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, devices } from "@playwright/test";

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..");
const hasDatabase = Boolean(process.env.AUTH_NINJA_DATABASE_URL);

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: hasDatabase
    ? {
        command: "pnpm --filter @auth-ninja/demo-next-fullstack dev",
        url: "http://localhost:3000",
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        cwd: repoRoot,
        env: {
          ...process.env,
          AUTH_NINJA_SECRET:
            process.env.AUTH_NINJA_SECRET ?? "test-secret-min-32-chars-long-!!",
          AUTH_NINJA_BASE_URL:
            process.env.AUTH_NINJA_BASE_URL ?? "http://localhost:3000",
          AUTH_NINJA_DATABASE_URL: process.env.AUTH_NINJA_DATABASE_URL!,
          AUTH_NINJA_LOCKOUT_MAX_ATTEMPTS: "3",
          AUTH_NINJA_LOCKOUT_WINDOW_MINUTES: "15",
          AUTH_NINJA_LOCKOUT_DURATION_MINUTES: "30",
          AUTH_NINJA_SESSION_IDLE_MINUTES: "15",
          AUTH_NINJA_CSRF_ENABLED: "true",
        },
      }
    : undefined,
});
