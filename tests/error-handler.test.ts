import { describe, it, expect } from 'vitest';
import { determineRecoveryStrategy, ErrorCode, ErrorContext, processBatch } from '../src/lib/error-handler';

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

describe('processBatch', () => {
  it('should process all items successfully', async () => {
    const items = [1, 2, 3, 4, 5];
    const processor = async (item: number) => item * 2;

    const result = await processBatch(items, processor);

    expect(result.totalCount).toBe(5);
    expect(result.successCount).toBe(5);
    expect(result.failureCount).toBe(0);
    expect(result.successful).toEqual([
      { item: 1, result: 2 },
      { item: 2, result: 4 },
      { item: 3, result: 6 },
      { item: 4, result: 8 },
      { item: 5, result: 10 },
    ]);
    expect(result.failed).toEqual([]);
  });

  it('should handle partial failures when continueOnError is true', async () => {
    const items = [1, 2, 3, 4, 5];
    const processor = async (item: number) => {
      if (item % 2 === 0) {
        throw new Error(`Failed on ${item}`);
      }
      return item * 2;
    };

    const result = await processBatch(items, processor);

    expect(result.totalCount).toBe(5);
    expect(result.successCount).toBe(3);
    expect(result.failureCount).toBe(2);
    expect(result.successful).toEqual([
      { item: 1, result: 2 },
      { item: 3, result: 6 },
      { item: 5, result: 10 },
    ]);
    expect(result.failed).toHaveLength(2);
    expect(result.failed[0].item).toBe(2);
    expect(result.failed[0].error.message).toBe('Failed on 2');
    expect(result.failed[1].item).toBe(4);
    expect(result.failed[1].error.message).toBe('Failed on 4');
  });

  it('should stop processing early when continueOnError is false', async () => {
    const items = [1, 2, 3, 4, 5];
    let processedCount = 0;
    const processor = async (item: number) => {
      processedCount++;
      if (item === 2) {
        throw new Error('Stop here');
      }
      return item * 2;
    };

    const result = await processBatch(items, processor, { continueOnError: false, maxConcurrent: 2 });

    expect(result.totalCount).toBe(5);
    expect(result.successCount).toBe(1);
    expect(result.failureCount).toBe(1);
    expect(processedCount).toBe(2);
    expect(result.successful).toEqual([{ item: 1, result: 2 }]);
    expect(result.failed).toHaveLength(1);
    expect(result.failed[0].item).toBe(2);
  });

  it('should process items in chunks based on maxConcurrent', async () => {
    const items = [1, 2, 3, 4, 5];
    const activeProcessors = new Set<number>();
    let maxObservedConcurrent = 0;

    const processor = async (item: number) => {
      activeProcessors.add(item);
      maxObservedConcurrent = Math.max(maxObservedConcurrent, activeProcessors.size);

      await new Promise(resolve => setTimeout(resolve, 10));

      activeProcessors.delete(item);
      return item * 2;
    };

    await processBatch(items, processor, { maxConcurrent: 2 });

    expect(maxObservedConcurrent).toBe(2);
  });
});
