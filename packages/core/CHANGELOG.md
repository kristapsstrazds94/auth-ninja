# @auth-ninja/core

## 0.1.0

### Minor Changes

- Initial v0.1.0 release: secure headless authentication for React and Next.js.

  - **@auth-ninja/core** — Zod config, error taxonomy, Argon2id passwords, TOTP 2FA, lockout engine, audit events
  - **@auth-ninja/protocol** — OpenAPI contract and contract tests
  - **@auth-ninja/react** — headless hooks (`useAuth`, `useSession`, `use2FA`, `usePasskey`); no UI components
  - **@auth-ninja/next** — Drizzle schema, route handlers, middleware, WebAuthn passkeys
  - **auth-ninja** CLI — `init`, `doctor`, `keys generate`, `demo`

  See [docs/PRODUCTION.md](../docs/PRODUCTION.md) for production readiness gates before deploying.
