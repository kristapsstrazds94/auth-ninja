<p align="center">
  <span style="background-color:#ffffff;display:inline-block;padding:16px 24px;border-radius:12px">
    <img src="assets/logo.png" alt="Auth-Ninja" width="220" />
  </span>
</p>

<h1 align="center">Auth-Ninja</h1>

<p align="center">
  Secure, reusable authentication for React apps — headless hooks on the client, battle-tested server adapters on the backend.
</p>

<p align="center">
  <strong>No UI components.</strong> You bring your own login screens; Auth-Ninja handles sessions, CSRF, rate limiting, TOTP 2FA, and WebAuthn passkeys with secure defaults baked in.
</p>

<p align="center">
  <a href="#install" style="color:#5b2cff">Install</a> ·
  <a href="#architecture" style="color:#5b2cff">Architecture</a> ·
  <a href="#security" style="color:#5b2cff">Security</a> ·
  <a href="#adding-to-an-existing-project" style="color:#5b2cff">Existing project</a> ·
  <a href="#demos" style="color:#5b2cff">Demos</a>
</p>

Pick a backend adapter — both implement the same [OpenAPI contract](packages/protocol/openapi.json) and share configuration via `@auth-ninja/core`:

| | [Next.js](#nextjs) | [.NET](#net) |
|---|-------------------|--------------|
| **Adapter** | `@auth-ninja/next` | `AuthNinja.AspNetCore` |
| **ORM** | Drizzle | EF Core |
| **Typical frontend** | Next.js App Router or Vite SPA | Vite / React SPA |
| **Demo** | [`demos/next-fullstack`](demos/next-fullstack) | [`demos/dotnet-spa`](demos/dotnet-spa) |

---

<h2 style="color:#5b2cff">Table of contents</h2>

- [Architecture](#architecture)
- [Security](#security)
- [Install](#install)
- [Adding to an existing project](#adding-to-an-existing-project)
- [Shared concepts](#shared-concepts)
- [Next.js](#nextjs)
- [.NET](#net)
- [Demos](#demos)
- [Development](#development)
- [License](#license)

---

<h2 style="color:#5b2cff">Architecture</h2>

The React client talks to `/auth/*` over **HttpOnly cookies** — never `localStorage`. Pick **one** server adapter:

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

| Package | Registry | Role |
|---------|----------|------|
| [`@auth-ninja/core`](packages/core) | npm | Config schema, errors, crypto, password/TOTP helpers |
| [`@auth-ninja/protocol`](packages/protocol) | npm | OpenAPI contract — source of truth for both backends |
| [`@auth-ninja/react`](packages/react) | npm | Headless React hooks (`AuthProvider`, `useAuth`, `RequireAuth`) |
| [`@auth-ninja/next`](packages/next) | npm | Next.js route handlers, middleware, Drizzle schema |
| [`@auth-ninja/cli`](packages/cli) | npm | `auth-ninja` scaffolding and deployment checks |
| [`AuthNinja.AspNetCore`](adapters/dotnet) | NuGet | ASP.NET Core middleware and endpoints |

All npm packages publish at version **0.1.0** and version together via [Changesets](.changeset/README.md).

---

<h2 style="color:#5b2cff">Security</h2>

Auth-Ninja is **fail-closed** — invalid sessions, CSRF tokens, and rate limits deny access. Protected routes never silently fall back to anonymous.

### Cryptography & secrets

| Area | Implementation |
|------|----------------|
| Password hashing | **Argon2id** via `@node-rs/argon2` (OWASP-aligned: 19 MiB, t=2, p=1) |
| Session tokens | Random IDs stored server-side as **SHA-256** hashes; cookie is HttpOnly only |
| TOTP seeds at rest | **AES-256-GCM** field encryption keyed from `AUTH_NINJA_SECRET` |
| Backup / recovery codes | Hashed; single-use |
| Password reset tokens | Hashed; short TTL; single-use |
| Secret comparison | **Constant-time** compare for passwords, TOTP codes, and API keys |
| Signing key | `AUTH_NINJA_SECRET` — ≥ 32 cryptographically random characters |

### Session & transport

| Control | Default |
|---------|---------|
| Session storage | **HttpOnly, Secure, SameSite=Strict** cookie — never `localStorage` / `sessionStorage` |
| Idle timeout | 15 minutes (refreshed on activity) |
| Absolute max lifetime | 8 hours |
| Session fixation | Session ID **regenerated on login** |
| Production transport | HTTPS required; `auth-ninja doctor --production --strict` validates this |

### Attack surface controls

| Control | Default |
|---------|---------|
| CSRF | Signed `X-CSRF-Token` on all state-changing routes |
| Rate limiting | Per-IP on auth endpoints (100 req/min default) |
| Account lockout | Configurable failed-attempt threshold (5 attempts / 15 min window) |
| Auth error messages | **Generic** — no user enumeration on login, register, or reset |
| IP audit | Login, logout, lockout, and suspicious IP events persisted |
| Passkeys | WebAuthn with origin + RP ID validation; challenges stored server-side with short TTL |
| Password policy | zxcvbn-based strength checks in `@auth-ninja/core` |

### Optional production hardening

| Feature | When to use |
|---------|-------------|
| **Redis** (`AUTH_NINJA_REDIS_URL`) | Multi-instance deployments — distributed rate limiting and lockout |
| **`auth-ninja doctor --production --strict`** | Pre-launch config validation (secret strength, HTTPS, cookie flags, CSRF/RP ID alignment) |
| **Semgrep / CI** | Monorepo runs security lint rules on every PR |

Full threat analysis: [`docs/THREAT-MODEL.md`](docs/THREAT-MODEL.md). Report vulnerabilities per [`SECURITY.md`](SECURITY.md).

---

<h2 style="color:#5b2cff">Install</h2>

The CLI scaffolds env files, wires the matching adapter, and validates your config. Works for **new or existing** projects.

### Prerequisites

| Requirement | Next.js stack | .NET stack |
|-------------|---------------|------------|
| Runtime | Node.js ≥ 20 | .NET 10 (`net10.0`) |
| Database | PostgreSQL 14+ | PostgreSQL 14+ |
| Frontend | React ^18 or ^19 | React ^18 or ^19 (Vite SPA) |
| Optional | Redis (recommended in production) | Redis (recommended in production) |

### Quick start (any stack)

```bash
# 1. Scaffold into your project (auto-detects Next.js, Vite, or .NET)
pnpm dlx @auth-ninja/cli init

# Or pick a stack explicitly:
pnpm dlx @auth-ninja/cli init --stack next
pnpm dlx @auth-ninja/cli init --stack vite
pnpm dlx @auth-ninja/cli init --stack dotnet

# 2. Generate a signing secret (copy output into .env)
auth-ninja keys generate

# 3. Set your database URL in .env, then validate
auth-ninja doctor

# 4. Try the local demo (optional)
auth-ninja demo                  # Next.js full-stack → http://localhost:3000
auth-ninja demo --stack vite     # Vite SPA + Next.js API → http://localhost:5173
auth-ninja demo --stack dotnet   # Vite SPA + .NET API → http://localhost:5174
```

### Manual package install

If you prefer not to use the CLI:

<details>
<summary><strong>Next.js full-stack</strong></summary>

```bash
pnpm add @auth-ninja/core @auth-ninja/next @auth-ninja/react
```

</details>

<details>
<summary><strong>Vite SPA (client only)</strong></summary>

```bash
pnpm add @auth-ninja/react
```

Your auth API still needs `@auth-ninja/next` or `AuthNinja.AspNetCore` on the backend.

</details>

<details>
<summary><strong>ASP.NET Core</strong></summary>

```bash
dotnet add package AuthNinja.AspNetCore
```

</details>

### Required environment variables

Copy [`.env.example`](.env.example) to `.env`. Both adapters read the same `AUTH_NINJA_*` variables:

| Variable | Required | Description |
|----------|----------|-------------|
| `AUTH_NINJA_SECRET` | Yes | ≥ 32 random chars — `auth-ninja keys generate` |
| `AUTH_NINJA_BASE_URL` | Yes | Public URL of the auth API |
| `AUTH_NINJA_DATABASE_URL` | Yes | PostgreSQL connection string |

See [Configuration](#configuration) for session, lockout, 2FA, passkey, and rate-limit options.

---

<h2 style="color:#5b2cff">Adding to an existing project</h2>

`auth-ninja init` is safe on existing codebases — it **never overwrites** an existing `.env` and skips files that already exist.

### What your project needs

| Stack | Server requirements | Client requirements |
|-------|--------------------|--------------------|
| **Next.js full-stack** | App Router, PostgreSQL, `/auth/*` route handlers + middleware | `AuthProvider` wrapping your app |
| **Vite + separate API** | Next.js or .NET API exposing `/auth/*` | `AuthProvider`, Vite env plugin, dev proxy for `/auth` |
| **.NET API + SPA** | ASP.NET Core 10, PostgreSQL, EF migrations | Same Vite client setup as above |

After init, configure `AUTH_NINJA_DATABASE_URL`, run migrations, and verify with `auth-ninja doctor`.

### What `auth-ninja init` creates

| Stack | Files scaffolded |
|-------|------------------|
| **next** | `lib/auth-ninja.ts`, `app/auth/*/route.ts`, `middleware.ts` (or merge snippet) |
| **vite** | `auth-ninja.vite-plugin.snippet.ts`, `auth-ninja.client.snippet.tsx` |
| **dotnet** | `auth-ninja.program.snippet.cs`, `.env.example` |
| **all** | `.env` (if missing), `.env.example`, client env vars when Vite is detected |

### Integration snippets

Expand the section for your stack and copy the patterns into your project.

<details>
<summary><strong>Next.js — server context (<code>lib/auth-ninja.ts</code>)</strong></summary>

```ts
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

</details>

<details>
<summary><strong>Next.js — route handler example (<code>app/auth/login/route.ts</code>)</strong></summary>

```ts
import { createLoginHandler } from "@auth-ninja/next";
import { getAuthNinja } from "@/lib/auth-ninja";

export async function POST(request: Request) {
  const auth = await getAuthNinja();
  return createLoginHandler(auth)(request);
}
```

Repeat for `register`, `logout`, `session`, `csrf`, and optional 2FA / passkey routes. See [`demos/next-fullstack/`](demos/next-fullstack/) for the full route tree.

</details>

<details>
<summary><strong>Next.js — middleware (CSRF, rate limit, IP audit)</strong></summary>

```ts
import { createAuthMiddleware } from "@auth-ninja/next";
import { getAuthNinja } from "@/lib/auth-ninja";

export default async function middleware(request: Request) {
  const auth = await getAuthNinja();
  return createAuthMiddleware(auth, { pathPrefix: "/auth" })(request);
}

export const config = { matcher: ["/auth/:path*"] };
```

If you already have `middleware.ts`, init writes `middleware.auth-ninja-snippet.ts` to merge manually.

</details>

<details>
<summary><strong>Next.js — client (<code>AuthProvider</code>)</strong></summary>

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

Set `NEXT_PUBLIC_AUTH_BASE_URL` to your app's public origin (e.g. `http://localhost:3000`).

</details>

<details>
<summary><strong>Vite SPA — <code>vite.config.ts</code> (env validation + dev proxy)</strong></summary>

```ts
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

Client env (`.env.local`):

```bash
VITE_AUTH_BASE_URL=http://localhost:5173
```

</details>

<details>
<summary><strong>Vite SPA — bootstrap (<code>main.tsx</code>)</strong></summary>

```tsx
import { AuthProvider, readViteAuthClientConfig } from "@auth-ninja/react";

const authConfig = readViteAuthClientConfig(import.meta.env);

<AuthProvider {...authConfig}>
  <App />
</AuthProvider>
```

In production, reverse-proxy `/auth/*` to your API so cookies stay same-origin with the SPA.

</details>

<details>
<summary><strong>ASP.NET Core — <code>Program.cs</code></strong></summary>

```csharp
builder.Services.AddAuthNinja(options => options.BindConfiguration(builder.Configuration));
app.UseAuthNinja();
app.MapAuthNinja(); // register, login, logout, session, csrf, 2fa, passkeys
```

Apply EF Core migrations:

```bash
export AUTH_NINJA_DATABASE_URL="postgresql://user:pass@localhost:5432/auth_ninja"
dotnet ef database update --project src/AuthNinja.AspNetCore/AuthNinja.AspNetCore.csproj
```

</details>

<details>
<summary><strong>React — minimal login form (any stack)</strong></summary>

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

CSRF tokens are fetched automatically before state-changing requests.

</details>

<details>
<summary><strong>React — protected route</strong></summary>

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

</details>

---

<h2 style="color:#5b2cff">Shared concepts</h2>

These apply regardless of which backend adapter you choose.

### React hooks

| Hook / component | Purpose |
|------------------|---------|
| `AuthProvider` | Session context, idle refresh, cross-tab sync |
| `useAuth()` | `user`, `login`, `register`, `logout`, `isLoading` |
| `RequireAuth` | Render children only when authenticated |
| `useSession()` | Low-level session fetch state |
| `use2FA()` | TOTP enroll, confirm, verify, disable |
| `usePasskey()` | WebAuthn register, login, list, delete |

### Configuration

Both adapters read the same `AUTH_NINJA_*` variables via `@auth-ninja/core`. Full schema: `loadAuthNinjaConfig()` in [`@auth-ninja/core`](packages/core).

#### Sessions & lockout (defaults)

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

---

<h2 style="color:#5b2cff">Next.js</h2>

Use `@auth-ninja/next` when your auth API runs on **Next.js App Router** (full-stack or as a standalone API).

### Next.js compatibility

| Requirement | Version | Notes |
|-------------|---------|-------|
| **Node.js** | ≥ 20 | Runtime for Next.js adapter and CLI |
| **Next.js** | `^14.0.0 \|\| ^15.0.0` | App Router required |
| **React** | `^18.0.0 \|\| ^19.0.0` | Via `@auth-ninja/react` |
| **PostgreSQL** | 14+ recommended | Sessions, users, credentials, audit log |
| **Redis** | Optional locally; **recommended in production** | Distributed rate limiting across instances |

Passkeys require a browser with WebAuthn. Session cookies require `SameSite=Strict` support (all modern browsers).

### Next.js quick start

```bash
pnpm dlx @auth-ninja/cli init --stack next
auth-ninja keys generate
auth-ninja doctor
auth-ninja demo
```

`auth-ninja init --stack next` scaffolds App Router routes under `app/auth/*`, a shared `lib/auth-ninja.ts`, and middleware.

> **Reference:** [`demos/next-fullstack/README.md`](demos/next-fullstack/README.md) · [`demos/vite-react/README.md`](demos/vite-react/README.md)

---

<h2 style="color:#5b2cff">.NET</h2>

Use `AuthNinja.AspNetCore` when your auth API runs on **ASP.NET Core**. The React client is the same `@auth-ninja/react` package used with Next.js.

### .NET compatibility

| Requirement | Version | Notes |
|-------------|---------|-------|
| **.NET** | **10** (`net10.0`) | Target framework for `AuthNinja.AspNetCore` |
| **ASP.NET Core** | ships with .NET 10 | Minimal hosting model |
| **PostgreSQL** | 14+ recommended | Same schema as the Next.js adapter |
| **Redis** | Optional locally; **recommended in production** | Distributed rate limiting across instances |
| **React client** | `^18.0.0 \|\| ^19.0.0` | Via `@auth-ninja/react` in your SPA |

Node.js is **not** required on the server — only if you use the `@auth-ninja/cli` or a Vite-based React frontend.

### .NET quick start

```bash
auth-ninja init --stack dotnet
auth-ninja keys generate
auth-ninja doctor --cwd ./api
auth-ninja demo --stack dotnet
```

### Database schema

EF Core entities mirror the Next.js Drizzle schema:

| Table | Purpose |
|-------|---------|
| `users` | Accounts (Argon2id password hash, optional TOTP secret) |
| `sessions` | HttpOnly cookie sessions (token stored as SHA-256 hash) |
| `credentials` | WebAuthn passkeys and hashed TOTP backup codes |
| `audit_events` | Login, logout, lockout, and IP audit rows |

> **Reference:** [`adapters/dotnet/README.md`](adapters/dotnet/README.md) · [`demos/dotnet-spa/README.md`](demos/dotnet-spa/README.md)

---

<h2 style="color:#5b2cff">Demos</h2>

Throwaway UI lives under [`demos/`](demos/) — **not published** to npm. Use them to explore flows and copy patterns, not components.

| Demo | Stack | Port |
|------|-------|------|
| [`demos/next-fullstack`](demos/next-fullstack) | Next.js + `@auth-ninja/next` | 3000 |
| [`demos/vite-react`](demos/vite-react) | Vite SPA + proxied Next.js API | 5173 |
| [`demos/dotnet-spa`](demos/dotnet-spa) | Vite SPA + `AuthNinja.AspNetCore` | 5174 |

Each demo includes login, register, TOTP 2FA, and passkey pages wired to headless hooks.

---

<h2 style="color:#5b2cff">Development</h2>

Contributors working on the monorepo itself:

```bash
pnpm install
pnpm build
pnpm test
pnpm typecheck
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
