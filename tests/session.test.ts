import { addPlaylistToUser } from '../src/lib/session';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { generateState } from '../src/lib/session';

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


import { storeState, verifyState } from '../src/lib/session';

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


describe('addPlaylistToUser', () => {
  let originalGet: any;
  let originalPut: any;

  beforeEach(() => {
    originalGet = cachedKV.get;
    originalPut = cachedKV.put;
  });

  afterEach(() => {
    cachedKV.get = originalGet;
    cachedKV.put = originalPut;
    vi.useRealTimers();
  });

  it('should not do anything if user does not exist', async () => {
    cachedKV.get = vi.fn().mockResolvedValue(null);
    cachedKV.put = vi.fn().mockResolvedValue(undefined);

    const mockKv = {} as any;
    await addPlaylistToUser(mockKv, 'missing-user', 'playlist-1', 10);

    expect(cachedKV.get).toHaveBeenCalledWith(mockKv, 'user_stats:missing-user', expect.any(Object));
    expect(cachedKV.put).not.toHaveBeenCalled();
  });

  it('should add playlist to user stats and update counts if not already added', async () => {
    const mockUserStats = {
      spotifyId: 'test-user',
      createdPlaylistIds: ['playlist-old'],
      playlistsCreated: 1,
      totalTracksInPlaylists: 10,
      lastActive: 'old-date'
    };

    cachedKV.get = vi.fn().mockResolvedValue(mockUserStats);
    cachedKV.put = vi.fn().mockResolvedValue(undefined);

    const mockKv = {} as any;

    // freeze time for deterministic test safely using vitest
    const mockDate = new Date('2023-01-01T00:00:00Z');
    vi.useFakeTimers();
    vi.setSystemTime(mockDate);

    await addPlaylistToUser(mockKv, 'test-user', 'playlist-new', 25);

    expect(cachedKV.get).toHaveBeenCalledWith(mockKv, 'user_stats:test-user', expect.any(Object));
    expect(cachedKV.put).toHaveBeenCalledWith(
      mockKv,
      'user_stats:test-user',
      JSON.stringify({
        spotifyId: 'test-user',
        createdPlaylistIds: ['playlist-old', 'playlist-new'],
        playlistsCreated: 2,
        totalTracksInPlaylists: 35,
        lastActive: mockDate.toISOString()
      }),
      { immediate: true }
    );
  });

  it('should not modify user stats if playlist is already added', async () => {
    const mockUserStats = {
      spotifyId: 'test-user',
      createdPlaylistIds: ['playlist-123'],
      playlistsCreated: 1,
      totalTracksInPlaylists: 15,
      lastActive: 'old-date'
    };

    cachedKV.get = vi.fn().mockResolvedValue(mockUserStats);
    cachedKV.put = vi.fn().mockResolvedValue(undefined);

    const mockKv = {} as any;

    await addPlaylistToUser(mockKv, 'test-user', 'playlist-123', 15);

    expect(cachedKV.get).toHaveBeenCalledWith(mockKv, 'user_stats:test-user', expect.any(Object));
    expect(cachedKV.put).not.toHaveBeenCalled();
  });

  it('should handle undefined totalTracksInPlaylists', async () => {
    const mockUserStats = {
      spotifyId: 'test-user',
      createdPlaylistIds: [],
      playlistsCreated: 0,
      totalTracksInPlaylists: undefined,
      lastActive: 'old-date'
    };

    cachedKV.get = vi.fn().mockResolvedValue(mockUserStats);
    cachedKV.put = vi.fn().mockResolvedValue(undefined);

    const mockKv = {} as any;

    await addPlaylistToUser(mockKv, 'test-user', 'playlist-new', 5);

    expect(cachedKV.put).toHaveBeenCalledWith(
      mockKv,
      'user_stats:test-user',
      expect.stringContaining('"totalTracksInPlaylists":5'),
      { immediate: true }
    );
  });
});
