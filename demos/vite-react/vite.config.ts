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
          VITE_AUTH_BASE_URL: env.VITE_AUTH_BASE_URL ?? "",
        },
      }),
      react(),
    ],
    server: {
      host: "localhost",
      port: 5173,
      strictPort: true,
      proxy: {
        "/auth": {
          target: process.env.AUTH_NINJA_PROXY_TARGET ?? "http://localhost:3000",
          changeOrigin: true,
        },
      },
    },
  };
});
