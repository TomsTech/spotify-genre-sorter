/**
 * Spotify Auth API Handlers
 *
 * Mock handlers for Spotify OAuth token exchange and refresh.
 */
import { http, HttpResponse } from 'msw';

// Track auth state for testing
let authFailureMode = false;
let tokenRefreshCount = 0;

export function setAuthFailureMode(fail: boolean): void {
  authFailureMode = fail;
}

export function resetAuthState(): void {
  authFailureMode = false;
  tokenRefreshCount = 0;
}

export function getTokenRefreshCount(): number {
  return tokenRefreshCount;
}

export const spotifyAuthHandlers = [
  // POST /api/token - Token exchange
  http.post('https://accounts.spotify.com/api/token', async ({ request }) => {
    if (authFailureMode) {
      return HttpResponse.json(
        { error: 'invalid_grant', error_description: 'Authorization code expired' },
        { status: 400 }
      );
    }

    const formData = await request.formData();
    const grantType = formData.get('grant_type');

    if (grantType === 'authorization_code') {
      // Initial token exchange
      const code = formData.get('code');

      if (code === 'invalid-code') {
        return HttpResponse.json(
          { error: 'invalid_grant', error_description: 'Invalid authorization code' },
          { status: 400 }
        );
      }

      return HttpResponse.json({
        access_token: `mock-access-token-${Date.now()}`,
        token_type: 'Bearer',
        scope: 'user-library-read playlist-modify-public playlist-modify-private user-read-private',
        expires_in: 3600,
        refresh_token: `mock-refresh-token-${Date.now()}`,
      });
    }

    if (grantType === 'refresh_token') {
      // Token refresh
      tokenRefreshCount++;

      const refreshToken = formData.get('refresh_token');

      if (refreshToken === 'expired-refresh-token') {
        return HttpResponse.json(
          { error: 'invalid_grant', error_description: 'Refresh token revoked' },
          { status: 400 }
        );
      }

      return HttpResponse.json({
        access_token: `mock-refreshed-token-${Date.now()}`,
        token_type: 'Bearer',
        scope: 'user-library-read playlist-modify-public playlist-modify-private user-read-private',
        expires_in: 3600,
        // Spotify sometimes returns a new refresh token
        refresh_token: `mock-new-refresh-token-${Date.now()}`,
      });
    }

    return HttpResponse.json(
      { error: 'unsupported_grant_type' },
      { status: 400 }
    );
  }),

  // GET /authorize - OAuth initiation (browser redirect, not API)
  // This is handled by the browser, but we can intercept for testing
  http.get('https://accounts.spotify.com/authorize', ({ request }) => {
    const url = new URL(request.url);
    const redirectUri = url.searchParams.get('redirect_uri');
    const state = url.searchParams.get('state');

    if (!redirectUri || !state) {
      return HttpResponse.json({ error: 'invalid_request' }, { status: 400 });
    }

    // In E2E tests, we'll redirect back with a mock code
    const callbackUrl = new URL(redirectUri);
    callbackUrl.searchParams.set('code', `mock-auth-code-${Date.now()}`);
    callbackUrl.searchParams.set('state', state);

    return HttpResponse.redirect(callbackUrl.toString(), 302);
  }),
];
