# Changesets

Auth-Ninja uses [Changesets](https://github.com/changesets/changesets) for versioning and changelogs.

## Adding a changeset

After making a user-facing change in a publishable package:

```bash
pnpm changeset
```

Follow the prompts, commit the generated file under `.changeset/`, and open a PR.

## Release workflow

1. Merge PRs with changeset files to `main`.
2. The **Release** GitHub Action opens a "Version packages" PR (or publishes when versions are bumped).
3. Merge the version PR — CI runs `pnpm build`, then `node scripts/publish-oidc.mjs` (direct `npm publish` for OIDC; see `scripts/publish-oidc.mjs`).

Publishable packages (`@auth-ninja/*`, including `@auth-ninja/cli`) share a **fixed** version line — one bump applies to all.

Demos and `@auth-ninja/contract-tests` are private and never published.

## First-time npm setup

All publishable packages use the **`@auth-ninja` npm organization**. The unscoped name `auth-ninja` is taken on npm by an unrelated package — the CLI publishes as **`@auth-ninja/cli`** (bin command remains `auth-ninja`).

If CI fails with `E404` / `'@auth-ninja/…' is not in this registry`, complete this once:

1. **Create the org** — [npm → Add an Organization](https://www.npmjs.com/org/create), name **`auth-ninja`**, choose the free public-packages plan.
2. **Log in to npm** on the machine that will bootstrap (must be an owner of the `auth-ninja` org):

   ```bash
   npm login
   npm whoami   # should print your npm username
   ```

3. **Bootstrap each scoped package** (trusted publishing can only be attached after the package exists on npm):

   ```bash
   pnpm build
   pnpm --filter @auth-ninja/protocol publish --access public --no-git-checks
   pnpm --filter @auth-ninja/core publish --access public --no-git-checks
   pnpm --filter @auth-ninja/react publish --access public --no-git-checks
   pnpm --filter @auth-ninja/next publish --access public --no-git-checks
   pnpm --filter @auth-ninja/cli publish --access public --no-git-checks
   ```

   Run from the repo root in dependency order (protocol → core → react → next → cli). If npm returns **403 / Two-factor authentication … is required**, append a current authenticator code:

   ```bash
   pnpm --filter @auth-ninja/protocol publish --access public --no-git-checks --otp 123456
   ```

   Generate a fresh `--otp` for each command (codes expire every ~30s). Or create a granular **Automation** token at [npmjs.com/settings/…/tokens](https://www.npmjs.com/settings/kristapsstrazds94/tokens) with **Publish** permission for the `@auth-ninja` scope and set it as the `NPM_TOKEN` repository secret.

4. **Configure trusted publishing** on npm for each package:

   | Field | Value |
   | --- | --- |
   | GitHub organization/user | `kristapsstrazds94` |
   | Repository | `auth-ninja` |
   | Workflow filename | `release.yml` |
   | Allowed action | `npm publish` |

5. Re-run the Release workflow (or merge a version PR). CI uses OIDC when `NPM_TOKEN` is unset; alternatively add an org **Automation** token as the `NPM_TOKEN` repository secret.
