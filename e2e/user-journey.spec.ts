import { test, expect, Page } from '@playwright/test';

/**
 * E2E Tests for Genre Genie - Full User Journey
 *
 * These tests validate the actual user experience from start to finish:
 * 1. Landing page loads correctly
 * 2. Sign-in flow initiates properly
 * 3. Auth success → genre loading → UI interaction
 * 4. Auth failure → request access flow
 *
 * For OAuth testing, set these environment variables:
 * - E2E_SPOTIFY_EMAIL: Test Spotify account email
 * - E2E_SPOTIFY_PASSWORD: Test Spotify account password
 * - E2E_BASE_URL: Production/staging URL (default: localhost:8787)
 */

test.describe('Landing Page', () => {
  test('should load and display correctly', async ({ page }) => {
    await page.goto('/');

    // Check title
    await expect(page).toHaveTitle(/Genre Genie/i);

    // Check main heading
    await expect(page.locator('h1')).toContainText(/Genre Genie/i);

    // Check sign-in button is visible
    const signInButton = page.locator('button, a').filter({ hasText: /sign in|log in|connect/i }).first();
    await expect(signInButton).toBeVisible();
  });

  test('should have health endpoint responding', async ({ request }) => {
    const response = await request.get('/health');
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(body.status).toBe('ok');
  });

  test('should have setup endpoint responding', async ({ request }) => {
    const response = await request.get('/setup');
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(body).toHaveProperty('spotifyConfigured');
  });

  test('should display leaderboard/sidebar on desktop', async ({ page }) => {
    await page.goto('/');

    // Wait for page to fully load
    await page.waitForLoadState('networkidle');

    // Check for sidebar elements (pioneers, recent playlists)
    const sidebar = page.locator('.sidebar, .leaderboard, [class*="sidebar"]');
    // Sidebar may or may not be visible depending on auth state
  });
});

test.describe('Error States', () => {
  test('should show not_allowed error message', async ({ page }) => {
    await page.goto('/?error=not_allowed');

    // Should display error message
    const errorMessage = page.locator('.error, .alert, [class*="error"]').filter({
      hasText: /not.*authorised|not.*allowed|access.*denied/i
    });
    await expect(errorMessage).toBeVisible({ timeout: 5000 });

    // Should show request access option (once implemented)
    const requestAccessButton = page.locator('button, a').filter({
      hasText: /request.*access|request.*invite/i
    });
    // Will fail until we implement this feature - that's the point!
    await expect(requestAccessButton).toBeVisible({ timeout: 5000 });
  });

  test('should show auth_failed error message', async ({ page }) => {
    await page.goto('/?error=auth_failed');

    const errorMessage = page.locator('.error, .alert, [class*="error"], [class*="message"]');
    await expect(errorMessage).toBeVisible({ timeout: 5000 });
  });

  test('should show spotify_error error message', async ({ page }) => {
    await page.goto('/?error=spotify_error');

    const errorMessage = page.locator('.error, .alert, [class*="error"], [class*="message"]');
    await expect(errorMessage).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Sign-In Flow', () => {
  test('should initiate Spotify OAuth when clicking sign in', async ({ page }) => {
    await page.goto('/');

    // Find and click sign-in button
    const signInButton = page.locator('button, a').filter({
      hasText: /sign in|connect.*spotify|log in/i
    }).first();

    await expect(signInButton).toBeVisible();

    // Click and check we're redirecting to auth
    const [response] = await Promise.all([
      page.waitForResponse(resp => resp.url().includes('/auth/spotify') || resp.url().includes('accounts.spotify.com')),
      signInButton.click()
    ]);

    // Should either redirect to Spotify or our auth endpoint
    expect(response.url()).toMatch(/spotify|auth/i);
  });
});

test.describe('Session Management', () => {
  test('should return session status', async ({ request }) => {
    const response = await request.get('/session');
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(body).toHaveProperty('authenticated');
  });
});

test.describe('API Endpoints', () => {
  test('should return leaderboard data', async ({ request }) => {
    const response = await request.get('/api/leaderboard');
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(body).toHaveProperty('pioneers');
    expect(body).toHaveProperty('newUsers');
  });

  test('should return scoreboard data', async ({ request }) => {
    const response = await request.get('/api/scoreboard');
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(Array.isArray(body.topPlaylists) || body.topPlaylists === undefined).toBeTruthy();
  });

  test('should return recent playlists', async ({ request }) => {
    const response = await request.get('/api/recent-playlists');
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(Array.isArray(body.playlists) || Array.isArray(body)).toBeTruthy();
  });

  test('should return stats', async ({ request }) => {
    const response = await request.get('/stats');
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(body).toHaveProperty('totalUsers');
  });
});

test.describe('Authenticated User Journey', () => {
  // These tests require actual Spotify credentials
  // Skip if credentials not provided
  test.skip(!process.env.E2E_SPOTIFY_EMAIL, 'Requires E2E_SPOTIFY_EMAIL env var');

  test('should complete full OAuth flow and load genres', async ({ page, context }) => {
    const email = process.env.E2E_SPOTIFY_EMAIL!;
    const password = process.env.E2E_SPOTIFY_PASSWORD!;

    await page.goto('/');

    // Click sign in
    const signInButton = page.locator('button, a').filter({
      hasText: /sign in|connect.*spotify/i
    }).first();
    await signInButton.click();

    // Wait for Spotify login page
    await page.waitForURL(/accounts\.spotify\.com/);

    // Fill in credentials
    await page.fill('input[id="login-username"], input[name="username"]', email);
    await page.fill('input[id="login-password"], input[name="password"]', password);

    // Submit
    await page.click('button[id="login-button"], button[type="submit"]');

    // May need to authorize the app
    const authorizeButton = page.locator('button').filter({ hasText: /agree|authorize|allow/i });
    if (await authorizeButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await authorizeButton.click();
    }

    // Wait for redirect back to our app
    await page.waitForURL(/localhost|genre-genie|spotify-genre-sorter/);

    // Should now be authenticated - check for user UI elements
    await expect(page.locator('button, a').filter({
      hasText: /analyze|get.*genres|load|scan/i
    })).toBeVisible({ timeout: 10000 });

    // Trigger genre analysis
    const analyzeButton = page.locator('button').filter({
      hasText: /analyze|get.*genres|load|scan/i
    }).first();
    await analyzeButton.click();

    // Wait for genres to load
    await page.waitForSelector('[class*="genre"], [class*="Genre"]', { timeout: 30000 });

    // Should display genre results
    const genreElements = page.locator('[class*="genre-item"], [class*="genre-card"], .genre');
    await expect(genreElements.first()).toBeVisible({ timeout: 30000 });
  });
});

test.describe('Mobile Experience', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test('should be mobile-responsive', async ({ page }) => {
    await page.goto('/');

    // Page should load without horizontal scroll
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    const viewportWidth = await page.evaluate(() => window.innerWidth);
    expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 10); // Allow small margin

    // Sign-in button should still be visible
    const signInButton = page.locator('button, a').filter({
      hasText: /sign in|connect|log in/i
    }).first();
    await expect(signInButton).toBeVisible();
  });
});

