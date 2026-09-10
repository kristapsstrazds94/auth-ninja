# Auth-Ninja — agent context

Reusable secure authentication for internal projects. Headless SDK — **no UI in published packages**. Demo UI lives in `demos/` only.

## How to work

Every numbered task uses the same protocol. Do not improvise a new process.

**Test handoff:** Turn 1 — agent implements, prints test commands, sets catalog to `in progress`, stops. Turn 2 — user replies **`tests passed`**; agent marks **`done`**, stops. Details: `docs/TASKS.md`.

1. User runs **`/next`** or **`/task {ID}`** → follow `.cursor/skills/implement-auth-task/SKILL.md`. Exit criteria: `docs/TASKS.md`.
2. User runs **`/plan-task {ID}`** → plan only, no code.
3. User runs **`/verify {ID}`** → check acceptance criteria against current code.
4. User runs **`/review`** → security-focused review of recent changes.
5. User runs **`/demo`** → start or verify demo stack (after task 6.1).

Do not start the next task unless asked. Do not skip security rules to move faster.

## Stack

| Path | Role |
| --- | --- |
| `packages/core` | Zod config, errors, crypto, password/TOTP helpers |
| `packages/protocol` | OpenAPI contract — source of truth for both backends |
| `packages/react` | Headless hooks: `AuthProvider`, `useAuth`, `RequireAuth` |
| `packages/next` | Next.js route handlers, middleware, Drizzle schema |
| `packages/cli` | `auth-ninja` binary |
| `adapters/dotnet` | `AuthNinja.AspNetCore` NuGet package |
| `demos/` | Throwaway UI for testing — never published |

Local dev: `pnpm install`, `pnpm build`, `pnpm test`.

## Hard rules (never trade these)

- **HttpOnly cookies only.** Never store session tokens in `localStorage` or `sessionStorage`.
- **Fail closed.** Invalid session, CSRF, or rate limit → deny. No silent fallback to anonymous on protected routes.
- **Generic auth errors.** Login/register/reset must not reveal whether an email exists.
- **Argon2id** for passwords. Never MD5, SHA1, or bare SHA256 for password storage.
- **Constant-time** compare for secrets, TOTP codes, and API keys.
- **Never log** passwords, TOTP seeds, session IDs, recovery codes, or `AUTH_NINJA_SECRET`.
- **OpenAPI first.** New endpoint → update `packages/protocol/openapi.json` in the same change.
- **Headless packages.** No `<LoginForm>` or styled components in `packages/react`. UI only in `demos/`.
- **Published packages** include only `dist/` + README — no `.cursor/`, no `docs/TASKS.md`, no demos.

## Definition of done (every task)

- Matches **Done when** in `docs/TASKS.md`
- Tests written for happy path and at least one negative/security case where applicable
- No secrets in code or logs
- Types pass: `pnpm typecheck` in affected packages
- Security rules in `.cursor/rules/auth-ninja-security.mdc` respected

## Agent doc map

| Doc | Purpose |
| --- | --- |
| `docs/TASKS.md` | Task catalog — status and acceptance criteria |
| `.cursor/commands/next.md` | Pick next implementable task |
| `.cursor/skills/implement-auth-task/SKILL.md` | Implementation protocol |
| `.cursor/rules/auth-ninja-security.mdc` | Security constraints |
| `.cursor-ai/` | Gitignored local scratch — do not commit |
