import { describe, it, expect, vi, afterEach } from 'vitest';
import { isUserAllowed, exchangeGitHubCode } from '../src/lib/github';

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
    global.fetch = vi.fn().mockResolvedValue({
      json: async () => ({ access_token: 'valid_token' }),
    });

    const token = await exchangeGitHubCode('test_code', 'client_id', 'client_secret');
    expect(token).toBe('valid_token');
    expect(global.fetch).toHaveBeenCalledWith('https://github.com/login/oauth/access_token', expect.any(Object));
  });

  it('should throw an error if the response contains an error field', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      json: async () => ({ error: 'bad_verification_code' }),
    });

    await expect(exchangeGitHubCode('bad_code', 'client_id', 'client_secret')).rejects.toThrow('bad_verification_code');
  });

  it('should throw an error if the response lacks both access_token and error fields', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      json: async () => ({}),
    });

    await expect(exchangeGitHubCode('test_code', 'client_id', 'client_secret')).rejects.toThrow('Failed to exchange code');
  });
});
