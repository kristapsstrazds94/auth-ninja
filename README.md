<p align="center">
  <img src="assets/auth-ninja-white.png" alt="Auth-Ninja" width="220" />
</p>

<h1 align="center">Auth-Ninja</h1>

<p align="center">
  Secure, reusable authentication for full-stack React apps — headless hooks on the client, battle-tested server adapters on the backend.
</p>

<p align="center">
  <strong>No UI components.</strong> You bring your own login screens; Auth-Ninja handles sessions, CSRF, rate limiting, TOTP 2FA, and WebAuthn passkeys with secure defaults baked in.
</p>

<p align="center">
  <a href="#setup" style="color:#5b2cff">Setup</a> ·
  <a href="#integrate" style="color:#5b2cff">Integrate</a> ·
  <a href="#architecture" style="color:#5b2cff">Architecture</a> ·
  <a href="#security" style="color:#5b2cff">Security</a>
</p>

Auth-Ninja targets **full-stack** projects only — a React frontend and a backend that share the same `/auth/*` API. There is no frontend-only install; login and register need a server.

| Stack | Backend | Frontend |
|-------|---------|----------|
| **React + Next.js** | `@auth-ninja/next` | Next.js App Router + `@auth-ninja/react` |
| **React + .NET** | `AuthNinja.AspNetCore` (NuGet) | Vite / React SPA + `@auth-ninja/react` |

Both backends implement the same [OpenAPI contract](packages/protocol/openapi.json) and share configuration via `@auth-ninja/core`.

### Install packages manually

Prefer explicit dependency control over the setup wizard:

```bash
# React + Next.js
pnpm add @auth-ninja/core @auth-ninja/react @auth-ninja/next

# React + .NET (SPA)
pnpm add @auth-ninja/core @auth-ninja/react
dotnet add package AuthNinja.AspNetCore
```

