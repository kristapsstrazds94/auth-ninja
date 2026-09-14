#!/usr/bin/env node
/**
 * Publish @auth-ninja/* packages from CI or locally.
 *
 * Skips packages already on npm at the same version (matching this repo).
 *
 * CI (GitHub Actions): prefers npm trusted publishing (OIDC). Configure each package
 * on npmjs.com → Settings → Trusted publishing → workflow `release.yml`.
 * Optional fallback: NPM_TOKEN secret (must bypass 2FA for publish).
 *
 * Local: NODE_AUTH_TOKEN or npm login.
 */

import { readFileSync, readdirSync, existsSync, writeFileSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const PUBLISH_ORDER = [
  '@auth-ninja/protocol',
  '@auth-ninja/core',
  '@auth-ninja/react',
  '@auth-ninja/next',
  '@auth-ninja/cli',
];

const OUR_REPO_MARKER = 'kristapsstrazds94/auth-ninja';

function npmAuthToken() {
  return process.env.NODE_AUTH_TOKEN || process.env.NPM_TOKEN || '';
}

function isCiPublish() {
  return process.env.GITHUB_ACTIONS === 'true';
}

function assertPublishAuthReady() {
  if (npmAuthToken()) {
    console.log('npm auth: token present');
    return;
  }
  if (isCiPublish()) {
    console.log('npm auth: trusted publishing (OIDC) — no token');
    return;
  }

  console.error(`
No npm credentials for local publish.

Use npm login, or set NODE_AUTH_TOKEN. For CI, see .changeset/README.md.
`);
  process.exit(1);
}

function printPublishPermissionHelp(name) {
  console.error(`
Publish failed with npm 404 for ${name}.

npm often returns 404 (not 403) when the token cannot publish to a scoped package.
"npm whoami" can still succeed with a read-only token.

Fix: see .changeset/README.md (NPM token setup or trusted publishing).
`);
}

function publishEnv() {
  const token = npmAuthToken();
  const env = { ...process.env };
  if (token) {
    env.NODE_AUTH_TOKEN = token;
  } else {
    delete env.NODE_AUTH_TOKEN;
    delete env.NPM_TOKEN;
  }
  return env;
}

function printEneedAuthHelp(name) {
  console.error(`
Publish failed with npm ENEEDAUTH for ${name}.

CI has no valid npm credentials.

Option A — trusted publishing (recommended):
  Configure trusted publisher on all five @auth-ninja/* packages:
    user/org: kristapsstrazds94, repo: auth-ninja, workflow: release.yml
  See .changeset/README.md

Option B — bypass-2FA token:
  Set GitHub secret NPM_TOKEN (granular token with bypass 2FA enabled)
`);
}

function printOtpHelp(name) {
  console.error(`
Publish failed with npm EOTP (one-time password required) for ${name}.

Your granular token does not bypass 2FA. CI cannot enter an OTP.

Recommended — npm trusted publishing (no token, no OTP):
  1. On npmjs.com, open each @auth-ninja/* package → Settings → Trusted publishing
  2. Add GitHub Actions publisher:
       User/org: kristapsstrazds94
       Repository: auth-ninja
       Workflow: release.yml
       Allowed actions: npm publish
  3. Repeat for all five packages (protocol, core, react, next, cli)
  4. Delete the NPM_TOKEN secret (optional) and re-run Release

Quick fix — bypass-2FA token:
  1. https://www.npmjs.com/settings/kristapsstrazds94/tokens
  2. Generate New Token → Granular Access Token
  3. Read and write on @auth-ninja/*
  4. Enable "Allow this token to bypass two-factor authentication"
  5. Update GitHub secret NPM_TOKEN and re-run Release
`);
}

function loadPackages() {
  const packages = new Map();
  for (const dir of readdirSync(join(root, 'packages'))) {
    const pkgPath = join(root, 'packages', dir, 'package.json');
    if (!existsSync(pkgPath)) continue;

    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
    if (pkg.private) continue;

    packages.set(pkg.name, {
      name: pkg.name,
      version: pkg.version,
      dir: join(root, 'packages', dir),
      manifest: pkg,
    });
  }
  return packages;
}

function resolveWorkspaceDeps(manifest, versions) {
  const resolved = structuredClone(manifest);
  for (const field of ['dependencies', 'peerDependencies', 'optionalDependencies']) {
    if (!resolved[field]) continue;
    for (const [dep, range] of Object.entries(resolved[field])) {
      if (typeof range === 'string' && range.startsWith('workspace:')) {
        const ver = versions.get(dep);
        if (!ver) {
          throw new Error(`Unknown workspace dependency ${dep} in ${manifest.name}`);
        }
        resolved[field][dep] = ver;
      }
    }
  }
  return resolved;
}

function npmViewExact(name, version) {
  try {
    const raw = execFileSync('npm', ['view', `${name}@${version}`, '--json'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function registryRepository(info) {
  const repo = info?.repository;
  if (typeof repo === 'string') return repo;
  if (repo && typeof repo === 'object' && typeof repo.url === 'string') {
    return repo.url;
  }
  return '';
}

function isOurPackagePublished(name, version) {
  const info = npmViewExact(name, version);
  if (!info) return false;

  const repo = registryRepository(info);
  if (!repo.includes(OUR_REPO_MARKER)) {
    throw new Error(
      `${name}@${version} exists on npm but belongs to another repository (${repo || 'unknown'}).`,
    );
  }

  return true;
}

function publishPackage({ name, version, dir, manifest }, versions) {
  if (isOurPackagePublished(name, version)) {
    console.log(`${name}@${version} is already on the registry, skipping`);
    return false;
  }

  console.log(`Publishing ${name}@${version}`);

  const pkgPath = join(dir, 'package.json');
  const original = readFileSync(pkgPath, 'utf8');
  const resolved = resolveWorkspaceDeps(manifest, versions);

  writeFileSync(pkgPath, `${JSON.stringify(resolved, null, 2)}\n`);

  try {
    const result = spawnSync(
      'npm',
      ['publish', '--access', 'public', '--ignore-scripts'],
      {
        cwd: dir,
        encoding: 'utf8',
        env: publishEnv(),
      },
    );
    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
    if (result.status !== 0) {
      const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
      if (output.includes('E404') || output.includes('404 Not Found')) {
        printPublishPermissionHelp(name);
      }
      if (output.includes('EOTP') || output.includes('one-time password')) {
        printOtpHelp(name);
      }
      if (output.includes('ENEEDAUTH') || output.includes('need auth')) {
        printEneedAuthHelp(name);
      }
      process.exit(result.status ?? 1);
    }
  } finally {
    writeFileSync(pkgPath, original);
  }

  const tag = `${name}@${version}`;
  spawnSync('git', ['tag', tag], { stdio: 'inherit' });
  console.log(`New tag: ${tag}`);
  return true;
}

function main() {
  assertPublishAuthReady();

  const packages = loadPackages();
  const versions = new Map([...packages.values()].map((p) => [p.name, p.version]));
  let publishedAny = false;

  for (const name of PUBLISH_ORDER) {
    const pkg = packages.get(name);
    if (!pkg) {
      throw new Error(`Expected publishable package ${name} under packages/`);
    }
    if (publishPackage(pkg, versions)) {
      publishedAny = true;
    }
  }

  if (!publishedAny) {
    console.log('All packages are already published at their local versions');
  }
}

main();
