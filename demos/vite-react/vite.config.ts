import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";
import { authNinjaViteEnvPlugin } from "@auth-ninja/react/vite";

/** Default dev-server origin — matches `.env.example`; override via `.env.local`. */
const DEFAULT_VITE_AUTH_BASE_URL = "http://localhost:5173";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    plugins: [
      authNinjaViteEnvPlugin({
        env: {
          ...env,
          VITE_AUTH_BASE_URL: env.VITE_AUTH_BASE_URL ?? DEFAULT_VITE_AUTH_BASE_URL,
        },
      }),
      react(),
    ],
    server: {
      port: 5173,
      proxy: {
        "/auth": {
          target: process.env.AUTH_NINJA_PROXY_TARGET ?? "http://localhost:3000",
          changeOrigin: true,
        },
      },
    },
  };
});
