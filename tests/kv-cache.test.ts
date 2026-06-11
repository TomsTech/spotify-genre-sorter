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
