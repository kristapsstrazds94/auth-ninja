# @auth-ninja/react

Headless React integration for Auth-Ninja.

**No UI components ship in this package.** Build your own login/register screens; use `demos/` for reference only.

## Quick start

### Next.js

```tsx
"use client";

import { AuthProvider } from "@auth-ninja/react";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider baseUrl={process.env.NEXT_PUBLIC_AUTH_BASE_URL ?? ""}>
      {children}
    </AuthProvider>
  );
}
```

Set `NEXT_PUBLIC_AUTH_BASE_URL` to your app origin (e.g. `http://localhost:3000`).

### Vite SPA

```tsx
import { AuthProvider, readViteAuthClientConfig } from "@auth-ninja/react";

const authConfig = readViteAuthClientConfig(import.meta.env);

<AuthProvider {...authConfig}>
  <App />
</AuthProvider>
```

Add the Vite env plugin so invalid `VITE_AUTH_*` values fail at build time:

```ts
import { defineConfig } from "vite";
import { authNinjaViteEnvPlugin } from "@auth-ninja/react/vite";

export default defineConfig({
  plugins: [authNinjaViteEnvPlugin(), react()],
  server: {
    proxy: {
      "/auth": { target: "http://localhost:5280", changeOrigin: true },
    },
  },
});
```

For local dev with a Vite `/auth` proxy, **leave `VITE_AUTH_BASE_URL` unset** — the client uses same-origin `/auth/*` requests. Set it only when the SPA and API run on different public origins in production.

Allowed `VITE_AUTH_*` keys: `VITE_AUTH_BASE_URL` (empty string = same-origin), `VITE_AUTH_SESSION_IDLE_MINUTES`, `VITE_AUTH_SESSION_IDLE_REFRESH`, `VITE_AUTH_SESSION_SYNC`. Secret-like keys are rejected.

## Hooks and components

| Export | Purpose |
| --- | --- |
| `AuthProvider` | Session context, idle refresh, cross-tab sync |
| `useAuth()` | `user`, `login`, `register`, `logout`, `refreshSession` |
| `useSession()` | Read-only session state without auth actions |
| `RequireAuth` | Render children only when authenticated |
| `use2FA()` | TOTP enroll, confirm, verify, disable, backup codes |
| `usePasskey()` | WebAuthn register, login, list, delete |

## Low-level client

`createAuthClient({ baseUrl })` wraps `fetch` with CSRF headers and cookie credentials. Use it for flows without dedicated hooks (e.g. password reset):

```ts
import { createAuthClient } from "@auth-ninja/react";

const client = createAuthClient({ baseUrl: "" });

await client.request("/auth/password-reset/request", {
  method: "POST",
  json: { email: "user@example.com" },
});
```

## MFA and passkeys

When login returns `{ mfaRequired: true }`, redirect to your MFA page and call `use2FA().verifyLogin({ code })`. Passkey flows use `usePasskey()` — see [`demos/vite-react/src/pages/`](../../demos/vite-react/src/pages/) for patterns.

Full integration guide: [main README](../../README.md#integrate).
