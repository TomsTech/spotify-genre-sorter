import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { generateCsrfToken, validateCsrfToken, getCsrfToken } from '../src/lib/csrf';
import { Context } from 'hono';

describe('CSRF Token Management', () => {
  describe('generateCsrfToken', () => {
    let originalGetRandomValues: any;

    beforeEach(() => {
      originalGetRandomValues = globalThis.crypto.getRandomValues;
    });

    afterEach(() => {
      globalThis.crypto.getRandomValues = originalGetRandomValues;
    });

    it('should generate a 64-character hex string', () => {
      const token = generateCsrfToken();
      expect(token).toHaveLength(64);
      expect(token).toMatch(/^[0-9a-f]{64}$/);
    });

    it('should use crypto.getRandomValues to generate random bytes', () => {
      const mockGetRandomValues = vi.fn((buffer) => {
        for (let i = 0; i < buffer.length; i++) {
          buffer[i] = i;
        }
        return buffer;
      });

      // Instead of replacing the crypto object, we replace just the function
      Object.defineProperty(globalThis.crypto, 'getRandomValues', {
        value: mockGetRandomValues,
        writable: true,
        configurable: true
      });

      const token = generateCsrfToken();
      expect(mockGetRandomValues).toHaveBeenCalledOnce();

      // Verification of hex string from byte array [0, 1, 2, ..., 31]
      let expectedHex = '';
      for (let i = 0; i < 32; i++) {
        expectedHex += i.toString(16).padStart(2, '0');
      }
      expect(token).toBe(expectedHex);
    });
  });

  describe('getCsrfToken', () => {
    it('should return empty string if session is null', () => {
      expect(getCsrfToken(null)).toBe('');
    });

    it('should return empty string if session has no csrfToken', () => {
      const session = { id: 'abc', state: '123' } as any;
      expect(getCsrfToken(session)).toBe('');
    });

    it('should return csrfToken if present in session', () => {
      const session = { id: 'abc', state: '123', csrfToken: 'my-token' } as any;
      expect(getCsrfToken(session)).toBe('my-token');
    });
  });

  describe('validateCsrfToken', () => {
    const validToken = 'test-valid-token-1234567890abcdef';
    const mockSession = {
      id: 'abc',
      state: '123',
      csrfToken: validToken,
    } as any;

    const createMockContext = (headerToken?: string, bodyToken?: string, bodyParseFails = false): any => {
      return {
        req: {
          header: vi.fn((name) => {
            if (name.toLowerCase() === 'x-csrf-token') return headerToken;
            return null;
          }),
          json: vi.fn(async () => {
            if (bodyParseFails) throw new Error('Invalid JSON');
            return bodyToken ? { csrf_token: bodyToken } : {};
          }),
        },
      } as unknown as Context;
    };

    it('should return false if session has no token', async () => {
      const c = createMockContext(validToken);
      const invalidSession = { id: 'abc', state: '123' } as any;
      expect(await validateCsrfToken(c, invalidSession)).toBe(false);
    });

    it('should return false if request has no token in header or body', async () => {
      const c = createMockContext();
      expect(await validateCsrfToken(c, mockSession)).toBe(false);
    });

    it('should return true if valid token in header', async () => {
      const c = createMockContext(validToken);
      expect(await validateCsrfToken(c, mockSession)).toBe(true);
    });

    it('should return true if valid token in body', async () => {
      const c = createMockContext(undefined, validToken);
      expect(await validateCsrfToken(c, mockSession)).toBe(true);
    });

    it('should return false if invalid token in header', async () => {
      const c = createMockContext('wrong-token');
      expect(await validateCsrfToken(c, mockSession)).toBe(false);
    });

    it('should return false if invalid token in body', async () => {
      const c = createMockContext(undefined, 'wrong-token');
      expect(await validateCsrfToken(c, mockSession)).toBe(false);
    });

    it('should return false if token length mismatches', async () => {
      const shortToken = validToken.substring(0, 10);
      const c = createMockContext(shortToken);
      expect(await validateCsrfToken(c, mockSession)).toBe(false);
    });

    it('should handle JSON parse failures gracefully and fallback to rejecting', async () => {
      const c = createMockContext(undefined, undefined, true);
      expect(await validateCsrfToken(c, mockSession)).toBe(false);
    });

    it('should prefer header token over body token', async () => {
      const c = createMockContext(validToken, 'wrong-token');
      expect(await validateCsrfToken(c, mockSession)).toBe(true);

      const c2 = createMockContext('wrong-token', validToken);
      expect(await validateCsrfToken(c2, mockSession)).toBe(false);
    });
  });
});
