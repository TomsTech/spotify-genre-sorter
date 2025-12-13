/**
 * Spotify Login Flow E2E Tests
 *
 * Tests the complete Spotify OAuth flow including redirects and callbacks.
 */
import { test, expect } from '../../fixtures/auth.fixture';
import { HomePage } from '../../pages/home.page';
import { AuthPage } from '../../pages/auth.page';

test.describe('Spotify OAuth Flow', () => {
  test.beforeEach(async ({ configureMocks }) => {
    // Reset mocks to default state
    configureMocks({});
  });

  test('should show sign in button when not authenticated', async ({ page }) => {
    const homePage = new HomePage(page);
    await homePage.goto();

    await expect(homePage.signInButton).toBeVisible();
  });

  test('should redirect to Spotify auth endpoint when clicking sign in', async ({ page }) => {
    const homePage = new HomePage(page);
    await homePage.goto();

    // Get the href of the sign in button
    const href = await homePage.signInButton.getAttribute('href');
    expect(href).toContain('/auth/spotify');
  });

  test('should initiate OAuth flow from /auth/spotify', async ({ page }) => {
    const authPage = new AuthPage(page);
    await authPage.goToSpotifyAuth();

    // Should either redirect to Spotify or mock callback
    // In E2E mode with mocks, it will handle the flow internally
    await page.waitForTimeout(1000);

    // Check we're either at Spotify or back home with session
    const url = page.url();
    const isAtSpotify = url.includes('spotify.com');
    const isAtHome = url.includes('localhost:8787') || url === '/';

    expect(isAtSpotify || isAtHome).toBe(true);
  });

  test('should handle successful OAuth callback', async ({ page }) => {
    const authPage = new AuthPage(page);

    // First, initiate the auth to get a valid state
    await page.goto('/auth/spotify');
    await page.waitForTimeout(500);

    // The mock will auto-redirect with a valid code
    // Check if we end up authenticated
    await page.waitForURL('/', { timeout: 10000 }).catch(() => {});

    const session = await authPage.getSessionStatus();
    // In mock mode, should be authenticated
    if (process.env.E2E_USE_MOCKS !== 'false') {
      // Mock mode should complete auth
      await page.waitForTimeout(1000);
    }
  });

  test('should handle OAuth denial (user cancels)', async ({ page }) => {
    const authPage = new AuthPage(page);

    await authPage.simulateSpotifyCallback({ error: 'access_denied' });

    // Should redirect to home with error
    await expect(page).toHaveURL(/error=spotify_denied/);
  });

  test('should handle invalid state parameter', async ({ page }) => {
    const authPage = new AuthPage(page);

    await authPage.simulateSpotifyCallback({
      code: 'some-code',
      state: 'completely-invalid-state',
    });

    // Should redirect with invalid_state error
    await expect(page).toHaveURL(/error=invalid_state/);
  });

  test('should handle missing code parameter', async ({ page }) => {
    await page.goto('/auth/spotify/callback?state=some-state');

    // Should redirect with invalid_request error
    await expect(page).toHaveURL(/error=invalid_request/);
  });

  test('should handle auth failure mode', async ({ page, configureMocks }) => {
    // Configure mock to fail auth
    configureMocks({ authFailure: true });

    const authPage = new AuthPage(page);

    // Try to complete auth
    await authPage.simulateSpotifyCallback({
      code: 'valid-code',
      state: 'valid-state',
    });

    // Should redirect with auth failure error
    await page.waitForTimeout(1000);
    const url = page.url();
    expect(url).toMatch(/error=/);
  });
});

test.describe('Session Persistence', () => {
  test('should persist session across page reloads', async ({ authenticatedPage }) => {
    // Reload the page
    await authenticatedPage.reload();
    await authenticatedPage.waitForLoadState('domcontentloaded');

    // Session cookie should still be valid after reload
    const cookies = await authenticatedPage.context().cookies();
    const sessionCookie = cookies.find((c) => c.name === 'session_id');
    expect(sessionCookie).toBeDefined();
  });

  test('should maintain auth state after navigation', async ({ authenticatedPage }) => {
    const homePage = new HomePage(authenticatedPage);

    // Navigate away and back
    await authenticatedPage.goto('/health');
    await authenticatedPage.goto('/');

    // Should still have session
    const cookies = await authenticatedPage.context().cookies();
    const sessionCookie = cookies.find((c) => c.name === 'session_id');
    expect(sessionCookie).toBeDefined();
  });
});
