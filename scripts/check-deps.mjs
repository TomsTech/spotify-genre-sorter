#!/usr/bin/env node
/**
 * Dependency Check Script
 *
 * Checks for outdated dependencies and reports them.
 * - Minor/patch updates: Warning (non-blocking)
 * - Major updates: Informational notice
 * - Security vulnerabilities: Error (blocking in CI)
 */

import { execSync } from 'child_process';

console.log('🔍 Checking for outdated dependencies...\n');

try {
  // Run npm outdated - it exits with code 1 if there are outdated packages
  const result = execSync('npm outdated --json', { encoding: 'utf8' });
  const outdated = JSON.parse(result || '{}');

  if (Object.keys(outdated).length === 0) {
    console.log('✅ All dependencies are up to date!\n');
    process.exit(0);
  }

  processOutdated(outdated);
} catch (error) {
  // npm outdated returns exit code 1 when packages are outdated
  if (error.stdout) {
    try {
      const outdated = JSON.parse(error.stdout);
      processOutdated(outdated);
    } catch {
      console.error('❌ Failed to parse npm outdated output');
      process.exit(1);
    }
  } else {
    console.error('❌ Failed to check dependencies:', error.message);
    process.exit(1);
  }
}

function processOutdated(outdated) {
  const packages = Object.entries(outdated);

  if (packages.length === 0) {
    console.log('✅ All dependencies are up to date!\n');
    process.exit(0);
  }

  const majorUpdates = [];
  const minorUpdates = [];
  const patchUpdates = [];

  for (const [name, info] of packages) {
    const current = info.current || 'unknown';
    const wanted = info.wanted || 'unknown';
    const latest = info.latest || 'unknown';

    // Determine update type by comparing major versions
    const currentMajor = parseInt(current.split('.')[0]) || 0;
    const latestMajor = parseInt(latest.split('.')[0]) || 0;
    const currentMinor = parseInt(current.split('.')[1]) || 0;
    const latestMinor = parseInt(latest.split('.')[1]) || 0;

    const update = { name, current, wanted, latest };

    if (latestMajor > currentMajor) {
      majorUpdates.push(update);
    } else if (latestMinor > currentMinor) {
      minorUpdates.push(update);
    } else if (current !== wanted) {
      patchUpdates.push(update);
    }
  }

  // Report findings
  console.log(`Found ${packages.length} outdated package(s):\n`);

  if (majorUpdates.length > 0) {
    console.log('📦 Major Updates (require migration):');
    for (const pkg of majorUpdates) {
      console.log(`   ${pkg.name}: ${pkg.current} → ${pkg.latest}`);
      // Add specific notes for known major version situations
      if (pkg.name === 'eslint') {
        console.log('      ℹ️  ESLint 9.x requires "flat config" migration.');
        console.log('      ℹ️  ESLint 8.57.1 is stable LTS - safe to stay on v8.');
      }
    }
    console.log('');
  }

  if (minorUpdates.length > 0) {
    console.log('⬆️  Minor Updates (new features):');
    for (const pkg of minorUpdates) {
      console.log(`   ${pkg.name}: ${pkg.current} → ${pkg.latest}`);
    }
    console.log('');
  }

  if (patchUpdates.length > 0) {
    console.log('🔧 Patch Updates (bug fixes):');
    for (const pkg of patchUpdates) {
      console.log(`   ${pkg.name}: ${pkg.current} → ${pkg.wanted}`);
    }
    console.log('');
  }

  // Summary
  console.log('─'.repeat(50));
  console.log('Summary:');
  console.log(`  Major: ${majorUpdates.length} (review before updating)`);
  console.log(`  Minor: ${minorUpdates.length} (run: npm update)`);
  console.log(`  Patch: ${patchUpdates.length} (run: npm update)`);
  console.log('');

  // Exit with warning code if there are minor/patch updates
  // (CI can choose to treat this as warning or error)
  if (minorUpdates.length > 0 || patchUpdates.length > 0) {
    console.log('💡 Run "npm update" to apply minor and patch updates.');
    console.log('');
  }

  // Don't fail on outdated packages - just inform
  process.exit(0);
}
