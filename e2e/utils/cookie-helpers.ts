/**
 * Cookie Helpers for E2E Tests
 *
 * Utilities for managing session cookies in tests.
 */
import { BrowserContext, Page } from '@playwright/test';
import { randomBytes } from 'crypto';

/**
 * Session cookie configuration
 */
export interface SessionCookieConfig {
  name: string;
  value: string;
  domain?: string;
  path?: string;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: 'Strict' | 'Lax' | 'None';
  expires?: number;
}

/**
 * Default session cookie settings
 */
const DEFAULT_SESSION_COOKIE: Partial<SessionCookieConfig> = {
  name: 'session_id',
  domain: 'localhost',
  path: '/',
  httpOnly: true,
  secure: false,
  sameSite: 'Lax',
};

/**
 * Set session cookie on a browser context
 */
export async function setSessionCookie(
  context: BrowserContext,
  sessionId: string,
  options: Partial<SessionCookieConfig> = {}
): Promise<void> {
  const cookie = {
    ...DEFAULT_SESSION_COOKIE,
    ...options,
    name: options.name || DEFAULT_SESSION_COOKIE.name!,
    value: sessionId,
  };

  await context.addCookies([cookie as Parameters<BrowserContext['addCookies']>[0][0]]);
}

/**
 * Get session cookie from context
 */
export async function getSessionCookie(
  context: BrowserContext,
  name = 'session_id'
): Promise<string | null> {
  const cookies = await context.cookies();
  const sessionCookie = cookies.find((c) => c.name === name);
  return sessionCookie?.value || null;
}

/**
 * Clear session cookie
 */
export async function clearSessionCookie(
  context: BrowserContext,
  name = 'session_id'
): Promise<void> {
  await context.clearCookies({ name });
}

/**
 * Clear all cookies
 */
export async function clearAllCookies(context: BrowserContext): Promise<void> {
  await context.clearCookies();
}

/**
 * Check if session cookie exists
 */
export async function hasSessionCookie(
  context: BrowserContext,
  name = 'session_id'
): Promise<boolean> {
  const value = await getSessionCookie(context, name);
  return value !== null && value !== '';
}

/**
 * Generate a unique session ID for testing
 * Uses crypto.randomBytes for security-compliant random generation
 */
export function generateTestSessionId(prefix = 'e2e-test'): string {
  const timestamp = Date.now();
  const random = randomBytes(4).toString('hex');
  return `${prefix}-${timestamp}-${random}`;
}

/**
 * Create an authenticated context with session cookie
 */
export async function createAuthenticatedContext(
  context: BrowserContext,
  options: {
    sessionId?: string;
    cookieName?: string;
  } = {}
): Promise<{ context: BrowserContext; sessionId: string }> {
  const sessionId = options.sessionId || generateTestSessionId();
  const cookieName = options.cookieName || 'session_id';

  await setSessionCookie(context, sessionId, { name: cookieName });

  return { context, sessionId };
}

/**
 * Extract cookies from page for debugging
 */
export async function debugCookies(context: BrowserContext): Promise<void> {
  const cookies = await context.cookies();
  console.log('Current cookies:', JSON.stringify(cookies, null, 2));
}

/**
 * Wait for session cookie to be set (after auth flow)
 */
export async function waitForSessionCookie(
  context: BrowserContext,
  options: {
    name?: string;
    timeout?: number;
    pollInterval?: number;
  } = {}
): Promise<string> {
  const { name = 'session_id', timeout = 10000, pollInterval = 500 } = options;
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    const value = await getSessionCookie(context, name);
    if (value) {
      return value;
    }
    await new Promise((resolve) => setTimeout(resolve, pollInterval));
  }

  throw new Error(`Timeout waiting for session cookie: ${name}`);
}
