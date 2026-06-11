import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { getKVMonitorData, KV_LIMITS, KV_PREFIXES } from '../src/lib/kv-monitor';
import type { KVNamespace } from '@cloudflare/workers-types';

vi.mock('../src/lib/kv-cache', () => ({
  getKVMetrics: vi.fn(() => ({
    reads: 10,
    writes: 5,
    deletes: 2,
    cacheHits: 8,
    cacheMisses: 2,
    lastReset: new Date('2024-01-01').toISOString(),
  })),
}));

// Suppress console.error in tests
const originalConsoleError = console.error;
beforeAll(() => {
  console.error = vi.fn();
});
afterAll(() => {
  console.error = originalConsoleError;
});

describe('kv-monitor', () => {
  it('should export KV_LIMITS with expected limits', () => {
    expect(KV_LIMITS.maxKeys).toBeGreaterThan(0);
    expect(KV_LIMITS.maxKeySize).toBe(512);
    expect(KV_LIMITS.maxValueSize).toBe(25 * 1024 * 1024);
  });

  it('should list prefixes successfully', async () => {
    const mockKv = {
      list: vi.fn().mockResolvedValue({
        keys: [
          { name: 'session:123', expiration: 1234, metadata: { size: 100 } },
          { name: 'session:456', metadata: { size: 200 } }
        ],
        list_complete: true,
      })
    } as unknown as KVNamespace;

    const result = await getKVMonitorData(mockKv);

    expect(result.summary.namespaceCount).toBe(KV_PREFIXES.length);
    expect(result.realTimeMetrics.cacheHits).toBe(8);
    expect(result.realTimeMetrics.cacheHitRate).toBe(80);

    // Check if limits are included
    expect(result.limits).toEqual(KV_LIMITS);

    // Ensure all namespace data was returned
    expect(result.namespaces.length).toBe(KV_PREFIXES.length);

    // Ensure stats calculated correctly
    expect(result.namespaces[0].keyCount).toBe(2);
    expect(result.namespaces[0].totalSize).toBe(300);
    expect(result.namespaces[0].avgSize).toBe(150);
  });

  it('should handle errors in kv.list gracefully', async () => {
    const mockKv = {
      list: vi.fn().mockRejectedValue(new Error('KV List Error'))
    } as unknown as KVNamespace;

    const result = await getKVMonitorData(mockKv);

    expect(result.namespaces.length).toBe(KV_PREFIXES.length);
    expect(result.namespaces[0].error).toBe('Failed to list keys');
    expect(result.namespaces[0].keyCount).toBe(0);
    expect(result.summary.totalKeys).toBe(0);
  });
});
