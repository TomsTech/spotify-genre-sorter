#!/usr/bin/env node
/**
 * Link/Image Validation Script
 * Extracts URLs from src/index.ts and validates they return 200 OK.
 * Used in CI to prevent broken images/links from being deployed.
 */

import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// Whitelist of URLs that may flake or are known to be rate-limited
const WHITELIST_FILE = join(ROOT, '.link-whitelist.json');
const SOURCE_FILE = join(ROOT, 'src', 'index.ts');

// Load whitelist
let whitelist = [];
if (existsSync(WHITELIST_FILE)) {
  try {
    whitelist = JSON.parse(readFileSync(WHITELIST_FILE, 'utf8'));
  } catch (e) {
    console.warn('Warning: Could not parse .link-whitelist.json');
  }
}

// Extract URLs from source file
function extractUrls(content) {
  const urlPattern = /https?:\/\/[^\s"'<>\\)]+/g;
  const matches = content.match(urlPattern) || [];

  // Dedupe and clean URLs
  const urls = [...new Set(matches)].map(url => {
    // Remove trailing punctuation that might have been captured
    return url.replace(/[,;:]+$/, '');
  });

  return urls;
}

// Check if URL is whitelisted
function isWhitelisted(url) {
  return whitelist.some(pattern => {
    if (pattern.includes('*')) {
      const regex = new RegExp(pattern.replace(/\*/g, '.*'));
      return regex.test(url);
    }
    return url.includes(pattern);
  });
}

// Validate a single URL
async function validateUrl(url) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; LinkValidator/1.0)'
      }
    });

    clearTimeout(timeout);

    return {
      url,
      status: response.status,
      ok: response.ok,
      whitelisted: false
    };
  } catch (error) {
    return {
      url,
      status: 0,
      ok: false,
      error: error.message,
      whitelisted: false
    };
  }
}

// Main validation
async function main() {
  console.log('🔗 Link/Image Validation');
  console.log('========================\n');

  if (!existsSync(SOURCE_FILE)) {
    console.error(`Error: ${SOURCE_FILE} not found`);
    process.exit(1);
  }

  const content = readFileSync(SOURCE_FILE, 'utf8');
  const urls = extractUrls(content);

  console.log(`Found ${urls.length} unique URLs\n`);

  const results = [];
  let criticalFailures = 0;

  for (const url of urls) {
    // Skip API endpoints - they're not static resources
    // Use proper URL parsing to prevent bypass via query strings or subdomains
    let hostname;
    try {
      hostname = new URL(url).hostname;
    } catch {
      // Invalid URL, will be caught by validation
      hostname = '';
    }

    const apiHosts = ['api.spotify.com', 'api.github.com', 'accounts.spotify.com'];
    if (apiHosts.includes(hostname)) {
      console.log(`⏭️  Skip (API): ${url}`);
      continue;
    }

    // Check whitelist
    if (isWhitelisted(url)) {
      console.log(`⚪ Skip (Whitelist): ${url}`);
      results.push({ url, whitelisted: true, ok: true });
      continue;
    }

    const result = await validateUrl(url);
    results.push(result);

    if (result.ok) {
      console.log(`✅ ${result.status}: ${url}`);
    } else if (result.error) {
      console.log(`❌ Error: ${url} - ${result.error}`);
      criticalFailures++;
    } else {
      console.log(`❌ ${result.status}: ${url}`);
      criticalFailures++;
    }
  }

  console.log('\n========================');
  console.log('Summary:');
  console.log(`  Total URLs: ${urls.length}`);
  console.log(`  Validated: ${results.filter(r => r.ok && !r.whitelisted).length}`);
  console.log(`  Whitelisted: ${results.filter(r => r.whitelisted).length}`);
  console.log(`  Failed: ${criticalFailures}`);

  if (criticalFailures > 0) {
    console.log('\n❌ Validation FAILED - broken links detected');
    process.exit(1);
  }

  console.log('\n✅ Validation PASSED - all links valid');
  process.exit(0);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
