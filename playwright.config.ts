import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E Test Configuration for Genre Genie
 *
 * Run tests with:
 *   npm run test:e2e           - Run all E2E tests
 *   npm run test:e2e:ui        - Run with UI mode
 *   npm run test:e2e:headed    - Run in headed browser
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html', { outputFolder: 'e2e-report' }],
    ['list']
  ],
  use: {
    // Base URL - defaults to local dev server, can override with E2E_BASE_URL
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:8787',

    // Capture traces on first retry
    trace: 'on-first-retry',

    // Screenshot on failure
    screenshot: 'only-on-failure',

    // Video on failure
    video: 'retain-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // Start local dev server before running tests (if not testing production)
  webServer: process.env.E2E_BASE_URL ? undefined : {
    command: 'npm run dev',
    url: 'http://localhost:8787',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
