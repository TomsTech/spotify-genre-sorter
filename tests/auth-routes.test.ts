import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Hono } from 'hono';
import auth from '../src/routes/auth';
import * as spotify from '../src/lib/spotify';
import * as github from '../src/lib/github';
import * as session from '../src/lib/session';
import { createLogger } from '../src/lib/logger';

// Mock dependencies
vi.mock('../src/lib/spotify', () => ({
  exchangeSpotifyCode: vi.fn(),
  getCurrentUser: vi.fn(),
  getSpotifyAuthUrl: vi.fn(),
  generateCodeVerifier: vi.fn(),
  createCodeChallenge: vi.fn(),
}));

vi.mock('../src/lib/github', () => ({
  exchangeGitHubCode: vi.fn(),
  getGitHubUser: vi.fn(),
  getGitHubAuthUrl: vi.fn(),
  isUserAllowed: vi.fn(),
}));

vi.mock('../src/lib/session', () => ({
  verifyState: vi.fn(),
  getSession: vi.fn(),
  trackAnalyticsEvent: vi.fn(),
  createSession: vi.fn(),
  updateSession: vi.fn(),
  registerUser: vi.fn(),
}));

vi.mock('../src/lib/logger', () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    error: vi.fn(),
    logError: vi.fn(),
  })),
}));

describe('Auth Routes', () => {
  let app: Hono;

  beforeEach(() => {
    app = new Hono();
    // Simulate env middleware
    app.use('*', async (c, next) => {
      const mockEnv = {
        SESSIONS: {}, // Mock KV
        SPOTIFY_CLIENT_ID: 'mock-client-id',
        SPOTIFY_CLIENT_SECRET: 'mock-client-secret',
        GITHUB_CLIENT_ID: 'mock-github-id',
        GITHUB_CLIENT_SECRET: 'mock-github-secret',
        SPOTIFY_ONLY_AUTH: 'true', // Test spotify-only mode by default
      };
      Object.defineProperty(c, 'env', { get: () => mockEnv, set: (val) => { Object.assign(mockEnv, val); } });
      Object.defineProperty(c, 'executionCtx', { get: () => ({ waitUntil: vi.fn() }) });
      await next();
    });
    app.route('/auth', auth);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /auth/spotify/callback', () => {
    it('should redirect to /?error=spotify_auth_failed when exchangeSpotifyCode fails', async () => {
      // 1. Mock verifyState to return a valid state
      vi.mocked(session.verifyState).mockResolvedValue({
        provider: 'spotify',
        spotifyOnly: 'true',
        codeVerifier: 'mock-verifier',
      } as any);

      // 2. Mock exchangeSpotifyCode to throw an error
      const errorMsg = 'Spotify exchange failed';
      vi.mocked(spotify.exchangeSpotifyCode).mockRejectedValue(new Error(errorMsg));

      // 3. Make request to the callback endpoint
      const req = new Request('http://localhost/auth/spotify/callback?code=mock-code&state=mock-state');
      const res = await app.request(req);

      // 4. Verify expectations
      expect(res.status).toBe(302);
      expect(res.headers.get('Location')).toBe('/?error=spotify_auth_failed');

      expect(session.trackAnalyticsEvent).toHaveBeenCalledWith(
        expect.anything(),
        'authFailure',
        { message: `Spotify auth failed: ${errorMsg}` }
      );
    });
  });

  describe('GET /auth/github/callback', () => {
    it('should redirect to /?error=auth_failed when exchangeGitHubCode fails', async () => {
      // Change to github mode
      app = new Hono();
      app.use('*', async (c, next) => {
        const mockEnv = {
          SESSIONS: {},
          GITHUB_CLIENT_ID: 'mock-github-id',
          GITHUB_CLIENT_SECRET: 'mock-github-secret',
          SPOTIFY_ONLY_AUTH: 'false',
        };
        Object.defineProperty(c, 'env', { get: () => mockEnv });
        Object.defineProperty(c, 'executionCtx', { get: () => ({ waitUntil: vi.fn() }) });
        await next();
      });
      app.route('/auth', auth);

      // 1. Mock verifyState to return a valid state
      vi.mocked(session.verifyState).mockResolvedValue({
        provider: 'github',
      } as any);

      // 2. Mock exchangeGitHubCode to throw an error
      const errorMsg = 'GitHub exchange failed';
      vi.mocked(github.exchangeGitHubCode).mockRejectedValue(new Error(errorMsg));

      // 3. Make request to the callback endpoint
      const req = new Request('http://localhost/auth/github/callback?code=mock-code&state=mock-state');
      const res = await app.request(req);

      // 4. Verify expectations
      expect(res.status).toBe(302);
      expect(res.headers.get('Location')).toBe('/?error=auth_failed');

      expect(session.trackAnalyticsEvent).toHaveBeenCalledWith(
        expect.anything(),
        'authFailure',
        { message: `GitHub auth failed: ${errorMsg}` }
      );
    });
  });
});
