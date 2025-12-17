/**
 * Mock Server for E2E Tests
 *
 * Combines all Spotify API handlers into a single MSW server.
 * Can be configured per-test for different scenarios.
 *
 * Usage:
 *   import { configureMockServer, resetMockServer } from './mock-server';
 *
 *   // Configure for specific test
 *   configureMockServer({ emptyLibrary: true });
 *
 *   // Reset to defaults
 *   resetMockServer();
 */
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';

import {
  spotifyAuthHandlers,
  setAuthFailureMode,
  resetAuthState,
} from './handlers/spotify-auth';

import {
  spotifyUserHandlers,
  setCurrentUser,
  setEmptyLibraryMode,
  setLargeLibraryMode,
  setRateLimitAfter,
  setNowPlaying,
  clearNowPlaying,
  resetUserState,
} from './handlers/spotify-user';

import testTracks from '../fixtures/test-data/tracks.json' with { type: 'json' };
import testArtists from '../fixtures/test-data/artists.json' with { type: 'json' };
import testUsers from '../fixtures/test-data/users.json' with { type: 'json' };

import {
  spotifyArtistHandlers,
  setArtistRateLimitAfter,
  setSlowResponseMs,
  resetArtistState,
} from './handlers/spotify-artists';

import {
  spotifyPlaylistHandlers,
  setFailPlaylistCreation,
  setExistingPlaylistNames,
  resetPlaylistState,
  getCreatedPlaylists,
  isFailPlaylistCreation,
} from './handlers/spotify-playlists';

import {
  appLoggingHandlers,
  getLoggedErrors,
  getLoggedPerf,
  resetLoggingState,
} from './handlers/app-logging';

import {
  appSessionHandlers,
  setSessionState,
  setAuthenticated,
  setUnauthenticated,
  resetSessionState,
  getSessionState,
  isCurrentlyLoggedOut,
} from './handlers/app-session';

import userStatsData from '../fixtures/test-data/user-stats.json' with { type: 'json' };
import analyticsData from '../fixtures/test-data/analytics.json' with { type: 'json' };

// ============ Mock KV Metrics State ============
// This tracks KV operations to display in the UI just like production
const mockKVMetrics = {
  reads: 0,
  writes: 0,
  deletes: 0,
  cacheHits: 0,
  cacheMisses: 0,
  lastReset: Date.now(),
};

// Activity tracking for usage estimation
const mockActivity = {
  signIns: 0,
  libraryScans: 0,
  playlistsCreated: 0,
  authFailures: 0,
  pageViews: 0,
};

// Track a KV read operation
export function trackKVRead(): void {
  mockKVMetrics.reads++;
}

// Track a KV write operation
export function trackKVWrite(): void {
  mockKVMetrics.writes++;
}

// Track a cache hit
export function trackCacheHit(): void {
  mockKVMetrics.cacheHits++;
}

// Track a cache miss (triggers KV read)
export function trackCacheMiss(): void {
  mockKVMetrics.cacheMisses++;
  mockKVMetrics.reads++;
}

// Track activity for usage estimation
export function trackActivity(type: 'signIn' | 'libraryScan' | 'playlistCreated' | 'authFailure' | 'pageView'): void {
  if (type === 'signIn') mockActivity.signIns++;
  if (type === 'libraryScan') mockActivity.libraryScans++;
  if (type === 'playlistCreated') mockActivity.playlistsCreated++;
  if (type === 'authFailure') mockActivity.authFailures++;
  if (type === 'pageView') mockActivity.pageViews++;
}

// Get current mock metrics
export function getMockKVMetrics(): typeof mockKVMetrics {
  return { ...mockKVMetrics };
}

// Get current mock activity
export function getMockActivity(): typeof mockActivity {
  return { ...mockActivity };
}

// Reset mock metrics
export function resetMockMetrics(): void {
  mockKVMetrics.reads = 0;
  mockKVMetrics.writes = 0;
  mockKVMetrics.deletes = 0;
  mockKVMetrics.cacheHits = 0;
  mockKVMetrics.cacheMisses = 0;
  mockKVMetrics.lastReset = Date.now();
  mockActivity.signIns = 0;
  mockActivity.libraryScans = 0;
  mockActivity.playlistsCreated = 0;
  mockActivity.authFailures = 0;
  mockActivity.pageViews = 0;
}

