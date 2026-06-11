import { describe, it, expect } from 'vitest';
import { isUserAllowed } from '../src/lib/github';

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
