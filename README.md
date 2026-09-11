# Auth-Ninja

Secure, reusable authentication for React apps — headless hooks on the client, battle-tested server adapters on the backend.

Auth-Ninja ships **no UI components**. You bring your own login screens; the packages handle sessions, CSRF, rate limiting, TOTP 2FA, and WebAuthn passkeys with secure defaults baked in.

Pick a backend adapter — both implement the same [OpenAPI contract](packages/protocol/openapi.json) and share configuration via `@auth-ninja/core`:

| | [Next.js](#nextjs) | [.NET](#net) |
|---|-------------------|--------------|
| **Adapter** | `@auth-ninja/next` | `AuthNinja.AspNetCore` |
| **ORM** | Drizzle | EF Core |
| **Typical frontend** | Next.js App Router or Vite SPA | Vite / React SPA |
| **Demo** | [`demos/next-fullstack`](demos/next-fullstack) | [`demos/dotnet-spa`](demos/dotnet-spa) |

---

## Table of contents

- [Shared concepts](#shared-concepts)
  - [Architecture](#architecture)
  - [Packages](#packages)
  - [React client setup](#react-client-setup)
  - [Configuration](#configuration)
  - [Auth API](#auth-api)
  - [Security defaults](#security-defaults)
- [Next.js](#nextjs)
  - [Compatibility](#nextjs-compatibility)
  - [Quick start](#nextjs-quick-start)
  - [Full-stack integration](#nextjs-full-stack)
  - [Vite SPA + Next.js API](#vite-spa--nextjs-api)
- [.NET](#net)
  - [Compatibility](#net-compatibility)
  - [Quick start](#net-quick-start)
  - [ASP.NET Core integration](#aspnet-core-integration)
  - [React SPA client](#react-spa-client)
- [Demos](#demos)
- [Development](#development)
- [License](#license)

---

## Shared concepts

These apply regardless of which backend adapter you choose.

### Architecture

The React client talks to `/auth/*` over HttpOnly cookies — never localStorage. Pick **one** server adapter:

```mermaid
flowchart TB
  subgraph client["React client (both stacks)"]
    UI["Your UI"]
    React["@auth-ninja/react"]
    UI --> React
  end

  React -->|"cookies + CSRF"| NextPath
  React -->|"cookies + CSRF"| DotNetPath

  subgraph NextPath["Next.js path"]
    Next["@auth-ninja/next"]
    Next --> PG1[(PostgreSQL)]
  end

  subgraph DotNetPath[".NET path"]
    DotNet["AuthNinja.AspNetCore"]
    DotNet --> PG2[(PostgreSQL)]
  end
```

| Layout | Backend | Frontend | Cookie origin |
|--------|---------|----------|---------------|
| Next.js full-stack | `@auth-ninja/next` | Next.js App Router | Same host — no proxy |
| Vite + Next.js API | `@auth-ninja/next` | Vite + React | Dev proxy `/auth` → API |
| Vite + .NET API | `AuthNinja.AspNetCore` | Vite + React | Dev proxy `/auth` → API |

### Packages

| Package | Registry | Used by |
|---------|----------|---------|
| [`@auth-ninja/core`](packages/core) | npm | Both stacks — config, errors, crypto |
| [`@auth-ninja/protocol`](packages/protocol) | npm | Contract tests, code generation |
| [`@auth-ninja/react`](packages/react) | npm | Both stacks — headless React hooks |
| [`@auth-ninja/next`](packages/next) | npm | **Next.js only** |
| [`@auth-ninja/cli`](packages/cli) | npm | Scaffolding for both stacks |
| [`AuthNinja.AspNetCore`](adapters/dotnet) | NuGet | **.NET only** |

All npm packages are published at version **0.1.0** and versioned together via [Changesets](.changeset/README.md).

### React client setup

`@auth-ninja/react` is headless and identical for both stacks. Build your own forms; use hooks for state and API calls.

#### Core hooks

| Hook / component | Purpose |
|------------------|---------|
| `AuthProvider` | Session context, idle refresh, cross-tab sync |
| `useAuth()` | `user`, `login`, `register`, `logout`, `isLoading` |
| `RequireAuth` | Render children only when authenticated |
| `useSession()` | Low-level session fetch state |
| `use2FA()` | TOTP enroll, confirm, verify, disable |
| `usePasskey()` | WebAuthn register, login, list, delete |

#### Minimal login example

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

#### Protected route

```tsx
import { RequireAuth } from "@auth-ninja/react";

function Dashboard() {
  return (
    <RequireAuth fallback={<p>Redirecting to login…</p>}>
      <DashboardContent />
    </RequireAuth>
  );
}
```

CSRF tokens are fetched automatically before state-changing requests (`POST`, `PUT`, `PATCH`, `DELETE`).

Stack-specific `AuthProvider` wiring is covered in [Next.js full-stack](#nextjs-full-stack), [Vite SPA + Next.js API](#vite-spa--nextjs-api), and [React SPA client](#react-spa-client).

### Configuration

Copy [`.env.example`](.env.example) to `.env`. Both adapters read the same `AUTH_NINJA_*` variables via `@auth-ninja/core`.

#### Required

| Variable | Description |
|----------|-------------|
| `AUTH_NINJA_SECRET` | ≥ 32 random characters — `auth-ninja keys generate` |
| `AUTH_NINJA_BASE_URL` | Public URL of the auth API (e.g. `https://app.example.com`) |
| `AUTH_NINJA_DATABASE_URL` | PostgreSQL connection string |

#### Sessions & lockout (defaults shown)

| Variable | Default | Description |
|----------|---------|-------------|
| `AUTH_NINJA_SESSION_IDLE_MINUTES` | `15` | Idle timeout; session refreshed on activity |
| `AUTH_NINJA_SESSION_ABSOLUTE_HOURS` | `8` | Maximum session lifetime |
| `AUTH_NINJA_LOCKOUT_MAX_ATTEMPTS` | `5` | Failed logins before lockout |
| `AUTH_NINJA_LOCKOUT_WINDOW_MINUTES` | `15` | Window for counting failures |
| `AUTH_NINJA_LOCKOUT_DURATION_MINUTES` | `30` | Lockout duration |

#### 2FA, passkeys, and guards

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

### Auth API

All routes are under `/auth`. The [OpenAPI spec](packages/protocol/openapi.json) is the source of truth for both adapters.

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

### Security defaults

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

## Next.js

Use `@auth-ninja/next` when your auth API runs on **Next.js App Router** (full-stack or as a standalone API).

### Next.js compatibility

| Requirement | Version | Notes |
|-------------|---------|-------|
| **Node.js** | ≥ 20 | Runtime for Next.js adapter and CLI |
| **Next.js** | `^14.0.0 \|\| ^15.0.0` | App Router required |
| **React** | `^18.0.0 \|\| ^19.0.0` | Via `@auth-ninja/react` |
| **PostgreSQL** | 14+ recommended | Sessions, users, credentials, audit log |
| **Redis** | Optional locally; **recommended in production** | Distributed rate limiting across instances |
| **TypeScript** | 5.x | Declarations ship with packages |

Passkeys require a browser with WebAuthn. Session cookies require `SameSite=Strict` support (all modern browsers).

### Next.js quick start

```bash
pnpm dlx @auth-ninja/cli init --stack next
auth-ninja keys generate          # copy into .env as AUTH_NINJA_SECRET
auth-ninja doctor                 # validate config
auth-ninja demo                   # local demo → http://localhost:3000
```

`auth-ninja init --stack next` scaffolds App Router routes under `app/auth/*`, a shared `lib/auth-ninja.ts`, and middleware. It creates `.env` and `.env.example` (never overwrites an existing `.env`).

Set `AUTH_NINJA_DATABASE_URL` in `.env`. Migrations run automatically on first request via `runAuthMigrations`.

### Next.js full-stack

Best when UI and auth API live in the **same Next.js app**.

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
// middleware.ts
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

### Vite SPA + Next.js API

Use when the React UI is a **separate Vite app** and the auth API runs on Next.js.

#### Install (SPA)

```bash
pnpm add @auth-ninja/react
```

#### Vite config — env validation + dev proxy

The Vite plugin rejects secret-like `VITE_AUTH_*` keys at build time. Proxy `/auth` to your Next.js API so session cookies stay same-origin during development:

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

Run `@auth-ninja/next` on port 3000 (or your chosen port). In production, put both behind a reverse proxy so `/auth/*` and the SPA share one origin.

> **Reference:** [`demos/vite-react/README.md`](demos/vite-react/README.md)

#### Next.js API backend

Follow [Next.js full-stack](#nextjs-full-stack) for the API side, or run a Next.js app that exposes only `/auth/*` routes without a React UI.

---

## .NET

Use `AuthNinja.AspNetCore` when your auth API runs on **ASP.NET Core**. The React client is the same `@auth-ninja/react` package used with Next.js.

### .NET compatibility

| Requirement | Version | Notes |
|-------------|---------|-------|
| **.NET** | **10** (`net10.0`) | Target framework for `AuthNinja.AspNetCore` |
| **ASP.NET Core** | ships with .NET 10 | Minimal hosting model |
| **PostgreSQL** | 14+ recommended | Same schema as the Next.js adapter |
| **Redis** | Optional locally; **recommended in production** | Distributed rate limiting across instances |
| **React client** | `^18.0.0 \|\| ^19.0.0` | Via `@auth-ninja/react` in your SPA |
| **Vite** (optional) | `^5.0.0 \|\| ^6.0.0` | For the env validation plugin in SPAs |

Node.js is **not** required on the server — only if you use the `@auth-ninja/cli` or a Vite-based React frontend.

### .NET quick start

```bash
auth-ninja init --stack dotnet    # scaffolds Program.cs snippet + .env
auth-ninja keys generate          # copy into api/.env as AUTH_NINJA_SECRET
auth-ninja doctor --cwd ./api
auth-ninja demo --stack dotnet    # local demo → http://localhost:5174
```

Set `AUTH_NINJA_DATABASE_URL`, then apply EF Core migrations:

```bash
export AUTH_NINJA_DATABASE_URL="postgresql://postgres:postgres@localhost:5432/auth_ninja"
dotnet ef database update --project src/AuthNinja.AspNetCore/AuthNinja.AspNetCore.csproj
```

### ASP.NET Core integration

#### Install

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

EF Core entities mirror the Next.js Drizzle schema:

| Table | Purpose |
|-------|---------|
| `users` | Accounts (Argon2id password hash, optional TOTP secret) |
| `sessions` | HttpOnly cookie sessions (token stored as SHA-256 hash) |
| `credentials` | WebAuthn passkeys and hashed TOTP backup codes |
| `audit_events` | Login, logout, lockout, and IP audit rows |

Configuration binds from environment variables or `appsettings.json` using the same `AUTH_NINJA_*` names documented in [Configuration](#configuration).

> **Reference:** [`adapters/dotnet/README.md`](adapters/dotnet/README.md)

### React SPA client

Pair the .NET API with a Vite + React SPA. The client setup is identical to [Vite SPA + Next.js API](#vite-spa--nextjs-api) — only the proxy target changes.

#### Vite dev proxy

```ts
// vite.config.ts
server: {
  port: 5174,
  proxy: {
    "/auth": {
      target: process.env.AUTH_NINJA_PROXY_TARGET ?? "http://localhost:5280",
      changeOrigin: true,
    },
  },
},
```

#### Client env (`.env.local`)

```bash
VITE_AUTH_BASE_URL=http://localhost:5174
```

#### Bootstrap

```tsx
import { AuthProvider, readViteAuthClientConfig } from "@auth-ninja/react";

const authConfig = readViteAuthClientConfig(import.meta.env);

<AuthProvider {...authConfig}>
  <App />
</AuthProvider>
```

In production, reverse-proxy `/auth/*` to the .NET API so cookies remain same-origin with the SPA.

> **Reference:** [`demos/dotnet-spa/README.md`](demos/dotnet-spa/README.md)

---

## Demos

Throwaway UI lives under [`demos/`](demos/) — **not published** to npm. Use them to explore flows and copy patterns, not components.

### Next.js demos

| Demo | Stack | Port |
|------|-------|------|
| [`demos/next-fullstack`](demos/next-fullstack) | Next.js + `@auth-ninja/next` | 3000 |
| [`demos/vite-react`](demos/vite-react) | Vite SPA + proxied Next.js API | 5173 |

### .NET demos

| Demo | Stack | Port |
|------|-------|------|
| [`demos/dotnet-spa`](demos/dotnet-spa) | Vite SPA + `AuthNinja.AspNetCore` | 5174 |

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
