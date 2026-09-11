import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { authNinjaViteEnvPlugin } from "@auth-ninja/react/vite";

export default defineConfig({
  plugins: [authNinjaViteEnvPlugin(), react()],
  server: {
    port: 5173,
    proxy: {
      "/auth": {
        target: process.env.AUTH_NINJA_PROXY_TARGET ?? "http://localhost:3000",
        changeOrigin: true,
      },
    },
  },
});
