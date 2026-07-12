import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cachedKV, getKVMetrics } from '../src/lib/kv-cache';

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
  });


  describe('getKVMetrics', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should return initial metrics', () => {
      const metrics = getKVMetrics();
      expect(metrics).toBeDefined();
      expect(metrics).toEqual(expect.objectContaining({
        reads: expect.any(Number),
        writes: expect.any(Number),
        deletes: expect.any(Number),
        cacheHits: expect.any(Number),
        cacheMisses: expect.any(Number),
        lastReset: expect.any(Number)
      }));
    });

    it('should reset metrics if older than a day', () => {
      const initialMetrics = getKVMetrics();

      // Advance time by 24 hours + 1 ms
      vi.setSystemTime(initialMetrics.lastReset + 24 * 60 * 60 * 1000 + 1);

      const resetMetrics = getKVMetrics();

      expect(resetMetrics.lastReset).toBeGreaterThan(initialMetrics.lastReset);
      expect(resetMetrics.reads).toBe(0);
      expect(resetMetrics.writes).toBe(0);
      expect(resetMetrics.deletes).toBe(0);
      expect(resetMetrics.cacheHits).toBe(0);
      expect(resetMetrics.cacheMisses).toBe(0);
    });
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
  });
});
