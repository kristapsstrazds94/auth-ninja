# @auth-ninja/core

Shared configuration schema, error types, crypto helpers, and auth primitives for Auth-Ninja.

This package is headless — no UI. Wire it through `@auth-ninja/react` and a server adapter (`@auth-ninja/next` or `AuthNinja.AspNetCore`).

## Configuration

Load and validate environment variables with Zod:

```ts
import { loadAuthNinjaConfig } from "@auth-ninja/core";

const config = loadAuthNinjaConfig();
// config.secret, config.baseUrl, config.databaseUrl, session/lockout/MFA options…
```

Required env vars: `AUTH_NINJA_SECRET` (≥ 32 chars), `AUTH_NINJA_BASE_URL`, `AUTH_NINJA_DATABASE_URL`. Full list: [main README config table](../../README.md#configuration).

Generate a secret: `generateAuthNinjaSecret()` or `pnpm dlx @auth-ninja/cli keys generate`.

## Subpath exports

| Import | Contents |
| --- | --- |
| `@auth-ninja/core` | Config, errors, passwords, TOTP, lockout, audit, field encryption |
| `@auth-ninja/core/errors` | Error types only |
| `@auth-ninja/core/password-policy` | zxcvbn strength assessment |

## Passwords

```ts
import { hashPassword, verifyPasswordWithTimingProtection } from "@auth-ninja/core";
import { assessPasswordStrength, isPasswordStrongEnough } from "@auth-ninja/core/password-policy";
```

Argon2id hashing with constant-time verification. Minimum strength enforced via zxcvbn (`passwordMinScore`, default 2).

## TOTP 2FA

```ts
import {
  generateTotpSecret,
  verifyTotpCode,
  generateBackupCodes,
  verifyBackupCode,
} from "@auth-ninja/core";
```

## Lockout

```ts
import { LockoutEngine, InMemoryLockoutStore, lockoutConfigFromAuthConfig } from "@auth-ninja/core";
```

## Audit events

Typed schemas for login, logout, lockout, and IP audit events — `createLoginAuditEvent`, `AUDIT_EVENT_TYPES`, etc.

## Error taxonomy

All auth API errors use `AuthNinjaError` with a code from `AUTH_ERROR_CODES`. Adapters should return the default generic message from `AUTH_ERROR_MESSAGES` unless a flow-specific variant is documented below.

| Code | HTTP | Message | When |
| --- | --- | --- | --- |
| `INVALID_CREDENTIALS` | 401 | Invalid email or password. | Login or passkey auth failed |
| `ACCOUNT_LOCKED` | 423 | Too many failed attempts. Try again later. | Lockout after failed attempts |
| `SESSION_EXPIRED` | 401 | Session expired. | Missing or expired session |
| `MFA_REQUIRED` | 403 | Multi-factor authentication is required. | Action requires completed MFA |
| `MFA_INVALID` | 400 | Invalid authentication code. | Bad TOTP or backup code |
| `CSRF_INVALID` | 403 | Invalid CSRF token. | Missing or invalid CSRF header |
| `RATE_LIMITED` | 429 | Too many requests. | Rate limit exceeded |
| `FORBIDDEN` | 403 | Forbidden. | Authenticated but not permitted |
| `VALIDATION_ERROR` | 400 | Invalid request. | Invalid request body or params |

Use `createAuthError(code)` for defaults, or `AUTH_GENERIC_MESSAGES` for register and password-reset flows that must not reveal account existence. Full descriptions: `AUTH_ERROR_CATALOG` in `src/errors.ts`.
