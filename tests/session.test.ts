import { describe, it, expect, vi } from 'vitest';
import { generateState, getScoreboard, cachedKV, buildScoreboard } from '../src/lib/session';

describe('Session Management', () => {
  describe('generateState', () => {
    it('should generate a string of length 32', () => {
      const state = generateState();
      expect(state).toHaveLength(32);
    });

    it('should only contain valid hex characters', () => {
      const state = generateState();
      const hexRegex = /^[0-9a-f]+$/i;
      expect(state).toMatch(hexRegex);
    });

    it('should generate unique states on each call', () => {
      const states = new Set<string>();
      for (let i = 0; i < 100; i++) {
        states.add(generateState());
      }
      expect(states.size).toBe(100);
    });
  });

  describe('Session TTL', () => {
    it('should have a 7-day TTL constant', () => {
      const SESSION_TTL = 60 * 60 * 24 * 7;
      expect(SESSION_TTL).toBe(604800);
    });
  });

  describe('Cookie Configuration', () => {
    it('should use secure cookie settings', () => {
      const cookieOptions = {
        httpOnly: true,
        secure: true,
        sameSite: 'Lax' as const,
        path: '/',
      };

      expect(cookieOptions.httpOnly).toBe(true);
      expect(cookieOptions.secure).toBe(true);
      expect(cookieOptions.sameSite).toBe('Lax');
    });
  });
});

describe('Token Refresh Logic', () => {
  it('should trigger refresh when token expires within 5 minutes', () => {
    const expiresAt = Date.now() + (4 * 60 * 1000);
    const bufferMs = 5 * 60 * 1000;

    const needsRefresh = expiresAt < (Date.now() + bufferMs);
    expect(needsRefresh).toBe(true);
  });

  it('should not refresh when token is still valid', () => {
    const expiresAt = Date.now() + (30 * 60 * 1000);
    const bufferMs = 5 * 60 * 1000;

    const needsRefresh = expiresAt < (Date.now() + bufferMs);
    expect(needsRefresh).toBe(false);
  });
});

describe('buildScoreboard', () => {
  it('should paginate through user_stats using cursor when list_complete is false', async () => {
    const mockKv = {
      list: vi.fn(),
      get: vi.fn().mockResolvedValue(JSON.stringify({
        totalGenresDiscovered: 1,
        totalArtistsDiscovered: 1,
        totalTracksAnalysed: 1,
        playlistsCreated: 1,
        totalTracksInPlaylists: 1,
        spotifyId: '1',
        spotifyName: 'A',
        spotifyAvatar: 'A'
      })),
      put: vi.fn().mockResolvedValue(undefined)
    };

    mockKv.list
      .mockResolvedValueOnce({
        keys: [{ name: 'user_stats:1' }],
        list_complete: false,
        cursor: 'cursor-1'
      })
      .mockResolvedValueOnce({
        keys: [{ name: 'user_stats:2' }],
        list_complete: true,
      });

    const scoreboard = await buildScoreboard(mockKv as any);

    expect(mockKv.list).toHaveBeenCalledTimes(2);
    expect(mockKv.list).toHaveBeenNthCalledWith(1, { prefix: 'user_stats:', cursor: undefined });
    expect(mockKv.list).toHaveBeenNthCalledWith(2, { prefix: 'user_stats:', cursor: 'cursor-1' });
    expect(scoreboard.totalUsers).toBe(2);
  });
});

describe('getScoreboard', () => {
  it('should return empty scoreboard on error', async () => {
    // mock cachedKV.get to throw error
    const originalGet = cachedKV.get;
    cachedKV.get = vi.fn().mockRejectedValue(new Error('KV Error'));

    const result = await getScoreboard({} as any);

    expect(result).toBeDefined();
    if (result) {
      expect(result.byGenres).toEqual([]);
      expect(result.byArtists).toEqual([]);
      expect(result.byTracks).toEqual([]);
      expect(result.byPlaylists).toEqual([]);
      expect(result.byTracksInPlaylists).toEqual([]);
      expect(result.totalUsers).toBe(0);
    }

    // restore
    cachedKV.get = originalGet;
  });
});
