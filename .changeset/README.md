# Changesets

Auth-Ninja uses [Changesets](https://github.com/changesets/changesets) for versioning and changelogs.

## npm publish auth (required for CI — pick one)

CI publishes via [`.github/workflows/release.yml`](../.github/workflows/release.yml). Choose **trusted publishing** (recommended) or a **bypass-2FA token**.

### Option A — Trusted publishing / OIDC (recommended)

No long-lived publish token. npm CLI 11.5.1+ exchanges a short-lived GitHub OIDC token during the workflow.

**One-time setup on npmjs.com** — repeat for **each** publishable package:

| Package | npm settings |
| --- | --- |
| `@auth-ninja/protocol` | [Package → Settings → Trusted publishing](https://www.npmjs.com/package/@auth-ninja/protocol?activeTab=settings) |
| `@auth-ninja/core` | [Package → Settings → Trusted publishing](https://www.npmjs.com/package/@auth-ninja/core?activeTab=settings) |
| `@auth-ninja/react` | [Package → Settings → Trusted publishing](https://www.npmjs.com/package/@auth-ninja/react?activeTab=settings) |
| `@auth-ninja/next` | [Package → Settings → Trusted publishing](https://www.npmjs.com/package/@auth-ninja/next?activeTab=settings) |
| `@auth-ninja/cli` | [Package → Settings → Trusted publishing](https://www.npmjs.com/package/@auth-ninja/cli?activeTab=settings) |

For each package, click **Add trusted publisher** → **GitHub Actions** and set:

- **Organization or user:** `kristapsstrazds94`
- **Repository:** `auth-ninja`
- **Workflow filename:** `release.yml` (filename only, not the path)
- **Allowed actions:** `npm publish`

The workflow already sets `id-token: write`. After all five publishers are configured, re-run **Release**. You can delete the `NPM_TOKEN` secret once OIDC publish succeeds.

Docs: [npm trusted publishing](https://docs.npmjs.com/trusted-publishers/)

### Option B — Granular token with bypass 2FA (legacy)

Use only if you cannot set up trusted publishing yet.

1. Open **[npm → Access Tokens](https://www.npmjs.com/settings/kristapsstrazds94/tokens)**.
2. **Generate New Token** → **Granular Access Token**.
3. Set:
   - **Permissions:** Read and write
   - **Packages:** all `@auth-ninja/*` packages
   - **Bypass 2FA:** enable **“Allow this token to bypass two-factor authentication”** (required — CI cannot enter an OTP)
4. Add GitHub secret **`NPM_TOKEN`** at [repo Actions secrets](https://github.com/kristapsstrazds94/auth-ninja/settings/secrets/actions).
5. Re-run **Release**.

> npm is deprecating bypass-2FA tokens for direct publish (~2027). Plan to migrate to Option A.

### Verify and re-run

1. Open **[Actions → Release](https://github.com/kristapsstrazds94/auth-ninja/actions/workflows/release.yml)**.
2. Re-run the failed job.

**Verify npm publish auth** should pass a dry-run for `@auth-ninja/protocol`. Publish then uploads new versions or skips packages already at the current version.

### Troubleshooting

| Error | Cause | Fix |
| --- | --- | --- |
| `EOTP` / one-time password | Token does not bypass 2FA | Option A (OIDC) or Option B with bypass 2FA enabled |
| `E404` / Not Found on publish | Token lacks write access to `@auth-ninja/*` | Regenerate token with read **and write** on all packages |
| `ENEEDAUTH` with no token | Trusted publisher not configured | Add trusted publisher on all five packages (exact workflow name `release.yml`) |

`npm whoami` can succeed while publish fails — the token may be read-only or blocked by 2FA.

---

## Adding a changeset

After a user-facing change:

```bash
pnpm changeset
```

Commit the file under `.changeset/` and open a PR.

## Release workflow

1. Merge PRs with changeset files to `main`.
2. CI opens a **Version packages** PR (or publishes when no pending changesets remain).
3. Merge the version PR → CI bumps versions and publishes new releases to npm.

Publishable packages: `@auth-ninja/protocol`, `@auth-ninja/core`, `@auth-ninja/react`, `@auth-ninja/next`, `@auth-ninja/cli` (CLI command is still `auth-ninja`).

The unscoped name `auth-ninja` on npm belongs to an unrelated project — our CLI is **`@auth-ninja/cli`**.

Demos and `@auth-ninja/contract-tests` are private and never published.

## Manual first publish (only if a package is missing on npm)

All five packages publish together at the current monorepo version (see `packages/core/package.json`). You only need manual publish when adding a **new** package name:

```bash
pnpm build
pnpm --filter @auth-ninja/cli publish --access public --no-git-checks
```

Use `--otp 123456` if npm asks for 2FA.
