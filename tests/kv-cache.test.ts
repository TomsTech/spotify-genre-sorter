import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { cachedKV, getKVMetrics } from '../src/lib/kv-cache';

// Type for KVNamespace mock
interface MockKVNamespace {
  get: ReturnType<typeof vi.fn>;
  put: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
}

describe('KV Cache Metrics', () => {
  let mockKV: MockKVNamespace;

  beforeEach(async () => {
    vi.useFakeTimers();
    cachedKV.clearCache();

    // Mock KV namespace
    mockKV = {
      get: vi.fn().mockResolvedValue(null),
      put: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
    };

    // Advance time by more than 24 hours to ensure metrics are reset
    vi.advanceTimersByTime(25 * 60 * 60 * 1000);
    getKVMetrics(); // Trigger reset
    // Manually ensure zeroing in case another test ran concurrently or leaked
    vi.advanceTimersByTime(24 * 60 * 60 * 1000 + 1);
    getKVMetrics(); // Second trigger just to be absolutely sure
    const m = getKVMetrics(); // Third time's the charm to read it

    // Also clear queue and stop flush timeouts
    cachedKV.flush(mockKV as any).catch(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('should return initial metrics', () => {
    const metrics = getKVMetrics();
    expect(metrics).toEqual({
      reads: 0,
      writes: 0,
      deletes: 0,
      cacheHits: 0,
      cacheMisses: 0,
      lastReset: expect.any(Number)
    });
  });

  it('should track cache misses and reads on get', async () => {
    await cachedKV.get(mockKV as any, 'test-key');
    const metrics = getKVMetrics();
    expect(metrics.cacheMisses).toBe(1);
    expect(metrics.reads).toBe(1);
    expect(metrics.cacheHits).toBe(0);
  });

  it('should track cache hits on subsequent get', async () => {
    mockKV.get.mockResolvedValueOnce(JSON.stringify({ data: 'test' }));

    // First get - miss & read
    await cachedKV.get(mockKV as any, 'test-key-2');

    // Second get - hit
    await cachedKV.get(mockKV as any, 'test-key-2');

    const metrics = getKVMetrics();
    expect(metrics.cacheHits).toBe(1);
  });

  it('should track immediate writes', async () => {
    await cachedKV.put(mockKV as any, 'write-key', JSON.stringify({ data: 'test' }), { immediate: true });
    const metrics = getKVMetrics();
    expect(metrics.writes).toBe(1);
  });

  it('should track delayed batch writes on flush', async () => {
    let initialMetrics = getKVMetrics();
    const initialWrites = initialMetrics.writes;

    // Queue a write
    await cachedKV.put(mockKV as any, 'batch-key', JSON.stringify({ data: 'test' }));

    let metrics = getKVMetrics();
    // Should not increment write immediately because it's queued
    expect(metrics.writes).toBe(initialWrites);

    // Flush uses Promise.all which is tricky with fake timers, so let's call flush manually
    await cachedKV.flush(mockKV as any);

    metrics = getKVMetrics();
    expect(metrics.writes).toBe(initialWrites + 1);
  });

  it('should track deletes', async () => {
    await cachedKV.delete(mockKV as any, 'delete-key');
    const metrics = getKVMetrics();
    expect(metrics.deletes).toBe(1);
  });

  it('should reset metrics daily', async () => {
    // Do some operations to increment metrics
    const initialReads = getKVMetrics().reads;
    await cachedKV.get(mockKV as any, 'reset-key'); // Miss + Read
    expect(getKVMetrics().reads).toBe(initialReads + 1);

    // Advance time by 24 hours + 1 ms
    vi.advanceTimersByTime(24 * 60 * 60 * 1000 + 1);

    // Next call should reset metrics
    const metrics = getKVMetrics();
    expect(metrics.reads).toBe(0);
    expect(metrics.cacheMisses).toBe(0);
    expect(metrics.cacheHits).toBe(0);
  });
});
