# @auth-ninja/next

Next.js App Router adapter: route handlers, middleware, session management, 2FA, passkeys, and password reset.

## Database

PostgreSQL schema via Drizzle ORM:

| Table | Purpose |
| --- | --- |
| `users` | Accounts (Argon2id password hash, optional TOTP secret) |
| `sessions` | HttpOnly cookie sessions (token stored as SHA-256 hash) |
| `credentials` | WebAuthn passkeys and hashed TOTP backup codes |
| `audit_events` | Login, logout, lockout, and IP audit rows |
| `password_reset_tokens` | Hashed one-time reset tokens with expiry |

```ts
import { createAuthDb, runAuthMigrations } from "@auth-ninja/next";

const handle = createAuthDb(process.env.AUTH_NINJA_DATABASE_URL!);
await runAuthMigrations(handle);
// use handle.db for queries
```

Import Drizzle table definitions from `@auth-ninja/next/schema` when extending queries.

SQL migrations ship in the package `drizzle/` folder. Regenerate with `pnpm --filter @auth-ninja/next db:generate`.

Apply pending migrations against PostgreSQL (requires `AUTH_NINJA_DATABASE_URL` in repo-root `.env`):

```bash
pnpm --filter @auth-ninja/next db:migrate
```

## Shared context

Wire App Router handlers with a shared `AuthNinjaContext`:

```ts
import {
  createAuthDb,
  createAuthNinjaContext,
  runAuthMigrations,
} from "@auth-ninja/next";
import { loadAuthNinjaConfig } from "@auth-ninja/core";

const config = loadAuthNinjaConfig();
const { db, client } = createAuthDb(config.databaseUrl);
await runAuthMigrations({ db, client });

export const auth = createAuthNinjaContext({ config, db });
```

## Register and login routes

Mount handlers under `app/auth/*/route.ts` (path prefix `/auth`):

```ts
import { createLoginHandler, createRegisterHandler } from "@auth-ninja/next";
import { auth } from "@/lib/auth-ninja";

// app/auth/register/route.ts
export const POST = createRegisterHandler(auth);

// app/auth/login/route.ts
export const POST = createLoginHandler(auth);
```

Sessions use HttpOnly `auth_session` cookies; login rotates any existing session ID.

## Session and logout routes

```ts
import { createLogoutHandler, createSessionHandler } from "@auth-ninja/next";
import { auth } from "@/lib/auth-ninja";

// app/auth/session/route.ts
export const GET = createSessionHandler(auth);

// app/auth/logout/route.ts
export const POST = createLogoutHandler(auth);
```

`GET /auth/session` returns the authenticated user snapshot and refreshes the idle timer. `POST /auth/logout` invalidates the server session and clears the cookie.

## Password reset routes

```ts
import {
  createPasswordResetConfirmHandler,
  createPasswordResetRequestHandler,
} from "@auth-ninja/next";
import { auth } from "@/lib/auth-ninja";

// app/auth/password-reset/request/route.ts
export const POST = createPasswordResetRequestHandler(auth);

// app/auth/password-reset/confirm/route.ts
export const POST = createPasswordResetConfirmHandler(auth);
```

Both endpoints return generic messages — no user enumeration.

## 2FA routes

| Handler | Route |
| --- | --- |
| `createTwoFaEnrollHandler` | `POST /auth/2fa/enroll` |
| `createTwoFaConfirmHandler` | `POST /auth/2fa/confirm` |
| `createTwoFaVerifyHandler` | `POST /auth/2fa/verify` |
| `createTwoFaBackupCodesHandler` | `POST /auth/2fa/backup-codes` |
| `createTwoFaDisableHandler` | `DELETE /auth/2fa` |

See [`demos/next-fullstack/app/auth/2fa/`](../../demos/next-fullstack/app/auth/2fa/) for wiring examples.

## Passkey routes

| Handler | Route |
| --- | --- |
| `createPasskeyRegisterBeginHandler` | `POST /auth/passkeys/register/begin` |
| `createPasskeyRegisterFinishHandler` | `POST /auth/passkeys/register/finish` |
| `createPasskeyLoginBeginHandler` | `POST /auth/passkeys/login/begin` |
| `createPasskeyLoginFinishHandler` | `POST /auth/passkeys/login/finish` |
| `createPasskeyListHandler` | `GET /auth/passkeys` |
| `createPasskeyDeleteHandler` | `DELETE /auth/passkeys/{credentialId}` |

## Middleware (API guard)

Rate limiting, CSRF validation, and IP audit hooks run before auth route handlers:

```ts
import {
  createAuthApiGuard,
  createAuthMiddleware,
  createCsrfHandler,
} from "@auth-ninja/next";
import { auth } from "./lib/auth-ninja.js";

// middleware.ts — reject bad requests before handlers run
export async function middleware(request: NextRequest) {
  const blocked = await createAuthMiddleware(auth)(request);
  if (blocked) return blocked;
  return NextResponse.next();
}

export const config = { matcher: "/auth/:path*" };

// app/auth/csrf/route.ts
export const GET = createCsrfHandler(auth);

// Or reuse a shared guard inside route wrappers
const guard = createAuthApiGuard(auth, { pathPrefix: "/auth" });
const blocked = await guard(request);
if (blocked) return blocked;
```

- **Rate limit** — per-IP fixed window (`apiRateLimitPerMinute`, default 100/min)
- **CSRF** — signed `X-CSRF-Token` header on state-changing routes when `csrfEnabled` (default `true`)
- **IP audit** — allowlist violations and rate-limit breaches persist `ip` audit events

Full integration guide: [main README](../../README.md#integrate-next).
