# @auth-ninja/next

Next.js App Router adapter: route handlers, middleware, session management.

## Database

PostgreSQL schema via Drizzle ORM:

| Table | Purpose |
| --- | --- |
| `users` | Accounts (Argon2id password hash, optional TOTP secret) |
| `sessions` | HttpOnly cookie sessions (token stored as SHA-256 hash) |
| `credentials` | WebAuthn passkeys and hashed TOTP backup codes |
| `audit_events` | Login, logout, lockout, and IP audit rows |

```ts
import { createAuthDb, runAuthMigrations } from "@auth-ninja/next";

const handle = createAuthDb(process.env.AUTH_NINJA_DATABASE_URL!);
await runAuthMigrations(handle);
// use handle.db for queries
```

SQL migrations ship in the package `drizzle/` folder. Regenerate with `pnpm --filter @auth-ninja/next db:generate`.

## Register and login routes

Wire App Router handlers with a shared context:

```ts
import {
  createAuthDb,
  createAuthNinjaContext,
  createLoginHandler,
  createRegisterHandler,
  runAuthMigrations,
} from "@auth-ninja/next";
import { loadAuthNinjaConfig } from "@auth-ninja/core";

const config = loadAuthNinjaConfig();
const { db, client } = createAuthDb(config.databaseUrl);
await runAuthMigrations({ db, client });

const auth = createAuthNinjaContext({ config, db });

export const POST = createRegisterHandler(auth);
// app/api/auth/login/route.ts → createLoginHandler(auth)
```

Sessions use HttpOnly `auth_session` cookies; login rotates any existing session ID.

## Session and logout routes

```ts
import {
  createLogoutHandler,
  createSessionHandler,
} from "@auth-ninja/next";

export const GET = createSessionHandler(auth);
// app/api/auth/logout/route.ts → createLogoutHandler(auth)
```

`GET /auth/session` returns the authenticated user snapshot and refreshes the idle timer. `POST /auth/logout` invalidates the server session and clears the cookie.

## Middleware (API guard)

Rate limiting, CSRF validation, and IP audit hooks run before auth route handlers:

```ts
import {
  createAuthApiGuard,
  createAuthMiddleware,
  createCsrfHandler,
} from "@auth-ninja/next";

// middleware.ts — reject bad requests before handlers run
export default createAuthMiddleware(auth, { pathPrefix: "/api/auth" });

// app/api/auth/csrf/route.ts
export const GET = createCsrfHandler(auth);

// Or reuse a shared guard inside route wrappers
const guard = createAuthApiGuard(auth, { pathPrefix: "/api/auth" });
const blocked = await guard(request);
if (blocked) return blocked;
```

- **Rate limit** — per-IP fixed window (`apiRateLimitPerMinute`, default 100/min)
- **CSRF** — signed `X-CSRF-Token` header on state-changing routes when `csrfEnabled` (default `true`)
- **IP audit** — allowlist violations and rate-limit breaches persist `ip` audit events

Implemented incrementally via `/next` tasks in `docs/TASKS.md`.
