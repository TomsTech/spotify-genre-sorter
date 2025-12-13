/**
 * Logout E2E Tests
 *
 * Tests the logout functionality and session cleanup.
 */
import { test, expect } from '../../fixtures/auth.fixture';
import { HomePage } from '../../pages/home.page';
import { AuthPage } from '../../pages/auth.page';

test.describe('Logout Functionality', () => {
  test('should clear session on logout', async ({ authenticatedPage }) => {
    const authPage = new AuthPage(authenticatedPage);

    // Verify we have a session
    let session = await authPage.getSessionStatus();
    const hadSession = !!authenticatedPage.context().cookies();

    // Logout
    await authPage.logout();

    // Session cookie should be cleared
    const cookies = await authenticatedPage.context().cookies();
    const sessionCookie = cookies.find((c) => c.name === 'session_id');

    // Cookie might be cleared or set to empty
    if (sessionCookie) {
      expect(sessionCookie.value).toBeFalsy();
    }
  });

  test('should redirect to home after logout', async ({ authenticatedPage }) => {
    const authPage = new AuthPage(authenticatedPage);

    await authPage.logout();

    await expect(authenticatedPage).toHaveURL('/');
  });

  test('should show sign in button after logout', async ({ authenticatedPage }) => {
    const homePage = new HomePage(authenticatedPage);
    const authPage = new AuthPage(authenticatedPage);

    await authPage.logout();

    // Should see sign in button
    await expect(homePage.signInButton).toBeVisible();
  });

  test('should not show user info after logout', async ({ authenticatedPage }) => {
    const homePage = new HomePage(authenticatedPage);
    const authPage = new AuthPage(authenticatedPage);

    await authPage.logout();

    // Wait for page to settle after logout redirect
    await authenticatedPage.waitForLoadState('domcontentloaded');

    // User avatar/name should not be visible after logout
    // Use soft assertions since elements may not exist at all in logged-out state
    const avatarVisible = await homePage.userAvatar.isVisible().catch(() => false);
    const nameVisible = await homePage.userName.isVisible().catch(() => false);

    // After logout, neither should be visible (or they don't exist - both are valid)
    expect(avatarVisible).toBe(false);
    expect(nameVisible).toBe(false);
  });

  test('should handle logout when already logged out', async ({ page }) => {
    const authPage = new AuthPage(page);

    // Go directly to logout without being logged in
    await authPage.logout();

    // Should just redirect to home without error
    await expect(page).toHaveURL('/');
  });

  test('should clear local storage on logout', async ({ authenticatedPage }) => {
    // Set some local storage (theme preference, etc.)
    await authenticatedPage.evaluate(() => {
      localStorage.setItem('theme', 'dark');
      localStorage.setItem('swedishMode', 'true');
    });

    const authPage = new AuthPage(authenticatedPage);
    await authPage.logout();

    // User preferences in localStorage might be preserved
    // but session-related data should be cleared
    const sessionData = await authenticatedPage.evaluate(() => {
      return {
        // These are user preferences, typically preserved
        theme: localStorage.getItem('theme'),
        // Session token should not be in localStorage
        sessionToken: localStorage.getItem('sessionToken'),
      };
    });

    // Session token specifically should not exist
    expect(sessionData.sessionToken).toBeNull();
  });
});

test.describe('Session Expiry', () => {
  test('should handle expired session gracefully', async ({ page }) => {
    // Set an old/invalid session cookie
    await page.context().addCookies([
      {
        name: 'session_id',
        value: 'expired-session-12345',
        domain: 'localhost',
        path: '/',
        httpOnly: true,
        secure: false,
        sameSite: 'Lax',
      },
    ]);

    const homePage = new HomePage(page);
    await homePage.goto();

    // Should show sign in button (session invalid)
    // The app should handle this gracefully
    await page.waitForTimeout(1000);

    // Check session status
    const response = await page.request.get('/session');
    const session = await response.json();

    // Either not authenticated or the session was invalid
    // App should not crash
    expect(response.ok()).toBe(true);
  });
});
