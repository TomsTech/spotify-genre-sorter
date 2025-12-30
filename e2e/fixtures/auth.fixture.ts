/**
 * Authentication Fixtures for E2E Tests
 *
 * Provides pre-authenticated pages and test utilities for auth-related testing.
 * Uses Playwright's route API to intercept /session and return mock data.
 */
import { test as base, Page, BrowserContext, expect } from '@playwright/test';
import { randomBytes } from 'crypto';
import { MockKVNamespace } from './mock-kv';
import { createMockSession, defaultTestUser, testUsers } from './index';
import { configureMockServer, resetMockServer, MockServerConfig } from '../mocks/mock-server';
import testTracks from './test-data/tracks.json' with { type: 'json' };
import testArtists from './test-data/artists.json' with { type: 'json' };

/**
 * Session state for route interception
 */
interface MockSessionState {
  authenticated: boolean;
  spotifyOnly: boolean;
  user?: string;
  avatar?: string;
  spotifyUser?: string;
  spotifyUserId?: string;
  spotifyAvatar?: string;
  spotifyConnected: boolean;
}

/**
 * Extended test fixtures for auth testing
 */
interface AuthFixtures {
  /** Fresh MockKV instance for each test */
  mockKV: MockKVNamespace;

  /** Default test user data */
  testUser: typeof defaultTestUser;

  /** Pre-authenticated page with valid session */
  authenticatedPage: Page;

  /** Configure mock server for specific scenarios */
  configureMocks: (config: MockServerConfig) => void;
}

/**
 * Extended test with auth fixtures
 */
