#!/usr/bin/env node
/**
 * Publish @auth-ninja/* packages from CI or locally.
 *
 * Skips packages already on npm at the same version (matching this repo).
 * Requires NODE_AUTH_TOKEN (CI: set via NPM_TOKEN repository secret).
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

function assertPublishAuthReady() {
  if (process.env.NODE_AUTH_TOKEN || process.env.NPM_TOKEN) {
    console.log('npm auth: token present');
    return;
  }

  console.error(`
NPM_TOKEN is not configured.

One-time setup:
  1. https://www.npmjs.com/settings/kristapsstrazds94/tokens
     → Generate New Token → Granular Access Token
     → Permissions: Read and write
     → Select packages: @auth-ninja/* (all packages in the auth-ninja org)
  2. https://github.com/kristapsstrazds94/auth-ninja/settings/secrets/actions
     → New repository secret → Name: NPM_TOKEN → paste the npm_… token
  3. Re-run the Release workflow
`);
  process.exit(1);
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
      { cwd: dir, stdio: 'inherit' },
    );
    if (result.status !== 0) {
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
