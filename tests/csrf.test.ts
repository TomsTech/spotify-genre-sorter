import { describe, it, expect, vi } from 'vitest';
import { generateCsrfToken, validateCsrfToken, getCsrfToken } from '../src/lib/csrf';
import { Context } from 'hono';
import { Session } from '../src/lib/session';

describe('CSRF Token Management', () => {
  describe('generateCsrfToken', () => {
    it('should generate a 64-character hex string', () => {
      const token = generateCsrfToken();
      expect(token).toHaveLength(64);
      expect(/^[0-9a-f]+$/.test(token)).toBe(true);
    });

    it('should generate unique tokens', () => {
      const token1 = generateCsrfToken();
      const token2 = generateCsrfToken();
      expect(token1).not.toBe(token2);
    });

    it('should properly zero-pad single-digit hex values', () => {
      // Mock crypto to return specific bytes
      const originalCrypto = global.crypto;
      const mockGetRandomValues = vi.fn().mockImplementation((buffer: Uint8Array) => {
        // Fill first 4 bytes with specific values to test padding
        buffer[0] = 0;   // hex '00'
        buffer[1] = 15;  // hex '0f'
        buffer[2] = 16;  // hex '10'
        buffer[3] = 255; // hex 'ff'
        // Rest can be zeros
        for (let i = 4; i < buffer.length; i++) {
          buffer[i] = 0;
        }
        return buffer;
      });

      vi.stubGlobal('crypto', { getRandomValues: mockGetRandomValues });

      try {
        const token = generateCsrfToken();

        // Verify mock was called correctly
        expect(mockGetRandomValues).toHaveBeenCalledTimes(1);

        // Verify the resulting hex string has correct zero padding
        // 0 -> '00'
        // 15 -> '0f'
        // 16 -> '10'
        // 255 -> 'ff'
        expect(token.startsWith('000f10ff')).toBe(true);
        expect(token).toHaveLength(64); // 32 bytes * 2 hex chars
      } finally {
        // Restore original crypto
        if (originalCrypto) {
          vi.stubGlobal('crypto', originalCrypto);
        } else {
          vi.unstubAllGlobals();
        }
      }
    });
  });

  describe('getCsrfToken', () => {
    it('should return empty string for null session', () => {
      expect(getCsrfToken(null)).toBe('');
    });

    it('should return empty string if session has no token', () => {
      expect(getCsrfToken({} as Session)).toBe('');
    });

    it('should return the token from the session', () => {
      expect(getCsrfToken({ csrfToken: 'test-token' } as Session)).toBe('test-token');
    });
  });

  describe('validateCsrfToken', () => {
    const validToken = 'a'.repeat(64);
    const invalidToken = 'b'.repeat(64);
    const mockSession = { csrfToken: validToken } as Session;

    it('should return false if session has no token', async () => {
      const c = { req: { header: vi.fn() } } as unknown as Context;
      expect(await validateCsrfToken(c, {} as Session)).toBe(false);
    });

    it('should validate token from header', async () => {
      const c = {
        req: {
          header: vi.fn().mockReturnValue(validToken)
        }
      } as unknown as Context;
      expect(await validateCsrfToken(c, mockSession)).toBe(true);
    });

    it('should return false if header token is invalid', async () => {
      const c = {
        req: {
          header: vi.fn().mockReturnValue(invalidToken)
        }
      } as unknown as Context;
      expect(await validateCsrfToken(c, mockSession)).toBe(false);
    });

    it('should validate token from body if header is missing', async () => {
      const c = {
        req: {
          header: vi.fn().mockReturnValue(undefined),
          json: vi.fn().mockResolvedValue({ csrf_token: validToken })
        }
      } as unknown as Context;
      expect(await validateCsrfToken(c, mockSession)).toBe(true);
    });

    it('should return false if body token is invalid', async () => {
      const c = {
        req: {
          header: vi.fn().mockReturnValue(undefined),
          json: vi.fn().mockResolvedValue({ csrf_token: invalidToken })
        }
      } as unknown as Context;
      expect(await validateCsrfToken(c, mockSession)).toBe(false);
    });

    it('should handle csrfToken sync JSON error with a bad JSON payload', async () => {
      const c = {
        req: {
          header: vi.fn().mockReturnValue(undefined),
          json: vi.fn().mockImplementation(() => {
            // Simulate synchronous error from bad JSON payload
            JSON.parse('{ bad json payload }');
          })
        }
      } as unknown as Context;

      expect(await validateCsrfToken(c, mockSession)).toBe(false);
    });

    it('should gracefully handle synchronous errors from req.json()', async () => {
      const c = {
        req: {
          header: vi.fn().mockReturnValue(undefined),
          json: vi.fn().mockImplementation(() => { throw new Error('Synchronous JSON error'); })
        }
      } as unknown as Context;

      // Should catch the error and return false because no token is found
      expect(await validateCsrfToken(c, mockSession)).toBe(false);
    });

    it('should gracefully handle JSON parsing rejections without a token', async () => {
      const c = {
        req: {
          header: vi.fn().mockReturnValue(undefined),
          json: vi.fn().mockRejectedValue(new Error('Async JSON error'))
        }
      } as unknown as Context;

      // Should handle the rejection and return false
      expect(await validateCsrfToken(c, mockSession)).toBe(false);
    });

    it('should return false if token is missing entirely', async () => {
      const c = {
        req: {
          header: vi.fn().mockReturnValue(undefined),
          json: vi.fn().mockResolvedValue({})
        }
      } as unknown as Context;
      expect(await validateCsrfToken(c, mockSession)).toBe(false);
    });

    it('should return false if timingSafeEqual checks strings of different lengths', async () => {
      const diffLengthToken = 'a'.repeat(32);
      const c = {
        req: {
          header: vi.fn().mockReturnValue(diffLengthToken)
        }
      } as unknown as Context;
      expect(await validateCsrfToken(c, mockSession)).toBe(false);
    });
  });
});
