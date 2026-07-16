import { describe, it, expect, vi, afterEach } from 'vitest';
import { generateNonce } from '../src/lib/csp-nonce';

describe('CSP Nonce Generator', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('generateNonce', () => {
    it('should return a 24-character string', () => {
      const nonce = generateNonce();
      expect(nonce).toHaveLength(24);
      expect(typeof nonce).toBe('string');
    });

    it('should return a valid base64 string', () => {
      const nonce = generateNonce();
      const isBase64 = /^[A-Za-z0-9+/]+={0,2}$/.test(nonce);
      expect(isBase64).toBe(true);

      // Should be decodable back to 16 bytes
      const decoded = atob(nonce);
      expect(decoded.length).toBe(16);
    });

    it('should generate unique nonces on subsequent calls', () => {
      const nonce1 = generateNonce();
      const nonce2 = generateNonce();
      const nonce3 = generateNonce();

      expect(nonce1).not.toBe(nonce2);
      expect(nonce1).not.toBe(nonce3);
      expect(nonce2).not.toBe(nonce3);
    });

    it('should generate sufficiently random nonces', () => {
      // Generate multiple nonces and check that they are unique
      const nonces = new Set();
      for (let i = 0; i < 100; i++) {
        nonces.add(generateNonce());
      }
      expect(nonces.size).toBe(100);
    });

    it('should use crypto.getRandomValues for deterministic check', () => {
      const getRandomValuesSpy = vi.spyOn(crypto, 'getRandomValues').mockImplementation((arr: any) => {
        for (let i = 0; i < arr.length; i++) {
          arr[i] = i; // Inject values 0-15
        }
        return arr;
      });

      const nonce = generateNonce();

      expect(getRandomValuesSpy).toHaveBeenCalledTimes(1);
      const passedArray = getRandomValuesSpy.mock.calls[0][0];
      expect(passedArray).toBeInstanceOf(Uint8Array);
      expect(passedArray.length).toBe(16);

      // Values 0-15 converted to base64
      expect(nonce).toBe('AAECAwQFBgcICQoLDA0ODw==');
    });
  });
});
