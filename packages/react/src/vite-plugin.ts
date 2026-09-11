import { loadEnv, type Plugin } from "vite";
import { validateViteAuthEnv } from "./vite-auth-env.js";

export type AuthNinjaViteEnvPluginOptions = {
  /** Override env entries (for tests). When omitted, uses Vite `loadEnv`. */
  env?: Record<string, string | undefined>;
};

/**
 * Vite plugin that validates `VITE_AUTH_*` at config time so misconfiguration fails the build.
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
      const env = options.env ?? loadEnv(mode, envDir, "");
      validateViteAuthEnv(env);
    },
  };
}
