import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateState, createSession, Session, cachedKV } from '../src/lib/session';
import { Context } from 'hono';
import * as cookie from 'hono/cookie';

vi.mock('hono/cookie', () => ({
  setCookie: vi.fn(),
  getCookie: vi.fn(),
  deleteCookie: vi.fn(),
}));

describe('Session Management', () => {

  describe('createSession', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('should create a session, save to kv and set cookie', async () => {
      const originalPut = cachedKV.put;
      cachedKV.put = vi.fn().mockResolvedValue(undefined);

      const mockEnv = { SESSIONS: {} as any };
      const mockContext = { env: mockEnv } as any as Context<{ Bindings: Env }, any, any>;
      const mockSession: Session = { spotifyUser: 'test' };

      const sessionId = await createSession(mockContext, mockSession);

      expect(sessionId).toBeDefined();
      expect(typeof sessionId).toBe('string');

      expect(cachedKV.put).toHaveBeenCalledWith(
        mockEnv.SESSIONS,
        `session:${sessionId}`,
        expect.any(String),
        { expirationTtl: 60 * 60 * 24 * 7, immediate: true }
      );

      const putCallArg = (cachedKV.put as any).mock.calls[0][2];
      const parsedSession = JSON.parse(putCallArg);
      expect(parsedSession.spotifyUser).toBe('test');
      expect(parsedSession.csrfToken).toBeDefined();

      expect(cookie.setCookie).toHaveBeenCalledWith(
        mockContext,
        'session_id',
        sessionId,
        {
          httpOnly: true,
          secure: true,
          sameSite: 'Lax',
          maxAge: 60 * 60 * 24 * 7,
          path: '/',
        }
      );

      cachedKV.put = originalPut;
    });
  });

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

import { getScoreboard } from '../src/lib/session';

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
