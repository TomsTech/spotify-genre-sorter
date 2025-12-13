#!/usr/bin/env node
/**
 * KV Export Script
 *
 * Exports all data from the production Cloudflare KV namespace to a JSON file.
 * This can then be imported into the E2E local environment for testing.
 *
 * Usage:
 *   npm run kv:export
 *   npm run kv:export -- --output ./my-export.json
 *
 * Requires: wrangler authenticated with Cloudflare
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

// Production KV namespace ID from wrangler.toml
const PRODUCTION_NAMESPACE_ID = 'd6874dfad2c344c9a9b8518601ae46ac';

// Parse command line arguments
const args = process.argv.slice(2);
const outputIndex = args.indexOf('--output');
const outputPath = outputIndex !== -1 ? args[outputIndex + 1] : './e2e/fixtures/kv-export.json';

console.log('🔄 Exporting KV data from production...\n');

try {
  // Step 1: List all keys
  console.log('📋 Listing all keys...');
  const keysRaw = execSync(
    `npx wrangler kv key list --namespace-id=${PRODUCTION_NAMESPACE_ID}`,
    { encoding: 'utf-8', maxBuffer: 50 * 1024 * 1024 } // 50MB buffer for large exports
  );

  const keys = JSON.parse(keysRaw);
  console.log(`   Found ${keys.length} keys\n`);

  if (keys.length === 0) {
    console.log('⚠️  No keys found in production KV. Creating empty export.');
    const emptyExport = {
      exportedAt: new Date().toISOString(),
      sourceNamespace: PRODUCTION_NAMESPACE_ID,
      keyCount: 0,
      data: {},
    };
    fs.writeFileSync(outputPath, JSON.stringify(emptyExport, null, 2));
    console.log(`✅ Empty export saved to: ${outputPath}`);
    process.exit(0);
  }

  // Step 2: Fetch each key's value
  console.log('📥 Fetching values...');
  const data = {};
  const metadata = {};

  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    const keyName = key.name;

    process.stdout.write(`   [${i + 1}/${keys.length}] ${keyName}...`);

    try {
      const valueRaw = execSync(
        `npx wrangler kv key get --namespace-id=${PRODUCTION_NAMESPACE_ID} "${keyName}"`,
        { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 } // 10MB per value
      );

      // Try to parse as JSON, otherwise store as string
      try {
        data[keyName] = JSON.parse(valueRaw);
      } catch {
        data[keyName] = valueRaw;
      }

      // Store metadata (expiration if present)
      if (key.expiration) {
        metadata[keyName] = {
          expiration: key.expiration,
          expiresAt: new Date(key.expiration * 1000).toISOString(),
        };
      }

      console.log(' ✓');
    } catch (err) {
      console.log(' ✗ (failed to fetch)');
      console.error(`      Error: ${err.message}`);
    }
  }

  // Step 3: Create export object
  const exportData = {
    exportedAt: new Date().toISOString(),
    sourceNamespace: PRODUCTION_NAMESPACE_ID,
    sourceNamespaceTitle: 'spotify-genre-sorter-SESSIONS',
    keyCount: Object.keys(data).length,
    metadata,
    data,
  };

  // Step 4: Write to file
  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  fs.writeFileSync(outputPath, JSON.stringify(exportData, null, 2));

  console.log(`\n✅ Export complete!`);
  console.log(`   Keys exported: ${Object.keys(data).length}`);
  console.log(`   Output file: ${outputPath}`);
  console.log(`   File size: ${(fs.statSync(outputPath).size / 1024).toFixed(2)} KB`);

  // List key names for reference
  console.log('\n📋 Exported keys:');
  Object.keys(data).forEach((key) => {
    const meta = metadata[key];
    const expiry = meta ? ` (expires: ${meta.expiresAt})` : '';
    console.log(`   - ${key}${expiry}`);
  });

} catch (err) {
  console.error('\n❌ Export failed:', err.message);
  process.exit(1);
}
