# @auth-ninja/core

Shared configuration schema, error types, and crypto helpers for Auth-Ninja.

This package is headless — no UI. Wire it through `@auth-ninja/react` and a server adapter.

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
