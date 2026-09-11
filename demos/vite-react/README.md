# Auth-Ninja Vite + React demo

Throwaway UI for manual testing. **Not published.**

## Setup

1. Copy `.env.example` to `.env.local` and point `VITE_AUTH_BASE_URL` at this dev server (default `http://localhost:5173`).
2. Run an Auth-Ninja API on port 3000 (e.g. Next adapter from task 6.2) or set `AUTH_NINJA_PROXY_TARGET`.
3. From the repo root:

```bash
pnpm install
pnpm build
pnpm --filter @auth-ninja/demo-vite-react dev
```

The Vite dev server proxies `/auth/*` to the backend so session cookies stay same-origin.

## Pages

| Route | Purpose |
| --- | --- |
| `/login` | Email/password login, passkey login, MFA redirect |
| `/register` | New account |
| `/2fa` | Enroll, confirm, disable TOTP |
| `/2fa/verify` | Complete login when MFA is required |
| `/passkeys` | Passkey login (guest) or register/list/remove (signed in) |

Uses headless hooks from `@auth-ninja/react` only — copy patterns, not this UI.
