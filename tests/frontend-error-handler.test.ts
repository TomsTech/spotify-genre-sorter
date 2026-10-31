import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import vm from 'vm';

describe('Frontend Error Handler', () => {
  let mockFetch: any;
  let mockLocation: { href: string };
  let mockStorage: Map<string, string>;
  let mockSessionStorage: any;
  let mockCrypto: any;

  function loadErrorHandler() {
    const code = readFileSync(resolve(__dirname, '../src/frontend/error-handler.js'), 'utf-8');
    const win: any = {
      location: mockLocation,
      crypto: mockCrypto,
    };
    const sandbox: any = {
      window: win,
      document: {
        createElement: (tag: string) => {
          const listeners: Record<string, Function[]> = {};
          return {
            tagName: tag,
            className: '',
            setAttribute: vi.fn(),
            classList: { add: vi.fn(), remove: vi.fn() },
            addEventListener: (event: string, handler: Function) => {
              listeners[event] = listeners[event] || [];
              listeners[event].push(handler);
            },
            dispatchEvent: (event: any) => {
              const handlers = listeners[event.type || event] || [];
              handlers.forEach(h => h(event));
            },
            remove: vi.fn(),
            parentNode: { removeChild: vi.fn() },
            innerHTML: '',
          };
        },
        body: {
          appendChild: vi.fn(),
        },
      },
      sessionStorage: mockSessionStorage,
      fetch: mockFetch,
      console,
      setTimeout,
      clearTimeout,
      Uint32Array,
      Math,
      Response,
      Headers,
      Request,
      URL,
      CustomEvent: class CustomEvent {
        type: string;
        detail: any;
        constructor(type: string, options?: any) {
          this.type = type;
          this.detail = options?.detail;
        }
      },
    };
    vm.createContext(sandbox);
    vm.runInContext(code, sandbox);
    return sandbox.window.ErrorHandler;
  }

  beforeEach(() => {
    vi.useFakeTimers();
    mockFetch = vi.fn();
    mockLocation = { href: 'https://example.com/app' };
    mockStorage = new Map<string, string>();
    mockSessionStorage = {
      getItem: vi.fn((key: string) => mockStorage.get(key) ?? null),
      setItem: vi.fn((key: string, val: string) => mockStorage.set(key, String(val))),
      removeItem: vi.fn((key: string) => mockStorage.delete(key)),
      clear: vi.fn(() => mockStorage.clear()),
    };
    mockCrypto = {
      getRandomValues: (arr: Uint32Array) => {
        for (let i = 0; i < arr.length; i++) arr[i] = 1000;
        return arr;
      },
    };
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('fetchWithRetry', () => {
    it('should return response directly on HTTP 200 without retrying', async () => {
      const handler = loadErrorHandler();
      const mockResponse = new Response(JSON.stringify({ ok: true }), { status: 200 });
      mockFetch.mockResolvedValueOnce(mockResponse);

      const response = await handler.fetchWithRetry('/api/test');

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(response).toBe(mockResponse);
    });

    it('should retry on HTTP 429 using Retry-After header if provided', async () => {
      const handler = loadErrorHandler();
      const onRetry = vi.fn();
      const rateLimitedResponse = new Response('Rate limited', {
        status: 429,
        headers: { 'Retry-After': '3' },
      });
      const successResponse = new Response(JSON.stringify({ ok: true }), { status: 200 });

      mockFetch
        .mockResolvedValueOnce(rateLimitedResponse)
        .mockResolvedValueOnce(successResponse);

      const promise = handler.fetchWithRetry('/api/rate-limited', {}, {
        maxRetries: 2,
        baseDelay: 100,
        maxDelay: 10000,
        onRetry,
      });

      // Initially fetch was called once
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Fast-forward delay (Retry-After: 3 seconds = 3000ms)
      await vi.advanceTimersByTimeAsync(3000);

      const response = await promise;
      expect(response).toBe(successResponse);
      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(onRetry).toHaveBeenCalledWith(1, 2, 3000);
    });

    it('should retry on HTTP 429 using exponential backoff when Retry-After is absent', async () => {
      const handler = loadErrorHandler();
      const onRetry = vi.fn();
      const rateLimitedResponse = new Response('Rate limited', { status: 429 });
      const successResponse = new Response(JSON.stringify({ ok: true }), { status: 200 });

      mockFetch
        .mockResolvedValueOnce(rateLimitedResponse)
        .mockResolvedValueOnce(successResponse);

      const promise = handler.fetchWithRetry('/api/rate-limited', {}, {
        maxRetries: 2,
        baseDelay: 500,
        maxDelay: 5000,
        onRetry,
      });

      expect(mockFetch).toHaveBeenCalledTimes(1);
      // attempt 0: delay = baseDelay * 2^0 = 500ms
      await vi.advanceTimersByTimeAsync(500);

      const response = await promise;
      expect(response).toBe(successResponse);
      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(onRetry).toHaveBeenCalledWith(1, 2, 500);
    });

    it('should return last 429 response when maxRetries is exhausted', async () => {
      const handler = loadErrorHandler();
      const rateLimitedResponse = new Response('Rate limited', { status: 429 });

      mockFetch.mockResolvedValue(rateLimitedResponse);

      const promise = handler.fetchWithRetry('/api/rate-limited', {}, {
        maxRetries: 2,
        baseDelay: 100,
        maxDelay: 500,
      });

      // Advance through attempt 0 (100ms) and attempt 1 (200ms)
      await vi.advanceTimersByTimeAsync(100);
      await vi.advanceTimersByTimeAsync(200);

      const response = await promise;
      expect(response).toBe(rateLimitedResponse);
      expect(mockFetch).toHaveBeenCalledTimes(3); // attempt 0, 1, 2
    });

    it('should handle HTTP 401 by clearing session, redirecting, and throwing', async () => {
      const handler = loadErrorHandler();
      mockStorage.set('token', 'abc');
      const unauthResponse = new Response('Unauthorized', { status: 401 });
      mockFetch.mockResolvedValue(unauthResponse);

      await expect(handler.fetchWithRetry('/api/auth-needed', {}, { maxRetries: 0 })).rejects.toThrow('Authentication required');
      expect(mockSessionStorage.clear).toHaveBeenCalledTimes(1);
      expect(mockLocation.href).toBe('/?error=session_expired');
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should retry on HTTP 401 until maxRetries is reached', async () => {
      const handler = loadErrorHandler();
      const unauthResponse = new Response('Unauthorized', { status: 401 });
      mockFetch.mockResolvedValue(unauthResponse);

      await expect(handler.fetchWithRetry('/api/auth-needed', {}, { maxRetries: 2 })).rejects.toThrow('Authentication required');
      expect(mockSessionStorage.clear).toHaveBeenCalledTimes(3); // attempt 0, 1, 2
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });


    it('should retry on HTTP 500+ server errors with exponential backoff and succeed', async () => {
      const handler = loadErrorHandler();
      const onRetry = vi.fn();
      const serverErrorResponse = new Response('Server Error', { status: 503 });
      const successResponse = new Response('OK', { status: 200 });

      mockFetch
        .mockResolvedValueOnce(serverErrorResponse)
        .mockResolvedValueOnce(successResponse);

      const promise = handler.fetchWithRetry('/api/server-err', {}, {
        maxRetries: 3,
        baseDelay: 200,
        onRetry,
      });

      // attempt 0: delay = 200 * 2^0 = 200ms
      await vi.advanceTimersByTimeAsync(200);

      const response = await promise;
      expect(response).toBe(successResponse);
      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(onRetry).toHaveBeenCalledWith(1, 3, 200);
    });

    it('should return last 500 response when retries are exhausted without throwing', async () => {
      const handler = loadErrorHandler();
      const serverErrorResponse = new Response('Internal Server Error', { status: 500 });
      mockFetch.mockResolvedValue(serverErrorResponse);

      const promise = handler.fetchWithRetry('/api/server-err', {}, {
        maxRetries: 2,
        baseDelay: 100,
      });

      // attempt 0 delay: 100ms, attempt 1 delay: 200ms
      await vi.advanceTimersByTimeAsync(100);
      await vi.advanceTimersByTimeAsync(200);

      const response = await promise;
      expect(response.status).toBe(500);
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('should retry on network/fetch errors and succeed on later attempt', async () => {
      const handler = loadErrorHandler();
      const onRetry = vi.fn();
      const networkError = new TypeError('Failed to fetch');
      const successResponse = new Response('OK', { status: 200 });

      mockFetch
        .mockRejectedValueOnce(networkError)
        .mockResolvedValueOnce(successResponse);

      const promise = handler.fetchWithRetry('/api/network-test', {}, {
        maxRetries: 2,
        baseDelay: 300,
        onRetry,
      });

      // Jitter from mockCrypto: getSecureRandom() = 1000 / (0xFFFFFFFF + 1) ~= 0.00000023
      // delay ~= 300ms
      await vi.advanceTimersByTimeAsync(1000);

      const response = await promise;
      expect(response).toBe(successResponse);
      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(onRetry).toHaveBeenCalledTimes(1);
    });

    it('should throw last network error after maxRetries are exhausted', async () => {
      const handler = loadErrorHandler();
      const networkError = new Error('network disconnected');
      mockFetch.mockRejectedValue(networkError);

      const promise = handler.fetchWithRetry('/api/network-fail', {}, {
        maxRetries: 2,
        baseDelay: 100,
      });

      const catchSpy = vi.fn();
      promise.catch(catchSpy);

      await vi.advanceTimersByTimeAsync(2000);

      await expect(promise).rejects.toThrow('network disconnected');
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('should throw immediately if an error is non-network and attempt is maxRetries', async () => {
      const handler = loadErrorHandler();
      const customError = new Error('custom unexpected error');
      mockFetch.mockRejectedValue(customError);

      const promise = handler.fetchWithRetry('/api/custom-err', {}, {
        maxRetries: 0,
      });

      await expect(promise).rejects.toThrow('custom unexpected error');
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should respect maxDelay cap during backoff', async () => {
      const handler = loadErrorHandler();
      const onRetry = vi.fn();
      const rateLimitedResponse = new Response('Rate limited', {
        status: 429,
        headers: { 'Retry-After': '50' }, // 50 seconds
      });
      const successResponse = new Response('OK', { status: 200 });

      mockFetch
        .mockResolvedValueOnce(rateLimitedResponse)
        .mockResolvedValueOnce(successResponse);

      const promise = handler.fetchWithRetry('/api/capped-delay', {}, {
        maxRetries: 1,
        baseDelay: 100,
        maxDelay: 2000, // Capped at 2 seconds
        onRetry,
      });

      // Should be sleeping for maxDelay (2000ms), not 50000ms
      await vi.advanceTimersByTimeAsync(2000);

      const response = await promise;
      expect(response).toBe(successResponse);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('parseErrorResponse', () => {
    it('should parse structured JSON error response correctly', async () => {
      const handler = loadErrorHandler();
      const response = new Response(JSON.stringify({
        code: 'SPOTIFY_API_ERROR',
        error: 'Rate limit exceeded',
        recoverable: true,
        retryable: true,
        suggestion: 'Please try again later',
        action: 'retry',
      }), {
        status: 429,
        headers: { 'Content-Type': 'application/json' },
      });

      const result = await handler.parseErrorResponse(response);
      expect(result).toEqual({
        code: 'SPOTIFY_API_ERROR',
        message: 'Rate limit exceeded',
        recoverable: true,
        retryable: true,
        suggestion: 'Please try again later',
        action: 'retry',
      });
    });

    it('should fallback to HTTP status when response is not valid JSON', async () => {
      const handler = loadErrorHandler();
      const response = new Response('Internal Server Error text', {
        status: 502,
        statusText: 'Bad Gateway',
      });

      const result = await handler.parseErrorResponse(response);
      expect(result).toEqual({
        code: 'UNKNOWN_ERROR',
        message: 'HTTP 502: Bad Gateway',
        recoverable: true,
        retryable: true,
      });
    });
  });

  describe('getUserFriendlyMessage', () => {
    it('should return English user-friendly message for known error code', () => {
      const handler = loadErrorHandler();
      const msg = handler.getUserFriendlyMessage({ code: 'RATE_LIMIT_ERROR' }, false);
      expect(msg).toBe('Too many requests. Please wait a moment and try again.');
    });

    it('should return Swedish user-friendly message when swedish flag is true', () => {
      const handler = loadErrorHandler();
      const msg = handler.getUserFriendlyMessage({ code: 'RATE_LIMIT_ERROR' }, true);
      expect(msg).toBe('För många förfrågningar. Vänta en stund och försök igen.');
    });

    it('should fallback to error message or unknown error message for unrecognized codes', () => {
      const handler = loadErrorHandler();
      const msgWithCustom = handler.getUserFriendlyMessage({ code: 'CUSTOM_CODE', message: 'Custom failure' }, false);
      expect(msgWithCustom).toBe('Custom failure');

      const msgWithoutMessage = handler.getUserFriendlyMessage({ code: 'CUSTOM_CODE' }, false);
      expect(msgWithoutMessage).toBe('An unexpected error occurred. Please try again.');
    });
  });

  describe('saveSessionState and recoverSession', () => {
    it('should save and recover session state', () => {
      const handler = loadErrorHandler();
      const state = { username: 'testuser', genres: ['rock', 'pop'] };

      handler.saveSessionState(state);
      expect(mockSessionStorage.setItem).toHaveBeenCalledWith(
        'appState',
        expect.stringContaining('"username":"testuser"')
      );

      const recovered = handler.recoverSession();
      expect(recovered).toMatchObject(state);
      expect(recovered.savedAt).toBeDefined();
    });

    it('should return null and clean storage when saved state is invalid JSON', () => {
      const handler = loadErrorHandler();
      mockStorage.set('appState', '{invalid json');

      const recovered = handler.recoverSession();
      expect(recovered).toBeNull();
      expect(mockSessionStorage.removeItem).toHaveBeenCalledWith('appState');
    });

    it('should return null when appState does not exist', () => {
      const handler = loadErrorHandler();
      const recovered = handler.recoverSession();
      expect(recovered).toBeNull();
    });
  });

  describe('handlePartialSuccess', () => {
    it('should report complete success when failed is 0', () => {
      const handler = loadErrorHandler();
      const result = handler.handlePartialSuccess({ total: 5, successful: 5, failed: 0 });
      expect(result.type).toBe('success');
      expect(result.message).toContain('All 5 items succeeded!');
    });

    it('should report complete failure when successful is 0', () => {
      const handler = loadErrorHandler();
      const result = handler.handlePartialSuccess({ total: 5, successful: 0, failed: 5 }, { swedish: true });
      expect(result.type).toBe('error');
      expect(result.message).toContain('Alla 5 items misslyckades');
    });

    it('should report partial success when some succeeded and some failed', () => {
      const handler = loadErrorHandler();
      const result = handler.handlePartialSuccess({ total: 5, successful: 3, failed: 2, results: [] });
      expect(result.type).toBe('warning');
      expect(result.message).toContain('3 of 5 items succeeded. 2 failed.');
    });
  });
});
