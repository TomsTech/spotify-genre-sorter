import { describe, it, expect } from 'vitest';
import { determineRecoveryStrategy, classifyError, AppError, ErrorCode, ErrorContext } from '../src/lib/error-handler';

describe('determineRecoveryStrategy', () => {
  const createMockError = (code: ErrorCode, retryable = false, userMessage = 'Test error'): ErrorContext => ({
    code,
    message: 'Internal test error message',
    userMessage,
    recoverable: true,
    retryable,
    statusCode: 500,
  });

  describe('Authentication errors', () => {
    it('should abort and prompt login for AUTH_ERROR', () => {
      const error = createMockError(ErrorCode.AUTH_ERROR);
      const strategy = determineRecoveryStrategy(error);

      expect(strategy.action).toBe('abort');
      expect(strategy.message).toBe('Please log in again to continue.');
    });

    it('should abort and prompt login for TOKEN_EXPIRED', () => {
      const error = createMockError(ErrorCode.TOKEN_EXPIRED);
      const strategy = determineRecoveryStrategy(error);

      expect(strategy.action).toBe('abort');
      expect(strategy.message).toBe('Please log in again to continue.');
    });
  });

  describe('Rate limiting', () => {
    it('should retry for RATE_LIMIT_ERROR', () => {
      const error = createMockError(ErrorCode.RATE_LIMIT_ERROR);
      const strategy = determineRecoveryStrategy(error);

      expect(strategy.action).toBe('retry');
      expect(strategy.message).toBe('Rate limited. Retrying...');
    });
  });

  describe('Network errors', () => {
    it('should retry for NETWORK_ERROR', () => {
      const error = createMockError(ErrorCode.NETWORK_ERROR);
      const strategy = determineRecoveryStrategy(error);

      expect(strategy.action).toBe('retry');
      expect(strategy.message).toBe('Connection lost. Retrying...');
    });

    it('should retry for TIMEOUT_ERROR', () => {
      const error = createMockError(ErrorCode.TIMEOUT_ERROR);
      const strategy = determineRecoveryStrategy(error);

      expect(strategy.action).toBe('retry');
      expect(strategy.message).toBe('Connection lost. Retrying...');
    });
  });

  describe('Validation errors', () => {
    it('should abort and show user message for VALIDATION_ERROR', () => {
      const userMessage = 'Invalid email address format';
      const error = createMockError(ErrorCode.VALIDATION_ERROR, false, userMessage);
      const strategy = determineRecoveryStrategy(error);

      expect(strategy.action).toBe('abort');
      expect(strategy.message).toBe(userMessage);
    });

    it('should abort and show user message for INVALID_INPUT', () => {
      const userMessage = 'Missing required field';
      const error = createMockError(ErrorCode.INVALID_INPUT, false, userMessage);
      const strategy = determineRecoveryStrategy(error);

      expect(strategy.action).toBe('abort');
      expect(strategy.message).toBe(userMessage);
    });
  });

  describe('Cache errors', () => {
    it('should fallback to direct storage for CACHE_ERROR', () => {
      const error = createMockError(ErrorCode.CACHE_ERROR);
      const strategy = determineRecoveryStrategy(error);

      expect(strategy.action).toBe('fallback');
      expect(strategy.message).toBe('Cache error, using direct storage.');
    });
  });

  describe('Default behaviors', () => {
    it('should retry generic errors if they are marked as retryable', () => {
      const error = createMockError(ErrorCode.UNKNOWN_ERROR, true);
      const strategy = determineRecoveryStrategy(error);

      expect(strategy.action).toBe('retry');
      expect(strategy.message).toBe('An error occurred. Retrying...');
    });

    it('should abort generic errors if they are not retryable and include user message', () => {
      const userMessage = 'Something went terribly wrong';
      const error = createMockError(ErrorCode.UNKNOWN_ERROR, false, userMessage);
      const strategy = determineRecoveryStrategy(error);

      expect(strategy.action).toBe('abort');
      expect(strategy.message).toBe(userMessage);
    });

    it('should use a default abort message if userMessage is missing for non-retryable errors', () => {
      const error = createMockError(ErrorCode.UNKNOWN_ERROR, false, undefined);
      // Explicitly delete userMessage to test the fallback
      delete error.userMessage;
      const strategy = determineRecoveryStrategy(error);

      expect(strategy.action).toBe('abort');
      expect(strategy.message).toBe('An error occurred.');
    });
  });
});


describe('classifyError', () => {
  it('should correctly map properties from an AppError instance', () => {
    const context = {
      code: ErrorCode.VALIDATION_ERROR,
      message: 'App error message',
      userMessage: 'User friendly app message',
      recoverable: true,
      retryable: false,
      statusCode: 400,
      context: { foo: 'bar' },
    };
    const appError = new AppError(context);
    const classified = classifyError(appError);

    expect(classified.code).toBe(ErrorCode.VALIDATION_ERROR);
    expect(classified.message).toBe('App error message');
    expect(classified.userMessage).toBe('User friendly app message');
    expect(classified.recoverable).toBe(true);
    expect(classified.retryable).toBe(false);
    expect(classified.statusCode).toBe(400);
    expect(classified.context).toEqual({ foo: 'bar' });
  });

  it('should classify standard Error with network keywords as NETWORK_ERROR', () => {
    const error = new Error('Failed to fetch data');
    const classified = classifyError(error);

    expect(classified.code).toBe(ErrorCode.NETWORK_ERROR);
    expect(classified.statusCode).toBe(503);
    expect(classified.retryable).toBe(true);
    expect(classified.originalError).toBe(error);
  });

  it('should classify standard Error with rate limit keywords as RATE_LIMIT_ERROR', () => {
    const error = new Error('API returned 429 Too Many Requests');
    const classified = classifyError(error);

    expect(classified.code).toBe(ErrorCode.RATE_LIMIT_ERROR);
    expect(classified.statusCode).toBe(429);
    expect(classified.retryable).toBe(true);
    expect(classified.originalError).toBe(error);
  });

  it('should classify standard Error with auth keywords as AUTH_ERROR', () => {
    const error = new Error('Invalid token provided');
    const classified = classifyError(error);

    expect(classified.code).toBe(ErrorCode.AUTH_ERROR);
    expect(classified.statusCode).toBe(401);
    expect(classified.retryable).toBe(false);
    expect(classified.originalError).toBe(error);
  });

  it('should classify standard Error with timeout keywords as TIMEOUT_ERROR', () => {
    const error = new Error('Request timed out after 3000ms');
    const classified = classifyError(error);

    expect(classified.code).toBe(ErrorCode.TIMEOUT_ERROR);
    expect(classified.statusCode).toBe(504);
    expect(classified.retryable).toBe(true);
    expect(classified.originalError).toBe(error);
  });

  it('should classify unknown standard Error as UNKNOWN_ERROR', () => {
    const error = new Error('Something weird happened');
    const classified = classifyError(error);

    expect(classified.code).toBe(ErrorCode.UNKNOWN_ERROR);
    expect(classified.statusCode).toBe(500);
    expect(classified.retryable).toBe(true);
    expect(classified.originalError).toBe(error);
  });

  it('should classify string error as UNKNOWN_ERROR', () => {
    const error = 'String error message';
    const classified = classifyError(error);

    expect(classified.code).toBe(ErrorCode.UNKNOWN_ERROR);
    expect(classified.message).toBe('String error message');
    expect(classified.statusCode).toBe(500);
    expect(classified.retryable).toBe(true);
    expect(classified.originalError).toBeUndefined();
  });
});
