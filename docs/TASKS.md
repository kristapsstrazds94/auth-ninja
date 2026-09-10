# Task catalog

Implementation tasks for Auth-Ninja. Run **`/next`** to pick the next eligible task, or **`/task {ID}`** for a specific one.

A task is not done until its **Done when** line is true and `AGENTS.md` definition of done is satisfied.

## Test handoff (two turns)

| Turn | You | Agent |
| --- | --- | --- |
| **1 — implement** | Run `/next` or `/task {ID}` | Implements unique slice, writes tests (does not run them), sets row to `in progress`, prints test commands + commit subject, **stops** |
| **2 — confirm** | Run commands; reply **`tests passed`** (or paste failures) | Marks row **`done`**, **stops**. Does not start next ID unless asked. |

On turn 1 the agent does **not** set `done`. Your reply **`tests passed`** is the signal to mark `done`.

| Status | Meaning |
| --- | --- |
| `done` | Acceptance criteria met and confirmed |
| `in progress` | Code in progress or waiting for `tests passed` |
| `not started` | No meaningful implementation yet |
| `blocked` | Cannot continue until named dependency |

---

## Phase 0 — Repository bootstrap

| ID | Task | Depends | Status | Done when | Prompt |
| --- | --- | --- | --- | --- | --- |
| 0.1 | Monorepo scaffold | — | done | `pnpm install && pnpm build` passes; packages stubbed | `/task 0.1` |
| 0.2 | CI pipeline | 0.1 | done | GitHub Actions runs build + test on push | `/task 0.2` |
| 0.3 | Cursor agent workflow | 0.1 | done | `AGENTS.md`, `docs/TASKS.md`, `/next` command, implement skill, security rules exist | `/task 0.3` |

Phase 0 exit: 0.1–0.3 done. **Next implementable task: 1.0**

---

## Phase 1 — Core & protocol

| ID | Task | Depends | Status | Done when | Prompt |
| --- | --- | --- | --- | --- | --- |
| 1.0 | Threat model document | 0.3 | not started | `docs/THREAT-MODEL.md` covers STRIDE for auth flows | `/task 1.0` |
| 1.1 | OpenAPI spec | 1.0 | not started | Full auth cycle in `openapi.json`; contract test passes | `/task 1.1` |
| 1.2 | Env loader | 1.1 | not started | `loadAuthNinjaConfig()` reads `.env` with Zod; rejects weak secrets | `/task 1.2` |
| 1.3 | Password hashing (Argon2id) | 1.2 | not started | Hash/verify functions + tests; timing-safe compare | `/task 1.3` |
| 1.4 | Error taxonomy | 1.2 | not started | All error codes documented; generic user-facing messages | `/task 1.4` |
| 1.5 | TOTP 2FA core | 1.3 | not started | Generate secret, verify code, backup codes; tests | `/task 1.5` |
| 1.6 | Audit event schema | 1.1 | not started | Login, logout, lockout, IP events typed in core | `/task 1.6` |
| 1.7 | Lockout engine | 1.2 | not started | Attempt counter + lock window; unit tests for edge cases | `/task 1.7` |

Phase 1 exit: 1.0–1.7 done.

---

## Phase 2 — React (headless)

| ID | Task | Depends | Status | Done when | Prompt |
| --- | --- | --- | --- | --- | --- |
| 2.1 | Auth fetch client | 1.4 | not started | CSRF header, credentials include, typed errors | `/task 2.1` |
| 2.2 | useAuth implementation | 2.1 | not started | login/logout/register/session methods; tests with mock fetch | `/task 2.2` |
| 2.3 | useSession + refresh | 2.2 | not started | Idle timeout handling; session state sync | `/task 2.3` |
| 2.4 | use2FA + usePasskey hooks | 2.2, 1.5 | not started | Headless hooks calling protocol endpoints | `/task 2.4` |
| 2.5 | Vite env plugin | 2.1 | not started | Validates `VITE_AUTH_*` at build time | `/task 2.5` |

Phase 2 exit: 2.1–2.5 done. No UI components in package.

---

## Phase 3 — Next.js adapter

