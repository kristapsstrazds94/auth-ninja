# @auth-ninja/react

Headless React integration for Auth-Ninja: `AuthProvider`, `useAuth`, `RequireAuth`.

**No UI components ship in this package.** Build your own login/register screens; use `demos/` for reference only.

## Vite env validation

Add the plugin so invalid `VITE_AUTH_*` values fail at build time:

```ts
import { defineConfig } from "vite";
import { authNinjaViteEnvPlugin } from "@auth-ninja/react/vite";

export default defineConfig({
  plugins: [authNinjaViteEnvPlugin()],
});
```

Required: `VITE_AUTH_BASE_URL` (auth API origin). Optional: `VITE_AUTH_SESSION_IDLE_MINUTES`, `VITE_AUTH_SESSION_IDLE_REFRESH`, `VITE_AUTH_SESSION_SYNC`. Secret-like `VITE_AUTH_*` keys are rejected.
