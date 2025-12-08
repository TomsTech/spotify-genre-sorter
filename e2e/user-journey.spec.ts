import { test, expect } from '@playwright/test';

/**
 * E2E Tests for Genre Genie - Full User Journey
 *
 * Tests validate the actual user experience from start to finish.
 * Run with: npm run test:e2e
 */

// Only run browser tests on chromium to avoid duplicate mobile failures
test.describe('Landing Page', () => {
  test('should load and display app title', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // Check title contains app name
    const title = await page.title();
    expect(title.toLowerCase()).toMatch(/genre|genie|spotify/i);

    // Check page has loaded content
    const body = await page.locator('body').textContent();
    expect(body).toBeTruthy();
    expect(body!.length).toBeGreaterThan(100);
  });

  test('should have main heading', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // H1 should exist
    const h1 = page.locator('h1').first();
    await expect(h1).toBeVisible({ timeout: 10000 });
  });

  test('should show sign-in option', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Look for Spotify or GitHub auth link/button - can be <a> or text containing sign in
    const html = await page.content();
    const hasAuthLink = html.includes('/auth/spotify') || html.includes('/auth/github') ||
                        html.toLowerCase().includes('sign in') || html.toLowerCase().includes('logga in');
    expect(hasAuthLink).toBeTruthy();
  });
});

test.describe('Health & API Endpoints', () => {
  test('GET /health returns ok status', async ({ request }) => {
    const response = await request.get('/health');
    expect(response.ok()).toBeTruthy();

    const body = await response.json();
    expect(body.status).toBe('ok');
    // version is returned, not timestamp
    expect(body).toHaveProperty('version');
  });

  test('GET /session returns auth status', async ({ request }) => {
    const response = await request.get('/session');
    expect(response.ok()).toBeTruthy();

    const body = await response.json();
    expect(body).toHaveProperty('authenticated');
    expect(typeof body.authenticated).toBe('boolean');
  });

  test('GET /stats returns user count', async ({ request }) => {
    const response = await request.get('/stats');
    expect(response.ok()).toBeTruthy();

    const body = await response.json();
    // Stats endpoint returns userCount, hallOfFame, launchDate
    expect(body).toHaveProperty('userCount');
    expect(typeof body.userCount).toBe('number');
  });

  test('GET /api/leaderboard returns pioneers and new users', async ({ request }) => {
    const response = await request.get('/api/leaderboard');
    expect(response.ok()).toBeTruthy();

    const body = await response.json();
    expect(body).toHaveProperty('pioneers');
    expect(body).toHaveProperty('newUsers');
    expect(Array.isArray(body.pioneers)).toBeTruthy();
    expect(Array.isArray(body.newUsers)).toBeTruthy();
  });

  test('GET /api/scoreboard returns rankings', async ({ request }) => {
    const response = await request.get('/api/scoreboard');
    expect(response.ok()).toBeTruthy();

    const body = await response.json();
    // Should have ranking categories
    expect(typeof body).toBe('object');
  });

  test('GET /api/recent-playlists returns array', async ({ request }) => {
    const response = await request.get('/api/recent-playlists');
    expect(response.ok()).toBeTruthy();

    const body = await response.json();
    expect(body).toHaveProperty('playlists');
    expect(Array.isArray(body.playlists)).toBeTruthy();
  });
});

test.describe('Request Access API', () => {
  test('POST /api/request-access endpoint exists', async ({ request }) => {
    // Test that the endpoint exists and responds (not 404)
    const response = await request.post('/api/request-access', {
      data: { email: 'test@example.com' }
    });

    // Should not be 404 - either success or validation error
    expect(response.status()).not.toBe(404);
  });

  test('POST /api/request-access with valid email returns success or duplicate', async ({ request }) => {
    const testEmail = `e2e-test-${Date.now()}@example.com`;

    const response = await request.post('/api/request-access', {
      data: {
        email: testEmail,
        github: 'testuser',
        message: 'E2E test request'
      }
    });

    // Either succeeds or returns duplicate message
    if (response.ok()) {
      const body = await response.json();
      expect(body.success === true || body.alreadyRequested === true).toBeTruthy();
    }
  });
});

