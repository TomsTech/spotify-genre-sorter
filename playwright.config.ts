import { defineConfig, devices } from '@playwright/test';
import path from 'path';
import os from 'os';

const IS_CI = !!process.env.CI;
const USE_MOCKS = process.env.E2E_USE_MOCKS !== 'false';

// Detect available CPUs and scale workers accordingly
// OPTIMIZED: Use more workers locally for faster test runs
const CPU_COUNT = os.cpus().length;
const LOCAL_WORKERS = Math.max(4, Math.min(CPU_COUNT - 2, 8)); // 4-8 workers locally

/**
 * Playwright E2E Test Configuration for Genre Genie
 *
 * Run tests with:
 *   npm run test:e2e           - Run all E2E tests with mocks
 *   npm run test:e2e:ui        - Run with UI mode
 *   npm run test:e2e:headed    - Run in headed browser
 *   npm run test:e2e:debug     - Debug mode
 *
 * Environment variables:
 *   E2E_BASE_URL       - Override base URL (default: http://localhost:8787)
 *   E2E_USE_MOCKS      - Set to 'false' to use real Spotify API
 *   E2E_WORKERS        - Override worker count
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: IS_CI,
  // OPTIMIZED: No retries locally (faster feedback), 2 in CI for stability
  retries: IS_CI ? 2 : 0,
  // OPTIMIZED: More workers locally, 2 in CI to avoid resource contention
  workers: process.env.E2E_WORKERS ? parseInt(process.env.E2E_WORKERS) : (IS_CI ? 2 : LOCAL_WORKERS),

  reporter: [
    ['html', { outputFolder: 'e2e-report', open: 'never' }],
    ['list'],
    ...(IS_CI ? [['github'] as const] : []),
  ],

  use: {
    // Base URL - defaults to local dev server
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:8787',

    // Capture traces on first retry
    trace: 'on-first-retry',

    // Screenshot on failure
    screenshot: 'only-on-failure',

    // Video on failure
    video: 'retain-on-failure',

    // Extended timeout for Cloudflare Workers cold start
    actionTimeout: 10000,
    navigationTimeout: 30000,
  },

  // OPTIMIZED: Reduced timeout from 60s to 45s
  timeout: 45000,

  // Expect timeout
  expect: {
    timeout: 10000,
  },

  projects: [
    // Main browser tests - always run
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },

    // OPTIMIZED: Mobile & Firefox only in CI for faster local runs
    // Mobile tests (for responsive UI testing)
    ...(IS_CI ? [{
      name: 'mobile',
      use: { ...devices['iPhone 13'] },
      testMatch: /ui\/.*\.spec\.ts/,
    }] : []),

    // Firefox (for cross-browser testing)
    ...(IS_CI ? [{
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
      testIgnore: /progressive-scan\.spec\.ts/, // Skip slow tests
    }] : []),
  ],

  // Start dev server before tests
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: USE_MOCKS
          ? 'npx wrangler dev --config wrangler.e2e.toml --local --port 8787'
          : 'npm run dev',
        url: 'http://localhost:8787/health',
        reuseExistingServer: !IS_CI,
        timeout: 120000,
        stdout: 'pipe',
        stderr: 'pipe',
      },

  // Global setup for seeding test data
  globalSetup: path.resolve('./e2e/global-setup.ts'),
  globalTeardown: path.resolve('./e2e/global-teardown.ts'),

  // Output directory for test artifacts
  outputDir: 'test-results',
});
