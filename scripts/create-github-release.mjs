#!/usr/bin/env node
/**
 * Create a GitHub Release for the current publishable package version.
 * Run after npm publish when all @auth-ninja/* packages share the same version.
 */

import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const VERSION_PKG = join(root, 'packages/core/package.json');

function readVersion() {
  const pkg = JSON.parse(readFileSync(VERSION_PKG, 'utf8'));
  if (!pkg.version) throw new Error('packages/core/package.json has no version');
  return pkg.version;
}

function extractChangelog(version) {
  const changelogPath = join(root, 'packages/core/CHANGELOG.md');
  if (!existsSync(changelogPath)) {
    throw new Error('packages/core/CHANGELOG.md not found');
  }

  const content = readFileSync(changelogPath, 'utf8');
  const heading = `## ${version}`;
  const start = content.indexOf(heading);
  if (start === -1) {
    throw new Error(`No changelog section ${heading} in packages/core/CHANGELOG.md`);
  }

  const bodyStart = start + heading.length;
  const nextHeading = content.indexOf('\n## ', bodyStart);
  const section = content.slice(bodyStart, nextHeading === -1 ? undefined : nextHeading).trim();

  return `# Auth-Ninja ${version}\n\n${section}`;
}

function ghReleaseExists(tag) {
  try {
    execFileSync('gh', ['release', 'view', tag], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function main() {
  const version = readVersion();
  const tag = `v${version}`;

  if (ghReleaseExists(tag)) {
    console.log(`GitHub release ${tag} already exists, skipping`);
    return;
  }

  const notes = extractChangelog(version);
  console.log(`Creating GitHub release ${tag}`);

  execFileSync(
    'gh',
    ['release', 'create', tag, '--title', `Auth-Ninja ${version}`, '--notes', notes],
    { stdio: 'inherit' },
  );
}

main();
