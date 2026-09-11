# auth-ninja CLI

Install globally or run with `pnpm dlx auth-ninja`.

## Commands

### `auth-ninja init`

Scaffolds Auth-Ninja into a consumer project:

1. Creates `.env` and `.env.example` (never overwrites an existing `.env`)
2. Detects stack from `package.json` / project layout (`next`, `vite`, or .NET)
3. Wires the matching adapter:
   - **Next.js** — App Router routes under `app/auth/*`, shared `lib/auth-ninja.ts`, middleware
   - **Vite** — client env vars and setup snippets
   - **.NET** — `Program.cs` integration snippet

```bash
auth-ninja init
auth-ninja init --stack next --cwd ./my-app
auth-ninja init --dry-run
```

After init, set `AUTH_NINJA_SECRET` with `auth-ninja keys generate` (task 5.3) and configure your database URL.

### `auth-ninja doctor`

Validates deployment configuration before going live:

- `AUTH_NINJA_SECRET` strength (via `@auth-ninja/core` — never prints the value)
- `AUTH_NINJA_BASE_URL` uses HTTPS in production
- Session cookies will be `Secure` when served over HTTPS (`HttpOnly`, `SameSite=Strict` always)
- Session idle/absolute timeouts within recommended limits
- CSRF and passkey RP ID alignment

```bash
auth-ninja doctor
auth-ninja doctor --cwd ./my-app
auth-ninja doctor --production --strict
```

Exit code `0` when all checks pass; `1` when any check fails (`--strict` also fails on warnings).

### `auth-ninja keys generate`

Outputs a cryptographically strong `AUTH_NINJA_SECRET` (≥ 32 random characters) validated by `@auth-ninja/core`:

```bash
auth-ninja keys generate
```

Copy the line into your `.env` file. Do not commit the generated value.

Other commands (`demo`) are implemented in later tasks — see `docs/TASKS.md` phase 6.