export const test = base.extend<AuthFixtures>({
  // Override base page fixture to add default route interception for public APIs
  // This ensures all tests (not just authenticatedPage) have mocked API responses
  page: async ({ page }, use) => {
    // Set up route interception for public APIs that don't require auth
    // This prevents tests from failing when wrangler dev has no KV data

    // Import user stats data for leaderboard/scoreboard
    const userStatsData = await import('./test-data/user-stats.json', { with: { type: 'json' } });

    // /stats endpoint
    await page.route('**/stats', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          userCount: 42,
          hallOfFame: [
            { position: 1, spotifyName: 'First Pioneer', spotifyAvatar: 'https://i.pravatar.cc/300?u=1' },
            { position: 2, spotifyName: 'Second Pioneer', spotifyAvatar: 'https://i.pravatar.cc/300?u=2' },
          ],
        }),
      });
    });

    // /api/leaderboard endpoint
    await page.route('**/api/leaderboard', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          pioneers: userStatsData.default.pioneers.map((p: { spotifyId: string; spotifyName: string; spotifyAvatar?: string; firstSeen: string }, i: number) => ({
            spotifyId: p.spotifyId,
            spotifyName: p.spotifyName,
            spotifyAvatar: p.spotifyAvatar,
            registeredAt: p.firstSeen,
            order: i + 1,
          })),
          newUsers: userStatsData.default.newUsers.map((u: { spotifyId: string; spotifyName: string; spotifyAvatar?: string; firstSeen: string }) => ({
            spotifyId: u.spotifyId,
            spotifyName: u.spotifyName,
            spotifyAvatar: u.spotifyAvatar,
            registeredAt: u.firstSeen,
          })),
          totalUsers: userStatsData.default.pioneers.length + userStatsData.default.newUsers.length,
          _cache: {
            updatedAt: new Date().toISOString(),
            ageSeconds: 0,
            nextRefreshSeconds: 900,
            fromCache: false,
            ttl: '15 minutes',
          },
        }),
      });
    });

    // /api/scoreboard endpoint
    await page.route('**/api/scoreboard', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ...userStatsData.default.scoreboard,
          totalUsers: userStatsData.default.pioneers.length + userStatsData.default.newUsers.length,
          updatedAt: new Date().toISOString(),
          _cache: {
            ageSeconds: 0,
            nextRefreshSeconds: 3600,
            fromCache: false,
            ttl: '1 hour',
          },
        }),
      });
    });

    // /api/recent-playlists endpoint
    await page.route('**/api/recent-playlists', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          playlists: userStatsData.default.recentPlaylists || [],
        }),
      });
    });

    // /session endpoint for unauthenticated tests
    await page.route('**/session', async (route, request) => {
      const cookieHeader = request.headers()['cookie'] || '';
      const hasSessionCookie = cookieHeader.includes('session_id=');

      // If there's a session cookie, let it through (authenticatedPage will override)
      // If no cookie, return unauthenticated
      if (!hasSessionCookie) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            authenticated: false,
            spotifyOnly: true,
            spotifyConnected: false,
          }),
        });
      } else {
        // Continue to server or let authenticatedPage fixture handle it
        await route.continue();
      }
    });

    await use(page);

    // Clean up routes
    await page.unroute('**/stats');
    await page.unroute('**/api/leaderboard');
    await page.unroute('**/api/scoreboard');
    await page.unroute('**/api/recent-playlists');
    await page.unroute('**/session');
  },

  // Fresh MockKV for each test
  mockKV: async ({}, use) => {
    const kv = new MockKVNamespace();
    await use(kv);
    kv.clear();
  },

  // Test user data
  testUser: async ({}, use) => {
    await use(defaultTestUser);
  },

  // Configure mock server
  configureMocks: async ({}, use) => {
    await use((config: MockServerConfig) => {
      configureMockServer(config);
    });

    // Reset after test
    resetMockServer();
  },

  // Pre-authenticated page with session interception
  authenticatedPage: async ({ page, context }, use) => {
    // Track session state that can be modified by logout
    let sessionState: MockSessionState = {
      authenticated: true,
      spotifyOnly: true,
      user: testUsers.default.display_name,
      avatar: testUsers.default.images[0]?.url,
      spotifyUser: testUsers.default.display_name,
      spotifyUserId: testUsers.default.id,
      spotifyAvatar: testUsers.default.images[0]?.url,
      spotifyConnected: true,
    };

    // Create a session ID
    const sessionId = `e2e-session-${Date.now()}-${randomBytes(4).toString('hex')}`;

    // Set session cookie
    await context.addCookies([
      {
        name: 'session_id',
        value: sessionId,
        domain: 'localhost',
        path: '/',
        httpOnly: true,
        secure: false,
        sameSite: 'Lax',
      },
    ]);

    // First, unroute any existing /session handler from base page fixture
    // This ensures our handler takes precedence
    await page.unroute('**/session');

    // Intercept /session requests to return mock data
    await page.route('**/session', async (route, request) => {
      // Check if the session cookie exists in the request
      const cookieHeader = request.headers()['cookie'] || '';
      const hasSessionCookie = cookieHeader.includes('session_id=');

      // If no cookie, return unauthenticated regardless of session state
      if (!hasSessionCookie) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            authenticated: false,
            spotifyOnly: true,
            spotifyConnected: false,
          }),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(sessionState),
      });
    });

    // Intercept /auth/logout to clear session state
    await page.route('**/auth/logout', async (route) => {
      // Mark session as logged out
      sessionState = {
        authenticated: false,
        spotifyOnly: true,
        spotifyConnected: false,
      };

      // Clear cookie by redirecting with Set-Cookie header
      await route.fulfill({
        status: 302,
        headers: {
          'Location': '/',
          'Set-Cookie': 'session_id=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Lax',
        },
      });
    });

    // Intercept /stats for user counter
    await page.route('**/stats', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          userCount: 42,
          hallOfFame: [
            { position: 1, spotifyName: 'First Pioneer', spotifyAvatar: 'https://i.pravatar.cc/300?u=1' },
            { position: 2, spotifyName: 'Second Pioneer', spotifyAvatar: 'https://i.pravatar.cc/300?u=2' },
          ],
        }),
      });
    });

    // Intercept /api/genres to return mock genre data
    await page.route('**/api/genres', async (route, request) => {
      const cookieHeader = request.headers()['cookie'] || '';
      const hasSessionCookie = cookieHeader.includes('session_id=');

      if (!hasSessionCookie || !sessionState.authenticated) {
        await route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Not authenticated' }),
        });
        return;
      }

      // Build genres from test data
      const genreMap: Record<string, { name: string; trackIds: string[]; count: number }> = {};
      const artistsObj = testArtists as Record<string, { id: string; genres: string[] }>;

      for (const track of testTracks) {
        const trackArtistIds = track.artists?.map((a: { id: string }) => a.id) || [];
        for (const artistId of trackArtistIds) {
          const artist = artistsObj[artistId];
          if (artist && artist.genres) {
            for (const genre of artist.genres) {
              if (!genreMap[genre]) {
                genreMap[genre] = { name: genre, trackIds: [], count: 0 };
              }
              genreMap[genre].trackIds.push(track.id);
              genreMap[genre].count++;
            }
          }
        }
      }

      const genres = Object.values(genreMap).sort((a, b) => b.count - a.count);

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          genres,
          totalTracks: testTracks.length,
          totalGenres: genres.length,
          totalArtists: Object.keys(artistsObj).length,
          fromCache: false,
          cachedAt: Date.now(),
        }),
      });
    });

    // Intercept POST /api/playlist to return mock success
    await page.route('**/api/playlist', async (route, request) => {
      if (request.method() !== 'POST') {
        await route.continue();
        return;
      }

      const cookieHeader = request.headers()['cookie'] || '';
      const hasSessionCookie = cookieHeader.includes('session_id=');

      if (!hasSessionCookie || !sessionState.authenticated) {
        await route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Not authenticated' }),
        });
        return;
      }

      // Parse request body to get genre name
      let genreName = 'Unknown';
      try {
        const body = await request.postDataJSON();
        genreName = body?.genre || 'Unknown';
      } catch {
        // Ignore parse errors
      }

      const playlistId = `mock-playlist-${Date.now()}`;
      const playlistName = `${genreName} (from Likes)`;
      const playlistUrl = `https://open.spotify.com/playlist/${playlistId}`;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          url: playlistUrl, // For backwards compatibility with some frontend code paths
          playlist: {
            id: playlistId,
            url: playlistUrl,
            name: playlistName,
            trackCount: 10,
          },
        }),
      });
    });

    // Intercept POST /api/playlists/bulk to return mock success
    await page.route('**/api/playlists/bulk', async (route, request) => {
      if (request.method() !== 'POST') {
        await route.continue();
        return;
      }

      const cookieHeader = request.headers()['cookie'] || '';
      const hasSessionCookie = cookieHeader.includes('session_id=');

      if (!hasSessionCookie || !sessionState.authenticated) {
        await route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Not authenticated' }),
        });
        return;
      }

      // Parse request body to get genres
      let genres: { name: string; trackIds: string[] }[] = [];
      try {
        const body = await request.postDataJSON();
        genres = body?.genres || [];
      } catch {
        // Ignore parse errors
      }

      // Generate mock results for each genre
      const results = genres.map((genre) => {
        const playlistId = `mock-bulk-playlist-${Date.now()}-${genre.name.replace(/\s+/g, '-')}`;
        const playlistUrl = `https://open.spotify.com/playlist/${playlistId}`;
        return {
          genre: genre.name,
          success: true,
          url: playlistUrl,
        };
      });

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          total: genres.length,
          successful: genres.length,
          skipped: 0,
          results,
        }),
      });
    });

    // Import user stats data for leaderboard/scoreboard
    const userStatsData = await import('./test-data/user-stats.json', { with: { type: 'json' } });

    // Intercept /api/leaderboard
    await page.route('**/api/leaderboard', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          pioneers: userStatsData.default.pioneers.map((p: { spotifyId: string; spotifyName: string; spotifyAvatar?: string; firstSeen: string }, i: number) => ({
            spotifyId: p.spotifyId,
            spotifyName: p.spotifyName,
            spotifyAvatar: p.spotifyAvatar,
            registeredAt: p.firstSeen,
            order: i + 1,
          })),
          newUsers: userStatsData.default.newUsers.map((u: { spotifyId: string; spotifyName: string; spotifyAvatar?: string; firstSeen: string }) => ({
            spotifyId: u.spotifyId,
            spotifyName: u.spotifyName,
            spotifyAvatar: u.spotifyAvatar,
            registeredAt: u.firstSeen,
          })),
          totalUsers: userStatsData.default.pioneers.length + userStatsData.default.newUsers.length,
          _cache: {
            updatedAt: new Date().toISOString(),
            ageSeconds: 0,
            nextRefreshSeconds: 900,
            fromCache: false,
            ttl: '15 minutes',
          },
        }),
      });
    });

    // Intercept /api/scoreboard
    await page.route('**/api/scoreboard', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ...userStatsData.default.scoreboard,
          totalUsers: userStatsData.default.pioneers.length + userStatsData.default.newUsers.length,
          updatedAt: new Date().toISOString(),
          _cache: {
            ageSeconds: 0,
            nextRefreshSeconds: 3600,
            fromCache: false,
            ttl: '1 hour',
          },
        }),
      });
    });

    // Intercept /api/recent-playlists
    await page.route('**/api/recent-playlists', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          playlists: userStatsData.default.recentPlaylists || [],
        }),
      });
    });

    // Intercept /api/user-playlists
    await page.route('**/api/user-playlists', async (route, request) => {
      const cookieHeader = request.headers()['cookie'] || '';
      const hasSessionCookie = cookieHeader.includes('session_id=');

      if (!hasSessionCookie || !sessionState.authenticated) {
        await route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Not authenticated' }),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          playlists: [
            {
              id: 'playlist-owned-1',
              name: 'My Rock Collection',
              trackCount: 150,
              image: 'https://i.pravatar.cc/300?rock',
              owner: testUsers.default.display_name,
              isOwned: true,
            },
            {
              id: 'playlist-owned-2',
              name: 'Workout Mix',
              trackCount: 45,
              image: 'https://i.pravatar.cc/300?workout',
              owner: testUsers.default.display_name,
              isOwned: true,
            },
            {
              id: 'playlist-followed-1',
              name: 'Top 50 Global',
              trackCount: 50,
              image: 'https://i.pravatar.cc/300?global',
              owner: 'Spotify',
              isOwned: false,
            },
          ],
        }),
      });
    });

    // Intercept /api/me
    await page.route('**/api/me', async (route, request) => {
      const cookieHeader = request.headers()['cookie'] || '';
      const hasSessionCookie = cookieHeader.includes('session_id=');

      if (!hasSessionCookie || !sessionState.authenticated) {
        await route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Not authenticated' }),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: testUsers.default.id,
          display_name: testUsers.default.display_name,
          email: testUsers.default.email,
          images: testUsers.default.images,
        }),
      });
    });

    // Navigate to home to establish session (use domcontentloaded for speed under load)
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    await use(page);

    // Clean up routes after test
    await page.unroute('**/session');
    await page.unroute('**/auth/logout');
    await page.unroute('**/stats');
    await page.unroute('**/api/genres');
    await page.unroute('**/api/playlist');
    await page.unroute('**/api/playlists/bulk');
    await page.unroute('**/api/leaderboard');
    await page.unroute('**/api/scoreboard');
    await page.unroute('**/api/recent-playlists');
    await page.unroute('**/api/user-playlists');
    await page.unroute('**/api/me');
  },
});

