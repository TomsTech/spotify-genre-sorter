import { test, expect } from '@playwright/test';

test.describe('Login Flow', () => {
  test('should show login page when not authenticated', async ({ page }) => {
    await page.goto('/');

    // Should show login button
    await expect(page.locator('text=Login with Spotify')).toBeVisible();
  });

  test('should have correct Spotify OAuth link', async ({ page }) => {
    await page.goto('/');

    // Find login button/link
    const loginLink = page.locator('a:has-text("Spotify")').first();
    const href = await loginLink.getAttribute('href');

    // Should point to auth endpoint
    expect(href).toContain('/auth/spotify');
  });

  test('should show header with app title', async ({ page }) => {
    await page.goto('/');

    // Check header exists
    await expect(page.locator('h1')).toBeVisible();
  });

  test('should have Heidi badge in footer', async ({ page }) => {
    await page.goto('/');

    // Check for Heidi dedication badge
    const heidiBadge = page.locator('text=For Heidi');
    await expect(heidiBadge).toBeVisible();
  });

  test('should redirect to Spotify auth when clicking login', async ({ page }) => {
    await page.goto('/');

    // Mock the navigation to avoid actually going to Spotify
    const [request] = await Promise.all([
      page.waitForRequest(req => req.url().includes('/auth/spotify')),
      page.locator('a:has-text("Spotify")').first().click(),
    ]);

    expect(request.url()).toContain('/auth/spotify');
  });
});

test.describe('Session Check', () => {
  test('should return session status from /session endpoint', async ({ request }) => {
    const response = await request.get('/session');
    expect(response.status()).toBe(200);

    const data = await response.json();
    expect(data).toHaveProperty('authenticated');
  });

  test('should return health status from /health endpoint', async ({ request }) => {
    const response = await request.get('/health');
    expect(response.status()).toBe(200);
  });
});
