import { describe, it, expect } from 'vitest';
import { determineRecoveryStrategy, ErrorCode, ErrorContext, classifyError, AppError, createErrorResponse } from '../src/lib/error-handler';



describe('AppError', () => {
  it('should instantiate correctly with all properties provided', () => {
    const error = new Error('original error');
    const appError = new AppError({
      code: ErrorCode.VALIDATION_ERROR,
      message: 'Base message',
      userMessage: 'User message',
      userMessageSV: 'User message SV',
      recoverable: true,
      retryable: true,
      statusCode: 400,
      context: { key: 'value' },
      originalError: error
    });

    expect(appError).toBeInstanceOf(Error);
    expect(appError.name).toBe('AppError');
    expect(appError.code).toBe(ErrorCode.VALIDATION_ERROR);
    expect(appError.message).toBe('Base message');
    expect(appError.userMessage).toBe('User message');
    expect(appError.userMessageSV).toBe('User message SV');
    expect(appError.recoverable).toBe(true);
    expect(appError.retryable).toBe(true);
    expect(appError.statusCode).toBe(400);
    expect(appError.context).toEqual({ key: 'value' });
    expect(appError.originalError).toBe(error);
  });

  it('should apply fallback values when optional properties are omitted', () => {
    const appError = new AppError({
      code: ErrorCode.UNKNOWN_ERROR,
      message: 'Fallback message',
      recoverable: false,
      retryable: false,
    });

    expect(appError.userMessage).toBe('Fallback message');
    expect(appError.userMessageSV).toBe('Fallback message');
    expect(appError.statusCode).toBe(500);
    expect(appError.context).toBeUndefined();
    expect(appError.originalError).toBeUndefined();
  });
});

describe('classifyError', () => {
  it('should return properties of an AppError instance unmodified', () => {
    const appError = new AppError({
      code: ErrorCode.VALIDATION_ERROR,
      message: 'Validation failed',
      userMessage: 'Please check your input.',
      userMessageSV: 'Kontrollera din inmatning.',
      recoverable: true,
      retryable: false,
      statusCode: 400,
      context: { field: 'email' },
    });

    const classified = classifyError(appError);

    expect(classified.code).toBe(ErrorCode.VALIDATION_ERROR);
    expect(classified.message).toBe('Validation failed');
    expect(classified.userMessage).toBe('Please check your input.');
    expect(classified.userMessageSV).toBe('Kontrollera din inmatning.');
    expect(classified.recoverable).toBe(true);
    expect(classified.retryable).toBe(false);
    expect(classified.statusCode).toBe(400);
    expect(classified.context).toEqual({ field: 'email' });
  });

  it('should classify network errors based on keyword', () => {
    const error = new Error('Failed to fetch data');
    const classified = classifyError(error);

    expect(classified.code).toBe(ErrorCode.NETWORK_ERROR);
    expect(classified.statusCode).toBe(503);
    expect(classified.originalError).toBe(error);
  });

  it('should classify rate limit errors based on keyword', () => {
    const error = new Error('API rate limit exceeded');
    const classified = classifyError(error);

    expect(classified.code).toBe(ErrorCode.RATE_LIMIT_ERROR);
    expect(classified.statusCode).toBe(429);
  });

  it('should classify authentication errors based on keyword', () => {
    const error = new Error('Status 401 Unauthorized');
    const classified = classifyError(error);

    expect(classified.code).toBe(ErrorCode.AUTH_ERROR);
    expect(classified.statusCode).toBe(401);
  });

  it('should classify timeout errors based on keyword', () => {
    const error = new Error('Connection timed out');
    const classified = classifyError(error);

    expect(classified.code).toBe(ErrorCode.TIMEOUT_ERROR);
    expect(classified.statusCode).toBe(504);
  });

  it('should fallback to UNKNOWN_ERROR for standard errors without matching keywords', () => {
    const error = new Error('Some bizarre unexpected issue');
    const classified = classifyError(error);

    expect(classified.code).toBe(ErrorCode.UNKNOWN_ERROR);
    expect(classified.statusCode).toBe(500);
    expect(classified.message).toBe('Some bizarre unexpected issue');
    expect(classified.originalError).toBe(error);
  });

  it('should classify non-Error primitives as UNKNOWN_ERROR', () => {
    const errorStr = 'Just a string error';
    const classified = classifyError(errorStr);

    expect(classified.code).toBe(ErrorCode.UNKNOWN_ERROR);
    expect(classified.statusCode).toBe(500);
    expect(classified.message).toBe('Just a string error');
    expect(classified.originalError).toBeUndefined();
  });
});

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

describe('createErrorResponse', () => {
  it('should create a response from an Error with default options', async () => {
    const error = new Error('Test error message');
    const response = createErrorResponse(error);

    expect(response.status).toBe(500);
    expect(response.headers.get('Content-Type')).toBe('application/json');

    const body = await response.json() as Record<string, unknown>;
    expect(body.error).toBe('An unexpected error occurred. Please try again.');
    expect(body.code).toBe(ErrorCode.UNKNOWN_ERROR);
    expect(body.recoverable).toBe(true);
    expect(body.retryable).toBe(true);
    expect(body.stack).toBeUndefined();

    // Default strategy for UNKNOWN_ERROR with retryable=true
    expect(body.suggestion).toBe('An error occurred. Retrying...');
    expect(body.action).toBe('retry');
  });

  it('should create a response from an AppError with swedish option', async () => {
    const appError = new AppError({
      code: ErrorCode.VALIDATION_ERROR,
      message: 'Validation failed',
      userMessage: 'English message',
      userMessageSV: 'Svenska meddelande',
      recoverable: true,
      retryable: false,
      statusCode: 400,
    });
    const response = createErrorResponse(appError, { swedish: true });

    expect(response.status).toBe(400);

    const body = await response.json() as Record<string, unknown>;
    expect(body.error).toBe('Svenska meddelande');
    expect(body.code).toBe(ErrorCode.VALIDATION_ERROR);
    expect(body.recoverable).toBe(true);
    expect(body.retryable).toBe(false);
    expect(body.stack).toBeUndefined();

    expect(body.suggestion).toBe('English message');
    expect(body.action).toBe('abort');
  });

  it('should include stack trace when includeStack is true and stack exists', async () => {
    const error = new Error('Test with stack');
    const response = createErrorResponse(error, { includeStack: true });

    const body = await response.json() as Record<string, unknown>;
    expect(body.stack).toBeDefined();
    expect(body.stack).toContain('Error: Test with stack');
  });

  it('should omit stack trace when includeStack is false', async () => {
    const error = new Error('Test without stack');
    const response = createErrorResponse(error, { includeStack: false });

    const body = await response.json() as Record<string, unknown>;
    expect(body.stack).toBeUndefined();
  });
});
