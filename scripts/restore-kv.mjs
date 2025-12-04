#!/usr/bin/env node
/**
 * Cloudflare KV Restore Script
 *
 * Restores data from a backup JSON file to Cloudflare KV namespaces.
 *
 * Usage:
 *   node scripts/restore-kv.mjs <backup-file.json>
 *   node scripts/restore-kv.mjs                    # Uses latest backup
 *
 * Environment variables required:
 *   CLOUDFLARE_API_TOKEN - API token with KV write access
 *   CLOUDFLARE_ACCOUNT_ID - (optional, auto-detected if not provided)
 *
 * DANGER: This will overwrite existing data!
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import readline from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const BACKUP_DIR = path.join(__dirname, '..', 'backups');

if (!API_TOKEN) {
  console.error('❌ CLOUDFLARE_API_TOKEN environment variable is required');
  process.exit(1);
}

/**
 * Ask user for confirmation
 */
function confirm(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y');
    });
  });
}

/**
 * Fetch Cloudflare account ID if not provided
 */
async function getAccountId() {
  if (ACCOUNT_ID) {
    return ACCOUNT_ID;
  }

  console.log('🔍 Auto-detecting Cloudflare account ID...');
  const response = await fetch('https://api.cloudflare.com/client/v4/accounts', {
    headers: {
      'Authorization': `Bearer ${API_TOKEN}`,
      'Content-Type': 'application/json',
    },
  });

  const data = await response.json();
  if (!response.ok || !data.success) {
    throw new Error(`Failed to get account ID: ${JSON.stringify(data.errors)}`);
  }

  if (data.result.length === 0) {
    throw new Error('No accounts found for this API token');
  }

  const accountId = data.result[0].id;
  console.log(`✅ Account ID: ${accountId}`);
  return accountId;
}

/**
 * Write a key-value pair to KV
 */
async function putKVValue(accountId, namespaceId, key, value, metadata = null) {
  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/storage/kv/namespaces/${namespaceId}/values/${encodeURIComponent(key)}`;

  const body = new FormData();
  body.append('value', value);
  if (metadata) {
    body.append('metadata', JSON.stringify(metadata));
  }

  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${API_TOKEN}`,
    },
    body: body,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to put key "${key}": ${response.statusText} - ${error}`);
  }

  return true;
}

/**
 * Restore a namespace from backup
 */
async function restoreNamespace(accountId, namespaceData) {
  const { namespace, namespaceId, entries } = namespaceData;

  console.log(`\n📥 Restoring namespace: ${namespace} (${namespaceId})`);
  console.log(`   📊 Total entries: ${entries.length}`);

  let restored = 0;
  let failed = 0;

  for (const entry of entries) {
    try {
      await putKVValue(accountId, namespaceId, entry.key, entry.value, entry.metadata);
      restored++;
      if (restored % 100 === 0 || restored === entries.length) {
        console.log(`   📥 Progress: ${restored}/${entries.length}`);
      }
    } catch (error) {
      console.error(`   ❌ Failed to restore key "${entry.key}": ${error.message}`);
      failed++;
    }
  }

  console.log(`   ✅ Restored ${restored}/${entries.length} entries (${failed} failed)`);

  return { restored, failed };
}

/**
 * Main restore function
 */
async function main() {
  try {
    console.log('🔄 Starting Cloudflare KV restore...\n');

    // Determine backup file
    const backupFile = process.argv[2] || path.join(BACKUP_DIR, 'kv-backup-latest.json');

    if (!fs.existsSync(backupFile)) {
      console.error(`❌ Backup file not found: ${backupFile}`);
      process.exit(1);
    }

    // Load backup
    console.log(`📂 Loading backup from: ${backupFile}`);
    const backupData = JSON.parse(fs.readFileSync(backupFile, 'utf8'));

    console.log(`   Version: ${backupData.version}`);
    console.log(`   Timestamp: ${backupData.timestamp}`);
    console.log(`   Namespaces: ${backupData.namespaces.length}`);

    // Count total entries
    const totalEntries = backupData.namespaces.reduce((sum, ns) => sum + ns.entries.length, 0);
    console.log(`   Total entries: ${totalEntries}`);

    // Confirm with user
    console.log('\n⚠️  WARNING: This will overwrite existing data in the following namespaces:');
    backupData.namespaces.forEach(ns => {
      console.log(`   - ${ns.namespace} (${ns.entries.length} entries)`);
    });

    const confirmed = await confirm('\nDo you want to continue? (yes/no): ');
    if (!confirmed) {
      console.log('❌ Restore cancelled');
      process.exit(0);
    }

    // Get account ID
    const accountId = await getAccountId();

    // Restore each namespace
    const results = [];
    for (const namespaceData of backupData.namespaces) {
      const result = await restoreNamespace(accountId, namespaceData);
      results.push({ namespace: namespaceData.namespace, ...result });
    }

    // Summary
    console.log('\n📊 Restore Summary:');
    results.forEach(result => {
      console.log(`   ${result.namespace}: ${result.restored} restored, ${result.failed} failed`);
    });

    console.log('\n🎉 Restore completed!');
  } catch (error) {
    console.error('\n❌ Restore failed:', error.message);
    process.exit(1);
  }
}

main();
