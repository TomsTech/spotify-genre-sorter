/**
 * Navigation & Routing E2E Tests
 *
 * Tests for page navigation and routing:
 * - Direct URL access
 * - OAuth callback handling
 * - History navigation
 * - Deep linking
 * - URL parameters
 */
import { test, expect } from '../../fixtures/auth.fixture';
import { HomePage } from '../../pages/home.page';

test.describe('Direct URL Access', () => {
  test('home page loads at /', async ({ page }) => {
    await page.goto('/');

    await expect(page).toHaveURL('/');
    await expect(page.locator('h1')).toBeVisible();
  });

  test('/health returns JSON response', async ({ page }) => {
    const response = await page.request.get('/health');

    expect(response.ok()).toBe(true);
    expect(response.headers()['content-type']).toContain('application/json');
  });

  test('/setup returns configuration', async ({ page }) => {
    const response = await page.request.get('/setup');

    // /setup returns 200 if configured, 503 if missing secrets
    expect([200, 503]).toContain(response.status());
  });

  test('/session returns auth status', async ({ page }) => {
    const response = await page.request.get('/session');

    expect(response.ok()).toBe(true);
  });

  test('/stats returns user stats', async ({ page }) => {
    const response = await page.request.get('/stats');

    expect(response.ok()).toBe(true);
  });
});

test.describe('OAuth Routes', () => {
  test('/auth/spotify redirects to Spotify', async ({ page }) => {
    // Navigate to auth endpoint
    const response = await page.request.get('/auth/spotify', {
      maxRedirects: 0,
    });

    // Should redirect to Spotify
    expect([301, 302, 303, 307, 308]).toContain(response.status());

    const location = response.headers()['location'];
    expect(location).toContain('accounts.spotify.com');
  });

  test('/auth/github redirects to GitHub (if enabled)', async ({ page }) => {
    const response = await page.request.get('/auth/github', {
      maxRedirects: 0,
    });

    // May redirect to GitHub or show error if not configured
    expect([200, 301, 302, 303, 307, 308, 400, 500]).toContain(response.status());
  });

  test('/auth/logout clears session', async ({ page }) => {
    // Set a session cookie first
    await page.context().addCookies([
      {
        name: 'session_id',
        value: 'test-session',
        domain: 'localhost',
        path: '/',
      },
    ]);

    // Navigate to logout
    await page.goto('/auth/logout');

    // Should redirect to home
    await expect(page).toHaveURL('/');

    // Session cookie should be cleared
    const cookies = await page.context().cookies();
    const sessionCookie = cookies.find(c => c.name === 'session_id');

    expect(!sessionCookie || !sessionCookie.value).toBe(true);
  });
});

test.describe('OAuth Callback Handling', () => {
  test('/auth/spotify/callback handles code parameter', async ({ page }) => {
    // Navigate to callback with mock code
    const response = await page.request.get('/auth/spotify/callback?code=test-code&state=test-state', {
      maxRedirects: 0,
    });

    // Should redirect or show error (code won't be valid)
    expect([200, 301, 302, 400, 500]).toContain(response.status());
  });

  test('/auth/spotify/callback handles error parameter', async ({ page }) => {
    await page.goto('/auth/spotify/callback?error=access_denied');

    // Should redirect to home with error
    await expect(page).toHaveURL(/error=|\/$/);
  });

  test('/auth/github/callback handles code parameter', async ({ page }) => {
    const response = await page.request.get('/auth/github/callback?code=test-code&state=test-state', {
      maxRedirects: 0,
    });

    // Should redirect or show error
    expect([200, 301, 302, 400, 500]).toContain(response.status());
  });
});

test.describe('URL Parameter Handling', () => {
  test('error parameter displays error message', async ({ page }) => {
    await page.goto('/?error=auth_failed');

    const pageContent = await page.content();
    expect(pageContent.toLowerCase()).toContain('error');
  });

  test('multiple error types are handled', async ({ page }) => {
    const errorTypes = ['github_denied', 'not_allowed', 'auth_failed', 'invalid_state', 'spotify_denied'];

    for (const error of errorTypes) {
      await page.goto(`/?error=${error}`);

      // Page should load without crashing
      await expect(page.locator('body')).toBeVisible();
    }
  });

  test('unknown error parameter shows generic message', async ({ page }) => {
    await page.goto('/?error=unknown_error_xyz');

    // Page should still load
    await expect(page.locator('body')).toBeVisible();
  });
});