Then configure `.env` and run migrations — see [Setup](#setup) below.

---

<h2 style="color:#5b2cff">Setup</h2>

### Prerequisites

| Requirement | React + Next.js | React + .NET |
|-------------|-----------------|--------------|
| Runtime | Node.js ≥ 20 | .NET 10 (`net10.0`) + Node.js ≥ 20 for the React SPA |
| Database | PostgreSQL 14+ | PostgreSQL 14+ |
| React | ^18 or ^19 | ^18 or ^19 (Vite SPA) |

### Step 1 — Run setup (one command)

From your **project root**, run setup. It installs packages, creates `.env` with a generated secret, migrates PostgreSQL, and validates config.

**Always prefix with `pnpm dlx`** unless you installed the CLI globally (`pnpm add -g @auth-ninja/cli`).

```bash
# React + Next.js (full-stack Next.js app)
pnpm dlx @auth-ninja/cli setup --stack next

# React + .NET (ASP.NET Core API + React SPA)
pnpm dlx @auth-ninja/cli setup --stack dotnet
```

Setup **never edits your application source files**. It only installs dependencies, writes `.env` / `.env.example`, and runs database migrations.

### Step 2 — Configure PostgreSQL

If setup could not reach PostgreSQL, edit `.env`:

```bash
AUTH_NINJA_DATABASE_URL=postgresql://postgres:yourpassword@localhost:5432/auth_ninja
```

Create the database if it does not exist, then apply migrations:

```bash
pnpm dlx @auth-ninja/cli db migrate
```

This creates all required tables: `users`, `sessions`, `credentials`, `audit_events`, `password_reset_tokens`.

### Step 3 — Integrate manually

Copy the code patterns below into your project. After wiring server routes and `AuthProvider`, login, register, session, 2FA, and passkeys work end-to-end.

---

<h2 style="color:#5b2cff" id="integrate">Integrate</h2>

<h3 id="integrate-next">React + Next.js</h3>

#### 1. Shared server context — `lib/auth-ninja.ts`

```ts
import { loadAuthNinjaConfig } from "@auth-ninja/core";
import {
  createAuthDb,
  createAuthNinjaContext,
  runAuthMigrations,
  type AuthNinjaContext,
} from "@auth-ninja/next";

type AuthNinjaGlobal = typeof globalThis & {
  __authNinjaPromise?: Promise<AuthNinjaContext>;
};

const globalForAuth = globalThis as AuthNinjaGlobal;

export async function getAuthNinja(): Promise<AuthNinjaContext> {
  if (!globalForAuth.__authNinjaPromise) {
    globalForAuth.__authNinjaPromise = (async () => {
      const config = loadAuthNinjaConfig();
      const { db, client } = createAuthDb(config.databaseUrl);
      await runAuthMigrations({ db, client });
      return createAuthNinjaContext({ config, db });
    })();
  }
  return globalForAuth.__authNinjaPromise;
}
```

Use `src/lib/auth-ninja.ts` when your app lives under `src/`.

#### 2. Route handlers — `app/auth/*/route.ts`

```ts
// app/auth/login/route.ts
import { createLoginHandler } from "@auth-ninja/next";
import { getAuthNinja } from "@/lib/auth-ninja";

export async function POST(request: Request) {
  const auth = await getAuthNinja();
  return createLoginHandler(auth)(request);
}
```

Add handlers for: `register`, `logout`, `session`, `csrf`, `password-reset/*`, `2fa/*`, and `passkeys/*`. Each uses the matching `create*Handler` from `@auth-ninja/next` — see [`demos/next-fullstack/app/auth/`](demos/next-fullstack/app/auth/) for the full route tree.

```ts
// app/auth/password-reset/request/route.ts
import { createPasswordResetRequestHandler } from "@auth-ninja/next";
import { getAuthNinja } from "@/lib/auth-ninja";

export async function POST(request: Request) {
  const auth = await getAuthNinja();
  return createPasswordResetRequestHandler(auth)(request);
}
```

Password reset has no React hook — call the API with `createAuthClient` from `@auth-ninja/react` (same CSRF and cookie behavior as other auth requests).

#### 3. Middleware — CSRF, rate limit, IP audit

```ts
// middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createAuthMiddleware } from "@auth-ninja/next";
import { getAuthNinja } from "./lib/auth-ninja.js";

export async function middleware(request: NextRequest) {
  const auth = await getAuthNinja();
  const blocked = await createAuthMiddleware(auth)(request);
  if (blocked) return blocked;
  return NextResponse.next();
}

export const config = { matcher: "/auth/:path*" };
```

If you already have middleware, call `createAuthMiddleware(auth)(request)` for `/auth/*` paths before `NextResponse.next()`.

#### 4. Client — `AuthProvider`

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

Set in `.env`:

```bash
NEXT_PUBLIC_AUTH_BASE_URL=http://localhost:3000
```

#### 5. Login and protected routes

```tsx
import { useAuth, RequireAuth } from "@auth-ninja/react";

function LoginPage() {
  const { login, isLoading } = useAuth();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    await login({
      email: String(form.get("email")),
      password: String(form.get("password")),
    });
  }

  return (
    <form onSubmit={handleSubmit}>
      <input name="email" type="email" required />
      <input name="password" type="password" required />
      <button type="submit" disabled={isLoading}>Sign in</button>
    </form>
  );
}

function Dashboard() {
  return (
    <RequireAuth fallback={<p>Redirecting…</p>}>
      <DashboardContent />
    </RequireAuth>
  );
}
```

CSRF tokens are fetched automatically before state-changing requests.

---

<h3 id="integrate-dotnet">React + .NET</h3>

#### 1. ASP.NET Core API — `Program.cs`

```csharp
using AuthNinja.AspNetCore;
using AuthNinja.AspNetCore.Data;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);
builder.Configuration.AddEnvironmentVariables();

builder.Services.AddAuthNinja(options => options.BindConfiguration(builder.Configuration));

var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AuthNinjaDbContext>();
    await db.Database.MigrateAsync();
}

app.UseRouting();
app.UseAuthNinja();
app.MapAuthNinja();

await app.RunAsync();
```

Place `AUTH_NINJA_*` variables in your API `.env` or user secrets. `setup --stack dotnet` creates them at the repo root.

Set `AUTH_NINJA_BASE_URL` to the **browser-facing origin** (your Vite dev server, e.g. `http://localhost:5174`), not the .NET listen port. When the SPA talks to the API directly during development, also set:

```bash
AUTH_NINJA_CORS_ORIGINS=http://localhost:5174
```

Prefer the Vite `/auth` proxy so cookies stay same-origin — CORS is only needed when the client calls the API port directly.

#### 2. React SPA — Vite config

Proxy `/auth` to your API so session cookies stay same-origin with the SPA:

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
        target: process.env.AUTH_NINJA_PROXY_TARGET ?? "http://localhost:5280",
        changeOrigin: true,
      },
    },
  },
});
```

For local dev with the Vite `/auth` proxy, **leave `VITE_AUTH_BASE_URL` unset** — the client uses same-origin `/auth/*` requests (no CORS). Set it only when the SPA and API run on different public origins in production.

#### 3. React SPA — bootstrap

```tsx
// main.tsx
import { AuthProvider, readViteAuthClientConfig } from "@auth-ninja/react";

const authConfig = readViteAuthClientConfig(import.meta.env);

<AuthProvider {...authConfig}>
  <App />
</AuthProvider>
```

#### 4. Login and protected routes

Same `useAuth` / `RequireAuth` patterns as the Next.js stack above.

In production, reverse-proxy `/auth/*` from the SPA origin to your .NET API.

> **Reference:** [`adapters/dotnet/README.md`](adapters/dotnet/README.md) · [`demos/dotnet-spa/`](demos/dotnet-spa/)

---

<h2 style="color:#5b2cff">Configuration</h2>

Both adapters read the same `AUTH_NINJA_*` variables via `@auth-ninja/core`.

| Variable | Required | Description |
|----------|----------|-------------|
| `AUTH_NINJA_SECRET` | Yes | ≥ 32 random chars — generated by `setup` |
| `AUTH_NINJA_BASE_URL` | Yes | Public URL of the auth API |
| `AUTH_NINJA_DATABASE_URL` | Yes | PostgreSQL connection string |

| Variable | Default | Description |
|----------|---------|-------------|
| `AUTH_NINJA_SESSION_IDLE_MINUTES` | `15` | Idle timeout |
| `AUTH_NINJA_SESSION_ABSOLUTE_HOURS` | `8` | Max session lifetime |
| `AUTH_NINJA_LOCKOUT_MAX_ATTEMPTS` | `5` | Failed logins before lockout |
| `AUTH_NINJA_LOCKOUT_WINDOW_MINUTES` | `15` | Window for counting failed attempts |
| `AUTH_NINJA_LOCKOUT_DURATION_MINUTES` | `30` | Lockout duration after threshold |
| `AUTH_NINJA_REQUIRE_2FA` | `false` | Require TOTP for all users |
| `AUTH_NINJA_2FA_ISSUER` | `AuthNinja` | TOTP issuer shown in authenticator apps |
| `AUTH_NINJA_PASSKEYS_ENABLED` | `true` | WebAuthn passkeys |
| `AUTH_NINJA_PASSKEY_RP_ID` | `localhost` | WebAuthn RP ID (production: your domain) |
| `AUTH_NINJA_IP_AUDIT_ENABLED` | `true` | Persist IP allowlist and rate-limit audit events |
| `AUTH_NINJA_IP_ALLOWLIST` | — | Comma-separated CIDRs; empty = allow all |
| `AUTH_NINJA_API_RATE_LIMIT` | `100` | Per-IP requests per minute on `/auth/*` |
| `AUTH_NINJA_CSRF_ENABLED` | `true` | CSRF on state-changing routes |
| `AUTH_NINJA_PASSWORD_MIN_SCORE` | `2` | Minimum zxcvbn score (0–4) for register and password reset |
| `AUTH_NINJA_REDIS_URL` | — | Redis for multi-instance production (required when scaling horizontally) |
| `AUTH_NINJA_CORS_ORIGINS` | — | .NET only: comma-separated browser origins when SPA calls API directly |

Regenerate a secret: `pnpm dlx @auth-ninja/cli keys generate`

Validate before deploy: `pnpm dlx @auth-ninja/cli doctor --production --strict`

---

<h2 style="color:#5b2cff">Architecture</h2>

```mermaid
flowchart TB
  subgraph client["React client"]
    UI["Your UI"]
    React["@auth-ninja/react"]
    UI --> React
  end

  React -->|"cookies + CSRF"| NextPath
  React -->|"cookies + CSRF"| DotNetPath

  subgraph NextPath["React + Next.js"]
    Next["@auth-ninja/next"]
    Next --> PG1[(PostgreSQL)]
  end

  subgraph DotNetPath["React + .NET"]
    DotNet["AuthNinja.AspNetCore"]
    DotNet --> PG2[(PostgreSQL)]
  end
```

### Packages

| Package | Role |
|---------|------|
| [`@auth-ninja/core`](packages/core) | Config, errors, crypto, password/TOTP helpers |
| [`@auth-ninja/protocol`](packages/protocol) | OpenAPI contract |
| [`@auth-ninja/react`](packages/react) | Headless hooks — `AuthProvider`, `useAuth`, `RequireAuth` |
| [`@auth-ninja/next`](packages/next) | Next.js route handlers, middleware, Drizzle schema |
| [`@auth-ninja/cli`](packages/cli) | `setup`, `db migrate`, `doctor`, `keys generate` |
| [`AuthNinja.AspNetCore`](adapters/dotnet) | ASP.NET Core middleware and endpoints |

All npm packages publish at the **same version** (currently **1.1.0**) and version together via [Changesets](.changeset/README.md).

### Auth API

| Route | Method | Description |
|-------|--------|-------------|
| `/auth/register` | POST | Create account |
| `/auth/login` | POST | Sign in (may return MFA challenge) |
| `/auth/logout` | POST | Invalidate session |
| `/auth/session` | GET | Current user; refreshes idle timer |
| `/auth/csrf` | GET | CSRF token |
| `/auth/password-reset/request` | POST | Request reset (generic response — no enumeration) |
| `/auth/password-reset/confirm` | POST | Set new password with reset token |
| `/auth/2fa/enroll` | POST | Start TOTP enrollment |
| `/auth/2fa/confirm` | POST | Confirm TOTP with first code |
| `/auth/2fa/verify` | POST | Complete login MFA step |
| `/auth/2fa/backup-codes` | POST | Regenerate backup codes |
| `/auth/2fa` | DELETE | Disable TOTP |
| `/auth/passkeys/register/begin` | POST | Start passkey registration |
| `/auth/passkeys/register/finish` | POST | Complete passkey registration |
| `/auth/passkeys/login/begin` | POST | Start passkey login |
| `/auth/passkeys/login/finish` | POST | Complete passkey login |
| `/auth/passkeys` | GET | List registered passkeys |
| `/auth/passkeys/{credentialId}` | DELETE | Remove a passkey |

Sessions use an HttpOnly `auth_session` cookie (`Secure`, `SameSite=Strict`).

### React hooks

| Hook / component | Purpose |
|------------------|---------|
| `AuthProvider` | Session context, idle refresh, cross-tab sync |
| `useAuth()` | `user`, `login`, `register`, `logout`, `refreshSession` |
| `useSession()` | Read-only session state (`user`, `isLoading`, `sessionError`) |
| `RequireAuth` | Render children only when authenticated |
| `use2FA()` | TOTP enroll, confirm, verify, disable, backup codes |
| `usePasskey()` | WebAuthn register, login, list, delete |
| `createAuthClient()` | Low-level fetch wrapper with CSRF — use for password reset and custom flows |

---

<h2 style="color:#5b2cff">Security</h2>

Auth-Ninja is **fail-closed** — invalid sessions, CSRF tokens, and rate limits deny access.

| Area | Implementation |
|------|----------------|
| Password hashing | Argon2id (OWASP-aligned) |
| Session tokens | Random IDs stored as SHA-256 hashes; HttpOnly cookies |
| TOTP seeds | AES-256-GCM field encryption |
| CSRF | Signed `X-CSRF-Token` on state-changing routes |
| Rate limiting | Per-IP on auth endpoints (100 req/min default) |
| Auth errors | Generic messages — no user enumeration |

Full threat analysis: [`docs/THREAT-MODEL.md`](docs/THREAT-MODEL.md). Report vulnerabilities per [`SECURITY.md`](SECURITY.md).

Before production deploy, complete the must-pass gates in [`docs/PRODUCTION.md`](docs/PRODUCTION.md) and run:

```bash
pnpm dlx @auth-ninja/cli doctor --production --strict
```

---

<h2 style="color:#5b2cff">Development</h2>

Contributors working on the monorepo:

```bash
pnpm install
pnpm build
pnpm test
pnpm demo              # local Next.js demo — not published
pnpm demo:dotnet       # local .NET demo — not published
```

Release workflow (maintainers):

```bash
pnpm changeset
pnpm version-packages
pnpm release
```

---

<h2 style="color:#5b2cff">License</h2>

[MIT](LICENSE)
