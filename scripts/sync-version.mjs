#!/usr/bin/env node
/**
 * Version Sync Script
 *
 * Ensures APP_VERSION in src/index.ts matches version in package.json.
 * Run before releases to keep versions in sync.
 *
 * Usage:
 *   node scripts/sync-version.mjs           # Sync from package.json to index.ts
 *   node scripts/sync-version.mjs 1.3.0     # Set specific version in both files
 *   node scripts/sync-version.mjs --check   # Check if versions match (CI use)
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const PACKAGE_JSON = resolve(ROOT, 'package.json');
const INDEX_TS = resolve(ROOT, 'src/index.ts');

function getPackageVersion() {
  const pkg = JSON.parse(readFileSync(PACKAGE_JSON, 'utf8'));
  return pkg.version;
}

function getIndexVersion() {
  const content = readFileSync(INDEX_TS, 'utf8');
  const match = content.match(/const APP_VERSION = ['"]([^'"]+)['"]/);
  return match ? match[1] : null;
}

function setPackageVersion(version) {
  const pkg = JSON.parse(readFileSync(PACKAGE_JSON, 'utf8'));
  pkg.version = version;
  writeFileSync(PACKAGE_JSON, JSON.stringify(pkg, null, 2) + '\n');
  console.log(`Updated package.json to ${version}`);
}

function setIndexVersion(version) {
  let content = readFileSync(INDEX_TS, 'utf8');
  content = content.replace(
    /const APP_VERSION = ['"][^'"]+['"]/,
    `const APP_VERSION = '${version}'`
  );
  writeFileSync(INDEX_TS, content);
  console.log(`Updated src/index.ts APP_VERSION to ${version}`);
}

function validateVersion(version) {
  const semverRegex = /^\d+\.\d+\.\d+(-[\w.]+)?$/;
  if (!semverRegex.test(version)) {
    console.error(`Invalid version format: ${version}`);
    console.error('Expected format: X.Y.Z or X.Y.Z-suffix');
    process.exit(1);
  }
}

// Main
const args = process.argv.slice(2);

if (args[0] === '--check') {
  // CI mode: check if versions match
  const pkgVersion = getPackageVersion();
  const indexVersion = getIndexVersion();

  console.log(`package.json:  ${pkgVersion}`);
  console.log(`src/index.ts:  ${indexVersion}`);

  if (pkgVersion !== indexVersion) {
    console.error('\nVersion mismatch! Run: npm run version:sync');
    process.exit(1);
  }

  console.log('\nVersions match.');
  process.exit(0);
}

if (args[0]) {
  // Set specific version
  const newVersion = args[0];
  validateVersion(newVersion);

  setPackageVersion(newVersion);
  setIndexVersion(newVersion);

  console.log(`\nBoth files updated to ${newVersion}`);
} else {
  // Sync from package.json to index.ts
  const pkgVersion = getPackageVersion();
  const indexVersion = getIndexVersion();

  console.log(`package.json:  ${pkgVersion}`);
  console.log(`src/index.ts:  ${indexVersion}`);

  if (pkgVersion === indexVersion) {
    console.log('\nVersions already in sync.');
  } else {
    setIndexVersion(pkgVersion);
    console.log(`\nSynced src/index.ts to ${pkgVersion}`);
  }
}
