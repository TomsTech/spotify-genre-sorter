import { describe, it, expect } from 'vitest';
import { generateNonce } from '../src/lib/csp-nonce';

describe('csp-nonce', () => {
  describe('generateNonce', () => {
    it('should return a string', () => {
      const nonce = generateNonce();
      expect(typeof nonce).toBe('string');
    });

    it('should return a valid base64 string', () => {
      const nonce = generateNonce();
      // A valid base64 string only contains a-z, A-Z, 0-9, +, /, and padding =
      const base64Regex = /^[A-Za-z0-9+/]+={0,2}$/;
      expect(base64Regex.test(nonce)).toBe(true);
    });

    it('should return a 24-character string (16 bytes base64 encoded)', () => {
      const nonce = generateNonce();
      expect(nonce).toHaveLength(24);
    });

    it('should return unique values on subsequent calls', () => {
      const nonce1 = generateNonce();
      const nonce2 = generateNonce();
      expect(nonce1).not.toBe(nonce2);
    });
  });
});
