# @auth-ninja/react

## 1.0.0

### Major Changes

- Auth-Ninja **1.0.0** — first stable release.

  - **@auth-ninja/core** — Zod config, error taxonomy, Argon2id passwords, TOTP 2FA, lockout engine, audit events
  - **@auth-ninja/protocol** — OpenAPI contract and contract tests
  - **@auth-ninja/react** — headless hooks (`useAuth`, `useSession`, `use2FA`, `usePasskey`); no UI components
  - **@auth-ninja/next** — Drizzle schema, route handlers, middleware, WebAuthn passkeys
  - **@auth-ninja/cli** — `init`, `doctor`, `keys generate`, `demo`

  See [docs/PRODUCTION.md](https://github.com/kristapsstrazds94/auth-ninja/blob/main/docs/PRODUCTION.md) for production readiness gates.

### Patch Changes

- Updated dependencies
  - @auth-ninja/core@1.0.0

## 0.1.0

### Patch Changes

- Updated dependencies
  - @auth-ninja/core@0.1.0
