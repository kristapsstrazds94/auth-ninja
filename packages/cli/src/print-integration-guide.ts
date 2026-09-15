import type { FullStack } from "./detect-stack.js";

const DOCS = "https://github.com/kristapsstrazds94/auth-ninja#";

/** Print manual integration steps — the CLI never edits application source files. */
export function printIntegrationGuide(stack: FullStack): void {
  console.log("\n--- Manual integration (copy from README) ---\n");
  console.log("Auth-Ninja does not modify your application code.");
  console.log(`Follow the integration guide: ${DOCS}integrate\n`);

  if (stack === "next") {
    console.log("Next.js full-stack checklist:");
    console.log("  1. Add lib/auth-ninja.ts (shared server context + auto-migrations on boot)");
    console.log("  2. Add app/auth/*/route.ts handlers (register, login, logout, session, csrf, 2FA, passkeys)");
    console.log("  3. Add middleware.ts for CSRF, rate limiting, and IP audit on /auth/*");
    console.log("  4. Wrap your app with <AuthProvider> and set NEXT_PUBLIC_AUTH_BASE_URL");
    console.log("  5. Build login, register, and protected pages with useAuth / RequireAuth");
    return;
  }

  console.log("React + .NET full-stack checklist:");
  console.log("  1. Register AddAuthNinja / UseAuthNinja / MapAuthNinja in Program.cs");
  console.log("  2. Call await db.Database.MigrateAsync() on startup (or use db migrate again)");
  console.log("  3. Configure Vite env + proxy /auth to your API in vite.config.ts");
  console.log("  4. Wrap your SPA with <AuthProvider> via readViteAuthClientConfig");
  console.log("  5. Build login, register, and protected pages with useAuth / RequireAuth");
}
