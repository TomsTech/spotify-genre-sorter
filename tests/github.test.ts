import { describe, it, expect, vi, afterEach } from 'vitest';
import { isUserAllowed, exchangeGitHubCode, getGitHubAuthUrl, getGitHubUser } from '../src/lib/github';

describe('isUserAllowed', () => {
  it('returns false when allowedUsers is empty', () => {
    expect(isUserAllowed('alice', '')).toBe(false);
  });

  it('returns false when allowedUsers is only whitespace', () => {
    expect(isUserAllowed('alice', '   ')).toBe(false);
  });

  it('returns true when username is in allowedUsers', () => {
    expect(isUserAllowed('alice', 'alice,bob,charlie')).toBe(true);
  });

  it('returns false when username is not in allowedUsers', () => {
    expect(isUserAllowed('eve', 'alice,bob,charlie')).toBe(false);
  });

  it('is case-insensitive for username', () => {
    expect(isUserAllowed('ALICE', 'alice,bob,charlie')).toBe(true);
  });

  it('is case-insensitive for allowedUsers', () => {
    expect(isUserAllowed('alice', 'ALICE,BOB,CHARLIE')).toBe(true);
  });

  it('handles spaces in allowedUsers gracefully', () => {
    expect(isUserAllowed('bob', ' alice , bob , charlie ')).toBe(true);
  });

  it('handles empty strings in the comma-separated list', () => {
    expect(isUserAllowed('bob', 'alice,,bob,charlie')).toBe(true);
  });
});

describe('exchangeGitHubCode', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should successfully exchange code for an access token', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      json: async () => ({ access_token: 'valid_token' }),
    } as any);

    const token = await exchangeGitHubCode('test_code', 'client_id', 'client_secret');
    expect(token).toBe('valid_token');
    expect(global.fetch).toHaveBeenCalledWith('https://github.com/login/oauth/access_token', expect.any(Object));
  });

  it('should throw an error if the response contains an error field', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      json: async () => ({ error: 'bad_verification_code' }),
    } as any);

    await expect(exchangeGitHubCode('bad_code', 'client_id', 'client_secret')).rejects.toThrow('bad_verification_code');
  });

  it('should throw an error if the response lacks both access_token and error fields', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      json: async () => ({}),
    } as any);

    await expect(exchangeGitHubCode('test_code', 'client_id', 'client_secret')).rejects.toThrow('Failed to exchange code');
  });
});


describe('getGitHubAuthUrl', () => {
  it('generates a correct GitHub OAuth URL', () => {
    const url = getGitHubAuthUrl('my-client-id', 'https://example.com/callback', 'random-state');
    const parsedUrl = new URL(url);

    expect(parsedUrl.origin).toBe('https://github.com');
    expect(parsedUrl.pathname).toBe('/login/oauth/authorize');
    expect(parsedUrl.searchParams.get('client_id')).toBe('my-client-id');
    expect(parsedUrl.searchParams.get('redirect_uri')).toBe('https://example.com/callback');
    expect(parsedUrl.searchParams.get('scope')).toBe('read:user');
    expect(parsedUrl.searchParams.get('state')).toBe('random-state');
  });

  it('URL encodes special characters in parameters', () => {
    const url = getGitHubAuthUrl('client-id-!@#', 'https://example.com/cb?foo=bar', 'state-with space');
    const parsedUrl = new URL(url);

    expect(parsedUrl.searchParams.get('client_id')).toBe('client-id-!@#');
    expect(parsedUrl.searchParams.get('redirect_uri')).toBe('https://example.com/cb?foo=bar');
    expect(parsedUrl.searchParams.get('state')).toBe('state-with space');
  });
});

describe('getGitHubUser', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should successfully get GitHub user', async () => {
    const mockUser = { login: 'octocat', avatar_url: 'https://github.com/images/error/octocat_happy.gif', name: 'monalisa octocat' };
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => mockUser,
    } as any);

    const user = await getGitHubUser('valid_token');
    expect(user).toEqual(mockUser);
    expect(global.fetch).toHaveBeenCalledWith('https://api.github.com/user', {
      headers: {
        Authorization: 'Bearer valid_token',
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'Spotify-Genre-Organizer',
      },
    });
  });

  it('should throw an error if the response is not ok', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
    } as any);

    await expect(getGitHubUser('invalid_token')).rejects.toThrow('Failed to get GitHub user');
    expect(global.fetch).toHaveBeenCalledWith('https://api.github.com/user', {
      headers: {
        Authorization: 'Bearer invalid_token',
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'Spotify-Genre-Organizer',
      },
    });
  });
});
