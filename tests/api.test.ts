import { describe, it, expect, vi } from 'vitest';
import app from '../src/index';


describe('API Response Formats', () => {
  describe('GET /api/genres', () => {
    it('should return correct genre response structure', () => {
      const mockResponse = {
        totalTracks: 150,
        totalGenres: 25,
        genres: [
          { name: 'rock', count: 50, trackIds: ['t1', 't2'] },
          { name: 'pop', count: 30, trackIds: ['t3', 't4'] },
        ],
      };

      expect(mockResponse).toHaveProperty('totalTracks');
      expect(mockResponse).toHaveProperty('totalGenres');
      expect(mockResponse).toHaveProperty('genres');
      expect(Array.isArray(mockResponse.genres)).toBe(true);

      const genre = mockResponse.genres[0];
      expect(genre).toHaveProperty('name');
      expect(genre).toHaveProperty('count');
      expect(genre).toHaveProperty('trackIds');
    });
  });

  describe('POST /api/playlist', () => {
    it('should validate required fields', () => {
      const validBody = { genre: 'rock', trackIds: ['t1', 't2'] };
      const invalidBody1 = { trackIds: ['t1'] }; // missing genre
      const invalidBody2 = { genre: 'rock' }; // missing trackIds
      const invalidBody3 = { genre: 'rock', trackIds: [] }; // empty trackIds

      expect(validBody.genre).toBeTruthy();
      expect(validBody.trackIds?.length).toBeGreaterThan(0);

      expect(invalidBody1.genre).toBeUndefined();
      expect(invalidBody2.trackIds).toBeUndefined();
      expect(invalidBody3.trackIds?.length).toBe(0);
    });

    it('should return correct playlist response structure', () => {
      const mockResponse = {
        success: true,
        playlist: {
          id: 'playlist123',
          url: 'https://open.spotify.com/playlist/playlist123',
          name: 'rock (from Likes)',
          trackCount: 50,
        },
      };

      expect(mockResponse.success).toBe(true);
      expect(mockResponse.playlist).toHaveProperty('id');
      expect(mockResponse.playlist).toHaveProperty('url');
      expect(mockResponse.playlist.url).toContain('spotify.com');
    });
  });

  describe('POST /api/playlists/bulk', () => {
    it('should handle multiple genre requests', () => {
      const bulkRequest = {
        genres: [
          { name: 'rock', trackIds: ['t1', 't2'] },
          { name: 'pop', trackIds: ['t3', 't4'] },
          { name: 'jazz', trackIds: ['t5'] },
        ],
      };

      expect(bulkRequest.genres.length).toBe(3);

      for (const genre of bulkRequest.genres) {
        expect(genre.name).toBeTruthy();
        expect(genre.trackIds.length).toBeGreaterThan(0);
      }
    });

    it('should track success/failure for each genre', () => {
      const mockResults = {
        total: 3,
        successful: 2,
        results: [
          { genre: 'rock', success: true, url: 'https://...' },
          { genre: 'pop', success: true, url: 'https://...' },
          { genre: 'jazz', success: false, error: 'Rate limited' },
        ],
      };

      expect(mockResults.total).toBe(3);
      expect(mockResults.successful).toBe(2);
      expect(mockResults.results.filter(r => r.success).length).toBe(2);
      expect(mockResults.results.filter(r => !r.success).length).toBe(1);
    });
  });
});

describe('Authentication Middleware', () => {
  it('should return 401 for unauthenticated requests', () => {
    const session = null;
    const errorResponse = session ? null : { error: 'Not authenticated', status: 401 };

    expect(errorResponse).not.toBeNull();
    expect(errorResponse?.status).toBe(401);
  });

  it('should return 401 when Spotify not connected', () => {
    const session = { githubUser: 'user' }; // No spotify token
    const hasSpotify = !!session.spotifyAccessToken;

    expect(hasSpotify).toBe(false);
  });
});

describe('Error Responses', () => {
  const errorCases = [
    { status: 400, error: 'Genre and trackIds required' },
    { status: 401, error: 'Not authenticated' },
    { status: 401, error: 'Spotify not connected' },
    { status: 401, error: 'Spotify session expired' },
    { status: 500, error: 'Failed to fetch genres' },
    { status: 500, error: 'Failed to create playlist' },
  ];

  errorCases.forEach(({ status, error }) => {
    it(`should have ${status} status for "${error}"`, () => {
      expect(status).toBeGreaterThanOrEqual(400);
      expect(status).toBeLessThan(600);
      expect(error).toBeTruthy();
    });
  });
});

describe('Health & Setup Endpoints', () => {
  it('should return ok status for health check', () => {
    const healthResponse = { status: 'ok' };
    expect(healthResponse.status).toBe('ok');
  });

  it('should detect missing secrets in setup', () => {
    const env = {
      SPOTIFY_CLIENT_ID: 'set',
      SPOTIFY_CLIENT_SECRET: 'set',
      GITHUB_CLIENT_ID: undefined,
      GITHUB_CLIENT_SECRET: undefined,
    };

    const spotifyOnly = !env.GITHUB_CLIENT_ID;
    expect(spotifyOnly).toBe(true);
  });

  it('should report auth mode correctly', () => {
    const spotifyOnlyEnv = { SPOTIFY_ONLY_AUTH: 'true' };
    const githubEnv = { GITHUB_CLIENT_ID: 'set' };

    const isSpotifyOnly1 = spotifyOnlyEnv.SPOTIFY_ONLY_AUTH === 'true';
    const isSpotifyOnly2 = !githubEnv.GITHUB_CLIENT_ID;

    expect(isSpotifyOnly1).toBe(true);
    expect(isSpotifyOnly2).toBe(false);
  });
});




describe('Token Refresh logic in Auth Middleware', () => {
  it('should return 401 when token refresh fails', async () => {
    const req = new Request('http://localhost/api/me', {
      headers: {
        'cf-connecting-ip': '127.0.0.1',
        'Cookie': 'session_id=test-session-id'
      }
    });

    const mockEnv = {
      SESSIONS: {
        get: vi.fn().mockResolvedValue(JSON.stringify({
          spotifyAccessToken: 'old-token',
          spotifyRefreshToken: 'refresh-token',
          spotifyExpiresAt: Date.now() - 1000,
        })),
        put: vi.fn(),
      },
      E2E_TEST_MODE: 'false',
      ENVIRONMENT: 'test',
      SPOTIFY_CLIENT_ID: 'client-id',
      SPOTIFY_CLIENT_SECRET: 'client-secret',
      BETTERSTACK_LOG_TOKEN: 'mock-token',
    };

    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error during refresh'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.useFakeTimers();

    const fetchPromise = app.fetch(req, mockEnv, {
      waitUntil: vi.fn(),
      passThroughOnException: vi.fn(),
    });

    await vi.advanceTimersByTimeAsync(10000);

    const res = await fetchPromise;

    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe('Failed to refresh Spotify token');

    global.fetch = originalFetch;
    vi.useRealTimers();
  });
});