// Combine all handlers
const allHandlers = [
  // App session handlers FIRST (highest priority for /session, /auth/*, etc.)
  ...appSessionHandlers,

  ...spotifyAuthHandlers,
  ...spotifyUserHandlers,
  ...spotifyArtistHandlers,
  ...spotifyPlaylistHandlers,
  ...appLoggingHandlers,

  // ============ App API Handlers (for wrangler dev passthrough) ============

  // GET /api/genres - Returns genre analysis for authenticated user
  http.get('*/api/genres', ({ request }) => {
    // Check for session cookie
    const cookie = request.headers.get('cookie') || '';
    const hasSessionCookie = cookie.includes('session_id=');

    if (!hasSessionCookie) {
      return HttpResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Build genres from test artists data
    const genreMap: Record<string, { name: string; trackIds: string[]; trackCount: number }> = {};
    const artistsArray = Object.values(testArtists) as Array<{ id: string; genres: string[] }>;

    // Map tracks to genres via their artists
    for (const track of testTracks) {
      const trackArtistIds = track.track?.artists?.map((a: { id: string }) => a.id) || [];
      for (const artistId of trackArtistIds) {
        const artist = artistsArray.find(a => a.id === artistId);
        if (artist && artist.genres) {
          for (const genre of artist.genres) {
            if (!genreMap[genre]) {
              genreMap[genre] = { name: genre, trackIds: [], trackCount: 0 };
            }
            genreMap[genre].trackIds.push(track.track?.id || '');
            genreMap[genre].trackCount++;
          }
        }
      }
    }

    // Sort by track count
    const genres = Object.values(genreMap).sort((a, b) => b.trackCount - a.trackCount);

    return HttpResponse.json({
      genres,
      totalTracks: testTracks.length,
      totalArtists: artistsArray.length,
      fromCache: false,
      cachedAt: new Date().toISOString(),
    });
  }),

  // GET /api/me - Returns current user info
  http.get('*/api/me', ({ request }) => {
    // Check for session cookie
    const cookie = request.headers.get('cookie') || '';
    const hasSessionCookie = cookie.includes('session_id=');

    if (!hasSessionCookie) {
      return HttpResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Return default user info
    const user = testUsers.default;
    return HttpResponse.json({
      id: user.id,
      display_name: user.display_name,
      email: user.email,
      images: user.images,
      product: user.product,
      country: user.country,
      external_urls: user.external_urls,
    });
  }),

  // GET /api/leaderboard - Returns pioneers and new users
  http.get('*/api/leaderboard', () => {
    return HttpResponse.json({
      pioneers: userStatsData.pioneers.map((p, i) => ({
        spotifyId: p.spotifyId,
        spotifyName: p.spotifyName,
        spotifyAvatar: p.spotifyAvatar,
        registeredAt: p.firstSeen,
        order: i + 1,
      })),
      newUsers: userStatsData.newUsers.map((u) => ({
        spotifyId: u.spotifyId,
        spotifyName: u.spotifyName,
        spotifyAvatar: u.spotifyAvatar,
        registeredAt: u.firstSeen,
      })),
      totalUsers: userStatsData.pioneers.length + userStatsData.newUsers.length,
      _cache: {
        updatedAt: new Date().toISOString(),
        ageSeconds: 0,
        nextRefreshSeconds: 900,
        fromCache: false,
        ttl: '15 minutes',
      },
    });
  }),

  // GET /api/scoreboard - Returns rankings by category
  http.get('*/api/scoreboard', () => {
    return HttpResponse.json({
      ...userStatsData.scoreboard,
      totalUsers: userStatsData.pioneers.length + userStatsData.newUsers.length,
      updatedAt: new Date().toISOString(),
      _cache: {
        ageSeconds: 0,
        nextRefreshSeconds: 3600,
        fromCache: false,
        ttl: '1 hour',
      },
    });
  }),

  // GET /api/recent-playlists - Returns recent playlists feed
  http.get('*/api/recent-playlists', () => {
    return HttpResponse.json({
      playlists: userStatsData.recentPlaylists,
    });
  }),

  // GET /api/kv-usage - KV usage estimation (matches production format exactly)
  http.get('*/api/kv-usage', () => {
    const today = new Date().toISOString().split('T')[0];
    const activity = getMockActivity();
    const metrics = getMockKVMetrics();

    // Calculate breakdown (same logic as production)
    const breakdown = {
      sessions: {
        reads: Math.round(activity.libraryScans * 2 + activity.playlistsCreated * 2),
        writes: activity.signIns * 2,
      },
      caches: {
        reads: Math.round(activity.pageViews * 0.5),
        writes: Math.round(activity.pageViews * 0.02),
      },
      userStats: {
        reads: activity.playlistsCreated,
        writes: activity.playlistsCreated,
      },
      recentPlaylists: {
        reads: Math.round(activity.pageViews * 0.3),
        writes: activity.playlistsCreated,
      },
      auth: {
        reads: activity.signIns * 3,
        writes: activity.signIns * 2,
      },
    };

    const estimatedReads = Object.values(breakdown).reduce((sum, cat) => sum + cat.reads, 0) + metrics.reads;
    const estimatedWrites = Object.values(breakdown).reduce((sum, cat) => sum + cat.writes, 0) + metrics.writes;

    const READ_LIMIT = 100000;
    const WRITE_LIMIT = 1000;

    const readUsagePercent = Math.round((estimatedReads / READ_LIMIT) * 100);
    const writeUsagePercent = Math.round((estimatedWrites / WRITE_LIMIT) * 100);

    let status: 'ok' | 'warning' | 'critical' = 'ok';
    if (writeUsagePercent > 90 || readUsagePercent > 90) {
      status = 'critical';
    } else if (writeUsagePercent > 80 || readUsagePercent > 80) {
      status = 'warning';
    }

    const cacheHitRate = metrics.cacheHits + metrics.cacheMisses > 0
      ? Math.round((metrics.cacheHits / (metrics.cacheHits + metrics.cacheMisses)) * 100)
      : 0;

    return HttpResponse.json({
      date: today,
      estimated: {
        reads: estimatedReads,
        writes: estimatedWrites,
      },
      estimatedReads,
      estimatedWrites,
      readUsagePercent,
      writeUsagePercent,
      breakdown,
      limits: {
        reads: READ_LIMIT,
        writes: WRITE_LIMIT,
      },
      usage: {
        readsPercent: readUsagePercent,
        writesPercent: writeUsagePercent,
        readsRemaining: READ_LIMIT - estimatedReads,
        writesRemaining: WRITE_LIMIT - estimatedWrites,
        reads: { percent: readUsagePercent },
        writes: { percent: writeUsagePercent },
      },
      trend: {
        direction: 'stable',
        avgDailyWrites: estimatedWrites,
        todayVsAvg: '100%',
      },
      status,
      activity: {
        signIns: activity.signIns,
        libraryScans: activity.libraryScans,
        playlistsCreated: activity.playlistsCreated,
        authFailures: activity.authFailures,
      },
      optimizations: {
        leaderboardCacheTTL: '15 minutes',
        scoreboardCacheTTL: '1 hour',
        pollingInterval: '3 minutes',
        pageViewTracking: 'disabled (using Cloudflare Analytics)',
        analyticsSampling: '10% (90% reduction in writes)',
      },
      realtime: {
        reads: metrics.reads,
        writes: metrics.writes,
        deletes: metrics.deletes,
        cacheHits: metrics.cacheHits,
        cacheMisses: metrics.cacheMisses,
        cacheHitRate,
        lastReset: new Date(metrics.lastReset).toISOString(),
      },
    });
  }),

  // GET /api/kv-metrics - Real-time KV metrics (matches production format)
  http.get('*/api/kv-metrics', () => {
    const metrics = getMockKVMetrics();
    const totalCacheRequests = metrics.cacheHits + metrics.cacheMisses;
    const hitRatio = totalCacheRequests > 0 ? Math.round((metrics.cacheHits / totalCacheRequests) * 100) : 0;

    return HttpResponse.json({
      timestamp: new Date().toISOString(),
      metrics: {
        kvReads: metrics.reads,
        kvWrites: metrics.writes,
        kvDeletes: metrics.deletes,
        cacheHits: metrics.cacheHits,
        cacheMisses: metrics.cacheMisses,
      },
      cacheEfficiency: {
        hitRatio: `${hitRatio}%`,
        estimatedKVReadsSaved: metrics.cacheHits,
        actualKVReads: metrics.reads,
        reduction: metrics.reads > 0 ? `${Math.round((metrics.cacheHits / (metrics.cacheHits + metrics.reads)) * 100)}%` : 'N/A',
      },
      note: 'Metrics reset daily and when worker restarts',
    });
  }),

  // GET /api/analytics - Analytics data
  http.get('*/api/analytics', () => {
    const metrics = getMockKVMetrics();
    const activity = getMockActivity();

    return HttpResponse.json({
      today: {
        date: new Date().toISOString().split('T')[0],
        pageViews: activity.pageViews,
        uniqueVisitors: Math.round(activity.pageViews * 0.3),
        signIns: activity.signIns,
        libraryScans: activity.libraryScans,
        playlistsCreated: activity.playlistsCreated,
        authFailures: activity.authFailures,
      },
      last7Days: analyticsData.last7Days,
      kvMetrics: {
        reads: metrics.reads,
        writes: metrics.writes,
        cacheHits: metrics.cacheHits,
        cacheMisses: metrics.cacheMisses,
      },
    });
  }),

  // POST /api/playlist - Create a single playlist
  http.post('*/api/playlist', async ({ request }) => {
    // Check for session cookie
    const cookie = request.headers.get('cookie') || '';
    const hasSessionCookie = cookie.includes('session_id=');

    if (!hasSessionCookie) {
      return HttpResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = await request.json() as { genre: string; trackIds: string[]; force?: boolean };
    const { genre, trackIds } = body;

    // Simulate failure if configured via setFailPlaylistCreation(true)
    if (isFailPlaylistCreation()) {
      return HttpResponse.json({ error: 'Failed to create playlist' }, { status: 500 });
    }

    // Generate mock playlist response
    const playlistId = `mock_playlist_${Date.now()}`;
    const playlistName = `${genre} (from Likes)`;

    // Track the creation
    trackActivity('playlistCreated');
    trackKVWrite();

    return HttpResponse.json({
      success: true,
      playlist: {
        id: playlistId,
        url: `https://open.spotify.com/playlist/${playlistId}`,
        name: playlistName,
        trackCount: trackIds?.length || 0,
      },
    });
  }),

  // POST /api/playlists/bulk - Create multiple playlists at once
  http.post('*/api/playlists/bulk', async ({ request }) => {
    // Check for session cookie
    const cookie = request.headers.get('cookie') || '';
    const hasSessionCookie = cookie.includes('session_id=');

    if (!hasSessionCookie) {
      return HttpResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = await request.json() as { genres: Array<{ name: string; trackIds: string[] }>; skipDuplicates?: boolean };
    const { genres, skipDuplicates } = body;

    if (!Array.isArray(genres) || genres.length === 0) {
      return HttpResponse.json({ error: 'Genres array required' }, { status: 400 });
    }

    const results: Array<{ genre: string; success: boolean; url?: string; error?: string; skipped?: boolean }> = [];

    for (const { name, trackIds } of genres) {
      const playlistId = `mock_playlist_${Date.now()}_${name.replace(/\s+/g, '_')}`;

      results.push({
        genre: name,
        success: true,
        url: `https://open.spotify.com/playlist/${playlistId}`,
      });

      trackActivity('playlistCreated');
      trackKVWrite();
    }

    return HttpResponse.json({
      total: genres.length,
      successful: results.filter(r => r.success).length,
      skipped: results.filter(r => r.skipped).length,
      results,
    });
  }),

  // GET /api/now-playing - Get current playback state
  http.get('*/api/now-playing', ({ request }) => {
    // Check for session cookie
    const cookie = request.headers.get('cookie') || '';
    const hasSessionCookie = cookie.includes('session_id=');

    if (!hasSessionCookie) {
      return HttpResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Return no track playing by default
    return HttpResponse.json({ playing: false });
  }),

  // Health check endpoint for the mock server itself
  http.get('http://localhost:3001/health', () => {
    return HttpResponse.json({ status: 'ok', service: 'mock-spotify-api' });
  }),

  // Test utility endpoint to seed session data
  http.post('http://localhost:3001/_test/seed-session', async ({ request }) => {
    const body = await request.json();
    // In a real implementation, this would write to the local KV
    // For now, we just acknowledge the request
    console.log('[Mock Server] Session seed request:', body);
    return HttpResponse.json({ success: true });
  }),

  // Test utility endpoint to reset state
  http.post('http://localhost:3001/_test/reset', () => {
    resetMockServer();
    return HttpResponse.json({ success: true });
  }),

  // Test utility endpoint to get created playlists
  http.get('http://localhost:3001/_test/created-playlists', () => {
    return HttpResponse.json({ playlists: getCreatedPlaylists() });
  }),

  // Test utility endpoint to get logged errors
  http.get('http://localhost:3001/_test/logged-errors', () => {
    return HttpResponse.json({ errors: getLoggedErrors() });
  }),

  // Test utility endpoint to get logged performance data
  http.get('http://localhost:3001/_test/logged-perf', () => {
    return HttpResponse.json({ perf: getLoggedPerf() });
  }),
];

// Create the MSW server
export const mockServer = setupServer(...allHandlers);

/**
 * Configuration options for the mock server
 */
export interface MockServerConfig {
  // User configuration
  user?: 'default' | 'heidi' | 'newUser' | 'largeLibraryUser';

  // Library configuration
  emptyLibrary?: boolean;
  largeLibrary?: boolean;

  // Rate limiting
  rateLimitAfterRequests?: number;

  // Error scenarios
  authFailure?: boolean;
  playlistCreationFailure?: boolean;

  // Existing playlists (for duplicate detection)
  existingPlaylists?: string[];

  // Slow responses (for testing loading states)
  slowResponseMs?: number;

  // Now Playing configuration
  nowPlaying?: boolean; // If true, simulate a track playing
  nowPlayingTrackIndex?: number; // Which track from fixtures to use (default: 0)

  // Simulate specific test scenarios
  scenario?: 'default' | 'firstTimeUser' | 'powerUser' | 'heidiMode';
}

/**
 * Configure the mock server for a specific test scenario
 */
export function configureMockServer(config: MockServerConfig): void {
  // Reset all state first
  resetAllState();

  // Apply scenario presets
  if (config.scenario === 'heidiMode') {
    setCurrentUser('heidi');
  } else if (config.scenario === 'firstTimeUser') {
    setCurrentUser('newUser');
  } else if (config.scenario === 'powerUser') {
    setCurrentUser('largeLibraryUser');
    setLargeLibraryMode(true);
  }

  // Apply individual configuration
  if (config.user) {
    setCurrentUser(config.user);
  }

  if (config.emptyLibrary) {
    setEmptyLibraryMode(true);
  }

  if (config.largeLibrary) {
    setLargeLibraryMode(true);
  }

  if (config.rateLimitAfterRequests !== undefined) {
    setRateLimitAfter(config.rateLimitAfterRequests);
    setArtistRateLimitAfter(config.rateLimitAfterRequests);
  }

  if (config.authFailure) {
    setAuthFailureMode(true);
  }

  if (config.playlistCreationFailure) {
    setFailPlaylistCreation(true);
  }

  if (config.existingPlaylists) {
    setExistingPlaylistNames(config.existingPlaylists);
  }

  if (config.slowResponseMs) {
    setSlowResponseMs(config.slowResponseMs);
  }

  // Now Playing configuration
  if (config.nowPlaying) {
    const trackIndex = config.nowPlayingTrackIndex ?? 0;
    const track = testTracks[trackIndex] || testTracks[0];
    setNowPlaying(track, true);
  }
}

/**
 * Reset the mock server to default state
 */
export function resetMockServer(): void {
  resetAllState();
  mockServer.resetHandlers();
}

function resetAllState(): void {
  resetAuthState();
  resetUserState();
  resetArtistState();
  resetPlaylistState();
  resetLoggingState();
  resetMockMetrics();
  resetSessionState();
}

/**
 * Start the mock server (call in global setup)
 */
export function startMockServer(): void {
  mockServer.listen({
    onUnhandledRequest: 'warn',
  });
  console.log('[Mock Server] Started');
}

/**
 * Stop the mock server (call in global teardown)
 */
export function stopMockServer(): void {
  mockServer.close();
  console.log('[Mock Server] Stopped');
}

// Export handlers for extending in tests
export {
  spotifyAuthHandlers,
  spotifyUserHandlers,
  spotifyArtistHandlers,
  spotifyPlaylistHandlers,
  appLoggingHandlers,
};

// Export state getters for assertions
export { getCreatedPlaylists };

// Export logging state getters
export { getLoggedErrors, getLoggedPerf };

// Export now playing controls
export { setNowPlaying, clearNowPlaying };

// Export session state controls
export {
  setSessionState,
  setAuthenticated,
  setUnauthenticated,
  resetSessionState,
  getSessionState,
  isCurrentlyLoggedOut,
  appSessionHandlers,
};

// Export KV metrics controls for tracking/testing
// Note: These are already exported at their definitions above

// Re-export http and HttpResponse for custom handlers in tests
export { http, HttpResponse };
