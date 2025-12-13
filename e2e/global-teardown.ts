/**
 * Global Teardown for E2E Tests
 *
 * Runs once after all tests to:
 * - Stop the mock server
 * - Clean up test data
 * - Generate summary reports
 */
import { FullConfig } from '@playwright/test';
import { stopMockServer } from './mocks/mock-server';
import fs from 'fs';
import path from 'path';

async function globalTeardown(config: FullConfig): Promise<void> {
  console.log('\n🧹 E2E Global Teardown Starting...\n');

  // Stop MSW mock server
  if (process.env.E2E_USE_MOCKS !== 'false') {
    stopMockServer();
    console.log('✅ Mock server stopped');
  }

  // Clean up seed data file
  const seedFilePath = path.join(process.cwd(), 'e2e', '.seed-data.json');
  if (fs.existsSync(seedFilePath)) {
    fs.unlinkSync(seedFilePath);
    console.log('✅ Cleaned up seed data file');
  }

  // Optionally clean up local KV data (uncomment if you want fresh state each run)
  // const kvDataDir = path.join(process.cwd(), '.wrangler', 'state', 'v3', 'kv', 'e2e-local-sessions');
  // if (fs.existsSync(kvDataDir)) {
  //   fs.rmSync(kvDataDir, { recursive: true });
  //   console.log('✅ Cleaned up local KV data');
  // }

  console.log('\n✅ E2E Global Teardown Complete\n');
}

export default globalTeardown;
