import { defineConfig, devices } from '@playwright/test';
import path from 'path';
import os from 'os';

const IS_CI = !!process.env.CI;
const USE_MOCKS = process.env.E2E_USE_MOCKS !== 'false';

// Detect available CPUs and scale workers accordingly
// Use fewer workers locally to avoid overwhelming the dev server
const CPU_COUNT = os.cpus().length;
const LOCAL_WORKERS = Math.max(2, Math.floor(CPU_COUNT / 2)); // Half of CPUs, min 2

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
  // Retry once locally for timeout/load issues, twice in CI
  retries: IS_CI ? 2 : 1,
  // Scale workers: 1 in CI, half of CPUs locally (configurable via env)
  workers: process.env.E2E_WORKERS ? parseInt(process.env.E2E_WORKERS) : (IS_CI ? 1 : LOCAL_WORKERS),

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

  // Test timeout
  timeout: 60000,

  // Expect timeout
  expect: {
    timeout: 10000,
  },

  projects: [
    // Main browser tests
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },

    // Mobile tests (for responsive UI testing)
    {
      name: 'mobile',
      use: { ...devices['iPhone 13'] },
      testMatch: /ui\/.*\.spec\.ts/,
    },

    // Firefox (optional, for cross-browser testing)
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
      testIgnore: /progressive-scan\.spec\.ts/, // Skip slow tests
    },
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
