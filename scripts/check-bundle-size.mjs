#!/usr/bin/env node

/**
 * Bundle Size Check Script
 *
 * Monitors the total source bundle size to ensure it stays within
 * Cloudflare Workers limits (1MB compressed).
 *
 * Usage:
 *   node scripts/check-bundle-size.mjs [--warn-threshold=900] [--fail-threshold=1000]
 *
 * Exit codes:
 *   0 - Bundle size is within limits
 *   1 - Bundle size exceeds fail threshold
 */

import { readdir, stat } from 'fs/promises';
import { join, extname } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

// Default thresholds in KB
const DEFAULT_WARN_THRESHOLD = 900;  // 900KB - start warning
const DEFAULT_FAIL_THRESHOLD = 1000; // 1MB - fail build

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  let warnThreshold = DEFAULT_WARN_THRESHOLD;
  let failThreshold = DEFAULT_FAIL_THRESHOLD;

  for (const arg of args) {
    if (arg.startsWith('--warn-threshold=')) {
      warnThreshold = parseInt(arg.split('=')[1], 10);
    } else if (arg.startsWith('--fail-threshold=')) {
      failThreshold = parseInt(arg.split('=')[1], 10);
    }
  }

  return { warnThreshold, failThreshold };
}

// Get all TypeScript files recursively
async function getSourceFiles(dir, files = []) {
  const entries = await readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);

    if (entry.isDirectory()) {
      // Skip node_modules, dist, .git, etc.
      if (!['node_modules', 'dist', '.git', '.wrangler', 'coverage'].includes(entry.name)) {
        await getSourceFiles(fullPath, files);
      }
    } else if (entry.isFile()) {
      const ext = extname(entry.name);
      if (['.ts', '.tsx', '.js', '.mjs'].includes(ext)) {
        files.push(fullPath);
      }
    }
  }

  return files;
}

// Format bytes to human readable
function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

async function main() {
  const { warnThreshold, failThreshold } = parseArgs();
  const srcDir = join(projectRoot, 'src');

  console.log('Bundle Size Check');
  console.log('='.repeat(50));
  console.log();

  try {
    const files = await getSourceFiles(srcDir);
    let totalSize = 0;
    const fileSizes = [];

    // Calculate sizes
    for (const file of files) {
      const stats = await stat(file);
      const relativePath = file.replace(projectRoot + '/', '').replace(projectRoot + '\\', '');
      fileSizes.push({ path: relativePath, size: stats.size });
      totalSize += stats.size;
    }

    // Sort by size descending
    fileSizes.sort((a, b) => b.size - a.size);

    // Display top 5 largest files
    console.log('Top 5 Largest Files:');
    console.log('-'.repeat(50));
    for (const file of fileSizes.slice(0, 5)) {
      const sizeStr = formatBytes(file.size).padStart(10);
      console.log(`  ${sizeStr}  ${file.path}`);
    }
    console.log();

    // Display total
    const totalKB = totalSize / 1024;
    console.log('Summary:');
    console.log('-'.repeat(50));
    console.log(`  Total Source Size: ${formatBytes(totalSize)}`);
    console.log(`  Files Analyzed:    ${files.length}`);
    console.log(`  Warn Threshold:    ${warnThreshold} KB`);
    console.log(`  Fail Threshold:    ${failThreshold} KB`);
    console.log();

    // Check thresholds
    if (totalKB >= failThreshold) {
      console.log(`FAIL: Bundle size (${formatBytes(totalSize)}) exceeds ${failThreshold} KB limit`);
      console.log();
      console.log('Recommendations:');
      console.log('  1. Extract embedded base64 assets to R2 or CDN');
      console.log('  2. Consider code splitting');
      console.log('  3. Review largest files for optimization opportunities');
      process.exit(1);
    } else if (totalKB >= warnThreshold) {
      console.log(`WARN: Bundle size (${formatBytes(totalSize)}) approaching ${failThreshold} KB limit`);
      console.log();
      console.log('Consider optimizing before adding more features.');
      process.exit(0);
    } else {
      console.log(`OK: Bundle size (${formatBytes(totalSize)}) is within limits`);
      const headroom = failThreshold - totalKB;
      console.log(`  Headroom: ${headroom.toFixed(1)} KB`);
      process.exit(0);
    }

  } catch (error) {
    console.error('Error checking bundle size:', error.message);
    process.exit(1);
  }
}

main();