| ID | Task | Depends | Status | Done when | Prompt |
| --- | --- | --- | --- | --- | --- |
| 3.1 | Drizzle schema + migrations | 1.1 | not started | Users, sessions, credentials, audit tables | `/task 3.1` |
| 3.2 | Register + login routes | 3.1, 1.3 | not started | HttpOnly cookies; session rotation on login | `/task 3.2` |
| 3.3 | Logout + session route | 3.2 | not started | GET session; POST logout clears cookie | `/task 3.3` |
| 3.4 | Middleware (API guard) | 3.3 | not started | Rate limit, CSRF, IP audit hook | `/task 3.4` |
| 3.5 | 2FA routes | 3.2, 1.5 | not started | Enroll, verify, backup codes | `/task 3.5` |
| 3.6 | Passkey routes | 3.2 | not started | WebAuthn register + login with @simplewebauthn | `/task 3.6` |
| 3.7 | Integration tests | 3.6 | not started | Full cycle tests against Next handler | `/task 3.7` |

Phase 3 exit: 3.1–3.7 done.

---

## Phase 4 — .NET adapter

| ID | Task | Depends | Status | Done when | Prompt |
| --- | --- | --- | --- | --- | --- |
| 4.1 | Project scaffold | 1.1 | not started | `AuthNinja.AspNetCore` builds; `AddAuthNinja()` stub | `/task 4.1` |
| 4.2 | EF Core schema | 4.1 | not started | Matches Drizzle schema; migrations run | `/task 4.2` |
| 4.3 | Auth endpoints parity | 4.2, 1.3 | not started | Same OpenAPI contract as Next adapter | `/task 4.3` |
| 4.4 | Middleware parity | 4.3 | not started | Rate limit, CSRF, IP audit | `/task 4.4` |
| 4.5 | 2FA + passkeys | 4.3, 1.5 | not started | TOTP + Fido2.AspNet | `/task 4.5` |
| 4.6 | Contract tests | 4.5 | not started | Shared tests pass against .NET and Next | `/task 4.6` |

Phase 4 exit: 4.1–4.6 done.

---

## Phase 5 — CLI

| ID | Task | Depends | Status | Done when | Prompt |
| --- | --- | --- | --- | --- | --- |
| 5.1 | `auth-ninja init` | 2.5, 3.4 | not started | Scaffolds env, wires Next or detects stack | `/task 5.1` |
| 5.2 | `auth-ninja doctor` | 5.1 | not started | Validates secrets, HTTPS, cookie config | `/task 5.2` |
| 5.3 | `auth-ninja keys generate` | 1.2 | not started | Outputs secure `AUTH_NINJA_SECRET` | `/task 5.3` |

Phase 5 exit: 5.1–5.3 done.

---

## Phase 6 — Demos (UI here only)

| ID | Task | Depends | Status | Done when | Prompt |
| --- | --- | --- | --- | --- | --- |
| 6.1 | Vite + React demo | 3.7, 2.4 | not started | Login/register/2FA/passkey pages in `demos/vite-react` | `/task 6.1` |
| 6.2 | Next full-stack demo | 6.1 | not started | Same flows in `demos/next-fullstack` | `/task 6.2` |
| 6.3 | .NET SPA demo | 4.6, 6.1 | not started | React SPA + .NET API in `demos/dotnet-spa` | `/task 6.3` |
| 6.4 | E2E edge-case suite | 6.2 | not started | Playwright: lockout, CSRF, session expiry, enumeration | `/task 6.4` |
| 6.5 | `auth-ninja demo` command | 6.1 | not started | One command starts demo stack | `/task 6.5` |

Phase 6 exit: 6.1–6.5 done.

---

## Phase 7 — Security hardening & release

| ID | Task | Depends | Status | Done when | Prompt |
| --- | --- | --- | --- | --- | --- |
| 7.1 | Semgrep rules + CI gate | 6.4 | not started | CI fails on auth anti-patterns | `/task 7.1` |
| 7.2 | Production readiness checklist | 7.1 | not started | `docs/PRODUCTION.md` with must-pass gates | `/task 7.2` |
| 7.3 | Changesets + v0.1.0 publish | 7.2 | not started | Packages publishable; changelog written | `/task 7.3` |

Phase 7 exit: 7.1–7.3 done — v0.1.0 release candidate.

---

## Suggested order for `/next`

Phase 0 is complete. `/next` should pick **1.0**, then **1.1**, **1.2**, … in dependency order. Skip `blocked` rows. Do not start Phase 2 until Phase 1 core is usable.
