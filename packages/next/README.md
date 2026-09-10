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

Implemented incrementally via `/next` tasks in `docs/TASKS.md`.
