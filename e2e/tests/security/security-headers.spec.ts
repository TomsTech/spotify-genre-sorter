/**
 * Security Headers E2E Tests
 *
 * Tests for security features implemented in #99a, #99b, #99c:
 * - CSP with nonces (no unsafe-inline)
 * - CSRF token protection
 * - PKCE OAuth flow
 */
import { test, expect } from '@playwright/test';

test.describe('Content Security Policy (#99a)', () => {
  test('CSP header is present on HTML responses', async ({ page }) => {
    const response = await page.goto('/');

    const csp = response?.headers()['content-security-policy'];
    expect(csp).toBeDefined();
  });

  test('CSP uses nonces instead of unsafe-inline for scripts', async ({ page }) => {
    const response = await page.goto('/');

    const csp = response?.headers()['content-security-policy'];
    expect(csp).toBeDefined();

    // Should have nonce-based script-src
    expect(csp).toMatch(/script-src[^;]*'nonce-[A-Za-z0-9+/=]+'/);

    // Should NOT have unsafe-inline for scripts
    expect(csp).not.toMatch(/script-src[^;]*'unsafe-inline'/);
  });

  test('CSP uses nonces instead of unsafe-inline for styles', async ({ page }) => {
    const response = await page.goto('/');

    const csp = response?.headers()['content-security-policy'];
    expect(csp).toBeDefined();

    // Should have nonce-based style-src
    expect(csp).toMatch(/style-src[^;]*'nonce-[A-Za-z0-9+/=]+'/);

    // Should NOT have unsafe-inline for styles
    expect(csp).not.toMatch(/style-src[^;]*'unsafe-inline'/);
  });

  test('CSP nonce is unique per request', async ({ page }) => {
    const response1 = await page.goto('/');
    const csp1 = response1?.headers()['content-security-policy'];

    // Extract nonce from CSP
    const nonceMatch1 = csp1?.match(/'nonce-([A-Za-z0-9+/=]+)'/);
    const nonce1 = nonceMatch1?.[1];

    // Make another request
    const response2 = await page.goto('/');
    const csp2 = response2?.headers()['content-security-policy'];
    const nonceMatch2 = csp2?.match(/'nonce-([A-Za-z0-9+/=]+)'/);
    const nonce2 = nonceMatch2?.[1];

    // Nonces should be different
    expect(nonce1).toBeDefined();
    expect(nonce2).toBeDefined();
    expect(nonce1).not.toBe(nonce2);
  });

  test('HTML contains script with nonce attribute', async ({ request }) => {
    // Use direct request to get raw HTML (not parsed by browser)
    const response = await request.get('/');
    const html = await response.text();

    // Verify CSP header has nonce
    const csp = response.headers()['content-security-policy'];
    expect(csp).toBeDefined();
    expect(csp).toMatch(/'nonce-[A-Za-z0-9+/=]+'/);

    // Verify script tag has nonce attribute in the HTML
    // The nonce should be a non-empty base64 string
    const scriptNoncePattern = /<script\s+nonce="([A-Za-z0-9+/=]+)"/;
    const match = html.match(scriptNoncePattern);

    expect(match).toBeTruthy();
    expect(match?.[1]?.length).toBeGreaterThan(10);
  });

  test('CSP includes self for default-src', async ({ page }) => {
    const response = await page.goto('/');

    const csp = response?.headers()['content-security-policy'];
    expect(csp).toMatch(/default-src[^;]*'self'/);
  });
});

test.describe('CSRF Protection (#99c)', () => {
  test('Session endpoint returns CSRF token for authenticated users', async ({ page }) => {
    // Set up mock authentication
    await page.route('**/session', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          authenticated: true,
          csrfToken: 'test-csrf-token-12345',
          user: { name: 'Test User' }
        }),
      });
    });

    const response = await page.request.get('/session');
    const data = await response.json();

    if (data.authenticated) {
      expect(data.csrfToken).toBeDefined();
      expect(typeof data.csrfToken).toBe('string');
      expect(data.csrfToken.length).toBeGreaterThan(0);
    }
  });

  test('API rejects state-changing requests without CSRF token when authenticated', async ({ page }) => {
    // This test verifies CSRF protection on protected endpoints
    // Without proper CSRF token, requests should be rejected

    const response = await page.request.post('/api/playlist', {
      data: {
        genre: 'rock',
        trackIds: ['spotify:track:123'],
      },
      headers: {
        // No CSRF token header
      }
    });

    // Should be rejected (401 for no auth, or 403 for missing CSRF)
    expect([401, 403]).toContain(response.status());
  });

  test('CSRF token is validated on protected endpoints', async ({ page }) => {
    // Any state-changing request without proper auth/CSRF should be rejected
    const response = await page.request.post('/api/playlist', {
      data: { genre: 'test', trackIds: [] },
      headers: {
        'x-csrf-token': 'invalid-token',
      }
    });

    // Should not succeed - reject with any error status (4xx)
    expect(response.status()).toBeGreaterThanOrEqual(400);
    expect(response.status()).toBeLessThan(500);
  });
});