/**
 * Re-export expect for convenience
 */
export { expect } from '@playwright/test';

/**
 * Helper to simulate OAuth callback
 */
export async function simulateOAuthCallback(
  page: Page,
  options: {
    code?: string;
    state?: string;
    error?: string;
  } = {}
): Promise<void> {
  const { code = 'mock-auth-code', state = 'mock-state', error } = options;

  if (error) {
    await page.goto(`/auth/spotify/callback?error=${error}`);
  } else {
    await page.goto(`/auth/spotify/callback?code=${code}&state=${state}`);
  }
}

/**
 * Helper to check if user is authenticated
 */
export async function isAuthenticated(page: Page): Promise<boolean> {
  const response = await page.request.get('/session');
  const session = await response.json();
  return session.authenticated === true;
}

/**
 * Helper to get session data
 */
export async function getSessionData(page: Page): Promise<{
  authenticated: boolean;
  user?: {
    name: string;
    id: string;
  };
}> {
  const response = await page.request.get('/session');
  return response.json();
}

/**
 * Helper to logout
 */
export async function logout(page: Page): Promise<void> {
  await page.goto('/auth/logout');
  await page.waitForURL('/');
}

/**
 * Helper to wait for auth state change
 */
export async function waitForAuthState(
  page: Page,
  expectedState: 'authenticated' | 'unauthenticated',
  timeout = 10000
): Promise<void> {
  const start = Date.now();

  while (Date.now() - start < timeout) {
    const isAuth = await isAuthenticated(page);

    if (expectedState === 'authenticated' && isAuth) return;
    if (expectedState === 'unauthenticated' && !isAuth) return;

    await page.waitForTimeout(500);
  }

  throw new Error(`Timeout waiting for auth state: ${expectedState}`);
}

/**
 * Create authenticated context with session cookie
 */
export async function createAuthenticatedContext(
  browser: BrowserContext,
  sessionId?: string
): Promise<BrowserContext> {
  const actualSessionId = sessionId || `e2e-session-${Date.now()}`;

  await browser.addCookies([
    {
      name: 'session_id',
      value: actualSessionId,
      domain: 'localhost',
      path: '/',
      httpOnly: true,
      secure: false,
      sameSite: 'Lax',
    },
  ]);

  return browser;
}
