# Auth-Ninja Next.js full-stack demo

Throwaway UI and API on one Next.js app. **Not published.**

## Setup

1. Start PostgreSQL and create a database (e.g. `auth_ninja`).
2. Copy `.env.example` to `.env.local` and set `AUTH_NINJA_SECRET` (`auth-ninja keys generate`) and `AUTH_NINJA_DATABASE_URL`.
3. From the repo root:

```bash
pnpm install
pnpm build
pnpm --filter @auth-ninja/demo-next-fullstack dev
```

Open [http://localhost:3000](http://localhost:3000). Auth API routes live at `/auth/*` on the same origin — no proxy needed.

## Pages

| Route | Purpose |
| --- | --- |
| `/login` | Email/password login, passkey login, MFA redirect |
| `/register` | New account |
| `/2fa` | Enroll, confirm, disable TOTP |
| `/2fa/verify` | Complete login when MFA is required |
| `/passkeys` | Passkey login (guest) or register/list/remove (signed in) |

Uses headless hooks from `@auth-ninja/react` and route handlers from `@auth-ninja/next` — copy patterns, not this UI.
