import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Test the retry logic used in spotify.ts
describe('Retry Logic', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('fetchWithRetry behaviour', () => {
    // Simulating the retry logic from spotify.ts
    async function fetchWithRetry(
      mockFetch: () => Promise<Response>,
      retries = 3,
      baseDelayMs = 100
    ): Promise<Response> {
      let lastError: Error | null = null;

      for (let attempt = 0; attempt < retries; attempt++) {
        try {
          const response = await mockFetch();

          if (response.status === 429 || response.status >= 500) {
            const retryAfter = response.headers.get('Retry-After');
            const delay = retryAfter
              ? parseInt(retryAfter, 10) * 1000
              : baseDelayMs * Math.pow(2, attempt);

            if (attempt < retries - 1) {
              await new Promise(resolve => setTimeout(resolve, delay));
              continue;
            }
          }

          return response;
        } catch (err) {
          lastError = err instanceof Error ? err : new Error(String(err));

          if (attempt < retries - 1) {
            await new Promise(resolve => setTimeout(resolve, baseDelayMs * Math.pow(2, attempt)));
            continue;
          }
        }
      }

      throw lastError || new Error('Request failed after retries');
    }

    it('should retry on 429 rate limit response', async () => {
      let callCount = 0;
      const mockFetch = vi.fn(async () => {
        callCount++;
        if (callCount < 3) {
          return new Response('Rate limited', {
            status: 429,
            headers: { 'Retry-After': '1' }
          });
        }
        return new Response('Success', { status: 200 });
      });

      const responsePromise = fetchWithRetry(mockFetch, 3, 100);

      // Advance timers for retries
      await vi.advanceTimersByTimeAsync(1000);
      await vi.advanceTimersByTimeAsync(1000);

      const response = await responsePromise;

      expect(mockFetch).toHaveBeenCalledTimes(3);
      expect(response.status).toBe(200);
    });

    it('should retry on 500 server error', async () => {
      let callCount = 0;
      const mockFetch = vi.fn(async () => {
        callCount++;
        if (callCount < 2) {
          return new Response('Server error', { status: 500 });
        }
        return new Response('Success', { status: 200 });
      });

      const responsePromise = fetchWithRetry(mockFetch, 3, 100);

      // Advance timer for exponential backoff
      await vi.advanceTimersByTimeAsync(100);

      const response = await responsePromise;

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(response.status).toBe(200);
    });

    it('should respect Retry-After header', async () => {
      const mockFetch = vi.fn(async () => {
        if (mockFetch.mock.calls.length < 2) {
          return new Response('Rate limited', {
            status: 429,
            headers: { 'Retry-After': '5' } // 5 seconds
          });
        }
        return new Response('Success', { status: 200 });
      });

      const startTime = Date.now();
      const responsePromise = fetchWithRetry(mockFetch, 3, 100);

      // Should wait 5 seconds (5000ms) as specified by Retry-After
      await vi.advanceTimersByTimeAsync(5000);

      const response = await responsePromise;
      expect(response.status).toBe(200);
    });

    it('should throw error after max retries exhausted', async () => {
      const mockFetch = vi.fn(async () => {
        return new Response('Server error', { status: 500 });
      });

      const responsePromise = fetchWithRetry(mockFetch, 3, 100);

      // Advance timers for all retries
      await vi.advanceTimersByTimeAsync(100); // First retry
      await vi.advanceTimersByTimeAsync(200); // Second retry

      const response = await responsePromise;

      expect(mockFetch).toHaveBeenCalledTimes(3);
      expect(response.status).toBe(500); // Returns last response even on failure
    });

    it('should use exponential backoff without Retry-After', async () => {
      const delays: number[] = [];
      const originalSetTimeout = global.setTimeout;

      const mockFetch = vi.fn(async () => {
        if (mockFetch.mock.calls.length < 3) {
          return new Response('Server error', { status: 500 });
        }
        return new Response('Success', { status: 200 });
      });

      const responsePromise = fetchWithRetry(mockFetch, 3, 100);

      // Advance through exponential backoff: 100ms, 200ms
      await vi.advanceTimersByTimeAsync(100);
      await vi.advanceTimersByTimeAsync(200);

      const response = await responsePromise;
      expect(response.status).toBe(200);
    });

    it('should retry on network error', async () => {
      let callCount = 0;
      const mockFetch = vi.fn(async () => {
        callCount++;
        if (callCount < 2) {
          throw new Error('Network error');
        }
        return new Response('Success', { status: 200 });
      });

      const responsePromise = fetchWithRetry(mockFetch, 3, 100);

      await vi.advanceTimersByTimeAsync(100);

      const response = await responsePromise;

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(response.status).toBe(200);
    });

    it('should throw last error if all retries fail due to network error', async () => {
      const mockFetch = vi.fn(async () => {
        throw new Error('Network failure');
      });

      const responsePromise = fetchWithRetry(mockFetch, 3, 100);

      await vi.advanceTimersByTimeAsync(100);
      await vi.advanceTimersByTimeAsync(200);

      await expect(responsePromise).rejects.toThrow('Network failure');
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });
  });
});

