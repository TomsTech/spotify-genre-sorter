/**
 * CSP Nonce Generation
 *
 * Generates cryptographically secure nonces for Content Security Policy
 * to replace 'unsafe-inline' directives.
 */

/**
 * Generates a cryptographically secure random nonce for CSP
 * @returns Base64-encoded nonce string
 */
export function generateNonce(): string {
  // Generate 16 random bytes (128 bits)
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);

  // Convert to base64
  return btoa(String.fromCharCode(...array));
}
