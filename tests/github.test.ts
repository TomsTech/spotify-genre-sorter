import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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

describe('getGitHubAuthUrl', () => {
  it('generates the correct URL', () => {
    const url = getGitHubAuthUrl('client_id', 'http://localhost/callback', 'state123');
    expect(url).toContain('https://github.com/login/oauth/authorize');
    expect(url).toContain('client_id=client_id');
    expect(url).toContain('redirect_uri=http%3A%2F%2Flocalhost%2Fcallback');
    expect(url).toContain('state=state123');
  });
});

describe('exchangeGitHubCode', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetAllMocks();
  });

  it('exchanges code successfully', async () => {
    fetchMock.mockResolvedValueOnce({
      json: async () => ({ access_token: 'test_token' })
    });

    const result = await exchangeGitHubCode('code123', 'client_id', 'client_secret');
    expect(result).toBe('test_token');
    expect(fetchMock).toHaveBeenCalledWith('https://github.com/login/oauth/access_token', expect.any(Object));
  });

  it('throws an error if GitHub returns an error string', async () => {
    fetchMock.mockResolvedValueOnce({
      json: async () => ({ error: 'bad_verification_code' })
    });

    await expect(exchangeGitHubCode('code123', 'client_id', 'client_secret')).rejects.toThrow('bad_verification_code');
  });

  it('throws a default error if no access_token or error is present', async () => {
    fetchMock.mockResolvedValueOnce({
      json: async () => ({})
    });

    await expect(exchangeGitHubCode('code123', 'client_id', 'client_secret')).rejects.toThrow('Failed to exchange code');
  });
});

describe('getGitHubUser', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetAllMocks();
  });

  it('returns github user successfully', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ login: 'alice', avatar_url: 'url', name: 'Alice' })
    });

    const result = await getGitHubUser('token');
    expect(result).toEqual({ login: 'alice', avatar_url: 'url', name: 'Alice' });
  });

  it('throws error if response is not ok', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false
    });

    await expect(getGitHubUser('token')).rejects.toThrow('Failed to get GitHub user');
  });
});
