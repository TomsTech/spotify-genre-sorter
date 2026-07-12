import { describe, it, expect } from 'vitest';
import { decodeStateFromCookie, encodeStateForCookie } from '../src/routes/auth';

describe('OAuth State Cookie Helpers', () => {
  describe('encodeStateForCookie and decodeStateFromCookie', () => {
    it('should correctly encode and decode valid state data', () => {
      const state = 'test-state-123';
      const data = { provider: 'spotify' };

      const encoded = encodeStateForCookie(state, data);
      const decoded = decodeStateFromCookie(encoded);

      expect(decoded).not.toBeNull();
      expect(decoded?.state).toBe(state);
      expect(decoded?.data).toEqual(data);
      expect(typeof decoded?.ts).toBe('number');
    });

    it('should return null when decoding invalid base64 string', () => {
      // Invalid base64 that causes atob to throw an error
      const invalidBase64 = 'invalid-base64-string!@#';
      const decoded = decodeStateFromCookie(invalidBase64);

      expect(decoded).toBeNull();
    });

    it('should return null when decoded string is not valid JSON', () => {
      // Valid base64, but not a JSON string
      const notJsonEncoded = btoa('not-json-string');
      const decoded = decodeStateFromCookie(notJsonEncoded);

      expect(decoded).toBeNull();
    });
  });
});
