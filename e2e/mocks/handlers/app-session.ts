/**
 * App Session Handlers
 *
 * Mock handlers for the app's /session and /auth/* endpoints.
 * These allow E2E tests to control session state without needing real KV.
 */
import { http, HttpResponse } from 'msw';
import testUsers from '../../fixtures/test-data/users.json' with { type: 'json' };

// ============ Session State ============

interface SessionState {
  authenticated: boolean;
  spotifyOnly: boolean;
  user?: string;
  avatar?: string;
  githubUser?: string;
  githubAvatar?: string;
  spotifyUser?: string;
  spotifyUserId?: string;
  spotifyAvatar?: string;
  spotifyConnected: boolean;
}

// Default session state - authenticated with Spotify
let sessionState: SessionState = {
  authenticated: true,
  spotifyOnly: true,
  user: testUsers.default.display_name,
  avatar: testUsers.default.images[0]?.url,
  spotifyUser: testUsers.default.display_name,
  spotifyUserId: testUsers.default.id,
  spotifyAvatar: testUsers.default.images[0]?.url,
  spotifyConnected: true,
};

// Track whether we're in "logged out" state
let isLoggedOut = false;

/**
 * Set the session state for testing
 */
export function setSessionState(state: Partial<SessionState>): void {
  sessionState = { ...sessionState, ...state };
  isLoggedOut = !state.authenticated;
}

/**
 * Set session to authenticated (logged in)
 */
export function setAuthenticated(user: keyof typeof testUsers = 'default'): void {
  const userData = testUsers[user];
  sessionState = {
    authenticated: true,
    spotifyOnly: true,
    user: userData.display_name,
    avatar: userData.images[0]?.url,
    spotifyUser: userData.display_name,
    spotifyUserId: userData.id,
    spotifyAvatar: userData.images[0]?.url,
    spotifyConnected: true,
  };
  isLoggedOut = false;
}

/**
 * Set session to unauthenticated (logged out)
 */
export function setUnauthenticated(): void {
  sessionState = {
    authenticated: false,
    spotifyOnly: true,
    spotifyConnected: false,
  };
  isLoggedOut = true;
}

/**
 * Reset session state to default
 */
export function resetSessionState(): void {
  setAuthenticated('default');
  isLoggedOut = false;
}

/**
 * Check if currently logged out
 */
export function isCurrentlyLoggedOut(): boolean {
  return isLoggedOut;
}

/**
 * Get current session state (for test assertions)
 */
export function getSessionState(): SessionState {
  return { ...sessionState };
}

// ============ Handlers ============

export const appSessionHandlers = [
  // GET /session - Session status endpoint
  http.get('*/session', ({ request }) => {
    // Check if the request has the session cookie
    const cookie = request.headers.get('cookie') || '';
    const hasSessionCookie = cookie.includes('session_id=');

    // If logged out or no cookie, return unauthenticated
    if (isLoggedOut || !hasSessionCookie) {
      return HttpResponse.json({
        authenticated: false,
        spotifyOnly: sessionState.spotifyOnly,
      });
    }

    // Return current session state
    return HttpResponse.json(sessionState);
  }),

  // GET /auth/logout - Logout endpoint
  http.get('*/auth/logout', () => {
    // Mark as logged out
    setUnauthenticated();

    // Return redirect to home
    return new HttpResponse(null, {
      status: 302,
      headers: {
        'Location': '/',
        // Clear the session cookie
        'Set-Cookie': 'session_id=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Lax',
      },
    });
  }),

  // GET /stats - Public stats endpoint
  http.get('*/stats', () => {
    return HttpResponse.json({
      userCount: 42,
      hallOfFame: [
        { position: 1, spotifyName: 'First Pioneer', spotifyAvatar: 'https://i.pravatar.cc/300?u=1' },
        { position: 2, spotifyName: 'Second Pioneer', spotifyAvatar: 'https://i.pravatar.cc/300?u=2' },
        { position: 3, spotifyName: 'Third Pioneer', spotifyAvatar: 'https://i.pravatar.cc/300?u=3' },
      ],
    });
  }),

  // GET /health - Health check
  http.get('*/health', () => {
    return HttpResponse.json({ status: 'ok' });
  }),

  // GET /setup - Setup check
  http.get('*/setup', () => {
    return HttpResponse.json({
      configured: true,
      authMode: 'spotify-only',
    });
  }),
];
