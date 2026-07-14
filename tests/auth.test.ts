import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import auth from '../src/routes/auth';
import * as session from '../src/lib/session';
import * as github from '../src/lib/github';
import * as spotify from '../src/lib/spotify';
import * as logger from '../src/lib/logger';

// Mock dependencies
vi.mock('../src/lib/session', async () => {
  const actual = await vi.importActual('../src/lib/session');
  return {
    ...actual as any,
    deleteSession: vi.fn(),
    getSession: vi.fn(),
    createSession: vi.fn(),
    updateSession: vi.fn(),
    storeState: vi.fn(),
    verifyState: vi.fn(),
    trackAnalyticsEvent: vi.fn(),
    registerUser: vi.fn(),
  };
});

vi.mock('../src/lib/github', async () => {
  const actual = await vi.importActual('../src/lib/github');
  return {
    ...actual as any,
    exchangeGitHubCode: vi.fn(),
    getGitHubUser: vi.fn(),
    isUserAllowed: vi.fn(),
  };
});

vi.mock('../src/lib/spotify', async () => {
  const actual = await vi.importActual('../src/lib/spotify');
  return {
    ...actual as any,
    exchangeSpotifyCode: vi.fn(),
    getCurrentUser: vi.fn(),
  };
});

vi.mock('../src/lib/logger', async () => {
  const actual = await vi.importActual('../src/lib/logger');
  return {
    ...actual as any,
    createLogger: vi.fn().mockReturnValue({ info: vi.fn(), logError: vi.fn() }),
  };
});

