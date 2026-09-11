# Production readiness

Must-pass gates before deploying Auth-Ninja to production. Every gate below is **blocking** — do not ship until all pass.

Use this document with:

- [`auth-ninja doctor --production --strict`](../packages/cli/README.md#auth-ninja-doctor) — automated config checks
- CI Semgrep auth rules (task 7.1)
- E2E edge-case suite in `demos/e2e` (task 6.4)
- [`docs/THREAT-MODEL.md`](./THREAT-MODEL.md) — STRIDE mitigations implemented

**Status:** Living document — update when adding endpoints, changing session/MFA behavior, or tightening defaults.

---

## Quick verify

Run from the project root after configuring production `.env`:

```bash
auth-ninja doctor --production --strict
pnpm build && pnpm test
node scripts/semgrep-scan.mjs
```

For full-stack demos, also run Playwright E2E before release:

```bash
pnpm --filter @auth-ninja/demo-e2e test
```

All commands must exit 0.

---

## Must-pass gates

### 1. Secrets and configuration

| Gate | Requirement | Verify |
| --- | --- | --- |
| **Secret strength** | `AUTH_NINJA_SECRET` is ≥ 32 cryptographically random characters, stored in a secret manager — never in git | `auth-ninja doctor` → `[ok] AUTH_NINJA_SECRET meets minimum strength requirements` |
| **No committed secrets** | `.env` is gitignored; no real secrets in repo, CI logs, or client bundles | Semgrep `hardcoded-auth-secret` rule passes; manual review of deploy config |
| **Database URL** | `AUTH_NINJA_DATABASE_URL` points to a production database with network isolation and least-privilege credentials | Doctor loads config without error; DB reachable from app only |
| **Base URL** | `AUTH_NINJA_BASE_URL` is the public HTTPS origin users hit (no trailing path tricks) | Doctor → `[ok] AUTH_NINJA_BASE_URL uses HTTPS` |

Generate a new secret if needed:

```bash
auth-ninja keys generate
```

### 2. Transport and cookies

| Gate | Requirement | Verify |
| --- | --- | --- |
| **HTTPS everywhere** | All auth traffic over TLS; no mixed content | Doctor `--production` → HTTPS check passes |
| **Secure cookies** | Session cookies: **HttpOnly**, **Secure**, **SameSite=Strict** | Doctor → `[ok] Session cookies will include Secure, HttpOnly, and SameSite=Strict` |
| **No token in web storage** | Session tokens never in `localStorage` or `sessionStorage` | Semgrep `session-token-in-web-storage` passes; code review of host SPA |

### 3. Session lifecycle

| Gate | Requirement | Verify |
| --- | --- | --- |
| **Idle timeout** | `AUTH_NINJA_SESSION_IDLE_MINUTES` ≤ 15 (default 15) | Doctor session-idle check passes or warns only in dev |
| **Absolute max** | `AUTH_NINJA_SESSION_ABSOLUTE_HOURS` ≤ 8 (default 8) | Doctor → session-absolute pass |
| **Session rotation** | New session ID issued on login (fixation prevention) | Integration/E2E: login returns new cookie; see task 3.2 |
| **Server-side invalidation** | Logout clears server session and cookie | E2E logout flow; OpenAPI `/logout` contract |

### 4. CSRF and rate limiting

| Gate | Requirement | Verify |
| --- | --- | --- |
| **CSRF enabled** | `AUTH_NINJA_CSRF_ENABLED=true` in production | Doctor `--production` → CSRF pass (disabled = fail) |
| **Rate limits** | Per-IP limits on auth endpoints active | Middleware enabled; E2E or integration tests for 429 behavior |
| **Lockout** | Failed-attempt counter and lock window configured | Defaults via config; E2E lockout scenario passes |

### 5. Passwords and MFA

| Gate | Requirement | Verify |
| --- | --- | --- |
| **Argon2id only** | Passwords hashed with Argon2id — never MD5, SHA1, or unsalted SHA256 | Semgrep weak-hash rules pass; use `@auth-ninja/core` helpers |
| **Generic auth errors** | Login, register, reset return same generic messages — no user enumeration | E2E enumeration tests; `packages/core` error taxonomy |
| **TOTP secrets** | TOTP seeds encrypted at rest; never logged | Semgrep `auth-secret-logging` passes; audit schema excludes seeds |
| **Backup codes** | Recovery codes hashed, single-use | Core backup-code tests; adapter parity |
| **Passkey RP ID** | When passkeys enabled, `AUTH_NINJA_PASSKEY_RP_ID` matches deployment host | Doctor passkey-rp-id check; WebAuthn origin validation in adapters |

If `AUTH_NINJA_REQUIRE_2FA=true`, ensure enroll/verify flows are tested before enforcing for all users.

### 6. Infrastructure (multi-instance)

| Gate | Requirement | Verify |
| --- | --- | --- |
| **Redis for scale** | `AUTH_NINJA_REDIS_URL` set when running more than one app instance | Doctor `--production --strict` — treat redis warn as fail in strict mode |
| **Shared state** | Rate limits, lockout, and WebAuthn challenges consistent across instances | Load test or multi-replica smoke test with Redis |
| **Database migrations** | Schema matches Drizzle/EF migrations; applied before traffic | `pnpm --filter @auth-ninja/next db:migrate` or .NET `dotnet ef database update` |
| **IP audit** | `AUTH_NINJA_IP_AUDIT_ENABLED=true` unless explicitly disabled with documented reason | Config review; audit events in DB |

### 7. Code quality and contract

| Gate | Requirement | Verify |
| --- | --- | --- |
| **CI green** | Build, typecheck, unit tests pass on main | GitHub Actions `build` job |
| **Semgrep gate** | Auth anti-pattern rules pass | CI `semgrep` job; `node scripts/semgrep-scan.mjs` locally |
| **OpenAPI parity** | Implemented routes match `packages/protocol/openapi.json` | Protocol contract tests pass |
| **Cross-adapter parity** | .NET and Next adapters pass shared contract tests | `pnpm --filter @auth-ninja/contract-tests test` (or equivalent) |
| **Headless packages** | No styled UI in `packages/react` | Semgrep `styled-ui-in-react-package` passes |

### 8. Observability and operations

| Gate | Requirement | Verify |
| --- | --- | --- |
| **No secret logging** | Passwords, TOTP seeds, session IDs, recovery codes, and `AUTH_NINJA_SECRET` never logged | Semgrep logging rule; log review in staging |
| **Audit trail** | Login, logout, lockout, and suspicious IP events recorded | Audit table populated in staging smoke test |
| **Incident contact** | Vulnerability reporting path configured in [`SECURITY.md`](../SECURITY.md) | Security contact email/ process documented before public release |
| **Rollback plan** | Previous image/version and DB migration rollback documented | Ops runbook (host responsibility) |

---

## Pre-release checklist

Copy into your release PR or deployment ticket. Every item must be checked.

- [ ] `auth-ninja doctor --production --strict` exits 0
- [ ] `AUTH_NINJA_SECRET` rotated from any dev/demo value; stored in secret manager
- [ ] HTTPS termination configured; HSTS enabled at load balancer or edge
- [ ] CSRF enabled; SPA sends CSRF header on state-changing requests
- [ ] Redis configured if replicas > 1
- [ ] Database migrations applied to production
- [ ] Semgrep CI job green on release commit
- [ ] E2E suite green: lockout, CSRF, session expiry, enumeration
- [ ] Contract tests pass for chosen adapter (Next and/or .NET)
- [ ] Passkey RP ID and origin match production domain (if passkeys enabled)
- [ ] Staging smoke test: register → login → session → logout
- [ ] Log sample reviewed — no credentials or session material
- [ ] [`docs/THREAT-MODEL.md`](./THREAT-MODEL.md) review checklist satisfied for any new endpoints

---

## Recommended (non-blocking)

These are warnings in `auth-ninja doctor` without `--strict`. Fix before scaling or tighten to must-pass via `--strict`:

| Item | Why |
| --- | --- |
| Session idle > 15 minutes | Longer idle increases hijack window |
| HTTP on localhost only | Expected for local dev — never in production |
| Missing `.env` file | OK if env vars injected by platform (K8s, PaaS) |
| Passkey RP ID mismatch | WebAuthn may fail for users until aligned |

---

## Version support

| Version | Production use |
| --- | --- |
| 0.0.x | Development only — not production-ready |
| 0.1.x+ | Supported after all must-pass gates green |

See [`SECURITY.md`](../SECURITY.md) for vulnerability reporting.

---

## References

- [`docs/THREAT-MODEL.md`](./THREAT-MODEL.md) — STRIDE analysis and mitigations
- [`SECURITY.md`](../SECURITY.md) — vulnerability reporting
- [`AGENTS.md`](../AGENTS.md) — hard security rules for contributors
- [`.cursor/rules/auth-ninja-security.mdc`](../.cursor/rules/auth-ninja-security.mdc) — agent constraints
- [`packages/cli/README.md`](../packages/cli/README.md) — `doctor`, `init`, `keys` commands
