/**
 * Error Handling & Recovery System
 *
 * Provides:
 * - Typed error classes for different failure scenarios
 * - Retry logic with exponential backoff
 * - Error classification and user-friendly messages
 * - Recovery strategies for partial failures
 * - Error logging and telemetry
 */

import { createLogger } from './logger';

// V8 Error.captureStackTrace type declaration
declare global {
  interface ErrorConstructor {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
    captureStackTrace?(targetObject: object, constructorOpt?: Function): void;
  }
}

// ==================== Error Types ====================

export enum ErrorCode {
  // Network & API Errors
  NETWORK_ERROR = 'NETWORK_ERROR',
  SPOTIFY_API_ERROR = 'SPOTIFY_API_ERROR',
  RATE_LIMIT_ERROR = 'RATE_LIMIT_ERROR',
  AUTH_ERROR = 'AUTH_ERROR',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',

  // KV/Storage Errors
  KV_ERROR = 'KV_ERROR',
  CACHE_ERROR = 'CACHE_ERROR',

  // Validation Errors
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INVALID_INPUT = 'INVALID_INPUT',

  // Application Errors
  PLAYLIST_CREATE_ERROR = 'PLAYLIST_CREATE_ERROR',
  TRACK_FETCH_ERROR = 'TRACK_FETCH_ERROR',
  GENRE_SCAN_ERROR = 'GENRE_SCAN_ERROR',

  // System Errors
  SUBREQUEST_LIMIT = 'SUBREQUEST_LIMIT',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

export interface ErrorContext {
  code: ErrorCode;
  message: string;
  userMessage?: string;
  userMessageSV?: string; // Swedish translation
  recoverable: boolean;
  retryable: boolean;
  statusCode?: number;
  originalError?: Error;
  context?: Record<string, unknown>;
}

export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly userMessage: string;
  public readonly userMessageSV: string;
  public readonly recoverable: boolean;
  public readonly retryable: boolean;
  public readonly statusCode: number;
  public readonly context?: Record<string, unknown>;
  public readonly originalError?: Error;

  constructor(config: ErrorContext) {
    super(config.message);
    this.name = 'AppError';
    this.code = config.code;
    this.userMessage = config.userMessage || config.message;
    this.userMessageSV = config.userMessageSV || config.userMessage || config.message;
    this.recoverable = config.recoverable;
    this.retryable = config.retryable;
    this.statusCode = config.statusCode || 500;
    this.context = config.context;
    this.originalError = config.originalError;

    // Maintain proper stack trace
    if (config.originalError instanceof Error && config.originalError.stack) {
      this.stack = config.originalError.stack;
    } else if (typeof Error.captureStackTrace === 'function') {
      Error.captureStackTrace(this, AppError);
    }
  }
}

// ==================== Error Classification ====================

export function classifyError(error: unknown): ErrorContext {
  // Handle AppError instances
  if (error instanceof AppError) {
    return {
      code: error.code,
      message: error.message,
      userMessage: error.userMessage,
      userMessageSV: error.userMessageSV,
      recoverable: error.recoverable,
      retryable: error.retryable,
      statusCode: error.statusCode,
      context: error.context,
    };
  }

  // Handle standard Error instances
  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    // Network errors
    if (message.includes('fetch') || message.includes('network')) {
      return {
        code: ErrorCode.NETWORK_ERROR,
        message: error.message,
        userMessage: 'Unable to connect to the server. Please check your internet connection.',
        userMessageSV: 'Kan inte ansluta till servern. Kontrollera din internetanslutning.',
        recoverable: true,
        retryable: true,
        statusCode: 503,
        originalError: error,
      };
    }

    // Rate limiting
    if (message.includes('rate limit') || message.includes('429')) {
      return {
        code: ErrorCode.RATE_LIMIT_ERROR,
        message: error.message,
        userMessage: 'Too many requests. Please wait a moment and try again.',
        userMessageSV: 'För många förfrågningar. Vänta en stund och försök igen.',
        recoverable: true,
        retryable: true,
        statusCode: 429,
        originalError: error,
      };
    }

    // Authentication errors
    if (message.includes('auth') || message.includes('401') || message.includes('token')) {
      return {
        code: ErrorCode.AUTH_ERROR,
        message: error.message,
        userMessage: 'Authentication failed. Please log in again.',
        userMessageSV: 'Autentisering misslyckades. Logga in igen.',
        recoverable: true,
        retryable: false,
        statusCode: 401,
        originalError: error,
      };
    }

    // Timeout errors
    if (message.includes('timeout') || message.includes('timed out')) {
      return {
        code: ErrorCode.TIMEOUT_ERROR,
        message: error.message,
        userMessage: 'Request timed out. The server is taking too long to respond.',
        userMessageSV: 'Begäran tog för lång tid. Servern svarar inte i tid.',
        recoverable: true,
        retryable: true,
        statusCode: 504,
        originalError: error,
      };
    }
  }

  // Unknown errors
  return {
    code: ErrorCode.UNKNOWN_ERROR,
    message: error instanceof Error ? error.message : String(error),
    userMessage: 'An unexpected error occurred. Please try again.',
    userMessageSV: 'Ett oväntat fel inträffade. Försök igen.',
    recoverable: true,
    retryable: true,
    statusCode: 500,
    originalError: error instanceof Error ? error : undefined,
  };
}

