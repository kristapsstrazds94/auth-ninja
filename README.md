# Auth-Ninja

Secure, reusable authentication for React apps — headless hooks on the client, battle-tested server adapters on the backend.

Auth-Ninja ships **no UI components**. You bring your own login screens; the packages handle sessions, CSRF, rate limiting, TOTP 2FA, and WebAuthn passkeys with secure defaults baked in.

---

## Table of contents

- [Architecture](#architecture)
- [Packages](#packages)
- [Compatibility](#compatibility)
- [Quick start](#quick-start)
- [Integration guides](#integration-guides)
  - [Next.js full-stack](#nextjs-full-stack)
  - [Vite SPA + API backend](#vite-spa--api-backend)
  - [React SPA + .NET API](#react-spa--net-api)
- [React client setup](#react-client-setup)
- [Configuration](#configuration)
- [Auth API](#auth-api)
- [Security defaults](#security-defaults)
- [Demos](#demos)
- [Development](#development)
- [License](#license)

---

## Architecture

Both server adapters implement the same [OpenAPI contract](packages/protocol/openapi.json). The React package talks to `/auth/*` over HttpOnly cookies — never localStorage.

```mermaid
flowchart LR
  subgraph client["Your React app"]
    UI["Your UI"]
    React["@auth-ninja/react"]
    UI --> React
  end

  subgraph server["Pick one adapter"]
    Next["@auth-ninja/next"]
    DotNet["AuthNinja.AspNetCore"]
  end

  DB[(PostgreSQL)]
  React -->|"fetch + cookies"| Next
  React -->|"fetch + cookies"| DotNet
  Next --> DB
  DotNet --> DB
```

**Typical layouts**

| Layout | Frontend | Backend | Cookie origin |
|--------|----------|---------|---------------|
| Full-stack Next.js | Next.js App Router | `@auth-ninja/next` on same origin | Same host — no proxy needed |
| Decoupled SPA | Vite + React | Next.js or .NET API | Dev proxy `/auth` → API; production reverse proxy or same host |
| .NET shop | Vite + React | `AuthNinja.AspNetCore` | Same as decoupled SPA |

---

## Packages

| Package | npm / NuGet | Role |
|---------|-------------|------|
| [`@auth-ninja/core`](packages/core) | npm | Config schema, error codes, crypto helpers |
| [`@auth-ninja/protocol`](packages/protocol) | npm | OpenAPI contract — shared by both backends |
| [`@auth-ninja/react`](packages/react) | npm | Headless `AuthProvider`, `useAuth`, `RequireAuth`, 2FA & passkey hooks |
| [`@auth-ninja/next`](packages/next) | npm | Next.js App Router handlers, middleware, Drizzle schema |
| [`@auth-ninja/cli`](packages/cli) | npm | `auth-ninja` CLI — scaffold, validate, demo |
| [`AuthNinja.AspNetCore`](adapters/dotnet) | NuGet | ASP.NET Core adapter with EF Core |

All npm packages are published at version **0.1.0** and versioned together via [Changesets](.changeset/README.md).

---

## Compatibility

### Runtime requirements

| Requirement | Version | Notes |
|-------------|---------|-------|
| **Node.js** | ≥ 20 | Required for Next.js adapter and CLI |
| **PostgreSQL** | 14+ recommended | Sessions, users, credentials, audit log |
| **Redis** | Optional locally; **recommended in production** | Distributed rate limiting and lockout when running multiple instances |

### Framework peer dependencies

| Package | Peer dependency | Supported range |
|---------|-----------------|-----------------|
| `@auth-ninja/react` | `react` | `^18.0.0 \|\| ^19.0.0` |
| `@auth-ninja/react` | `vite` (optional) | `^5.0.0 \|\| ^6.0.0` — only for the env validation plugin |
| `@auth-ninja/next` | `next` | `^14.0.0 \|\| ^15.0.0` (App Router) |
| `AuthNinja.AspNetCore` | .NET | **.NET 10** (`net10.0`) |

### TypeScript

Packages ship TypeScript declarations. Consumer projects on **TypeScript 5.x** are tested in this monorepo.

### Browser support

Passkeys require a browser with WebAuthn. Session cookies require `SameSite=Strict` support (all modern browsers).

---

## Quick start

The fastest path into a new or existing project is the CLI.

### 1. Install the CLI

```bash
pnpm dlx @auth-ninja/cli init
# or: npm create @auth-ninja/cli@latest init
# or globally: npm i -g @auth-ninja/cli && auth-ninja init
```

`auth-ninja init` detects your stack from `package.json` / project layout and scaffolds:

- `.env` and `.env.example` (never overwrites an existing `.env`)
- **Next.js** — App Router routes under `app/auth/*`, shared `lib/auth-ninja.ts`, middleware
- **Vite** — client env vars and setup snippets
- **.NET** — `Program.cs` integration snippet

```bash
auth-ninja init --stack next --cwd ./my-app   # force a stack
auth-ninja init --dry-run                      # preview changes
```

### 2. Generate a secret

```bash
auth-ninja keys generate
```

Copy the output into `.env` as `AUTH_NINJA_SECRET`. Never commit this value.

### 3. Start PostgreSQL and run migrations

Set `AUTH_NINJA_DATABASE_URL` in `.env`, then migrations run automatically on first request (Next.js / .NET adapters call `runAuthMigrations` / `dotnet ef database update`).

### 4. Validate before deploy

```bash
auth-ninja doctor
auth-ninja doctor --production --strict
```

Checks secret strength, HTTPS in production, cookie flags, CSRF alignment, and timeout limits — without printing secrets.

### 5. Try a local demo

```bash
auth-ninja demo              # Next.js full-stack → http://localhost:3000
auth-ninja demo --stack vite # Vite SPA + API → http://localhost:5173
auth-ninja demo --stack dotnet
```

PostgreSQL is required. The demo command starts a Docker Compose Postgres service when none is reachable.

---

## Integration guides

### Next.js full-stack

Best when UI and auth API live on the same Next.js app.

#### Install

```bash
pnpm add @auth-ninja/core @auth-ninja/next @auth-ninja/react
```

#### Server — shared context

Create a singleton that loads config, connects to Postgres, and runs migrations once per process:

```ts
// lib/auth-ninja.ts
import { loadAuthNinjaConfig } from "@auth-ninja/core";
import {
  createAuthDb,
  createAuthNinjaContext,
  runAuthMigrations,
  type AuthNinjaContext,
} from "@auth-ninja/next";

let authPromise: Promise<AuthNinjaContext> | undefined;

export async function getAuthNinja(): Promise<AuthNinjaContext> {
  if (!authPromise) {
    authPromise = (async () => {
      const config = loadAuthNinjaConfig();
      const { db, client } = createAuthDb(config.databaseUrl);
      await runAuthMigrations({ db, client });
      return createAuthNinjaContext({ config, db });
    })();
  }
  return authPromise;
}
```

#### Server — route handlers

Wire App Router routes under `app/auth/*`:

```ts
// app/auth/register/route.ts
import { createRegisterHandler } from "@auth-ninja/next";
import { getAuthNinja } from "@/lib/auth-ninja";

export async function POST(request: Request) {
  const auth = await getAuthNinja();
  return createRegisterHandler(auth)(request);
}
```

Repeat for `login`, `logout`, `session`, `csrf`, and optional 2FA / passkey routes. See [`demos/next-fullstack/`](demos/next-fullstack/) for the full route tree.

#### Server — API guard

Rate limiting, CSRF validation, and IP audit run before handlers:

```ts
// middleware.ts (or wrap each route with createAuthApiGuard)
import { createAuthMiddleware } from "@auth-ninja/next";
import { getAuthNinja } from "@/lib/auth-ninja";

export default async function middleware(request: Request) {
  const auth = await getAuthNinja();
  return createAuthMiddleware(auth, { pathPrefix: "/auth" })(request);
}

export const config = { matcher: ["/auth/:path*"] };
```

#### Client — wrap your app

```tsx
// app/providers.tsx
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

Set `NEXT_PUBLIC_AUTH_BASE_URL` to your app's public origin (e.g. `http://localhost:3000`) so the client hits `/auth/*` on the same host.

> **Reference:** [`demos/next-fullstack/README.md`](demos/next-fullstack/README.md)

---

### Vite SPA + API backend

Best when the React UI is a separate Vite app and the auth API runs on Next.js or .NET.

#### Install (SPA)

```bash
pnpm add @auth-ninja/react
```

#### Vite config — env validation + dev proxy

The Vite plugin rejects secret-like `VITE_AUTH_*` keys at build time. Proxy `/auth` to your API so session cookies stay same-origin during development:

```ts
// vite.config.ts
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
```

#### Client env (`.env.local`)

```bash
# Public origin of the SPA — NOT the API host
VITE_AUTH_BASE_URL=http://localhost:5173

# Optional — match server AUTH_NINJA_SESSION_IDLE_MINUTES
# VITE_AUTH_SESSION_IDLE_MINUTES=15
```

#### Bootstrap

```tsx
// src/main.tsx
import { AuthProvider, readViteAuthClientConfig } from "@auth-ninja/react";

const authConfig = readViteAuthClientConfig(import.meta.env);

<AuthProvider {...authConfig}>
  <App />
</AuthProvider>
```

#### API backend

Run `@auth-ninja/next` or `AuthNinja.AspNetCore` on port 3000 (or your chosen port). In production, put both behind a reverse proxy so `/auth/*` and the SPA share one origin, or configure CORS + cookie domain carefully.

> **Reference:** [`demos/vite-react/README.md`](demos/vite-react/README.md)

---

### React SPA + .NET API

Use when your backend is ASP.NET Core and the frontend is React (typically Vite).

#### Install (.NET)

```bash
dotnet add package AuthNinja.AspNetCore
```

#### Program.cs

```csharp
builder.Services.AddAuthNinja(options => options.BindConfiguration(builder.Configuration));
app.UseAuthNinja();
app.MapAuthNinja(); // register, login, logout, session, csrf, 2fa, passkeys
```

#### Database

EF Core entities mirror the Next.js Drizzle schema (`users`, `sessions`, `credentials`, `audit_events`):

```bash
export AUTH_NINJA_DATABASE_URL="postgresql://postgres:postgres@localhost:5432/auth_ninja"
dotnet ef database update --project src/AuthNinja.AspNetCore/AuthNinja.AspNetCore.csproj
```

#### React client

Same as the [Vite SPA guide](#vite-spa--api-backend) — proxy `/auth` to the .NET API in dev.

> **Reference:** [`adapters/dotnet/README.md`](adapters/dotnet/README.md) · [`demos/dotnet-spa/README.md`](demos/dotnet-spa/README.md)

---

## React client setup

`@auth-ninja/react` is headless. Build your own forms; use hooks for state and API calls.

### Core hooks

| Hook / component | Purpose |
|------------------|---------|
| `AuthProvider` | Session context, idle refresh, cross-tab sync |
| `useAuth()` | `user`, `login`, `register`, `logout`, `isLoading` |
| `RequireAuth` | Render children only when authenticated |
| `useSession()` | Low-level session fetch state |
| `use2FA()` | TOTP enroll, confirm, verify, disable |
| `usePasskey()` | WebAuthn register, login, list, delete |

### Minimal login example

```tsx
import { useAuth } from "@auth-ninja/react";

function LoginPage() {
  const { login, isLoading } = useAuth();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const result = await login({
      email: String(form.get("email")),
      password: String(form.get("password")),
    });
    if ("mfaRequired" in result && result.mfaRequired) {
      // redirect to your /2fa/verify page
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <input name="email" type="email" required />
      <input name="password" type="password" required />
      <button type="submit" disabled={isLoading}>Sign in</button>
    </form>
  );
}
```

### Protected route

```tsx
import { RequireAuth, useAuth } from "@auth-ninja/react";

function Dashboard() {
  return (
    <RequireAuth fallback={<p>Redirecting to login…</p>}>
      <DashboardContent />
    </RequireAuth>
  );
}
```

CSRF tokens are fetched automatically by `createAuthClient` before state-changing requests (`POST`, `PUT`, `PATCH`, `DELETE`).

---

## Configuration

Copy [`.env.example`](.env.example) to `.env` and fill in the required values.

### Required

| Variable | Description |
|----------|-------------|
| `AUTH_NINJA_SECRET` | ≥ 32 random characters — `auth-ninja keys generate` |
| `AUTH_NINJA_BASE_URL` | Public URL of the auth API (e.g. `https://app.example.com`) |
| `AUTH_NINJA_DATABASE_URL` | PostgreSQL connection string |

### Sessions & lockout (defaults shown)

| Variable | Default | Description |
|----------|---------|-------------|
| `AUTH_NINJA_SESSION_IDLE_MINUTES` | `15` | Idle timeout; session refreshed on activity |
| `AUTH_NINJA_SESSION_ABSOLUTE_HOURS` | `8` | Maximum session lifetime |
| `AUTH_NINJA_LOCKOUT_MAX_ATTEMPTS` | `5` | Failed logins before lockout |
| `AUTH_NINJA_LOCKOUT_WINDOW_MINUTES` | `15` | Window for counting failures |
| `AUTH_NINJA_LOCKOUT_DURATION_MINUTES` | `30` | Lockout duration |

### 2FA, passkeys, and guards

| Variable | Default | Description |
|----------|---------|-------------|
| `AUTH_NINJA_REQUIRE_2FA` | `false` | Require TOTP for all users |
| `AUTH_NINJA_2FA_ISSUER` | `AuthNinja` | TOTP issuer name in authenticator apps |
| `AUTH_NINJA_PASSKEYS_ENABLED` | `true` | Enable WebAuthn passkeys |
| `AUTH_NINJA_PASSKEY_RP_ID` | — | Relying party ID (usually your domain) |
| `AUTH_NINJA_CSRF_ENABLED` | `true` | Signed `X-CSRF-Token` on state-changing routes |
| `AUTH_NINJA_API_RATE_LIMIT` | `100` | Requests per IP per minute |
| `AUTH_NINJA_IP_AUDIT_ENABLED` | `true` | Persist IP audit events |
| `AUTH_NINJA_REDIS_URL` | — | Redis for multi-instance deployments |

Full schema: `loadAuthNinjaConfig()` in [`@auth-ninja/core`](packages/core).

---

## Auth API

All routes are under `/auth`. The [OpenAPI spec](packages/protocol/openapi.json) is the source of truth.

| Route | Method | Description |
|-------|--------|-------------|
| `/auth/register` | POST | Create account |
| `/auth/login` | POST | Sign in (may return MFA challenge) |
| `/auth/logout` | POST | Invalidate session |
| `/auth/session` | GET | Read current user; refreshes idle timer |
| `/auth/csrf` | GET | CSRF token for state-changing requests |
| `/auth/2fa/*` | various | TOTP enrollment, verify, backup codes |
| `/auth/passkeys/*` | various | WebAuthn register and login |

Sessions use an HttpOnly `auth_session` cookie (`Secure`, `SameSite=Strict`). Login rotates any existing session ID.

---

## Security defaults

Auth-Ninja is **fail-closed** — invalid sessions, CSRF tokens, and rate limits deny access; protected routes never silently fall back to anonymous.

| Area | Default |
|------|---------|
| Session storage | HttpOnly cookie — **never** localStorage or sessionStorage |
| Password hashing | Argon2id |
| Auth errors | Generic messages — no user enumeration |
| CSRF | Enabled on state-changing routes |
| Rate limiting | Per-IP on auth endpoints |
| Account lockout | Configurable failed-attempt threshold |
| Session fixation | Session ID regenerated on login |

Report vulnerabilities per [`SECURITY.md`](SECURITY.md). Run `auth-ninja doctor --production --strict` before going live.

---

## Demos

Throwaway UI lives under [`demos/`](demos/) — **not published** to npm. Use them to explore flows and copy patterns, not components.

| Demo | Stack | Port |
|------|-------|------|
| [`demos/next-fullstack`](demos/next-fullstack) | Next.js + `@auth-ninja/next` | 3000 |
| [`demos/vite-react`](demos/vite-react) | Vite SPA + proxied API | 5173 |
| [`demos/dotnet-spa`](demos/dotnet-spa) | Vite SPA + .NET API | 5174 |

Each demo includes login, register, TOTP 2FA, and passkey pages wired to headless hooks.

---

## Development

Contributors working on the monorepo itself:

```bash
pnpm install
pnpm build
pnpm test
pnpm typecheck
```

Release workflow (maintainers):

```bash
pnpm changeset          # after user-facing changes
pnpm version-packages   # bump versions + CHANGELOGs
pnpm release            # build and publish to npm (OIDC or NPM_TOKEN)
```

---

## License

[MIT](LICENSE)
