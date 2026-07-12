import { describe, it, expect } from 'vitest';
import { determineRecoveryStrategy, ErrorCode, ErrorContext, classifyError, AppError, logError } from '../src/lib/error-handler';
import * as loggerModule from '../src/lib/logger';
import { vi, beforeEach, afterEach } from 'vitest';


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



describe('logError', () => {
  let consoleErrorSpy: any;
  let createLoggerSpy: any;
  let mockLogger: any;
  let mockExecutionContext: any;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    mockLogger = {
      error: vi.fn(),
      logError: vi.fn(),
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      logRequest: vi.fn(),
    };

    createLoggerSpy = vi.spyOn(loggerModule, 'createLogger').mockReturnValue(mockLogger);

    mockExecutionContext = {
      waitUntil: vi.fn()
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should fallback to console.error when executionContext is not provided', () => {
    const error = new Error('Test error');
    logError(error);

    expect(consoleErrorSpy).toHaveBeenCalled();
    expect(createLoggerSpy).not.toHaveBeenCalled();

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[ERROR]',
      expect.objectContaining({
        code: ErrorCode.UNKNOWN_ERROR,
        message: 'Test error',
        statusCode: 500,
      })
    );
  });

  it('should use custom logger when executionContext is provided', () => {
    const error = new Error('Test error');

    const requestContext = {
      path: '/api/test',
      method: 'GET',
      userId: 'user123'
    };

    logError(error, {
      executionContext: mockExecutionContext,
      requestContext
    });

    expect(createLoggerSpy).toHaveBeenCalledWith(
      mockExecutionContext,
      undefined,
      requestContext
    );

    expect(mockLogger.error).toHaveBeenCalledWith(
      '[ERROR]',
      expect.objectContaining({
        code: ErrorCode.UNKNOWN_ERROR,
        message: 'Test error',
        statusCode: 500,
        path: '/api/test',
      })
    );

    expect(mockLogger.logError).not.toHaveBeenCalled();
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it('should call BetterStack-specific logging when betterStackToken is provided', () => {
    const appError = new AppError({
      code: ErrorCode.NETWORK_ERROR,
      message: 'Network failed',
      statusCode: 503,
      recoverable: true,
      retryable: true,
      context: { host: 'api.spotify.com' },
    });

    const token = 'fake-betterstack-token';

    logError(appError, {
      executionContext: mockExecutionContext,
      betterStackToken: token
    });

    expect(createLoggerSpy).toHaveBeenCalledWith(
      mockExecutionContext,
      token,
      undefined
    );

    expect(mockLogger.error).toHaveBeenCalled();

    expect(mockLogger.logError).toHaveBeenCalledWith(
      'Network failed',
      expect.any(Error),
      expect.objectContaining({
        errorCode: ErrorCode.NETWORK_ERROR,
        statusCode: 503,
        recoverable: true,
        retryable: true,
        host: 'api.spotify.com'
      })
    );
  });

  it('should fallback to console.error when creating the custom logger throws an error', () => {
    const error = new Error('Test error');

    const loggerError = new Error('Failed to create logger');
    createLoggerSpy.mockImplementationOnce(() => {
      throw loggerError;
    });

    logError(error, { executionContext: mockExecutionContext });

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Failed to send error to logger:',
      loggerError
    );
  });
});
