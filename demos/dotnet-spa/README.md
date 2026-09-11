# Auth-Ninja .NET SPA demo

React SPA (Vite) with Auth-Ninja API on ASP.NET Core. **Not published.**

## Setup

1. Start PostgreSQL and create a database (e.g. `auth_ninja`).
2. Copy `api/.env.example` to `api/.env` and set `AUTH_NINJA_SECRET` (`auth-ninja keys generate`) and `AUTH_NINJA_DATABASE_URL`.
3. Copy `.env.example` to `.env.local` (SPA client config).
4. From the repo root:

```bash
pnpm install
pnpm build
pnpm --filter @auth-ninja/demo-dotnet-spa build:api
```

In one terminal, start the .NET API:

```bash
pnpm --filter @auth-ninja/demo-dotnet-spa dev:api
```

In another, start the SPA:

```bash
pnpm --filter @auth-ninja/demo-dotnet-spa dev
```

Open [http://localhost:5174](http://localhost:5174). The Vite dev server proxies `/auth/*` to the .NET API on port 5280 so session cookies stay same-origin.

Production SPA build:

```bash
pnpm --filter @auth-ninja/demo-dotnet-spa build:app
```

## Pages

| Route | Purpose |
| --- | --- |
| `/login` | Email/password login, passkey login, MFA redirect |
| `/register` | New account |
| `/2fa` | Enroll, confirm, disable TOTP |
| `/2fa/verify` | Complete login when MFA is required |
| `/passkeys` | Passkey login (guest) or register/list/remove (signed in) |

Uses headless hooks from `@auth-ninja/react` and `AuthNinja.AspNetCore` — copy patterns, not this UI.
