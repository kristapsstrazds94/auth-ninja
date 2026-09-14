# Changesets

Auth-Ninja uses [Changesets](https://github.com/changesets/changesets) for versioning and changelogs.

## NPM token setup (required for CI — do this once)

CI publishes with an **npm Automation token** stored as a GitHub secret. Without it, the Release workflow fails with `ENEEDAUTH`.

### Step 1 — Create token on npm

1. Open **[npm → Access Tokens](https://www.npmjs.com/settings/kristapsstrazds94/tokens)** (log in as owner of the `@auth-ninja` org).
2. Click **Generate New Token** → **Granular Access Token**.
3. Set:
   - **Token name:** `github-actions-auth-ninja`
   - **Expiration:** your choice (90 days or no expiration)
   - **Packages and scopes:** select **Read and write** for all `@auth-ninja/*` packages (or the whole `@auth-ninja` org)
4. Click **Generate Token** and **copy** the value (starts with `npm_`). You won't see it again.

### Step 2 — Add GitHub secret

1. Open **[GitHub → auth-ninja → Settings → Secrets and variables → Actions](https://github.com/kristapsstrazds94/auth-ninja/settings/secrets/actions)**.
2. Click **New repository secret**.
3. **Name:** `NPM_TOKEN`
4. **Value:** paste the `npm_…` token from step 1.
5. Click **Add secret**.

### Step 3 — Re-run Release

1. Open **[Actions → Release](https://github.com/kristapsstrazds94/auth-ninja/actions/workflows/release.yml)**.
2. Click the failed run → **Re-run all jobs**.

The **Verify npm credentials** step should print `Logged in as: your-npm-username`. Publish then skips packages already at the current version or uploads new ones after a version bump.

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
