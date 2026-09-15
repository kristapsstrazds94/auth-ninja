import { loadEnv, type Plugin } from "vite";
import { validateViteAuthEnv, type ViteAuthEnv } from "./vite-auth-env.js";

export type AuthNinjaViteEnvPluginOptions = {
  /** Override env entries (for tests). When omitted, uses Vite `loadEnv`. */
  env?: Record<string, string | undefined>;
};

function defineViteAuthEnv(validated: ViteAuthEnv): Record<string, string> {
  const define: Record<string, string> = {
    "import.meta.env.VITE_AUTH_BASE_URL": JSON.stringify(validated.VITE_AUTH_BASE_URL),
  };

  if (validated.VITE_AUTH_SESSION_IDLE_MINUTES !== undefined) {
    define["import.meta.env.VITE_AUTH_SESSION_IDLE_MINUTES"] = JSON.stringify(
      String(validated.VITE_AUTH_SESSION_IDLE_MINUTES),
    );
  }

  if (validated.VITE_AUTH_SESSION_IDLE_REFRESH !== undefined) {
    define["import.meta.env.VITE_AUTH_SESSION_IDLE_REFRESH"] = JSON.stringify(
      validated.VITE_AUTH_SESSION_IDLE_REFRESH ? "true" : "false",
    );
  }

  if (validated.VITE_AUTH_SESSION_SYNC !== undefined) {
    define["import.meta.env.VITE_AUTH_SESSION_SYNC"] = JSON.stringify(
      validated.VITE_AUTH_SESSION_SYNC ? "true" : "false",
    );
  }

  return define;
}

/**
 * Vite plugin that validates `VITE_AUTH_*` at config time and injects them into
 * `import.meta.env` so defaults from `vite.config.ts` reach the client bundle.
 *
 * @example
 * ```ts
 * import { defineConfig } from "vite";
 * import { authNinjaViteEnvPlugin } from "@auth-ninja/react/vite";
 *
 * export default defineConfig({
 *   plugins: [authNinjaViteEnvPlugin()],
 * });
 * ```
 */
export function authNinjaViteEnvPlugin(
  options: AuthNinjaViteEnvPluginOptions = {},
): Plugin {
  return {
    name: "auth-ninja-vite-env",
    enforce: "pre",
    config(config, { mode }) {
      const envDir = config.envDir ?? process.cwd();
      const loaded = loadEnv(mode, envDir, "");
      const env = options.env ? { ...loaded, ...options.env } : loaded;
      const validated = validateViteAuthEnv(env);

      return {
        define: defineViteAuthEnv(validated),
      };
    },
  };
}
