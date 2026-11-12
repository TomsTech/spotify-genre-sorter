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

    it('catches an error thrown from flushWriteQueue in batch.map loop', async () => {
      // Mock KV.put to reject with an error
      const error = new Error('Simulated KV put error');
      mockKV.put.mockRejectedValue(error);
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      // Add item to write queue with metadata and expirationTtl to hit lines 143, 144
      await cachedKV.put(mockKV, 'test-error-key', 'test-value', { immediate: false, expirationTtl: 3600, metadata: { test: true } });

      // Trigger flush
      await cachedKV.flush(mockKV);

      expect(consoleErrorSpy).toHaveBeenCalledWith(`KV write failed for key test-error-key:`, error);
      consoleErrorSpy.mockRestore();
    });

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

    it('flushes all pending items during forced flush even if queue exceeds max batch size', async () => {
      vi.useRealTimers();

      // Delay put to allow queue to build up
      mockKV.put.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 5)));

      const puts = Array.from({ length: 15 }).map((_, i) =>
        cachedKV.put(mockKV, `key-${i}`, `val-${i}`, { immediate: false })
      );

      await cachedKV.flush(mockKV);
      await Promise.all(puts);

      expect(mockKV.put).toHaveBeenCalledTimes(15);
    });

    it('catches unexpected errors from flushWriteQueue in scheduleFlush', async () => {
      // Mock Promise.all to simulate a catastrophic failure in flushWriteQueue
      const error = new Error('Promise.all failed');
      const promiseAllSpy = vi.spyOn(Promise, 'all').mockRejectedValueOnce(error);
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      vi.useFakeTimers();

      // Add item to the write queue (immediate: false)
      // This will call scheduleFlush(kv) internally
      await cachedKV.put(mockKV, 'test-schedule-error-key', '{"val":"test"}', { immediate: false });

      // Fast forward the scheduled timeout in scheduleFlush
      vi.runAllTimers();

      // flushWriteQueue runs asynchronously; we need to wait for the event loop
      // to process the promise rejection and the subsequent .catch(console.error)
      await Promise.resolve();
      await Promise.resolve();

      expect(consoleErrorSpy).toHaveBeenCalledWith(error);

      consoleErrorSpy.mockRestore();
      promiseAllSpy.mockRestore();
      vi.useRealTimers();
    });
  });

  describe('MemoryCache LRU Eviction & Re-ordering (PERF-026)', () => {
    it('evicts the oldest inserted item when capacity (100) is exceeded', async () => {
      // Fill cache to MAX_SIZE (100)
      for (let i = 0; i < 100; i++) {
        await cachedKV.put(mockKV, `key-${i}`, JSON.stringify({ item: i }));
      }

      // Read back key-0 from cache (should be hit)
      const hit0 = await cachedKV.get(mockKV, 'key-0');
      expect(hit0).toEqual({ item: 0 });

      // Insert 101st item to trigger evictOldest
      // Since key-0 was accessed above, accessing key-0 moved key-0 to the end (most recently used).
      // Therefore, key-1 is now the oldest and should be evicted!
      await cachedKV.put(mockKV, 'key-100', JSON.stringify({ item: 100 }));

      // Key-1 should have been evicted (cache miss from memory, falls back to KV mock)
      mockKV.get.mockResolvedValueOnce(null);
      const missed1 = await cachedKV.get(mockKV, 'key-1');
      expect(missed1).toBeNull();
      expect(mockKV.get).toHaveBeenCalledWith('key-1');

      // Key-0 should still be in memory cache (cache hit, no mockKV.get call)
      mockKV.get.mockClear();
      const hit0Again = await cachedKV.get(mockKV, 'key-0');
      expect(hit0Again).toEqual({ item: 0 });
      expect(mockKV.get).not.toHaveBeenCalled();
    });

    it('updates LRU order on set when overwriting existing key', async () => {
      for (let i = 0; i < 100; i++) {
        await cachedKV.put(mockKV, `key-${i}`, JSON.stringify({ item: i }));
      }

      // Overwrite key-0
      await cachedKV.put(mockKV, 'key-0', JSON.stringify({ item: 'updated-0' }));

      // Insert new key to trigger eviction
      // key-0 was overwritten so it moved to newest; key-1 is now oldest
      await cachedKV.put(mockKV, 'key-100', JSON.stringify({ item: 100 }));

      // key-1 evicted
      mockKV.get.mockResolvedValueOnce(null);
      const missed1 = await cachedKV.get(mockKV, 'key-1');
      expect(missed1).toBeNull();

      // key-0 retained with updated value
      mockKV.get.mockClear();
      const hit0 = await cachedKV.get(mockKV, 'key-0');
      expect(hit0).toEqual({ item: 'updated-0' });
      expect(mockKV.get).not.toHaveBeenCalled();
    });

    it('handles cache entry expiry correctly during get', async () => {
      vi.useFakeTimers();
      const now = Date.now();
      vi.setSystemTime(now);

      await cachedKV.put(mockKV, 'ttl-key', JSON.stringify({ val: 'test' }), { expirationTtl: 10 }); // 10s TTL

      // Advance time beyond TTL (10 seconds + 1ms)
      vi.setSystemTime(now + 10000 + 1);

      mockKV.get.mockResolvedValueOnce(null);
      const expiredVal = await cachedKV.get(mockKV, 'ttl-key');
      expect(expiredVal).toBeNull();
      expect(mockKV.get).toHaveBeenCalledWith('ttl-key');

      vi.useRealTimers();
    });
  });

});
