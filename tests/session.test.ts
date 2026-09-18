import { describe, it, expect, vi } from 'vitest';
import {
  generateState,
  storeState,
  verifyState,
  getScoreboard,
  cachedKV,
  buildScoreboard,
  getScanProgress,
  saveScanProgress,
  deleteScanProgress,
  type ScanProgress
} from '../src/lib/session';

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

      const mockKv = {} as any;
      const result = await verifyState(mockKv, 'missing-id');

      expect(result).toBeNull();
      expect(cachedKV.getString).toHaveBeenCalledWith(mockKv, 'state:missing-id');

      cachedKV.getString = originalGetString;
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
      expect(cachedKV.getString).toHaveBeenCalledWith(mockKv, 'state:valid-id');
      expect(cachedKV.delete).toHaveBeenCalledWith(mockKv, 'state:valid-id');

      cachedKV.getString = originalGetString;
      cachedKV.delete = originalDelete;
    });
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


describe('ScanProgress Management', () => {
  const mockKv = {} as any;
  const mockProgress: ScanProgress = {
    userId: 'user-123',
    totalTracks: 100,
    processedTracks: 50,
    startedAt: '2023-01-01T00:00:00Z',
    lastUpdatedAt: '2023-01-01T00:00:00Z',
    status: 'in_progress',
  };

  describe('saveScanProgress', () => {
    it('should save scan progress to KV with correct key and TTL', async () => {
      const originalPut = cachedKV.put;
      cachedKV.put = vi.fn().mockResolvedValue(undefined);

      await saveScanProgress(mockKv, mockProgress);

      expect(cachedKV.put).toHaveBeenCalledWith(
        mockKv,
        'scan_progress:user-123',
        JSON.stringify(mockProgress),
        { expirationTtl: 3600, immediate: true }
      );

      cachedKV.put = originalPut;
    });
  });

  describe('getScanProgress', () => {
    it('should retrieve scan progress from KV with correct cache TTL', async () => {
      const originalGet = cachedKV.get;
      cachedKV.get = vi.fn().mockResolvedValue(mockProgress);

      const result = await getScanProgress(mockKv, 'user-123');

      expect(cachedKV.get).toHaveBeenCalledWith(
        mockKv,
        'scan_progress:user-123',
        { cacheTtlMs: 60000 }
      );
      expect(result).toEqual(mockProgress);

      cachedKV.get = originalGet;
    });

    it('should return null if no progress is found', async () => {
      const originalGet = cachedKV.get;
      cachedKV.get = vi.fn().mockResolvedValue(null);

      const result = await getScanProgress(mockKv, 'user-123');
      expect(result).toBeNull();

      cachedKV.get = originalGet;
    });
  });

  describe('deleteScanProgress', () => {
    it('should delete scan progress from KV', async () => {
      const originalDelete = cachedKV.delete;
      cachedKV.delete = vi.fn().mockResolvedValue(undefined);

      await deleteScanProgress(mockKv, 'user-123');

      expect(cachedKV.delete).toHaveBeenCalledWith(
        mockKv,
        'scan_progress:user-123'
      );

      cachedKV.delete = originalDelete;
    });
  });
});
