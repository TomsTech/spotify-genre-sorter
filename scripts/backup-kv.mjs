#!/usr/bin/env node
/**
 * Cloudflare KV Backup Script
 *
 * Exports all data from Cloudflare KV namespaces to JSON files.
 * Can be run manually or via GitHub Actions on a schedule.
 *
 * Usage:
 *   node scripts/backup-kv.mjs
 *
 * Environment variables required:
 *   CLOUDFLARE_API_TOKEN - API token with KV read access
 *   CLOUDFLARE_ACCOUNT_ID - (optional, auto-detected if not provided)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const BACKUP_DIR = path.join(__dirname, '..', 'backups');

// KV namespace configuration (from wrangler.toml)
const SESSIONS_NAMESPACE_ID = 'd6874dfad2c344c9a9b8518601ae46ac'; // SESSIONS namespace from wrangler.toml

if (!API_TOKEN) {
  console.error('❌ CLOUDFLARE_API_TOKEN environment variable is required');
  process.exit(1);
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
 * List all keys in a KV namespace
 */
async function listKVKeys(accountId, namespaceId) {
  const allKeys = [];
  let cursor = null;

  do {
    const url = new URL(`https://api.cloudflare.com/client/v4/accounts/${accountId}/storage/kv/namespaces/${namespaceId}/keys`);
    if (cursor) {
      url.searchParams.set('cursor', cursor);
    }
    url.searchParams.set('limit', '1000'); // Max per request

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${API_TOKEN}`,
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();
    if (!response.ok || !data.success) {
      throw new Error(`Failed to list keys: ${JSON.stringify(data.errors)}`);
    }

    allKeys.push(...data.result);
    cursor = data.result_info?.cursor;
  } while (cursor);

  return allKeys;
}

/**
 * Get value for a specific key from KV
 */
async function getKVValue(accountId, namespaceId, key) {
  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/storage/kv/namespaces/${namespaceId}/values/${encodeURIComponent(key)}`;

  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${API_TOKEN}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to get value for key "${key}": ${response.statusText}`);
  }

  return await response.text();
}

/**
 * Backup a single KV namespace
 */
async function backupNamespace(accountId, namespaceId, namespaceName) {
  console.log(`\n📦 Backing up namespace: ${namespaceName} (${namespaceId})`);

  // List all keys
  console.log('   📋 Listing keys...');
  const keys = await listKVKeys(accountId, namespaceId);
  console.log(`   ✅ Found ${keys.length} keys`);

  if (keys.length === 0) {
    console.log('   ⚠️  No data to backup');
    return { namespace: namespaceName, keys: 0, entries: [] };
  }

  // Fetch all values
  console.log('   📥 Fetching values...');
  const entries = [];
  let progress = 0;

  for (const keyInfo of keys) {
    try {
      const value = await getKVValue(accountId, namespaceId, keyInfo.name);
      entries.push({
        key: keyInfo.name,
        value: value,
        metadata: keyInfo.metadata || null,
      });
      progress++;
      if (progress % 100 === 0 || progress === keys.length) {
        console.log(`   📥 Progress: ${progress}/${keys.length}`);
      }
    } catch (error) {
      console.error(`   ❌ Failed to fetch key "${keyInfo.name}": ${error.message}`);
    }
  }

  console.log(`   ✅ Backed up ${entries.length}/${keys.length} entries`);

  return {
    namespace: namespaceName,
    namespaceId: namespaceId,
    timestamp: new Date().toISOString(),
    keyCount: keys.length,
    entries: entries,
  };
}

/**
 * Main backup function
 */
async function main() {
  try {
    console.log('🚀 Starting Cloudflare KV backup...\n');

    // Get account ID
    const accountId = await getAccountId();

    // Create backup directory
    if (!fs.existsSync(BACKUP_DIR)) {
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }

    // Backup SESSIONS namespace
    const sessionsBackup = await backupNamespace(accountId, SESSIONS_NAMESPACE_ID, 'SESSIONS');

    // Create timestamped backup file
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
    const backupFilename = `kv-backup-${timestamp}.json`;
    const backupPath = path.join(BACKUP_DIR, backupFilename);

    const backupData = {
      version: '1.0',
      timestamp: new Date().toISOString(),
      accountId: accountId,
      namespaces: [sessionsBackup],
    };

    // Write backup file
    fs.writeFileSync(backupPath, JSON.stringify(backupData, null, 2));
    console.log(`\n✅ Backup saved to: ${backupPath}`);

    // Create latest symlink/copy
    const latestPath = path.join(BACKUP_DIR, 'kv-backup-latest.json');
    fs.copyFileSync(backupPath, latestPath);
    console.log(`✅ Latest backup: ${latestPath}`);

    // Summary
    console.log('\n📊 Backup Summary:');
    console.log(`   Total namespaces: 1`);
    console.log(`   Total keys: ${sessionsBackup.keyCount}`);
    console.log(`   Total entries backed up: ${sessionsBackup.entries.length}`);
    console.log(`   Backup size: ${(fs.statSync(backupPath).size / 1024).toFixed(2)} KB`);

    console.log('\n🎉 Backup completed successfully!');
  } catch (error) {
    console.error('\n❌ Backup failed:', error.message);
    process.exit(1);
  }
}

main();
