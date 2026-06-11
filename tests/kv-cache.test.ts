import { describe, it, expect, vi, beforeEach } from 'vitest';
import { cachedKV, getKVMetrics } from '../src/lib/kv-cache';

describe('KV Cache Error Handling', () => {
  let mockKV: any;

  beforeEach(() => {
    // Basic mock KV namespace
    mockKV = {
      get: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
    };
    cachedKV.clearCache();
    vi.clearAllMocks();
  });

  it('should test flushWriteQueue error path and verify errors metric increments', async () => {
    // 1. Mock console.error to avoid noise in test output
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // 2. Setup mock KV put to throw an error
    mockKV.put.mockRejectedValue(new Error('KV write failed'));

    // 3. Get metrics before
    const initialMetrics = getKVMetrics();

    // 4. Queue a write operation via cachedKV.put (batched)
    await cachedKV.put(mockKV, 'test-error-key', JSON.stringify({ data: 'value' }));

    // 5. Force flush the queue
    await cachedKV.flush(mockKV);

    // 6. Verify the error was handled (console.error was called)
    expect(mockKV.put).toHaveBeenCalledWith('test-error-key', '{"data":"value"}', undefined);
    expect(consoleErrorSpy).toHaveBeenCalledWith('KV write failed for key test-error-key:', expect.any(Error));

    // 7. Verify writes metric did not increment
    const currentMetrics = getKVMetrics();
    expect(currentMetrics.writes).toBe(initialMetrics.writes);

    // 8. Verify errors metric incremented
    expect(currentMetrics.errors).toBe(initialMetrics.errors + 1);

    // Cleanup
    consoleErrorSpy.mockRestore();
  });
});
