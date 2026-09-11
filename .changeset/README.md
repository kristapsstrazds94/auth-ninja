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
3. Merge the version PR — CI runs `pnpm build`, then `changeset publish` with `NPM_TOKEN`.

Publishable packages (`@auth-ninja/*` and `auth-ninja` CLI) share a **fixed** version line — one bump applies to all.

Demos and `@auth-ninja/contract-tests` are private and never published.
