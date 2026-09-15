import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";
import { authNinjaViteEnvPlugin } from "@auth-ninja/react/vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    plugins: [
      authNinjaViteEnvPlugin({
        env: {
          ...env,
          // Empty = same-origin `/auth/*` through the dev proxy (avoids localhost vs 127.0.0.1 CORS).
          VITE_AUTH_BASE_URL: env.VITE_AUTH_BASE_URL ?? "",
        },
      }),
      react(),
    ],
    server: {
      host: "localhost",
      port: 5174,
      strictPort: true,
      // The .NET API lives alongside this SPA — do not watch build output (Windows EBUSY).
      watch: {
        ignored: ["**/api/**"],
      },
      proxy: {
        "/auth": {
          target: process.env.AUTH_NINJA_PROXY_TARGET ?? "http://localhost:5280",
          changeOrigin: true,
        },
      },
    },
  };
});