// ==================== Retry Logic ====================

export interface RetryConfig {
  maxRetries: number;
  baseDelay: number; // milliseconds
  maxDelay: number; // milliseconds
  exponentialBase: number;
  retryableErrors?: ErrorCode[];
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 10000,
  exponentialBase: 2,
  retryableErrors: [
    ErrorCode.NETWORK_ERROR,
    ErrorCode.RATE_LIMIT_ERROR,
    ErrorCode.TIMEOUT_ERROR,
    ErrorCode.SPOTIFY_API_ERROR,
  ],
};

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  config: Partial<RetryConfig> = {}
): Promise<T> {
  const finalConfig = { ...DEFAULT_RETRY_CONFIG, ...config };
  let lastError: Error | AppError | undefined;

  for (let attempt = 0; attempt <= finalConfig.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      const classified = classifyError(error);
      lastError = error instanceof Error ? error : new Error(String(error));

      // Don't retry if error is not retryable
      if (!classified.retryable) {
        throw new AppError(classified);
      }

      // Don't retry if error code not in retryable list (if specified)
      if (
        finalConfig.retryableErrors &&
        !finalConfig.retryableErrors.includes(classified.code)
      ) {
        throw new AppError(classified);
      }

      // Don't retry on last attempt
      if (attempt >= finalConfig.maxRetries) {
        throw new AppError(classified);
      }

      // Calculate delay with exponential backoff
      const delay = Math.min(
        finalConfig.baseDelay * Math.pow(finalConfig.exponentialBase, attempt),
        finalConfig.maxDelay
      );

      // Add jitter (±20%) to prevent thundering herd
      const jitter = delay * 0.2 * (Math.random() * 2 - 1);
      const finalDelay = Math.max(0, delay + jitter);

      console.warn(`Retry attempt ${attempt + 1}/${finalConfig.maxRetries} after ${finalDelay}ms`, {
        error: classified.code,
        message: classified.message,
      });

      await sleep(finalDelay);
    }
  }

  throw lastError || new Error('Retry exhausted');
}

// ==================== Error Recovery ====================

export interface RecoveryStrategy {
  action: 'retry' | 'fallback' | 'skip' | 'abort';
  message?: string;
  fallbackValue?: unknown;
}

export function determineRecoveryStrategy(error: ErrorContext): RecoveryStrategy {
  // Authentication errors → redirect to login
  if (error.code === ErrorCode.AUTH_ERROR || error.code === ErrorCode.TOKEN_EXPIRED) {
    return {
      action: 'abort',
      message: 'Please log in again to continue.',
    };
  }

  // Rate limiting → retry with backoff
  if (error.code === ErrorCode.RATE_LIMIT_ERROR) {
    return {
      action: 'retry',
      message: 'Rate limited. Retrying...',
    };
  }

  // Network errors → retry
  if (error.code === ErrorCode.NETWORK_ERROR || error.code === ErrorCode.TIMEOUT_ERROR) {
    return {
      action: 'retry',
      message: 'Connection lost. Retrying...',
    };
  }

  // Validation errors → abort (user needs to fix input)
  if (error.code === ErrorCode.VALIDATION_ERROR || error.code === ErrorCode.INVALID_INPUT) {
    return {
      action: 'abort',
      message: error.userMessage,
    };
  }

  // Cache errors → fallback to direct KV
  if (error.code === ErrorCode.CACHE_ERROR) {
    return {
      action: 'fallback',
      message: 'Cache error, using direct storage.',
    };
  }

  // Default: retry if retryable, otherwise abort
  if (error.retryable) {
    return {
      action: 'retry',
      message: 'An error occurred. Retrying...',
    };
  }

  return {
    action: 'abort',
    message: error.userMessage || 'An error occurred.',
  };
}

