import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getGitHubAuthUrl, exchangeGitHubCode, getGitHubUser, isUserAllowed } from '../src/lib/github';

describe('GitHub Library', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('getGitHubAuthUrl', () => {
    it('should generate a valid GitHub auth URL', () => {
      const url = getGitHubAuthUrl(
        'test-client-id',
        'https://example.com/callback',
        'test-state-123'
      );

      expect(url).toContain('https://github.com/login/oauth/authorize');
      expect(url).toContain('client_id=test-client-id');
      expect(url).toContain('redirect_uri=https%3A%2F%2Fexample.com%2Fcallback');
      expect(url).toContain('state=test-state-123');
      expect(url).toContain('scope=read%3Auser');
    });
  });

  describe('exchangeGitHubCode', () => {
    it('should successfully exchange code for access token', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        json: vi.fn().mockResolvedValue({ access_token: 'test-access-token' }),
      });

      const token = await exchangeGitHubCode('test-code', 'client-id', 'client-secret');

      expect(token).toBe('test-access-token');
      expect(global.fetch).toHaveBeenCalledWith('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          client_id: 'client-id',
          client_secret: 'client-secret',
          code: 'test-code',
        }),
      });
    });

    it('should throw an error when API returns an error', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        json: vi.fn().mockResolvedValue({ error: 'bad_verification_code' }),
      });

      await expect(
        exchangeGitHubCode('bad-code', 'client-id', 'client-secret')
      ).rejects.toThrow('bad_verification_code');
    });

    it('should throw an error when access_token is missing without explicit error', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        json: vi.fn().mockResolvedValue({}),
      });

      await expect(
        exchangeGitHubCode('test-code', 'client-id', 'client-secret')
      ).rejects.toThrow('Failed to exchange code');
    });
  });

  describe('getGitHubUser', () => {
    it('should fetch user data successfully', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          login: 'testuser',
          avatar_url: 'https://example.com/avatar.jpg',
          name: 'Test User',
        }),
      });

      const user = await getGitHubUser('valid-token');

      expect(user).toEqual({
        login: 'testuser',
        avatar_url: 'https://example.com/avatar.jpg',
        name: 'Test User',
      });
      expect(global.fetch).toHaveBeenCalledWith('https://api.github.com/user', {
        headers: {
          Authorization: 'Bearer valid-token',
          Accept: 'application/vnd.github.v3+json',
          'User-Agent': 'Spotify-Genre-Organizer',
        },
      });
    });

    it('should throw an error when response is not ok', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
      });

      await expect(getGitHubUser('invalid-token')).rejects.toThrow('Failed to get GitHub user');
    });
  });

  describe('isUserAllowed', () => {
    it('should return true for an allowed user', () => {
      expect(isUserAllowed('alloweduser', 'alloweduser,otheruser')).toBe(true);
    });

    it('should return false for an unallowed user', () => {
      expect(isUserAllowed('unalloweduser', 'alloweduser,otheruser')).toBe(false);
    });

    it('should be case-insensitive', () => {
      expect(isUserAllowed('AllowedUser', 'alloweduser,otheruser')).toBe(true);
      expect(isUserAllowed('alloweduser', 'AllowedUser,otheruser')).toBe(true);
    });

    it('should handle whitespace in the allowlist', () => {
      expect(isUserAllowed('alloweduser', ' alloweduser , otheruser ')).toBe(true);
    });

    it('should return false when allowlist is empty', () => {
      expect(isUserAllowed('anyuser', '')).toBe(false);
    });

    it('should return false when allowlist is undefined or null', () => {
      expect(isUserAllowed('anyuser', undefined as any)).toBe(false);
      expect(isUserAllowed('anyuser', null as any)).toBe(false);
    });
  });
});
