import { describe, it, expect } from 'vitest';
import { isUserAllowed, exchangeGitHubCode, getGitHubUser, getGitHubAuthUrl } from '../src/lib/github';
import { vi, afterEach } from 'vitest';

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
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('throws an error if response contains an error', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      json: async () => ({ error: 'bad_verification_code' })
    });

    await expect(exchangeGitHubCode('fake-code', 'client-id', 'client-secret')).rejects.toThrow('bad_verification_code');
  });

  it('throws an error if access_token is missing', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      json: async () => ({ some_other_field: 'value' })
    });

    await expect(exchangeGitHubCode('fake-code', 'client-id', 'client-secret')).rejects.toThrow('Failed to exchange code');
  });

  it('successfully returns access_token', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      json: async () => ({ access_token: 'valid-token' })
    });

    const token = await exchangeGitHubCode('fake-code', 'client-id', 'client-secret');
    expect(token).toBe('valid-token');

    expect(global.fetch).toHaveBeenCalledWith('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        client_id: 'client-id',
        client_secret: 'client-secret',
        code: 'fake-code',
      }),
    });
  });
});


describe('getGitHubUser', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('throws an error if response is not ok', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false
    });

    await expect(getGitHubUser('fake-token')).rejects.toThrow('Failed to get GitHub user');
  });

  it('successfully returns GitHub user', async () => {
    const mockUser = {
      login: 'testuser',
      avatar_url: 'https://example.com/avatar.png',
      name: 'Test User'
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockUser
    });

    const user = await getGitHubUser('fake-token');
    expect(user).toEqual(mockUser);

    expect(global.fetch).toHaveBeenCalledWith('https://api.github.com/user', {
      headers: {
        Authorization: 'Bearer fake-token',
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'Spotify-Genre-Organizer',
      },
    });
  });
});


describe('getGitHubAuthUrl', () => {
  it('returns correctly formatted URL', () => {
    const url = getGitHubAuthUrl('client-id', 'http://localhost/callback', 'random-state');
    expect(url).toBe('https://github.com/login/oauth/authorize?client_id=client-id&redirect_uri=http%3A%2F%2Flocalhost%2Fcallback&scope=read%3Auser&state=random-state');
  });
});
