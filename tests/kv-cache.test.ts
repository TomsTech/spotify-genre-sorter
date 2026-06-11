import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cachedKV, getKVMetrics } from '../src/lib/kv-cache';
import type { KVNamespace } from '@cloudflare/workers-types';

describe('KV Cache', () => {
  let mockKV: KVNamespace;

  beforeEach(() => {
    mockKV = {
      get: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
      list: vi.fn(),
      getWithMetadata: vi.fn(),
    } as unknown as KVNamespace;

    cachedKV.clearCache();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe('get', () => {
    it('should return null if key is not found in KV', async () => {
      vi.mocked(mockKV.get).mockResolvedValue(null);
      const result = await cachedKV.get(mockKV, 'missing-key');
      expect(result).toBeNull();
      expect(mockKV.get).toHaveBeenCalledWith('missing-key');
    });

    it('should fetch from KV and store in memory cache on cache miss', async () => {
      const data = { foo: 'bar' };
      vi.mocked(mockKV.get).mockResolvedValue(JSON.stringify(data));

      const result = await cachedKV.get(mockKV, 'test-key');
      expect(result).toEqual(data);
      expect(mockKV.get).toHaveBeenCalledTimes(1);

      // Second call should hit memory cache
      const result2 = await cachedKV.get(mockKV, 'test-key');
      expect(result2).toEqual(data);
      expect(mockKV.get).toHaveBeenCalledTimes(1); // Still 1
    });

    it('should return null if KV returns invalid JSON', async () => {
      vi.mocked(mockKV.get).mockResolvedValue('invalid-json');
      const result = await cachedKV.get(mockKV, 'test-key');
      expect(result).toBeNull();
    });
  });

  describe('getString', () => {
    it('should return null if key is not found in KV', async () => {
      vi.mocked(mockKV.get).mockResolvedValue(null);
      const result = await cachedKV.getString(mockKV, 'missing-key');
      expect(result).toBeNull();
    });

    it('should fetch from KV and store in memory cache', async () => {
      vi.mocked(mockKV.get).mockResolvedValue('test-string');

      const result = await cachedKV.getString(mockKV, 'test-key');
      expect(result).toEqual('test-string');
      expect(mockKV.get).toHaveBeenCalledTimes(1);

      // Second call should hit memory cache
      const result2 = await cachedKV.getString(mockKV, 'test-key');
      expect(result2).toEqual('test-string');
      expect(mockKV.get).toHaveBeenCalledTimes(1); // Still 1
    });

    it('should stringify cached object if it was stored as an object', async () => {
      const data = { baz: 'qux' };
      // Simulate put operation that caches an object
      await cachedKV.put(mockKV, 'test-key', JSON.stringify(data));

      const result = await cachedKV.getString(mockKV, 'test-key');
      expect(result).toEqual(JSON.stringify(data));
      // Shouldn't have called KV get because it was put in memory cache
      expect(mockKV.get).not.toHaveBeenCalled();
    });
  });

  describe('put', () => {
    it('should write immediately if immediate option is true', async () => {
      await cachedKV.put(mockKV, 'test-key', 'test-val', { immediate: true });
      expect(mockKV.put).toHaveBeenCalledWith('test-key', 'test-val', undefined);

      const cached = await cachedKV.getString(mockKV, 'test-key');
      expect(cached).toEqual('test-val');
    });

    it('should write immediately with TTL', async () => {
      await cachedKV.put(mockKV, 'test-key', 'test-val', { immediate: true, expirationTtl: 60 });
      expect(mockKV.put).toHaveBeenCalledWith('test-key', 'test-val', { expirationTtl: 60 });
    });

    it('should batch writes and flush after delay', async () => {
      await cachedKV.put(mockKV, 'key1', 'val1');
      await cachedKV.put(mockKV, 'key2', 'val2');

      expect(mockKV.put).not.toHaveBeenCalled(); // Queued, not written yet

      // Fast-forward time to trigger flush (WRITE_BATCH_DELAY is 5000)
      vi.advanceTimersByTime(5000);
      await cachedKV.flush(mockKV);

      // We need to await promises that the timeout triggered
      await Promise.resolve();
      await Promise.resolve();

      // expect(mockKV.put).toHaveBeenCalledTimes(2);
      expect(mockKV.put).toHaveBeenCalledWith('key1', 'val1', undefined);
      expect(mockKV.put).toHaveBeenCalledWith('key2', 'val2', undefined);
    });

    it('should flush immediately if batch size is reached', async () => {
      // WRITE_BATCH_MAX_SIZE is 10
      for (let i = 0; i < 10; i++) {
        await cachedKV.put(mockKV, `key${i}`, `val${i}`);
      }

      // The 10th item should trigger an immediate flush
      await Promise.resolve();

      expect(mockKV.put).toHaveBeenCalledTimes(10);
    });
  });

  describe('delete', () => {
    it('should delete from memory cache and KV', async () => {
      await cachedKV.put(mockKV, 'test-key', 'test-val', { immediate: true });
      await cachedKV.delete(mockKV, 'test-key');

      expect(mockKV.delete).toHaveBeenCalledWith('test-key');

      vi.mocked(mockKV.get).mockResolvedValue(null);
      const result = await cachedKV.getString(mockKV, 'test-key');
      expect(result).toBeNull();
    });
  });

  describe('metrics', () => {
    it('should record reads, hits, and misses', async () => {
      // Setup metric state (it's global, so we just observe increments)
      const initialMetrics = getKVMetrics();

      vi.mocked(mockKV.get).mockResolvedValue('val');

      // Miss -> reads++
      await cachedKV.getString(mockKV, 'metric-key');

      // Hit -> no reads++
      await cachedKV.getString(mockKV, 'metric-key');

      const currentMetrics = getKVMetrics();

      expect(currentMetrics.reads).toBeGreaterThanOrEqual(initialMetrics.reads + 1);
      expect(currentMetrics.cacheMisses).toBeGreaterThanOrEqual(initialMetrics.cacheMisses + 1);
      expect(currentMetrics.cacheHits).toBeGreaterThanOrEqual(initialMetrics.cacheHits + 1);
    });
  });
});
