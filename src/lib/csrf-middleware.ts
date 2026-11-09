import type { Context, Next, Input } from 'hono';
import { getSession, Session } from './session';
import { validateCsrfToken } from './csrf';
import type { Env } from '../types';

/**
 * Checks whether the HTTP method is a state-changing method requiring CSRF protection.
 * GET, HEAD, OPTIONS requests are exempt as they should be idempotent.
 */
export function isStateMutatingMethod(method: string): boolean {
  const stateMutatingMethods = ['POST', 'PUT', 'DELETE', 'PATCH'];
  return stateMutatingMethods.includes(method.toUpperCase());
}

/**
 * Validates the CSRF token for a given session.
 * Returns a 403 Forbidden Response if the token is invalid, or null if valid.
 */
export async function validateSessionCsrf<P extends string, I extends Input>(
  c: Context<{ Bindings: Env }, P, I>,
  session: Session
): Promise<Response | null> {
  const isValid = await validateCsrfToken(c, session);
  if (!isValid) {
    return c.json(
      {
        error: 'Forbidden',
        message: 'Invalid or missing CSRF token',
        code: 'CSRF_TOKEN_INVALID',
      },
      403
    );
  }
  return null;
}

/**
 * CSRF Protection Middleware
 *
 * Validates CSRF tokens on state-changing HTTP methods (POST, PUT, DELETE, PATCH).
 * GET, HEAD, OPTIONS requests are exempt as they should be idempotent.
 *
 * Returns 403 Forbidden if:
 * - User is not authenticated
 * - CSRF token is missing
 * - CSRF token is invalid
 */
export async function csrfProtection<P extends string, I extends Input>(
  c: Context<{ Bindings: Env }, P, I>,
  next: Next
): Promise<Response | void> {
  // Only validate on state-changing methods
  if (!isStateMutatingMethod(c.req.method)) {
    return next();
  }

  // Get current session
  const session = await getSession(c);
  if (!session) {
    return c.json(
      { error: 'Unauthorized', message: 'Authentication required' },
      401
    );
  }

  // Validate CSRF token
  const errorResponse = await validateSessionCsrf(c, session);
  if (errorResponse) {
    return errorResponse;
  }

  // Token is valid, continue to route handler
  return next();
}

/**
 * Optional CSRF Protection Middleware
 *
 * Same as csrfProtection but allows requests without authentication.
 * Only validates CSRF if the user IS authenticated.
 *
 * Use for endpoints that accept both authenticated and anonymous requests.
 */
export async function optionalCsrfProtection<P extends string, I extends Input>(
  c: Context<{ Bindings: Env }, P, I>,
  next: Next
): Promise<Response | void> {
  // Only validate on state-changing methods
  if (!isStateMutatingMethod(c.req.method)) {
    return next();
  }

  // Get current session (may be null)
  const session = await getSession(c);

  // If user IS authenticated, validate CSRF token
  if (session) {
    const errorResponse = await validateSessionCsrf(c, session);
    if (errorResponse) {
      return errorResponse;
    }
  }

  // Either no session or valid CSRF token
  return next();
}
