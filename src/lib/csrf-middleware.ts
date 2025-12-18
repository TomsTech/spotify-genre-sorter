import { Context, Next } from 'hono';
import { getSession } from './session';
import { validateCsrfToken } from './csrf';

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
export async function csrfProtection(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  c: Context<{ Bindings: Env }, any, any>,
  next: Next
): Promise<Response | void> {
  const method = c.req.method.toUpperCase();

  // Only validate on state-changing methods
  const stateMutatingMethods = ['POST', 'PUT', 'DELETE', 'PATCH'];
  if (!stateMutatingMethods.includes(method)) {
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
export async function optionalCsrfProtection(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  c: Context<{ Bindings: Env }, any, any>,
  next: Next
): Promise<Response | void> {
  const method = c.req.method.toUpperCase();

  // Only validate on state-changing methods
  const stateMutatingMethods = ['POST', 'PUT', 'DELETE', 'PATCH'];
  if (!stateMutatingMethods.includes(method)) {
    return next();
  }

  // Get current session (may be null)
  const session = await getSession(c);

  // If user IS authenticated, validate CSRF token
  if (session) {
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
  }

  // Either no session or valid CSRF token
  return next();
}
