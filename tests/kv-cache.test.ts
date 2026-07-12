import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cachedKV } from '../src/lib/kv-cache';

describe('KV Cache', () => {
  let mockKV: any;

  beforeEach(() => {
    mockKV = {
      get: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
    };
    cachedKV.clearCache();
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  describe('flushWriteQueue error handling', () => {
    it('handles write errors during flush gracefully without crashing', async () => {
      const error = new Error('KV Write Error');
      mockKV.put.mockRejectedValue(error);

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      // Add item to the write queue (immediate: false)
      await cachedKV.put(mockKV, 'test-error-key', '{"val":"test"}', { immediate: false });

      // Force a flush, which triggers flushWriteQueue
      await cachedKV.flush(mockKV);

      expect(mockKV.put).toHaveBeenCalledWith('test-error-key', '{"val":"test"}', undefined);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'KV write failed for key test-error-key:',
        error
      );

      consoleErrorSpy.mockRestore();
    });

    it('handles parallel write errors gracefully during flushWriteQueue', async () => {
      // Simulate batch map write error
      const error = new Error('Parallel Batch Write Error');
      mockKV.put.mockRejectedValue(error);
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      // Add item to queue (immediate: false)
      await cachedKV.put(mockKV, 'test-parallel-error', '{"val":"parallel"}', { immediate: false });

      // Trigger flush
      await cachedKV.flush(mockKV);

      expect(mockKV.put).toHaveBeenCalledWith('test-parallel-error', '{"val":"parallel"}', undefined);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'KV write failed for key test-parallel-error:',
        error
      );

      consoleErrorSpy.mockRestore();
    });

    it('handles write errors during background scheduled flush gracefully without crashing', async () => {
      vi.useFakeTimers();
      const error = new Error('Background KV Write Error');
      mockKV.put.mockRejectedValue(error);
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      // Add item to queue, triggering scheduleFlush
      await cachedKV.put(mockKV, 'test-bg-error', '{"val":"bg"}', { immediate: false });

      // Fast-forward time to trigger the scheduled flushWriteQueue
      await vi.runAllTimersAsync();

      expect(mockKV.put).toHaveBeenCalledWith('test-bg-error', '{"val":"bg"}', undefined);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'KV write failed for key test-bg-error:',
        error
      );

      consoleErrorSpy.mockRestore();
    });
  });
});
