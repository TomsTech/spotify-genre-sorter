import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { sendLog, createLogger, generateRequestId, LogEntry } from '../src/lib/logger';

describe('Logger', () => {
  let mockCtx: any;
  let originalConsoleLog: typeof console.log;
  let originalConsoleError: typeof console.error;

  beforeEach(() => {
    mockCtx = {
      waitUntil: vi.fn(),
    };

    originalConsoleLog = console.log;
    originalConsoleError = console.error;
    console.log = vi.fn();
    console.error = vi.fn();

    global.fetch = vi.fn().mockResolvedValue(new Response('ok', { status: 200 }));
  });

  afterEach(() => {
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
    vi.restoreAllMocks();
  });

  describe('generateRequestId', () => {
    it('should generate an 8-character string', () => {
      // Mock crypto.randomUUID
      vi.spyOn(crypto, 'randomUUID').mockReturnValue('12345678-90ab-cdef-1234-567890abcdef' as `${string}-${string}-${string}-${string}-${string}`);

      const reqId = generateRequestId();
      expect(reqId).toBe('12345678');
      expect(reqId.length).toBe(8);

      vi.restoreAllMocks();
    });
  });

  describe('sendLog', () => {
    const entry: LogEntry = {
      level: 'info',
      message: 'test message',
      timestamp: new Date().toISOString(),
      service: 'test-service'
    };

    it('should fallback to console.log if no token is provided', () => {
      sendLog(mockCtx, undefined, entry);
      expect(console.log).toHaveBeenCalledWith(`[INFO] test message`);
      expect(mockCtx.waitUntil).not.toHaveBeenCalled();
    });

    it('should send fetch request if token is provided', () => {
      sendLog(mockCtx, 'test-token', entry);

      expect(mockCtx.waitUntil).toHaveBeenCalled();
      expect(global.fetch).toHaveBeenCalledWith(
        'https://s1624750.eu-nbg-2.betterstackdata.com',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer test-token',
          },
          body: JSON.stringify(entry),
        })
      );
    });

    it('should handle fetch failure gracefully', async () => {
      // We need to capture the promise passed to waitUntil to await it
      let waitUntilPromise: Promise<any> | undefined;
      mockCtx.waitUntil.mockImplementation((promise: Promise<any>) => {
        waitUntilPromise = promise;
      });

      global.fetch = vi.fn().mockRejectedValue(new Error('Network Error'));

      sendLog(mockCtx, 'test-token', entry);

      expect(mockCtx.waitUntil).toHaveBeenCalled();

      // Wait for the catch block to execute
      if (waitUntilPromise) {
        await waitUntilPromise;
      }

      expect(console.error).toHaveBeenCalledWith(
        'Failed to send log to BetterStack:',
        expect.any(Error)
      );
    });
  });

  describe('createLogger', () => {
    let mockDate: Date;

    beforeEach(() => {
      mockDate = new Date('2023-01-01T00:00:00.000Z');
      vi.useFakeTimers();
      vi.setSystemTime(mockDate);
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should include request context in log entries', () => {
      const logger = createLogger(mockCtx, 'test-token', {
        requestId: 'req-123',
        path: '/test',
        method: 'GET'
      });

      logger.info('Test request context');

      expect(mockCtx.waitUntil).toHaveBeenCalled();
      const fetchArgs = vi.mocked(global.fetch).mock.calls[0];
      const body = JSON.parse(fetchArgs[1]?.body as string);

      expect(body).toEqual(expect.objectContaining({
        level: 'info',
        message: 'Test request context',
        service: 'genre-genie',
        requestId: 'req-123',
        path: '/test',
        method: 'GET',
        timestamp: mockDate.toISOString()
      }));
    });

    it('should expose debug, info, warn, error methods', () => {
      const logger = createLogger(mockCtx, 'test-token');

      logger.debug('Debug msg', { foo: 'bar' });
      logger.info('Info msg');
      logger.warn('Warn msg');
      logger.error('Error msg');

      expect(mockCtx.waitUntil).toHaveBeenCalledTimes(4);

      const calls = vi.mocked(global.fetch).mock.calls;
      expect(JSON.parse(calls[0][1]?.body as string).level).toBe('debug');
      expect(JSON.parse(calls[0][1]?.body as string).foo).toBe('bar');
      expect(JSON.parse(calls[1][1]?.body as string).level).toBe('info');
      expect(JSON.parse(calls[2][1]?.body as string).level).toBe('warn');
      expect(JSON.parse(calls[3][1]?.body as string).level).toBe('error');
    });

    describe('logError', () => {
      it('should handle Error instances', () => {
        const logger = createLogger(mockCtx, 'test-token');
        const err = new Error('Test error message');
        err.stack = 'Test stack trace';

        logger.logError('Operation failed', err, { contextId: 123 });

        const fetchArgs = vi.mocked(global.fetch).mock.calls[0];
        const body = JSON.parse(fetchArgs[1]?.body as string);

        expect(body).toEqual(expect.objectContaining({
          level: 'error',
          message: 'Operation failed',
          error: 'Test error message',
          stack: 'Test stack trace',
          contextId: 123
        }));
      });

      it('should handle string errors', () => {
        const logger = createLogger(mockCtx, 'test-token');

        logger.logError('Operation failed', 'String error message');

        const fetchArgs = vi.mocked(global.fetch).mock.calls[0];
        const body = JSON.parse(fetchArgs[1]?.body as string);

        expect(body).toEqual(expect.objectContaining({
          level: 'error',
          message: 'Operation failed',
          error: 'String error message'
        }));
        expect(body.stack).toBeUndefined();
      });
    });

    describe('logRequest', () => {
      it('should log 2xx as info', () => {
        const logger = createLogger(mockCtx, 'test-token', { path: '/api/data', method: 'GET' });

        logger.logRequest(200, 45, { bytes: 1024 });

        const fetchArgs = vi.mocked(global.fetch).mock.calls[0];
        const body = JSON.parse(fetchArgs[1]?.body as string);

        expect(body).toEqual(expect.objectContaining({
          level: 'info',
          message: 'GET /api/data 200',
          status: 200,
          duration: 45,
          bytes: 1024
        }));
      });

      it('should log 4xx as warn', () => {
        const logger = createLogger(mockCtx, 'test-token', { path: '/api/data', method: 'POST' });

        logger.logRequest(400, 15);

        const fetchArgs = vi.mocked(global.fetch).mock.calls[0];
        const body = JSON.parse(fetchArgs[1]?.body as string);

        expect(body.level).toBe('warn');
        expect(body.message).toBe('POST /api/data 400');
        expect(body.status).toBe(400);
      });

      it('should log 5xx as error', () => {
        const logger = createLogger(mockCtx, 'test-token', { path: '/api/data', method: 'DELETE' });

        logger.logRequest(500, 150);

        const fetchArgs = vi.mocked(global.fetch).mock.calls[0];
        const body = JSON.parse(fetchArgs[1]?.body as string);

        expect(body.level).toBe('error');
        expect(body.message).toBe('DELETE /api/data 500');
        expect(body.status).toBe(500);
      });
    });
  });
});
