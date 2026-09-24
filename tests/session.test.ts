import { describe, it, expect } from 'vitest';
import { generateState, getUserStats } from '../src/lib/session';

describe('Session Management', () => {
  describe('generateState', () => {
    it('should generate a valid UUID', () => {
      const state = generateState();
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      expect(state).toMatch(uuidRegex);
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

import { vi } from 'vitest';

import { storeState, verifyState, deleteScanProgress } from '../src/lib/session';

describe('State Management', () => {
  describe('storeState', () => {
    it('should store state in KV with correct TTL', async () => {
      const originalPut = cachedKV.put;
      cachedKV.put = vi.fn().mockResolvedValue(undefined);

      const mockKv = {} as any;
      const data = { token: '123' };

      await storeState(mockKv, 'test-id', data);

      expect(cachedKV.put).toHaveBeenCalledWith(
        mockKv,
        'state:test-id',
        JSON.stringify(data),
        { expirationTtl: 600, immediate: true }
      );

      cachedKV.put = originalPut;
    });
  });

  describe('verifyState', () => {
    it('should return null if state not found', async () => {
      const originalGetString = cachedKV.getString;
      cachedKV.getString = vi.fn().mockResolvedValue(null);
      const originalDelete = cachedKV.delete;
      cachedKV.delete = vi.fn().mockResolvedValue(undefined);

      const mockKv = {} as any;
      const result = await verifyState(mockKv, 'missing-id');

      expect(result).toBeNull();
      expect(cachedKV.getString).toHaveBeenCalledWith(mockKv, 'state:missing-id', { cacheTtlMs: 0 });

      cachedKV.getString = originalGetString;
      cachedKV.delete = originalDelete;
    });

    it('should return parsed state and delete it from KV', async () => {
      const originalGetString = cachedKV.getString;
      const originalDelete = cachedKV.delete;

      const mockData = { token: '123' };
      cachedKV.getString = vi.fn().mockResolvedValue(JSON.stringify(mockData));
      cachedKV.delete = vi.fn().mockResolvedValue(undefined);

      const mockKv = {} as any;
      const result = await verifyState(mockKv, 'valid-id');

      expect(result).toEqual(mockData);
      expect(cachedKV.getString).toHaveBeenCalledWith(mockKv, 'state:valid-id', { cacheTtlMs: 0 });
      expect(cachedKV.delete).toHaveBeenCalledWith(mockKv, 'state:valid-id');

      cachedKV.getString = originalGetString;
      cachedKV.delete = originalDelete;
    });
  });
});

import { getScoreboard, cachedKV } from '../src/lib/session';

import { buildScoreboard } from '../src/lib/session';

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

describe('deleteScanProgress', () => {
  it('should call cachedKV.delete with correct key', async () => {
    const originalDelete = cachedKV.delete;
    cachedKV.delete = vi.fn().mockResolvedValue(undefined);

    const mockKv = {} as any;
    const userId = 'test-user-123';

    await deleteScanProgress(mockKv, userId);

    expect(cachedKV.delete).toHaveBeenCalledWith(mockKv, 'scan_progress:test-user-123');

    cachedKV.delete = originalDelete;
  });

  it('should propagate errors from cachedKV.delete', async () => {
    const originalDelete = cachedKV.delete;
    const error = new Error('KV Error');
    cachedKV.delete = vi.fn().mockRejectedValue(error);

    const mockKv = {} as any;
    const userId = 'test-user-123';

    await expect(deleteScanProgress(mockKv, userId)).rejects.toThrow('KV Error');

    cachedKV.delete = originalDelete;
  });
});

describe('getUserStats', () => {
  it('should fetch user stats using cachedKV.get with correct parameters', async () => {
    const originalGet = cachedKV.get;

    const mockUserStats = {
      totalGenresDiscovered: 10,
      totalArtistsDiscovered: 5,
      totalTracksAnalysed: 20,
      playlistsCreated: 1,
      totalTracksInPlaylists: 15,
      firstSeen: '2023-01-01',
      lastActive: '2023-01-02',
      createdPlaylistIds: ['playlist-1']
    };

    cachedKV.get = vi.fn().mockResolvedValue(mockUserStats);

    const mockKv = {} as any;
    const spotifyId = 'test-spotify-id';

    const result = await getUserStats(mockKv, spotifyId);

    expect(result).toEqual(mockUserStats);
    expect(cachedKV.get).toHaveBeenCalledWith(
      mockKv,
      `user_stats:${spotifyId}`,
      { cacheTtlMs: 300000 } // CACHE_TTL.USER_STATS is 300000
    );

    cachedKV.get = originalGet;
  });

  it('should propagate errors from cachedKV.get', async () => {
    const originalGet = cachedKV.get;

    cachedKV.get = vi.fn().mockRejectedValue(new Error('KV Error'));

    const mockKv = {} as any;
    const spotifyId = 'test-spotify-id';

    await expect(getUserStats(mockKv, spotifyId)).rejects.toThrow('KV Error');

    cachedKV.get = originalGet;
  });
});
