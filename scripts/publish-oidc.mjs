#!/usr/bin/env node
/**
 * Publish monorepo packages via npm OIDC trusted publishing.
 *
 * `pnpm release` → `changeset publish` → `pnpm publish` breaks OIDC because
 * pnpm injects NPM_CONFIG_* env vars that prevent npm 11+ from using
 * ACTIONS_ID_TOKEN_* credentials (ENEEDAUTH in CI).
 *
 * This script resolves workspace:* deps and calls `npm publish` directly so
 * OIDC env vars reach the npm CLI. Use as the changesets/action `publish`
 * command after `pnpm build` has already run in the workflow.
 *
 * @see https://github.com/npm/cli/issues/8976
 * @see https://github.com/changesets/action/issues/542
 */

import { readFileSync, readdirSync, existsSync, writeFileSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Dependency order: publish dependents after their workspace deps exist on npm. */
const PUBLISH_ORDER = [
  '@auth-ninja/protocol',
  '@auth-ninja/core',
  '@auth-ninja/react',
  '@auth-ninja/next',
  'auth-ninja',
];

/** Remove _authToken lines that block npm OIDC when no real token is configured. */
function stripDummyNpmrcAuth() {
  const candidates = [
    process.env.NPM_CONFIG_USERCONFIG,
    join(homedir(), '.npmrc'),
    join(process.cwd(), '.npmrc'),
  ].filter(Boolean);

  for (const npmrcPath of new Set(candidates)) {
    if (!existsSync(npmrcPath)) continue;
    const original = readFileSync(npmrcPath, 'utf8');
    const stripped = original
      .split('\n')
      .filter((line) => !line.includes('_authToken'))
      .join('\n');
    if (stripped !== original) {
      writeFileSync(npmrcPath, stripped);
      console.log(`Stripped dummy _authToken from ${npmrcPath}`);
    }
  }
}

/** Strip pnpm-injected npm config so OIDC trusted publishing can engage. */
function envForPublish(base = process.env) {
  if (base.NPM_TOKEN || base.NODE_AUTH_TOKEN) {
    return { ...base };
  }

  const env = { ...base };
  for (const key of Object.keys(env)) {
    if (key.toLowerCase().startsWith('npm_config_')) {
      delete env[key];
    }
  }
  delete env.NODE_AUTH_TOKEN;
  delete env.NPM_TOKEN;
  return env;
}

function assertPublishAuthReady(env) {
  if (env.NPM_TOKEN || env.NODE_AUTH_TOKEN) {
    console.log('Using NPM_TOKEN / NODE_AUTH_TOKEN for publish');
    return;
  }

  const hasOidc =
    Boolean(env.ACTIONS_ID_TOKEN_REQUEST_URL) &&
    Boolean(env.ACTIONS_ID_TOKEN_REQUEST_TOKEN);

  if (!hasOidc) {
    console.error(
      'No NPM_TOKEN and no OIDC env vars — configure npm trusted publishers ' +
        'on npmjs.com or add an NPM_TOKEN repository secret.',
    );
    process.exit(1);
  }

  console.log('Using npm OIDC trusted publishing');
  console.log(`npm: ${execFileSync('npm', ['--version'], { encoding: 'utf8' }).trim()}`);
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

function npmViewVersion(name, env) {
  try {
    return execFileSync('npm', ['view', name, 'version'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      env,
    }).trim();
  } catch {
    return null;
  }
}

function publishPackage({ name, version, dir, manifest }, versions, env) {
  const published = npmViewVersion(name, env);
  if (published === version) {
    console.log(`${name}@${version} is already on the registry, skipping`);
    return false;
  }

  console.log(
    `Publishing ${name}@${version} (registry currently at: ${published ?? 'none'})`,
  );

  const pkgPath = join(dir, 'package.json');
  const original = readFileSync(pkgPath, 'utf8');
  const resolved = resolveWorkspaceDeps(manifest, versions);

  writeFileSync(pkgPath, `${JSON.stringify(resolved, null, 2)}\n`);

  try {
    const result = spawnSync(
      'npm',
      ['publish', '--access', 'public', '--provenance', '--ignore-scripts'],
      { cwd: dir, env, stdio: 'inherit' },
    );
    if (result.status !== 0) {
      process.exit(result.status ?? 1);
    }
  } finally {
    writeFileSync(pkgPath, original);
  }

  const tag = `${name}@${version}`;
  const tagResult = spawnSync('git', ['tag', tag], { stdio: 'inherit' });
  if (tagResult.status !== 0) {
    console.log(`Note: git tag ${tag} could not be created (already exists?)`);
  }

  // changesets/action parses this line to push tags and create GitHub releases.
  console.log(`New tag: ${tag}`);
  return true;
}

function main() {
  stripDummyNpmrcAuth();
  const env = envForPublish();
  assertPublishAuthReady(env);

  const packages = loadPackages();
  const versions = new Map([...packages.values()].map((p) => [p.name, p.version]));
  let publishedAny = false;

  for (const name of PUBLISH_ORDER) {
    const pkg = packages.get(name);
    if (!pkg) {
      throw new Error(`Expected publishable package ${name} under packages/`);
    }
    if (publishPackage(pkg, versions, env)) {
      publishedAny = true;
    }
  }

  if (!publishedAny) {
    console.log('All packages are already published at their local versions');
  }
}

main();
