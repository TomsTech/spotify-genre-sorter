#!/usr/bin/env node
/**
 * Build documentation PDFs from markdown files
 *
 * Usage:
 *   node scripts/build-docs.mjs        # Build all docs
 *   node scripts/build-docs.mjs --check # Check if PDFs are up to date
 */

import { execSync } from 'child_process';
import { readdirSync, statSync, existsSync } from 'fs';
import { join, basename } from 'path';

const DOCS_DIR = 'docs';
const CHECK_MODE = process.argv.includes('--check');

// Get all markdown files in docs/
const mdFiles = readdirSync(DOCS_DIR)
  .filter(f => f.endsWith('.md'))
  .map(f => join(DOCS_DIR, f));

if (mdFiles.length === 0) {
  console.log('No markdown files found in docs/');
  process.exit(0);
}

console.log(`Found ${mdFiles.length} markdown files\n`);

let needsRebuild = false;
let errors = 0;

for (const mdFile of mdFiles) {
  const pdfFile = mdFile.replace('.md', '.pdf');
  const mdName = basename(mdFile);
  const pdfName = basename(pdfFile);

  // Check if PDF exists and is newer than MD
  if (existsSync(pdfFile)) {
    const mdStat = statSync(mdFile);
    const pdfStat = statSync(pdfFile);

    if (pdfStat.mtime >= mdStat.mtime) {
      console.log(`✓ ${pdfName} is up to date`);
      continue;
    }
  }

  needsRebuild = true;

  if (CHECK_MODE) {
    console.log(`✗ ${pdfName} needs rebuild (${mdName} is newer)`);
    continue;
  }

  // Build the PDF
  console.log(`Building ${pdfName}...`);
  try {
    execSync(`npx md-to-pdf "${mdFile}"`, { stdio: 'inherit' });
    console.log(`✓ ${pdfName} created\n`);
  } catch (err) {
    console.error(`✗ Failed to build ${pdfName}`);
    errors++;
  }
}

if (CHECK_MODE && needsRebuild) {
  console.log('\nSome PDFs need rebuilding. Run: npm run docs:build');
  process.exit(1);
}

if (errors > 0) {
  console.error(`\n${errors} file(s) failed to build`);
  process.exit(1);
}

console.log('\nAll documentation PDFs are up to date');
