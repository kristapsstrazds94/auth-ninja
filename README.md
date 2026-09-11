# Auth-Ninja

Secure, reusable authentication for internal projects.

**Frontend:** React + TypeScript + Vite (headless hooks only — no UI in packages)  
**Backend:** Next.js or .NET adapters sharing one OpenAPI contract

## Packages

| Package | Description |
|---------|-------------|
| `@auth-ninja/core` | Config schema, errors, crypto helpers |
| `@auth-ninja/protocol` | OpenAPI contract |
| `@auth-ninja/react` | Headless `AuthProvider`, `useAuth`, `RequireAuth` |
| `@auth-ninja/next` | Next.js route handlers + middleware |
| `@auth-ninja/cli` | CLI (`init`, `doctor`, `demo`, `keys`) — run as `auth-ninja` |
| `AuthNinja.AspNetCore` | .NET adapter (`adapters/dotnet/`) |

## Quick start (development)

```bash
pnpm install
pnpm build
pnpm test
```

## Release

Publishable packages share version **0.1.0** via [Changesets](https://github.com/changesets/changesets). See [`.changeset/README.md`](.changeset/README.md) for the release workflow.

```bash
pnpm changeset          # add a changeset after user-facing changes
pnpm version-packages   # bump versions and update CHANGELOGs
pnpm release            # build and publish to npm (OIDC or NPM_TOKEN)
```

## Security defaults

- HttpOnly session cookies (never localStorage tokens)
- Argon2id password hashing
- CSRF protection, rate limiting, account lockout
- Optional TOTP 2FA and WebAuthn passkeys
- IP audit logging

See [`SECURITY.md`](SECURITY.md) for reporting vulnerabilities.

## Demos

Demo apps with throwaway UI live under `demos/` — **not published** to npm. Use them to test auth flows locally.

## License

[MIT](LICENSE)
