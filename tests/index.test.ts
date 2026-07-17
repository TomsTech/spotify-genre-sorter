import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { errorHandler } from '../src/index';
import * as session from '../src/lib/session';
import * as logger from '../src/lib/logger';

vi.mock('../src/lib/session', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/lib/session')>();
  return {
    ...actual,
    trackAnalyticsEvent: vi.fn(),
  };
});

vi.mock('../src/lib/logger', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/lib/logger')>();
  return {
    ...actual,
    createLogger: vi.fn(),
  };
});

describe('Global Error Handler in index.ts', () => {
  let mockLogError: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockLogError = vi.fn();
    vi.mocked(logger.createLogger).mockReturnValue({
      logError: mockLogError,
      logInfo: vi.fn(),
      logWarn: vi.fn(),
      logDebug: vi.fn(),
    } as any);
  });

  const runErrorHandler = async (err: any) => {
    const mockCtx = {
      req: {
        path: '/test-error',
        method: 'GET'
      },
      env: {
        BETTERSTACK_LOG_TOKEN: 'test-token',
        SESSIONS: {} as KVNamespace,
      },
      executionCtx: {
        waitUntil: vi.fn(),
        passThroughOnException: vi.fn(),
      },
      json: vi.fn((data, status) => {
        return {
          status,
          json: async () => data
        } as unknown as Response;
      }),
    };

    const res = await errorHandler(err, mockCtx as any);
    return { res, mockCtx };
  };

  it('should handle errors, log them, track analytics, and return 500', async () => {
    const err = new Error('Test error message');
    const { res, mockCtx } = await runErrorHandler(err);

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'Test error message' });

    expect(logger.createLogger).toHaveBeenCalledWith(
      mockCtx.executionCtx,
      'test-token',
      { path: '/test-error', method: 'GET' }
    );
    expect(mockLogError).toHaveBeenCalledWith(
      'Worker error',
      err,
      { path: '/test-error' }
    );

    expect(session.trackAnalyticsEvent).toHaveBeenCalledWith(
      mockCtx.env.SESSIONS,
      'error',
      {
        message: 'Test error message',
        path: '/test-error',
        timestamp: expect.any(String),
      }
    );
  });

  it('should handle errors without message property gracefully', async () => {
    const err = 'String error';
    const { res, mockCtx } = await runErrorHandler(err);

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'Internal error' });

    expect(session.trackAnalyticsEvent).toHaveBeenCalledWith(
      mockCtx.env.SESSIONS,
      'error',
      {
        message: 'Unknown error',
        path: '/test-error',
        timestamp: expect.any(String),
      }
    );
  });

  it('should ignore analytics tracking failures', async () => {
    vi.mocked(session.trackAnalyticsEvent).mockRejectedValueOnce(new Error('Analytics failure'));

    const err = new Error('Another error');
    const { res, mockCtx } = await runErrorHandler(err);

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'Another error' });
    expect(session.trackAnalyticsEvent).toHaveBeenCalled();
  });
});
