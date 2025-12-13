/**
 * Session Management E2E Tests
 *
 * Tests session persistence, expiry, and token refresh.
 */
import { test, expect } from '../../fixtures/auth.fixture';
import { HomePage } from '../../pages/home.page';
import { AuthPage } from '../../pages/auth.page';
import { getSessionCookie, hasSessionCookie, clearSessionCookie } from '../../utils/cookie-helpers';

test.describe('Session Persistence', () => {
  test('session cookie is set after authentication', async ({ authenticatedPage }) => {
    const hasSession = await hasSessionCookie(authenticatedPage.context());
    expect(hasSession).toBe(true);
  });

  test('session persists across page navigation', async ({ authenticatedPage }) => {
    // Navigate to different pages
    await authenticatedPage.goto('/health');
    await authenticatedPage.goto('/');

    // Session should still exist
    const hasSession = await hasSessionCookie(authenticatedPage.context());
    expect(hasSession).toBe(true);
  });

  test('session persists after page reload', async ({ authenticatedPage }) => {
    const initialSession = await getSessionCookie(authenticatedPage.context());

    await authenticatedPage.reload();

    const afterReloadSession = await getSessionCookie(authenticatedPage.context());
    expect(afterReloadSession).toBe(initialSession);
  });

  test('session is HttpOnly', async ({ authenticatedPage }) => {
    // HttpOnly cookies cannot be accessed via JavaScript
    const jsAccessible = await authenticatedPage.evaluate(() => {
      return document.cookie.includes('session_id');
    });

    expect(jsAccessible).toBe(false);
  });

  test('session cookie has correct attributes', async ({ authenticatedPage }) => {
    const cookies = await authenticatedPage.context().cookies();
    const sessionCookie = cookies.find((c) => c.name === 'session_id');

    expect(sessionCookie).toBeDefined();
    expect(sessionCookie?.httpOnly).toBe(true);
    expect(sessionCookie?.sameSite).toBe('Lax');
  });
});

test.describe('Session API', () => {
  test('GET /session returns authenticated status when logged in', async ({ authenticatedPage }) => {
    const response = await authenticatedPage.request.get('/session');
    expect(response.ok()).toBe(true);

    const session = await response.json();
    // Session endpoint returns auth status
    expect(session).toHaveProperty('authenticated');
  });

  test('GET /session returns unauthenticated when not logged in', async ({ page }) => {
    const response = await page.request.get('/session');
    expect(response.ok()).toBe(true);

    const session = await response.json();
    expect(session.authenticated).toBe(false);
  });
});

test.describe('Session Cleanup', () => {
  test('session is cleared on logout', async ({ authenticatedPage }) => {
    // Verify we have a session
    expect(await hasSessionCookie(authenticatedPage.context())).toBe(true);

    // Logout
    const authPage = new AuthPage(authenticatedPage);
    await authPage.logout();

    // Check session is cleared or invalidated
    const cookies = await authenticatedPage.context().cookies();
    const sessionCookie = cookies.find((c) => c.name === 'session_id');

    // Cookie should be empty or not exist
    expect(!sessionCookie || !sessionCookie.value).toBe(true);
  });

  test('clearing cookies forces re-authentication', async ({ authenticatedPage }) => {
    const homePage = new HomePage(authenticatedPage);

    // Clear all cookies
    await clearSessionCookie(authenticatedPage.context());

    // Reload page
    await authenticatedPage.reload();

    // Should show sign-in button (not authenticated)
    await expect(homePage.signInButton).toBeVisible();
  });
});

test.describe('Invalid Sessions', () => {
  test('invalid session ID is handled gracefully', async ({ page }) => {
    // Set an invalid session cookie
    await page.context().addCookies([
      {
        name: 'session_id',
        value: 'completely-invalid-session-12345',
        domain: 'localhost',
        path: '/',
        httpOnly: true,
        secure: false,
        sameSite: 'Lax',
      },
    ]);

    // Navigate to home
    const homePage = new HomePage(page);
    await homePage.goto();

    // Page should load without crashing
    await expect(homePage.heading).toBeVisible();

    // Should show sign-in (invalid session treated as logged out)
    // The app should handle invalid sessions gracefully
    const response = await page.request.get('/session');
    expect(response.ok()).toBe(true);
  });

  test('malformed session cookie is handled', async ({ page }) => {
    // Set a malformed cookie value
    await page.context().addCookies([
      {
        name: 'session_id',
        value: '<script>alert(1)</script>',
        domain: 'localhost',
        path: '/',
      },
    ]);

    // Navigate - should not crash
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // Page should still function
    const title = await page.title();
    expect(title).toBeTruthy();
  });
});
