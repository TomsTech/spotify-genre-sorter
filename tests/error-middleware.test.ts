import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  errorHandler,
  validationError,
  authError,
  rateLimitError,
  spotifyError,
  kvError,
} from '../src/lib/error-middleware';
import { ErrorCode, AppError } from '../src/lib/error-handler';
import { Context } from 'hono';

describe('errorHandler middleware', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should call next and not catch if no error', async () => {
    const c = {
      set: vi.fn(),
      env: {},
      get: vi.fn(),
      req: { url: 'http://localhost/test', method: 'GET', header: vi.fn() },
      executionCtx: {},
    } as unknown as Context;
    const next = vi.fn().mockResolvedValue(undefined);

    const result = await errorHandler(c, next);
    expect(next).toHaveBeenCalled();
    expect(c.set).toHaveBeenCalledWith('requestId', expect.any(String));
    expect(result).toBeUndefined();
  });

  it('should catch generic error, log and return response', async () => {
    const c = {
      set: vi.fn(),
      env: { ENVIRONMENT: 'development' },
      get: vi.fn(),
      req: { url: 'http://localhost/test', method: 'GET', header: vi.fn() },
      executionCtx: {},
    } as unknown as Context;
    const next = vi.fn().mockRejectedValue(new Error('Test error'));

    const result = await errorHandler(c, next);
    expect(next).toHaveBeenCalled();
    expect(result).toBeInstanceOf(Response);
    if (result instanceof Response) {
      expect(result.status).toBe(500);
      expect(result.headers.get('X-Request-ID')).toBeTruthy();
      expect(result.headers.get('X-Error-Code')).toBe('UNKNOWN_ERROR');
    }
  });

  it('should handle AppError properly', async () => {
    const c = {
      set: vi.fn(),
      env: { ENVIRONMENT: 'production' },
      get: vi.fn(),
      req: { url: 'http://localhost/test', method: 'GET', header: vi.fn() },
      executionCtx: {},
    } as unknown as Context;

    const authError = new AppError({
        code: ErrorCode.AUTH_ERROR,
        message: 'Auth fail',
        userMessage: 'Please log in',
        statusCode: 401
    });

    const next = vi.fn().mockRejectedValue(authError);

    const result = await errorHandler(c, next);
    expect(next).toHaveBeenCalled();
    expect(result).toBeInstanceOf(Response);
    if (result instanceof Response) {
      expect(result.status).toBe(401);
      expect(result.headers.get('X-Request-ID')).toBeTruthy();
      expect(result.headers.get('X-Error-Code')).toBe(ErrorCode.AUTH_ERROR);
    }
  });
});


describe('Error Helpers', () => {
  describe('validationError', () => {
    it('should create a validation error with correct properties', () => {
      const message = 'Invalid input';
      const context = { field: 'email' };
      const error = validationError(message, context);

      expect(error).toBeInstanceOf(AppError);
      expect(error.code).toBe(ErrorCode.VALIDATION_ERROR);
      expect(error.message).toBe(message);
      expect(error.userMessage).toBe(message);
      expect(error.userMessageSV).toBe(message);
      expect(error.statusCode).toBe(400);
      expect(error.recoverable).toBe(false);
      expect(error.retryable).toBe(false);
      expect(error.context).toEqual(context);
    });
  });

  describe('authError', () => {
    it('should create an auth error with default message', () => {
      const error = authError();

      expect(error).toBeInstanceOf(AppError);
      expect(error.code).toBe(ErrorCode.AUTH_ERROR);
      expect(error.message).toBe('Authentication required');
      expect(error.userMessage).toBe('Please log in to continue.');
      expect(error.statusCode).toBe(401);
      expect(error.recoverable).toBe(true);
      expect(error.retryable).toBe(false);
    });

    it('should create an auth error with custom message', () => {
      const customMessage = 'Session expired';
      const error = authError(customMessage);

      expect(error.message).toBe(customMessage);
    });
  });

  describe('rateLimitError', () => {
    it('should create a rate limit error without retryAfterSeconds', () => {
      const error = rateLimitError();

      expect(error).toBeInstanceOf(AppError);
      expect(error.code).toBe(ErrorCode.RATE_LIMIT_ERROR);
      expect(error.statusCode).toBe(429);
      expect(error.userMessage).toBe('Too many requests. Please try again later.');
      expect(error.recoverable).toBe(true);
      expect(error.retryable).toBe(true);
      expect(error.context).toBeUndefined();
    });

    it('should create a rate limit error with retryAfterSeconds', () => {
      const retryAfter = 60;
      const error = rateLimitError(retryAfter);

      expect(error.userMessage).toContain(`Please try again in ${retryAfter} seconds.`);
      expect(error.context).toEqual({ retryAfter });
    });
  });

  describe('spotifyError', () => {
    it('should create a spotify error with default status', () => {
      const message = 'API down';
      const error = spotifyError(message);

      expect(error).toBeInstanceOf(AppError);
      expect(error.code).toBe(ErrorCode.SPOTIFY_API_ERROR);
      expect(error.message).toBe(`Spotify API error: ${message}`);
      expect(error.userMessage).toBe('Unable to communicate with Spotify. Please try again.');
      expect(error.userMessageSV).toBe('Kan inte kommunicera med Spotify. Försök igen.');
      expect(error.recoverable).toBe(true);
      expect(error.statusCode).toBe(502);
      expect(error.retryable).toBe(true);
      expect(error.context).toEqual({ spotifyStatus: undefined });
    });

    it('should not be retryable for 400 status', () => {
      const error = spotifyError('Bad Request', 400);
      expect(error.statusCode).toBe(400);
      expect(error.retryable).toBe(false);
      expect(error.context).toEqual({ spotifyStatus: 400 });
    });

    it('should not be retryable for 403 status', () => {
      const error = spotifyError('Forbidden', 403);
      expect(error.statusCode).toBe(403);
      expect(error.retryable).toBe(false);
      expect(error.context).toEqual({ spotifyStatus: 403 });
    });

    it('should be retryable for other statuses (e.g., 500)', () => {
      const error = spotifyError('Server Error', 500);
      expect(error.statusCode).toBe(500);
      expect(error.retryable).toBe(true);
      expect(error.context).toEqual({ spotifyStatus: 500 });
    });
  });

  describe('kvError', () => {
    it('should create a KV error', () => {
      const operation = 'get';
      const originalError = new Error('KV connection failed');
      const error = kvError(operation, originalError);

      expect(error).toBeInstanceOf(AppError);
      expect(error.code).toBe(ErrorCode.KV_ERROR);
      expect(error.message).toContain(`KV ${operation} failed`);
      expect(error.message).toContain(originalError.message);
      expect(error.statusCode).toBe(500);
      expect(error.context).toEqual({ operation });
      expect(error.originalError).toBe(originalError);
    });

    it('should handle non-error original error objects', () => {
      const error = kvError('set', 'Something went wrong');
      expect(error.message).toContain('Something went wrong');
      expect(error.originalError).toBeUndefined();
    });
  });
});