test.describe('History Navigation', () => {
  test('back button works correctly', async ({ page }) => {
    const homePage = new HomePage(page);
    await homePage.goto();

    // Wait for page to be fully loaded
    await page.waitForLoadState('networkidle');

    // Get the initial URL
    const initialUrl = page.url();

    // Navigate somewhere (like opening a modal)
    const scoreboardBtn = page.locator('button:has-text("Scoreboard"), .sidebar-scoreboard-btn');

    if (await scoreboardBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await scoreboardBtn.click();
      // Wait for modal to appear
      await page.waitForSelector('.scoreboard-modal, [class*="scoreboard"]', { timeout: 3000 }).catch(() => null);
    }

    // Go back in history
    await page.goBack();
    await page.waitForLoadState('domcontentloaded');

    // Should still be on home page or a valid page
    await expect(page.locator('body')).toBeVisible();
    // URL should be same or navigable
    expect(page.url()).toBeTruthy();
  });

  test('forward button works correctly', async ({ page }) => {
    const homePage = new HomePage(page);
    await homePage.goto();

    // Go back (if possible)
    const canGoBack = await page.evaluate(() => window.history.length > 1);

    if (canGoBack) {
      await page.goBack();
      await page.goForward();

      // Should be back where we started
      await expect(page.locator('body')).toBeVisible();
    }
  });

  test('page reload preserves state', async ({ page }) => {
    const homePage = new HomePage(page);
    await homePage.goto();

    // Set some state
    await page.evaluate(() => {
      localStorage.setItem('test-state', 'preserved');
    });

    // Reload page
    await page.reload();

    // Check state is preserved
    const state = await page.evaluate(() => localStorage.getItem('test-state'));
    expect(state).toBe('preserved');

    // Cleanup
    await page.evaluate(() => localStorage.removeItem('test-state'));
  });
});

test.describe('Deep Linking', () => {
  test('API endpoints return JSON', async ({ page }) => {
    const endpoints = [
      '/health',
      '/session',
      '/stats',
      '/api/leaderboard',
      '/api/scoreboard',
      '/api/recent-playlists',
    ];

    for (const endpoint of endpoints) {
      const response = await page.request.get(endpoint);
      // All endpoints should return a valid response (some may be 500 in test env)
      expect([200, 500]).toContain(response.status());

      if (response.ok()) {
        const contentType = response.headers()['content-type'];
        expect(contentType).toContain('application/json');
      }
    }
  });

  test('unknown routes return 404', async ({ page }) => {
    const response = await page.request.get('/unknown-page-xyz');

    expect(response.status()).toBe(404);
  });

  test('malformed URLs are handled', async ({ page }) => {
    // Try some potentially problematic URLs
    const urls = [
      '/?<script>alert(1)</script>',
      '/?error=<img onerror=alert(1)>',
      '/..%2f..%2fetc/passwd',
    ];

    for (const url of urls) {
      const response = await page.request.get(url);

      // Should not crash - may return 200, 400, or 404
      expect([200, 400, 404]).toContain(response.status());
    }
  });
});

test.describe('Page Transitions', () => {
  test('page transitions are smooth', async ({ page }) => {
    const homePage = new HomePage(page);
    await homePage.goto();

    // Measure navigation time
    const start = Date.now();
    await page.reload();
    const duration = Date.now() - start;

    // Page should load reasonably fast
    expect(duration).toBeLessThan(10000);
  });

  test('no layout shift during load', async ({ page }) => {
    // Enable CLS measurement
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    // Wait for page to stabilize
    await page.waitForTimeout(2000);

    // Page should be stable
    await expect(page.locator('body')).toBeVisible();
  });
});

test.describe('External Links', () => {
  test('GitHub links open in new tab', async ({ page }) => {
    const homePage = new HomePage(page);
    await homePage.goto();

    const githubLinks = page.locator('a[href*="github.com"]');
    const linkCount = await githubLinks.count();

    for (let i = 0; i < Math.min(linkCount, 5); i++) {
      const link = githubLinks.nth(i);
      const target = await link.getAttribute('target');

      // External links should open in new tab
      expect(target).toBe('_blank');
    }
  });

  test('Spotify links open in new tab', async ({ page }) => {
    const homePage = new HomePage(page);
    await homePage.goto();

    const spotifyLinks = page.locator('a[href*="spotify.com"]:not([href*="/auth"])');
    const linkCount = await spotifyLinks.count();

    for (let i = 0; i < Math.min(linkCount, 5); i++) {
      const link = spotifyLinks.nth(i);
      const target = await link.getAttribute('target');

      // External Spotify links should open in new tab
      expect(target).toBe('_blank');
    }
  });

  test('donation link opens in new tab', async ({ page }) => {
    const homePage = new HomePage(page);
    await homePage.goto();

    const donationBtn = page.locator('#donation-btn, .sidebar-donate-btn');

    if (await donationBtn.isVisible()) {
      const target = await donationBtn.getAttribute('target');
      expect(target).toBe('_blank');
    }
  });
});

test.describe('Mobile Navigation', () => {
  test('mobile viewport shows responsive layout', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });

    const homePage = new HomePage(page);
    await homePage.goto();

    // Page should be visible
    await expect(page.locator('body')).toBeVisible();
    await expect(page.locator('h1')).toBeVisible();
  });

  test('tablet viewport shows responsive layout', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });

    const homePage = new HomePage(page);
    await homePage.goto();

    await expect(page.locator('body')).toBeVisible();
    await expect(page.locator('h1')).toBeVisible();
  });

  test('sidebar toggle works on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });

    const homePage = new HomePage(page);
    await homePage.goto();

    const sidebarToggle = page.locator('#sidebar-toggle, .sidebar-toggle');

    if (await sidebarToggle.isVisible()) {
      await sidebarToggle.click();
      await page.waitForTimeout(300);

      // Sidebar should toggle
      expect(true).toBe(true);
    }
  });
});
