# @auth-ninja/cli

Run every command with **`pnpm dlx @auth-ninja/cli`** (or install globally: `pnpm add -g @auth-ninja/cli`).

The CLI installs packages, configures `.env`, migrates PostgreSQL, and validates your config. **It never modifies your application source code** — copy integration steps from the [main README](../../README.md#integrate).

## Commands

### `setup` — one command to get started

Full-stack only: **React + Next.js** or **React + .NET**.

```bash
pnpm dlx @auth-ninja/cli setup --stack next
pnpm dlx @auth-ninja/cli setup --stack dotnet
pnpm dlx @auth-ninja/cli setup --cwd ./my-app
pnpm dlx @auth-ninja/cli setup --skip-install    # env + migrate only
pnpm dlx @auth-ninja/cli setup --skip-migrate      # install + env only
```

From your project root (auto-detects stack when possible):

```bash
pnpm dlx @auth-ninja/cli setup
```

What `setup` does:

1. Installs npm / NuGet packages for the selected stack
2. Creates `.env` and `.env.example` (generates `AUTH_NINJA_SECRET`; never overwrites an existing `.env`)
3. Applies PostgreSQL migrations (`users`, `sessions`, `credentials`, `audit_events`, `password_reset_tokens`)
4. Runs `doctor` validation
5. Prints manual integration checklist (copy code from README)

If PostgreSQL is not ready yet, set `AUTH_NINJA_DATABASE_URL` in `.env` and run:

```bash
pnpm dlx @auth-ninja/cli db migrate
```

### `db migrate`

Apply Auth-Ninja PostgreSQL migrations (same schema for Next.js and .NET):

```bash
pnpm dlx @auth-ninja/cli db migrate
pnpm dlx @auth-ninja/cli db migrate --cwd ./my-app
```

### `doctor`

Validate deployment configuration:

```bash
pnpm dlx @auth-ninja/cli doctor
pnpm dlx @auth-ninja/cli doctor --production --strict
```

### `keys generate`

Regenerate `AUTH_NINJA_SECRET` if needed:

```bash
pnpm dlx @auth-ninja/cli keys generate
```

## Deprecated

- `auth-ninja init` — alias for `setup` (prints a deprecation notice)
- `auth-ninja demo` — removed from the published CLI; monorepo contributors use `pnpm demo` at the repo root