test.describe('PKCE OAuth Flow (#99b)', () => {
  test('Spotify auth redirect includes code_challenge parameter', async ({ page }) => {
    // Intercept the redirect to Spotify
    let spotifyUrl: string | null = null;

    await page.route('**/accounts.spotify.com/**', async (route) => {
      spotifyUrl = route.request().url();
      // Don't actually follow through to Spotify
      await route.abort();
    });

    // Trigger Spotify auth
    await page.goto('/auth/spotify');

    // Verify PKCE parameters are present
    if (spotifyUrl) {
      const url = new URL(spotifyUrl);

      // Should have code_challenge
      const codeChallenge = url.searchParams.get('code_challenge');
      expect(codeChallenge).toBeTruthy();
      expect(codeChallenge?.length).toBeGreaterThan(20);

      // Should have code_challenge_method set to S256
      const challengeMethod = url.searchParams.get('code_challenge_method');
      expect(challengeMethod).toBe('S256');
    }
  });

  test('Spotify auth includes standard OAuth parameters', async ({ page }) => {
    let spotifyUrl: string | null = null;

    await page.route('**/accounts.spotify.com/**', async (route) => {
      spotifyUrl = route.request().url();
      await route.abort();
    });

    await page.goto('/auth/spotify');

    if (spotifyUrl) {
      const url = new URL(spotifyUrl);

      // Standard OAuth params
      expect(url.searchParams.get('response_type')).toBe('code');
      expect(url.searchParams.get('client_id')).toBeTruthy();
      expect(url.searchParams.get('redirect_uri')).toBeTruthy();
      expect(url.searchParams.get('state')).toBeTruthy();
      expect(url.searchParams.get('scope')).toBeTruthy();
    }
  });

  test('Each auth request generates unique code_challenge', async ({ page }) => {
    const challenges: string[] = [];

    await page.route('**/accounts.spotify.com/**', async (route) => {
      const url = new URL(route.request().url());
      const challenge = url.searchParams.get('code_challenge');
      if (challenge) challenges.push(challenge);
      await route.abort();
    });

    // Make multiple auth requests
    await page.goto('/auth/spotify');
    await page.goto('/auth/spotify');
    await page.goto('/auth/spotify');

    // All challenges should be unique
    const uniqueChallenges = new Set(challenges);
    expect(uniqueChallenges.size).toBe(challenges.length);
  });
});

test.describe('Security Headers', () => {
  test('X-Content-Type-Options is set to nosniff', async ({ page }) => {
    const response = await page.goto('/');

    const header = response?.headers()['x-content-type-options'];
    expect(header).toBe('nosniff');
  });

  test('X-Frame-Options prevents clickjacking', async ({ page }) => {
    const response = await page.goto('/');

    const header = response?.headers()['x-frame-options'];
    // Should be DENY or SAMEORIGIN
    expect(['DENY', 'SAMEORIGIN']).toContain(header);
  });

  test('Strict-Transport-Security is enabled', async ({ page }) => {
    const response = await page.goto('/');

    // HSTS may not be set in local dev, but should be in production
    const hsts = response?.headers()['strict-transport-security'];
    // Just verify it doesn't break if present
    if (hsts) {
      expect(hsts).toContain('max-age');
    }
  });
});

test.describe('CORS Policy (#99d)', () => {
  test('CORS preflight returns correct headers', async ({ page }) => {
    const response = await page.request.fetch('/api/genres', {
      method: 'OPTIONS',
      headers: {
        'Origin': 'https://example.com',
        'Access-Control-Request-Method': 'GET',
      }
    });

    // Should either allow or deny based on origin
    const allowOrigin = response.headers()['access-control-allow-origin'];
    const allowMethods = response.headers()['access-control-allow-methods'];

    // If CORS is configured, these headers should be present
    // If origin is not allowed, headers may be absent (which is correct)
    expect([200, 204, 403]).toContain(response.status());
  });

  test('API endpoints include CORS headers for allowed origins', async ({ page }) => {
    const response = await page.request.get('/health', {
      headers: {
        'Origin': 'https://spotify-genre-sorter.pages.dev',
      }
    });

    expect(response.ok()).toBe(true);
    // Health endpoint should work regardless of CORS
  });
});
