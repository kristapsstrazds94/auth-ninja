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

Other commands (`doctor`, `demo`, `keys`) are implemented in later tasks — see `docs/TASKS.md` phase 5.
