#!/usr/bin/env node
/**
 * KV Import Script
 *
 * Imports KV data from an export file into the local E2E wrangler environment.
 * Uses wrangler's local persistence directory to seed the mock KV.
 *
 * Usage:
 *   npm run kv:import
 *   npm run kv:import -- --input ./my-export.json
 *
 * The data is written directly to wrangler's local KV persistence files.
 */

import fs from 'fs';
import path from 'path';

// Parse command line arguments
const args = process.argv.slice(2);
const inputIndex = args.indexOf('--input');
const inputPath = inputIndex !== -1 ? args[inputIndex + 1] : './e2e/fixtures/kv-export.json';

// Wrangler local persistence directory
// This is where wrangler stores local KV data when using --local flag
const WRANGLER_LOCAL_DIR = '.wrangler/state/v3/kv';
const E2E_NAMESPACE_ID = 'e2e-local-sessions';

console.log('🔄 Importing KV data to local E2E environment...\n');

try {
  // Step 1: Read export file
  if (!fs.existsSync(inputPath)) {
    console.error(`❌ Export file not found: ${inputPath}`);
    console.log('\n   Run "npm run kv:export" first to create an export file.');
    process.exit(1);
  }

  console.log(`📂 Reading export file: ${inputPath}`);
  const exportData = JSON.parse(fs.readFileSync(inputPath, 'utf-8'));

  console.log(`   Exported at: ${exportData.exportedAt}`);
  console.log(`   Source: ${exportData.sourceNamespaceTitle || exportData.sourceNamespace}`);
  console.log(`   Keys: ${exportData.keyCount}\n`);

  if (exportData.keyCount === 0) {
    console.log('⚠️  No data to import (empty export).');
    process.exit(0);
  }

  // Step 2: Create wrangler local KV directory structure
  const kvDir = path.join(process.cwd(), WRANGLER_LOCAL_DIR, E2E_NAMESPACE_ID);

  if (!fs.existsSync(kvDir)) {
    fs.mkdirSync(kvDir, { recursive: true });
    console.log(`📁 Created local KV directory: ${kvDir}`);
  }

  // Step 3: Write each key to the local KV store
  // Wrangler stores keys as files in the namespace directory
  console.log('📥 Importing keys...');

  let imported = 0;
  let skipped = 0;

  for (const [key, value] of Object.entries(exportData.data)) {
    const metadata = exportData.metadata?.[key];

    // Check if key has expired
    if (metadata?.expiration) {
      const expiryTime = metadata.expiration * 1000;
      if (expiryTime < Date.now()) {
        console.log(`   ⏭️  ${key} (expired, skipping)`);
        skipped++;
        continue;
      }
    }

    // Encode key for filesystem (replace problematic characters)
    const safeKey = encodeURIComponent(key);
    const keyPath = path.join(kvDir, safeKey);

    // Write value (as JSON string if object, otherwise as-is)
    const valueStr = typeof value === 'object' ? JSON.stringify(value) : String(value);
    fs.writeFileSync(keyPath, valueStr);

    // Write metadata if present
    if (metadata) {
      const metaPath = path.join(kvDir, `${safeKey}__meta`);
      fs.writeFileSync(metaPath, JSON.stringify(metadata));
    }

    console.log(`   ✓ ${key}`);
    imported++;
  }

  console.log(`\n✅ Import complete!`);
  console.log(`   Imported: ${imported} keys`);
  console.log(`   Skipped: ${skipped} keys (expired)`);
  console.log(`   Location: ${kvDir}`);

  // Step 4: Also update the E2E fixtures for MSW mock server
  const fixtureDir = path.join(process.cwd(), 'e2e', 'fixtures', 'test-data');
  const kvStatePath = path.join(fixtureDir, 'kv-state.json');

  if (!fs.existsSync(fixtureDir)) {
    fs.mkdirSync(fixtureDir, { recursive: true });
  }

  // Create a simplified state file for the mock server
  const mockState = {
    importedAt: new Date().toISOString(),
    sourceExport: inputPath,
    keys: {},
  };

  for (const [key, value] of Object.entries(exportData.data)) {
    const metadata = exportData.metadata?.[key];

    // Skip expired keys
    if (metadata?.expiration && metadata.expiration * 1000 < Date.now()) {
      continue;
    }

    mockState.keys[key] = {
      value,
      metadata: metadata || null,
    };
  }

  fs.writeFileSync(kvStatePath, JSON.stringify(mockState, null, 2));
  console.log(`\n📋 Mock server state updated: ${kvStatePath}`);

} catch (err) {
  console.error('\n❌ Import failed:', err.message);
  console.error(err.stack);
  process.exit(1);
}
