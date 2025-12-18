import { Context } from 'hono';
import { Session } from './session';

/**
 * CSRF Token Management
 *
 * Implements CSRF (Cross-Site Request Forgery) protection using the Synchronizer Token Pattern.
 * Each session gets a unique CSRF token that must be included in all state-changing requests.
 */

const CSRF_TOKEN_LENGTH = 32;
const CSRF_HEADER_NAME = 'x-csrf-token';
const CSRF_FORM_FIELD = 'csrf_token';

/**
 * Generates a cryptographically secure random CSRF token
 */
export function generateCsrfToken(): string {
  // Generate 32 random bytes and convert to hex string
  const buffer = new Uint8Array(CSRF_TOKEN_LENGTH);
  crypto.getRandomValues(buffer);
  return Array.from(buffer)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Validates CSRF token from request against session token
 *
 * Accepts token from:
 * 1. X-CSRF-Token header (preferred for AJAX)
 * 2. csrf_token form field/body parameter
 *
 * @param c - Hono context
 * @param session - Current user session
 * @returns true if token is valid, false otherwise
 */
export async function validateCsrfToken(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  c: Context<{ Bindings: Env }, any, any>,
  session: Session
): Promise<boolean> {
  if (!session.csrfToken) {
    return false;
  }

  // Try header first (for AJAX requests)
  let requestToken = c.req.header(CSRF_HEADER_NAME);

  // Try body/form field if header not present
  if (!requestToken) {
    try {
      const body: unknown = await c.req.json().catch(() => null);
      if (body && typeof body === 'object' && body !== null && CSRF_FORM_FIELD in (body as Record<string, unknown>)) {
        requestToken = (body as Record<string, unknown>)[CSRF_FORM_FIELD] as string;
      }
    } catch {
      // If JSON parsing fails, token is not in body
    }
  }

  if (!requestToken) {
    return false;
  }

  // Constant-time comparison to prevent timing attacks
  return timingSafeEqual(requestToken, session.csrfToken);
}

/**
 * Timing-safe string comparison to prevent timing attacks
 *
 * @param a - First string
 * @param b - Second string
 * @returns true if strings are equal
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

/**
 * Gets CSRF token from session, or returns empty string if not available
 *
 * @param session - Current user session
 * @returns CSRF token or empty string
 */
export function getCsrfToken(session: Session | null): string {
  return session?.csrfToken || '';
}