// ==================== Partial Failure Handling ====================

export interface BatchResult<T, TInput = T> {
  successful: T[];
  failed: Array<{ item: TInput; error: ErrorContext }>;
  totalCount: number;
  successCount: number;
  failureCount: number;
}

/**
 * Process items in batch with partial failure support
 * Continues processing even if some items fail
 */
export async function processBatch<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  options: {
    continueOnError?: boolean;
    maxConcurrent?: number;
  } = {}
): Promise<BatchResult<{ item: T; result: R }, T>> {
  const { continueOnError = true, maxConcurrent = 5 } = options;
  const successful: Array<{ item: T; result: R }> = [];
  const failed: Array<{ item: T; error: ErrorContext }> = [];

  // Process in chunks to avoid overwhelming the system
  for (let i = 0; i < items.length; i += maxConcurrent) {
    const chunk = items.slice(i, i + maxConcurrent);
    const results = await Promise.allSettled(
      chunk.map(item => processor(item).then(result => ({ item, result })))
    );

    for (const result of results) {
      if (result.status === 'fulfilled') {
        successful.push(result.value);
      } else {
        const error = classifyError(result.reason);
        failed.push({
          item: chunk[results.indexOf(result)],
          error,
        });

        if (!continueOnError) {
          // Return early with partial results
          return {
            successful,
            failed,
            totalCount: items.length,
            successCount: successful.length,
            failureCount: failed.length,
          };
        }
      }
    }
  }

  return {
    successful,
    failed,
    totalCount: items.length,
    successCount: successful.length,
    failureCount: failed.length,
  };
}

// ==================== Error Logging ====================

export interface ErrorLogEntry {
  timestamp: string;
  code: ErrorCode;
  message: string;
  statusCode: number;
  stack?: string;
  context?: Record<string, unknown>;
  userAgent?: string;
  path?: string;
  userId?: string;
}

/**
 * Log error for debugging and monitoring
 */
export function logError(
  error: ErrorContext | Error,
  ctx?: {
    executionContext?: ExecutionContext;
    betterStackToken?: string;
    requestContext?: {
      path?: string;
      method?: string;
      userId?: string;
    };
  }
): ErrorLogEntry {
  const classified = error instanceof AppError ? error : classifyError(error);

  const originalError: Error | undefined = classified.originalError;
  const logEntry: ErrorLogEntry = {
    timestamp: new Date().toISOString(),
    code: classified.code,
    message: classified.message,
    statusCode: classified.statusCode || 500,
    stack: originalError instanceof Error ? originalError.stack : undefined,
    context: classified.context,
    path: ctx?.requestContext?.path,
    userId: ctx?.requestContext?.userId,
  };

  // Log to console
  console.error('[ERROR]', {
    code: logEntry.code,
    message: logEntry.message,
    statusCode: logEntry.statusCode,
    path: logEntry.path,
  });

  // Log to BetterStack if available
  if (ctx?.executionContext && ctx?.betterStackToken) {
    try {
      const logger = createLogger(
        ctx.executionContext,
        ctx.betterStackToken,
        ctx.requestContext
      );
      logger.logError(classified.message, originalError || new Error(classified.message), {
        errorCode: classified.code,
        statusCode: classified.statusCode,
        recoverable: classified.recoverable,
        retryable: classified.retryable,
        ...classified.context,
      });
    } catch (logErr) {
      console.error('Failed to send error to BetterStack:', logErr);
    }
  }

  return logEntry;
}

// ==================== Response Helpers ====================

/**
 * Create error response with proper status code and user-friendly message
 */
export function createErrorResponse(
  error: ErrorContext | Error,
  options: {
    swedish?: boolean;
    includeStack?: boolean;
  } = {}
): Response {
  const classified = error instanceof AppError ? error : classifyError(error);
  const userMessage = options.swedish ? classified.userMessageSV : classified.userMessage;

  const body: Record<string, unknown> = {
    error: userMessage || classified.message,
    code: classified.code,
    recoverable: classified.recoverable,
    retryable: classified.retryable,
  };

  // Include stack trace in development
  if (options.includeStack && classified.originalError?.stack) {
    body.stack = classified.originalError.stack;
  }

  // Include recovery suggestions
  const recovery = determineRecoveryStrategy(classified);
  if (recovery.message) {
    body.suggestion = recovery.message;
    body.action = recovery.action;
  }

  return new Response(JSON.stringify(body), {
    status: classified.statusCode || 500,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}