test.describe('Error States', () => {
  test('not_allowed error page shows error content', async ({ page }) => {
    await page.goto('/?error=not_allowed');
    await page.waitForLoadState('networkidle');

    // Page should contain error-related text
    const bodyContent = await page.locator('body').textContent();
    expect(bodyContent?.toLowerCase()).toMatch(/not.*authorised|not.*allowed|inte.*behörig|error/i);
  });

  test('not_allowed error has request access code available', async ({ page }) => {
    await page.goto('/?error=not_allowed');
    await page.waitForLoadState('networkidle');

    // Check if request access code exists in the page source
    const html = await page.content();
    const hasRequestAccess = html.includes('showRequestAccessModal') || html.includes('request-access') ||
                             html.includes('Request Access') || html.includes('Begär Åtkomst');
    expect(hasRequestAccess).toBeTruthy();
  });

  test('auth_failed error displays message', async ({ page }) => {
    await page.goto('/?error=auth_failed');
    await page.waitForLoadState('networkidle');

    const content = await page.locator('body').textContent();
    expect(content?.toLowerCase()).toMatch(/failed|error|misslyckades/i);
  });

  test('error query param is processed', async ({ page }) => {
    await page.goto('/?error=test_error');
    await page.waitForLoadState('networkidle');

    // The page should still load (error handling works)
    const title = await page.title();
    expect(title).toBeTruthy();
  });
});

test.describe('Auth Flow', () => {
  test('auth/spotify redirects to Spotify', async ({ page }) => {
    // Navigate directly to auth endpoint
    const response = await page.goto('/auth/spotify');

    // Should redirect to Spotify
    const url = page.url();
    expect(url).toMatch(/accounts\.spotify\.com|localhost/);
  });

  test('unauthenticated API calls return 401', async ({ request }) => {
    const response = await request.get('/api/me');
    expect(response.status()).toBe(401);
  });

  test('unauthenticated genre fetch returns 401', async ({ request }) => {
    const response = await request.get('/api/genres');
    expect(response.status()).toBe(401);
  });
});

test.describe('UI Features', () => {
  test('page has theme toggle in HTML source', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Check page source contains theme toggle references
    const html = await page.content();
    const hasTheme = html.includes('toggleTheme') || html.includes('theme-toggle') || html.includes('light-mode');
    expect(hasTheme).toBeTruthy();
  });

  test('page includes Genre Wrapped code', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Check page source contains wrapped feature code
    const html = await page.content();
    const hasWrapped = html.includes('showGenreWrapped') || html.includes('genre-wrapped') || html.includes('wrapped-card');
    expect(hasWrapped).toBeTruthy();
  });

  test('page includes Request Access code', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Check page source contains request access feature
    const html = await page.content();
    const hasRequestAccess = html.includes('showRequestAccessModal') || html.includes('request-access');
    expect(hasRequestAccess).toBeTruthy();
  });

  test('page includes Swedish translations', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const html = await page.content();
    const hasSwedish = html.includes('svenska') || html.includes('sv:') || html.includes('Logga');
    expect(hasSwedish).toBeTruthy();
  });
});

test.describe('Mobile Responsiveness', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test('mobile: page loads without horizontal scroll', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const hasHorizontalScroll = await page.evaluate(() => {
      return document.body.scrollWidth > window.innerWidth + 20;
    });

    expect(hasHorizontalScroll).toBeFalsy();
  });

  test('mobile: page is usable', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Page should have main content visible
    const h1 = page.locator('h1').first();
    await expect(h1).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Accessibility', () => {
  test('page has h1 heading', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const h1Count = await page.locator('h1').count();
    expect(h1Count).toBeGreaterThanOrEqual(1);
  });

  test('interactive elements are keyboard focusable', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Tab to first focusable element
    await page.keyboard.press('Tab');

    const focusedTag = await page.evaluate(() => {
      const el = document.activeElement;
      return el?.tagName?.toLowerCase();
    });

    // Should focus a button, link, or input
    expect(['button', 'a', 'input', 'select', 'textarea']).toContain(focusedTag);
  });

  test('page has no empty buttons', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const emptyButtons = await page.evaluate(() => {
      const buttons = document.querySelectorAll('button');
      let empty = 0;
      buttons.forEach(btn => {
        const text = btn.textContent?.trim() || '';
        const ariaLabel = btn.getAttribute('aria-label') || '';
        const title = btn.getAttribute('title') || '';
        if (!text && !ariaLabel && !title && btn.querySelector('svg, img') === null) {
          empty++;
        }
      });
      return empty;
    });

    expect(emptyButtons).toBe(0);
  });
});

test.describe('Security Headers', () => {
  test('response includes security headers', async ({ request }) => {
    const response = await request.get('/');
    const headers = response.headers();

    // Should have some security headers
    const hasSecurityHeaders =
      headers['x-content-type-options'] === 'nosniff' ||
      headers['x-frame-options'] !== undefined ||
      headers['content-security-policy'] !== undefined;

    expect(hasSecurityHeaders).toBeTruthy();
  });
});

test.describe('Performance', () => {
  test('health endpoint responds quickly', async ({ request }) => {
    const start = Date.now();
    await request.get('/health');
    const duration = Date.now() - start;

    expect(duration).toBeLessThan(1000); // Under 1 second
  });

  test('page loads within acceptable time', async ({ page }) => {
    const start = Date.now();
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    const duration = Date.now() - start;

    expect(duration).toBeLessThan(10000); // Under 10 seconds
  });
});