describe('Auth Routes', () => {
  let app: Hono<any>;

  beforeEach(() => {
    vi.clearAllMocks();
    app = new Hono();
    app.route('/auth', auth);
  });

  describe('GET /auth/logout', () => {
    it('should call deleteSession and redirect to /', async () => {
      const req = new Request('http://localhost/auth/logout');
      const res = await app.fetch(req, { SESSIONS: {} }, { passThroughOnException: vi.fn(), waitUntil: vi.fn() });

      expect(res.status).toBe(302);
      expect(res.headers.get('Location')).toBe('/');
      expect(session.deleteSession).toHaveBeenCalled();
    });
  });

  describe('GET /auth/github', () => {
    it('should redirect to spotify auth in spotify-only mode', async () => {
      const req = new Request('http://localhost/auth/github');
      const res = await app.fetch(req, { SPOTIFY_ONLY_AUTH: 'true' }, { passThroughOnException: vi.fn(), waitUntil: vi.fn() });

      expect(res.status).toBe(302);
      expect(res.headers.get('Location')).toBe('/auth/spotify');
    });

    it('should generate state and redirect to github auth', async () => {
      const req = new Request('http://localhost/auth/github');
      const res = await app.fetch(req, { GITHUB_CLIENT_ID: 'client_id' }, { passThroughOnException: vi.fn(), waitUntil: vi.fn() });

      expect(res.status).toBe(302);
      const location = res.headers.get('Location');
      expect(location).toContain('github.com/login/oauth/authorize');
      expect(location).toContain('client_id=client_id');
      expect(session.storeState).toHaveBeenCalled();
    });
  });

  describe('GET /auth/github/callback', () => {
    it('should successfully exchange code and create session', async () => {
      vi.mocked(session.verifyState).mockResolvedValue({ provider: 'github' } as any);
      vi.mocked(github.exchangeGitHubCode).mockResolvedValue('access_token');
      vi.mocked(github.getGitHubUser).mockResolvedValue({ login: 'testuser', avatar_url: 'http://example.com/avatar.png' } as any);
      vi.mocked(github.isUserAllowed).mockReturnValue(true);

      const req = new Request('http://localhost/auth/github/callback?code=123&state=xyz');
      const res = await app.fetch(req, { SPOTIFY_ONLY_AUTH: 'false', GITHUB_CLIENT_ID: 'id', GITHUB_CLIENT_SECRET: 'secret', BETTERSTACK_LOG_TOKEN: 'mock' } as any, { passThroughOnException: vi.fn(), waitUntil: vi.fn() } as any);

      expect(res.status).toBe(302);
      expect(res.headers.get('Location')).toBe('/');
      expect(session.createSession).toHaveBeenCalled();
    });

    it('should redirect to / if spotify only mode', async () => {
      const req = new Request('http://localhost/auth/github/callback');
      const res = await app.fetch(req, { SPOTIFY_ONLY_AUTH: 'true' }, { passThroughOnException: vi.fn(), waitUntil: vi.fn() });

      expect(res.status).toBe(302);
      expect(res.headers.get('Location')).toBe('/');
    });

    it('should redirect to /?error=github_denied if error is in query', async () => {
      const req = new Request('http://localhost/auth/github/callback?error=access_denied');
      const res = await app.fetch(req, { SPOTIFY_ONLY_AUTH: 'false', GITHUB_CLIENT_ID: 'id', BETTERSTACK_LOG_TOKEN: 'mock' } as any, { passThroughOnException: vi.fn(), waitUntil: vi.fn() } as any);

      expect(res.status).toBe(302);
      expect(res.headers.get('Location')).toBe('/?error=github_denied');
      expect(session.trackAnalyticsEvent).toHaveBeenCalledWith(undefined, 'authFailure', { message: 'GitHub OAuth denied' });
    });

    it('should redirect to /?error=invalid_request if code or state is missing', async () => {
      const req = new Request('http://localhost/auth/github/callback?code=123');
      const res = await app.fetch(req, { SPOTIFY_ONLY_AUTH: 'false', GITHUB_CLIENT_ID: 'id', BETTERSTACK_LOG_TOKEN: 'mock' } as any, { passThroughOnException: vi.fn(), waitUntil: vi.fn() } as any);

      expect(res.status).toBe(302);
      expect(res.headers.get('Location')).toBe('/?error=invalid_request');
    });

    it('should redirect to /?error=invalid_state if verifyState returns null', async () => {
      vi.mocked(session.verifyState).mockResolvedValue(null);
      const req = new Request('http://localhost/auth/github/callback?code=123&state=xyz');
      const res = await app.fetch(req, { SPOTIFY_ONLY_AUTH: 'false', GITHUB_CLIENT_ID: 'id', BETTERSTACK_LOG_TOKEN: 'mock' } as any, { passThroughOnException: vi.fn(), waitUntil: vi.fn() } as any);

      expect(res.status).toBe(302);
      expect(res.headers.get('Location')).toBe('/?error=invalid_state');
    });
  });

  describe('GET /auth/spotify', () => {
    it('should redirect to /?error=not_logged_in if github mode and no session', async () => {
      const req = new Request('http://localhost/auth/spotify');
      vi.mocked(session.getSession).mockResolvedValue(null);
      const res = await app.fetch(req, { GITHUB_CLIENT_ID: 'client_id' }, { passThroughOnException: vi.fn(), waitUntil: vi.fn() });

      expect(res.status).toBe(302);
      expect(res.headers.get('Location')).toBe('/?error=not_logged_in');
    });

    it('should redirect to spotify auth in spotify-only mode', async () => {
      const req = new Request('http://localhost/auth/spotify');
      const res = await app.fetch(req, { SPOTIFY_ONLY_AUTH: 'true', SPOTIFY_CLIENT_ID: 'spotify_client_id' }, { passThroughOnException: vi.fn(), waitUntil: vi.fn() });

      expect(res.status).toBe(302);
      const location = res.headers.get('Location');
      expect(location).toContain('accounts.spotify.com/authorize');
      expect(location).toContain('client_id=spotify_client_id');
      expect(session.storeState).toHaveBeenCalled();
    });
  });

  describe('GET /auth/spotify/callback', () => {
    it('should successfully exchange code and update session', async () => {
      vi.mocked(session.verifyState).mockResolvedValue({ provider: 'spotify', spotifyOnly: 'false', codeVerifier: 'verifier' } as any);
      vi.mocked(session.getSession).mockResolvedValue({ githubUser: 'test' } as any);
      vi.mocked(session.createSession).mockResolvedValue(undefined);
      vi.mocked(session.registerUser).mockResolvedValue(undefined);
      vi.mocked(spotify.exchangeSpotifyCode).mockResolvedValue({ access_token: 'token', refresh_token: 'refresh', expires_in: 3600 } as any);
      vi.mocked(spotify.getCurrentUser).mockResolvedValue({ id: 'spotify123', display_name: 'Spotify User', images: [{ url: 'http://example.com/avatar.png' }] } as any);

      const req = new Request('http://localhost/auth/spotify/callback?code=123&state=xyz');
      const res = await app.fetch(req, { BETTERSTACK_LOG_TOKEN: 'mock', SPOTIFY_CLIENT_ID: 'id', SPOTIFY_CLIENT_SECRET: 'secret', SESSIONS: { get: vi.fn(), put: vi.fn() } } as any, { passThroughOnException: vi.fn(), waitUntil: vi.fn() } as any);

      expect(res.status).toBe(302);
      expect(res.headers.get('Location')).toBe('/');
      expect(session.updateSession).toHaveBeenCalled();
    });

    it('should redirect to /?error=spotify_denied if error is in query', async () => {
      const req = new Request('http://localhost/auth/spotify/callback?error=access_denied');
      const res = await app.fetch(req, { BETTERSTACK_LOG_TOKEN: 'mock' } as any, { passThroughOnException: vi.fn(), waitUntil: vi.fn() } as any);

      expect(res.status).toBe(302);
      expect(res.headers.get('Location')).toBe('/?error=spotify_denied');
    });

    it('should redirect to /?error=invalid_request if code or state is missing', async () => {
      const req = new Request('http://localhost/auth/spotify/callback?code=123');
      const res = await app.fetch(req, { BETTERSTACK_LOG_TOKEN: 'mock' } as any, { passThroughOnException: vi.fn(), waitUntil: vi.fn() } as any);

      expect(res.status).toBe(302);
      expect(res.headers.get('Location')).toBe('/?error=invalid_request');
    });

    it('should redirect to /?error=invalid_state if verifyState returns null', async () => {
      vi.mocked(session.verifyState).mockResolvedValue(null);
      const req = new Request('http://localhost/auth/spotify/callback?code=123&state=xyz');
      const res = await app.fetch(req, { BETTERSTACK_LOG_TOKEN: 'mock' } as any, { passThroughOnException: vi.fn(), waitUntil: vi.fn() } as any);

      expect(res.status).toBe(302);
      expect(res.headers.get('Location')).toBe('/?error=invalid_state');
    });
  });
});
