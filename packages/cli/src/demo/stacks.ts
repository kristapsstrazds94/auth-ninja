export type DemoStack = "next" | "vite" | "dotnet";

export type DemoProcess = {
  label: string;
  filter: string;
  script: string;
  /** When true, merge the resolved Auth-Ninja server env (secret, database, etc.). */
  needsServerEnv?: boolean;
  env?: Record<string, string>;
};

export type DemoStackPlan = {
  stack: DemoStack;
  processes: DemoProcess[];
  urls: string[];
  serverBaseUrl: string;
};

/** Default demo secret — test fixture only, never use in production. */
export const DEMO_SECRET = "test-secret-min-32-chars-long-!!";

export function buildDemoServerEnv(options: {
  databaseUrl: string;
  baseUrl: string;
}): Record<string, string> {
  return {
    AUTH_NINJA_SECRET: DEMO_SECRET,
    AUTH_NINJA_BASE_URL: options.baseUrl,
    AUTH_NINJA_DATABASE_URL: options.databaseUrl,
    AUTH_NINJA_SESSION_IDLE_MINUTES: "15",
    AUTH_NINJA_SESSION_ABSOLUTE_HOURS: "8",
    AUTH_NINJA_LOCKOUT_MAX_ATTEMPTS: "5",
    AUTH_NINJA_LOCKOUT_WINDOW_MINUTES: "15",
    AUTH_NINJA_LOCKOUT_DURATION_MINUTES: "30",
    AUTH_NINJA_REQUIRE_2FA: "false",
    AUTH_NINJA_2FA_ISSUER: "AuthNinja",
    AUTH_NINJA_PASSKEYS_ENABLED: "true",
    AUTH_NINJA_PASSKEY_RP_ID: "localhost",
    AUTH_NINJA_API_RATE_LIMIT: "100",
    AUTH_NINJA_CSRF_ENABLED: "true",
  };
}

/** Resolve dev-server processes and URLs for a demo stack. */
export function resolveDemoPlan(stack: DemoStack): DemoStackPlan {
  switch (stack) {
    case "next":
      return {
        stack,
        serverBaseUrl: "http://localhost:3000",
        urls: ["http://localhost:3000"],
        processes: [
          {
            label: "Next.js full-stack demo",
            filter: "@auth-ninja/demo-next-fullstack",
            script: "dev",
            needsServerEnv: true,
          },
        ],
      };
    case "vite":
      return {
        stack,
        serverBaseUrl: "http://localhost:3000",
        urls: ["http://localhost:5173"],
        processes: [
          {
            label: "Next.js auth API (backend for Vite demo)",
            filter: "@auth-ninja/demo-next-fullstack",
            script: "dev",
            needsServerEnv: true,
          },
          {
            label: "Vite + React demo",
            filter: "@auth-ninja/demo-vite-react",
            script: "dev",
            env: {
              AUTH_NINJA_PROXY_TARGET: "http://localhost:3000",
            },
          },
        ],
      };
    case "dotnet":
      return {
        stack,
        serverBaseUrl: "http://localhost:5174",
        urls: ["http://localhost:5174"],
        processes: [
          {
            label: ".NET Auth API",
            filter: "@auth-ninja/demo-dotnet-spa",
            script: "dev:api",
            needsServerEnv: true,
          },
          {
            label: ".NET SPA (Vite)",
            filter: "@auth-ninja/demo-dotnet-spa",
            script: "dev",
            env: {
              AUTH_NINJA_PROXY_TARGET: "http://localhost:5280",
            },
          },
        ],
      };
    default: {
      const _exhaustive: never = stack;
      throw new Error(`Unknown demo stack: ${String(_exhaustive)}`);
    }
  }
}
