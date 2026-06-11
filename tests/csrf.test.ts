import { describe, it, expect, vi } from 'vitest';
import { generateCsrfToken, validateCsrfToken, getCsrfToken } from '../src/lib/csrf';
import type { Session } from '../src/lib/session';
import type { Context } from 'hono';

describe('CSRF Module', () => {
  describe('generateCsrfToken', () => {
    it('should generate a 64-character hex string', () => {
      const token = generateCsrfToken();
      expect(token).toHaveLength(64);
      expect(/^[0-9a-f]{64}$/.test(token)).toBe(true);
    });

    it('should generate unique tokens', () => {
      const token1 = generateCsrfToken();
      const token2 = generateCsrfToken();
      expect(token1).not.toBe(token2);
    });
  });

  describe('getCsrfToken', () => {
    it('should return token if session has csrfToken', () => {
      const session = { csrfToken: 'test-token' } as Session;
      expect(getCsrfToken(session)).toBe('test-token');
    });

    it('should return empty string if session is null', () => {
      expect(getCsrfToken(null)).toBe('');
    });

    it('should return empty string if session has no csrfToken', () => {
      const session = {} as Session;
      expect(getCsrfToken(session)).toBe('');
    });
  });

  describe('validateCsrfToken', () => {
    const validToken = 'valid-token';
    const mockSession = { csrfToken: validToken } as Session;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const createMockContext = (headerToken?: string | null, bodyData?: any, jsonThrows: boolean = false) => {
      return {
        req: {
          header: vi.fn((name: string) => {
            if (name === 'x-csrf-token') return headerToken;
            return null;
          }),
          json: vi.fn(async () => {
            if (jsonThrows) throw new Error('Invalid JSON');
            return bodyData;
          }),
        }
      } as unknown as Context<any, any, any>;
    };

    it('should return false if session has no csrfToken', async () => {
      const c = createMockContext(validToken);
      const sessionWithoutToken = {} as Session;
      expect(await validateCsrfToken(c, sessionWithoutToken)).toBe(false);
    });

    it('should return true if valid token is in header', async () => {
      const c = createMockContext(validToken);
      expect(await validateCsrfToken(c, mockSession)).toBe(true);
    });

    it('should return false if invalid token is in header', async () => {
      const c = createMockContext('invalid-token');
      expect(await validateCsrfToken(c, mockSession)).toBe(false);
    });

    it('should return true if valid token is in body', async () => {
      // no header token
      const c = createMockContext(null, { csrf_token: validToken });
      expect(await validateCsrfToken(c, mockSession)).toBe(true);
    });

    it('should return false if invalid token is in body', async () => {
      const c = createMockContext(null, { csrf_token: 'invalid-token' });
      expect(await validateCsrfToken(c, mockSession)).toBe(false);
    });

    it('should return false if token is missing from both header and body', async () => {
      const c = createMockContext(null, { other_field: 'value' });
      expect(await validateCsrfToken(c, mockSession)).toBe(false);
    });

    it('should handle body parsing errors gracefully', async () => {
      const c = createMockContext(null, null, true);
      expect(await validateCsrfToken(c, mockSession)).toBe(false);
    });

    it('should return false when timingSafeEqual gets different length strings', async () => {
        const c = createMockContext('short');
        expect(await validateCsrfToken(c, mockSession)).toBe(false);
    });
  });
});