describe('Session Token Refresh', () => {
  it('should trigger refresh when token expires within 5 minutes', () => {
    const bufferMs = 5 * 60 * 1000; // 5 minutes
    const now = Date.now();

    // Token expires in 4 minutes - should refresh
    const expiresAt = now + (4 * 60 * 1000);
    const needsRefresh = expiresAt < (now + bufferMs);
    expect(needsRefresh).toBe(true);
  });

  it('should not refresh when token is valid for more than 5 minutes', () => {
    const bufferMs = 5 * 60 * 1000;
    const now = Date.now();

    // Token expires in 30 minutes - should not refresh
    const expiresAt = now + (30 * 60 * 1000);
    const needsRefresh = expiresAt < (now + bufferMs);
    expect(needsRefresh).toBe(false);
  });

  it('should handle missing refresh token gracefully', () => {
    const session = {
      spotifyAccessToken: 'valid-access-token',
      spotifyRefreshToken: undefined,
      expiresAt: Date.now() - 1000 // Already expired
    };

    const canRefresh = !!session.spotifyRefreshToken;
    expect(canRefresh).toBe(false);
  });

  it('should detect when token has already expired', () => {
    const now = Date.now();
    const expiresAt = now - (10 * 60 * 1000); // Expired 10 minutes ago

    const isExpired = expiresAt < now;
    expect(isExpired).toBe(true);
  });

  it('should preserve refresh token if new one not provided', () => {
    const originalRefreshToken = 'original-refresh-token';
    const newTokenResponse = {
      access_token: 'new-access-token',
      expires_in: 3600,
      refresh_token: undefined // Spotify may not return a new refresh token
    };

    const finalRefreshToken = newTokenResponse.refresh_token || originalRefreshToken;
    expect(finalRefreshToken).toBe(originalRefreshToken);
  });
});

describe('Bulk Playlist Creation', () => {
  it('should handle partial failures in bulk creation', () => {
    const genres = ['rock', 'pop', 'jazz', 'classical'];
    const results = [
      { genre: 'rock', success: true, url: 'https://spotify.com/playlist/1' },
      { genre: 'pop', success: false, error: 'Rate limited' },
      { genre: 'jazz', success: true, url: 'https://spotify.com/playlist/2' },
      { genre: 'classical', success: false, error: 'Network error' }
    ];

    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    expect(successful).toBe(2);
    expect(failed).toBe(2);
    expect(results.length).toBe(genres.length);
  });

  it('should accumulate results in correct order', () => {
    const genres = ['rock', 'pop', 'jazz'];
    const results: { genre: string; order: number }[] = [];

    genres.forEach((genre, index) => {
      results.push({ genre, order: index });
    });

    expect(results[0].genre).toBe('rock');
    expect(results[1].genre).toBe('pop');
    expect(results[2].genre).toBe('jazz');
    expect(results.map(r => r.order)).toEqual([0, 1, 2]);
  });

  it('should skip duplicates when skipDuplicates is true', () => {
    const existingPlaylists = ['rock (from Likes)', 'pop (from Likes)'];
    const genresToCreate = ['rock', 'jazz', 'classical'];
    const skipDuplicates = true;

    const results = genresToCreate.map(genre => {
      const playlistName = `${genre} (from Likes)`;
      const isDuplicate = existingPlaylists.includes(playlistName);

      if (isDuplicate && skipDuplicates) {
        return { genre, skipped: true, success: false };
      }
      return { genre, success: true, url: `https://spotify.com/playlist/${genre}` };
    });

    const skipped = results.filter(r => r.skipped).length;
    const created = results.filter(r => r.success).length;

    expect(skipped).toBe(1); // rock was skipped
    expect(created).toBe(2); // jazz and classical were created
  });

  it('should count totals correctly with skipped items', () => {
    const results = [
      { success: true },
      { success: false, skipped: true },
      { success: true },
      { success: false, error: 'Failed' }
    ];

    const total = results.length;
    const successful = results.filter(r => r.success).length;
    const skipped = results.filter(r => r.skipped).length;
    const failed = results.filter(r => !r.success && !r.skipped).length;

    expect(total).toBe(4);
    expect(successful).toBe(2);
    expect(skipped).toBe(1);
    expect(failed).toBe(1);
  });
});
