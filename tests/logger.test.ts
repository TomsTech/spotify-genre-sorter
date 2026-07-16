import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { sendLog, createLogger, generateRequestId, LogLevel, LogEntry } from '../src/lib/logger';

describe('logger', () => {
  let mockCtx: any;

  beforeEach(() => {
    mockCtx = {
      waitUntil: vi.fn((promise) => promise),
    };
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: true })));
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2023-01-01T00:00:00Z'));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('sendLog', () => {
    it('should fallback to console.log when token is missing', () => {
      const entry = { level: 'info' as LogLevel, message: 'Test message', timestamp: '2023-01-01', service: 'test' };
      sendLog(mockCtx, undefined, entry);

      expect(console.log).toHaveBeenCalledWith('[INFO] Test message');
      expect(mockCtx.waitUntil).not.toHaveBeenCalled();
      expect(fetch).not.toHaveBeenCalled();
    });


    it('should fallback to console.error when token is missing and level is error', () => {
      const entry = { level: 'error' as LogLevel, message: 'Test error message', timestamp: '2023-01-01', service: 'test', error: 'Something went wrong', stack: 'Error stack' };
      sendLog(mockCtx, undefined, entry);

      expect(console.error).toHaveBeenCalledWith('[ERROR] Test error message', '\nSomething went wrong', '\nError stack');
      expect(console.log).not.toHaveBeenCalled();
      expect(mockCtx.waitUntil).not.toHaveBeenCalled();
      expect(fetch).not.toHaveBeenCalled();
    });

    it('should fallback to console.error when token is missing and level is error but no extra error info', () => {
      const entry = { level: 'error' as LogLevel, message: 'Test error message', timestamp: '2023-01-01', service: 'test' };
      sendLog(mockCtx, undefined, entry);

      expect(console.error).toHaveBeenCalledWith('[ERROR] Test error message', '', '');
      expect(console.log).not.toHaveBeenCalled();
      expect(mockCtx.waitUntil).not.toHaveBeenCalled();
      expect(fetch).not.toHaveBeenCalled();
    });

    it('should send log to BetterStack via fetch and waitUntil when token is provided', () => {
      const entry = { level: 'info' as LogLevel, message: 'Test message', timestamp: '2023-01-01', service: 'test' };
      sendLog(mockCtx, 'test-token', entry);

      expect(mockCtx.waitUntil).toHaveBeenCalled();
      expect(fetch).toHaveBeenCalledWith('https://s1624750.eu-nbg-2.betterstackdata.com', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token',
        },
        body: JSON.stringify(entry),
      });
    });

    it('should log to console.error if fetch fails', async () => {
      const entry = { level: 'info' as LogLevel, message: 'Test message', timestamp: '2023-01-01', service: 'test' };
      const error = new Error('Network error');
      vi.stubGlobal('fetch', vi.fn(() => Promise.reject(error)));

      sendLog(mockCtx, 'test-token', entry);

      // Wait for the catch block to execute
      await Promise.resolve();

      expect(console.error).toHaveBeenCalledWith('Failed to send log to BetterStack:', error);
    });
  });

  describe('createLogger', () => {
    it('should create a logger with expected methods', () => {
      const logger = createLogger(mockCtx, 'test-token');
      expect(logger).toHaveProperty('debug');
      expect(logger).toHaveProperty('info');
      expect(logger).toHaveProperty('warn');
      expect(logger).toHaveProperty('error');
      expect(logger).toHaveProperty('logError');
      expect(logger).toHaveProperty('logRequest');
    });

    it('should include request context in logs', () => {
      const logger = createLogger(mockCtx, 'test-token', { requestId: 'req-123', userId: 'user-456' });
      logger.info('Test context');

      expect(fetch).toHaveBeenCalled();
      const callArgs = vi.mocked(fetch).mock.calls[0];
      const body = JSON.parse(callArgs[1].body as string);

      expect(body).toMatchObject({
        service: 'genre-genie',
        requestId: 'req-123',
        userId: 'user-456',
        level: 'info',
        message: 'Test context',
        timestamp: '2023-01-01T00:00:00.000Z',
      });
    });

    describe('log levels', () => {
      const levels: LogLevel[] = ['debug', 'info', 'warn', 'error'];

      levels.forEach(level => {
        it(`should log ${level} messages correctly`, () => {
          const logger = createLogger(mockCtx, 'test-token');
          logger[level](`${level} message`, { extra: 'data' });

          expect(fetch).toHaveBeenCalled();
          const callArgs = vi.mocked(fetch).mock.calls[0];
          const body = JSON.parse(callArgs[1].body as string);

          expect(body).toMatchObject({
            level,
            message: `${level} message`,
            extra: 'data',
          });
        });
      });
    });

    describe('logError', () => {
      it('should handle Error instances', () => {
        const logger = createLogger(mockCtx, 'test-token');
        const error = new Error('Test error message');
        error.stack = 'Test stack trace';

        logger.logError('Operation failed', error, { context: 'test' });

        const callArgs = vi.mocked(fetch).mock.calls[0];
        const body = JSON.parse(callArgs[1].body as string);
        expect(body).toMatchObject({
          level: 'error',
          message: 'Operation failed',
          error: 'Test error message',
          stack: 'Test stack trace',
          context: 'test',
        });
      });

      it('should handle non-Error objects', () => {
        const logger = createLogger(mockCtx, 'test-token');

        logger.logError('Operation failed', 'String error', { context: 'test' });

        const callArgs = vi.mocked(fetch).mock.calls[0];
        const body = JSON.parse(callArgs[1].body as string);
        expect(body).toMatchObject({
          level: 'error',
          message: 'Operation failed',
          error: 'String error',
          context: 'test',
        });
        expect(body.stack).toBeUndefined();
      });
    });

    describe('logRequest', () => {
      it('should log 2xx status as info', () => {
        const logger = createLogger(mockCtx, 'test-token', { method: 'GET', path: '/api/test' });
        logger.logRequest(200, 45);

        const callArgs = vi.mocked(fetch).mock.calls[0];
        const body = JSON.parse(callArgs[1].body as string);
        expect(body).toMatchObject({
          level: 'info',
          message: 'GET /api/test 200',
          status: 200,
          duration: 45,
        });
      });

      it('should log 4xx status as warn', () => {
        const logger = createLogger(mockCtx, 'test-token', { method: 'POST', path: '/api/data' });
        logger.logRequest(404, 10);

        const callArgs = vi.mocked(fetch).mock.calls[0];
        const body = JSON.parse(callArgs[1].body as string);
        expect(body).toMatchObject({
          level: 'warn',
          message: 'POST /api/data 404',
          status: 404,
          duration: 10,
        });
      });

      it('should log 5xx status as error', () => {
        const logger = createLogger(mockCtx, 'test-token', { method: 'PUT', path: '/api/error' });
        logger.logRequest(500, 120);

        const callArgs = vi.mocked(fetch).mock.calls[0];
        const body = JSON.parse(callArgs[1].body as string);
        expect(body).toMatchObject({
          level: 'error',
          message: 'PUT /api/error 500',
          status: 500,
          duration: 120,
        });
      });
    });
  });

  describe('generateRequestId', () => {
    it('should generate an 8-character string', () => {
      // Vitest's Node environment has crypto.randomUUID
      const id = generateRequestId();
      expect(typeof id).toBe('string');
      expect(id).toHaveLength(8);

      const id2 = generateRequestId();
      expect(id).not.toBe(id2);
    });

    it('should extract the first 8 characters of a UUID', () => {
      const spy = vi.spyOn(crypto, 'randomUUID').mockReturnValue('11223344-5566-7788-9900-aabbccddeeff');
      try {
        const id = generateRequestId();
        expect(id).toBe('11223344');
        expect(spy).toHaveBeenCalledOnce();
      } finally {
        spy.mockRestore();
      }
    });
  });
});