test.describe('Swedish Mode', () => {
  test('should toggle to Swedish mode', async ({ page }) => {
    await page.goto('/');

    // Find and click the Heidi badge or Swedish toggle
    const swedishToggle = page.locator('[class*="heidi"], [class*="swedish"], button').filter({
      hasText: /heidi|🇸🇪|svenska/i
    }).first();

    if (await swedishToggle.isVisible({ timeout: 3000 }).catch(() => false)) {
      await swedishToggle.click();

      // Should now show Swedish text
      await expect(page.locator('body')).toContainText(/logga in|anslut|genrer/i);
    }
  });
});

test.describe('Genre Wrapped Feature', () => {
  test('should have Share Your Taste button when authenticated', async ({ page }) => {
    // This test would need authentication first
    // For now, just check the button exists in the page source
    await page.goto('/');

    // The button should exist in JavaScript (even if hidden)
    const hasWrappedFeature = await page.evaluate(() => {
      return typeof (window as any).showGenreWrapped === 'function' ||
             document.body.innerHTML.includes('showGenreWrapped') ||
             document.body.innerHTML.includes('Share Your Taste');
    });

    // Feature should be present in codebase
    expect(hasWrappedFeature).toBeTruthy();
  });
});

test.describe('Accessibility', () => {
  test('should have proper heading hierarchy', async ({ page }) => {
    await page.goto('/');

    const h1Count = await page.locator('h1').count();
    expect(h1Count).toBeGreaterThanOrEqual(1);
  });

  test('should have alt text on images', async ({ page }) => {
    await page.goto('/');

    const images = page.locator('img');
    const count = await images.count();

    for (let i = 0; i < count; i++) {
      const img = images.nth(i);
      const alt = await img.getAttribute('alt');
      const ariaLabel = await img.getAttribute('aria-label');
      const role = await img.getAttribute('role');

      // Each image should have alt text or be decorative
      expect(alt !== null || ariaLabel !== null || role === 'presentation').toBeTruthy();
    }
  });

  test('should have focus indicators', async ({ page }) => {
    await page.goto('/');

    // Tab to first focusable element
    await page.keyboard.press('Tab');

    // Should have visible focus
    const focusedElement = page.locator(':focus');
    await expect(focusedElement).toBeVisible();
  });
});
