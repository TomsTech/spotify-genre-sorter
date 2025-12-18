/**
 * Error Handling Middleware for Hono
 *
 * Provides centralized error handling for all routes
 */

import { Context, Next } from 'hono';
import {
  AppError,
  classifyError,
  createErrorResponse,
  logError,
  ErrorCode,
} from './error-handler';
import { generateRequestId } from './logger';

/**
 * Global error handler middleware
 * Catches all errors and converts them to proper HTTP responses
 */
export async function errorHandler(c: Context, next: Next): Promise<Response | void> {
  const requestId = generateRequestId();
  const startTime = Date.now();

  // Add request ID to context for tracing
  c.set('requestId' as never, requestId);

  try {
    await next();
  } catch (error) {
    const duration = Date.now() - startTime;

    // Log the error
    const logEntry = logError(error, {
      executionContext: c.executionCtx,
      betterStackToken: c.env?.BETTERSTACK_TOKEN,
      requestContext: {
        path: new URL(c.req.url).pathname,
        method: c.req.method,
        userId: c.get('session' as never)?.spotifyUserId,
      },
    });

    // Add request metadata to response headers
    const headers = new Headers();
    headers.set('X-Request-ID', requestId);
    headers.set('X-Error-Code', logEntry.code);

    // Check if user prefers Swedish
    const swedish = c.req.header('Accept-Language')?.includes('sv') || false;

    // Create error response
    const errorResponse = createErrorResponse(error, {
      swedish,
      includeStack: c.env?.ENVIRONMENT === 'development',
    });

    // Clone response to add headers
    const responseWithHeaders = new Response(errorResponse.body, {
      status: errorResponse.status,
      headers: {
        ...Object.fromEntries(errorResponse.headers.entries()),
        ...Object.fromEntries(headers.entries()),
      },
    });

    console.error(`[${requestId}] Error after ${duration}ms:`, {
      code: logEntry.code,
      message: logEntry.message,
      path: c.req.url,
    });

    return responseWithHeaders;
  }
}

/**
 * Validation error helper
 */
export function validationError(message: string, context?: Record<string, unknown>): AppError {
  return new AppError({
    code: ErrorCode.VALIDATION_ERROR,
    message,
    userMessage: message,
    userMessageSV: message, // You can add Swedish translations here
    recoverable: false,
    retryable: false,
    statusCode: 400,
    context,
  });
}

/**
 * Authentication error helper
 */
export function authError(message: string = 'Authentication required'): AppError {
  return new AppError({
    code: ErrorCode.AUTH_ERROR,
    message,
    userMessage: 'Please log in to continue.',
    userMessageSV: 'Logga in för att fortsätta.',
    recoverable: true,
    retryable: false,
    statusCode: 401,
  });
}

/**
 * Rate limit error helper
 */
export function rateLimitError(retryAfterSeconds?: number): AppError {
  return new AppError({
    code: ErrorCode.RATE_LIMIT_ERROR,
    message: 'Rate limit exceeded',
    userMessage: retryAfterSeconds
      ? `Too many requests. Please try again in ${retryAfterSeconds} seconds.`
      : 'Too many requests. Please try again later.',
    userMessageSV: retryAfterSeconds
      ? `För många förfrågningar. Försök igen om ${retryAfterSeconds} sekunder.`
      : 'För många förfrågningar. Försök igen senare.',
    recoverable: true,
    retryable: true,
    statusCode: 429,
    context: retryAfterSeconds ? { retryAfter: retryAfterSeconds } : undefined,
  });
}

/**
 * Spotify API error helper
 */
export function spotifyError(message: string, status?: number): AppError {
  return new AppError({
    code: ErrorCode.SPOTIFY_API_ERROR,
    message: `Spotify API error: ${message}`,
    userMessage: 'Unable to communicate with Spotify. Please try again.',
    userMessageSV: 'Kan inte kommunicera med Spotify. Försök igen.',
    recoverable: true,
    retryable: status !== 400 && status !== 403, // Don't retry client errors
    statusCode: status || 502,
    context: { spotifyStatus: status },
  });
}

/**
 * KV error helper
 */
export function kvError(operation: string, error?: unknown): AppError {
  return new AppError({
    code: ErrorCode.KV_ERROR,
    message: `KV ${operation} failed: ${error instanceof Error ? error.message : String(error)}`,
    userMessage: 'A storage error occurred. Please try again.',
    userMessageSV: 'Ett lagringsfel inträffade. Försök igen.',
    recoverable: true,
    retryable: true,
    statusCode: 500,
    context: { operation },
    originalError: error instanceof Error ? error : undefined,
  });
}
