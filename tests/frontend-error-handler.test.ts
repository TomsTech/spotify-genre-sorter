import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import vm from 'vm';

/**
 * Loads src/frontend/error-handler.js into a sandboxed environment
 * to test pure functions exported via window.ErrorHandler.
 */
function loadFrontendErrorHandler() {
  const filePath = resolve(__dirname, '../src/frontend/error-handler.js');
  const code = readFileSync(filePath, 'utf-8');

  const context: Record<string, any> = {
    window: {
      crypto: {
        getRandomValues: (arr: Uint32Array) => arr,
      },
      location: { origin: 'http://localhost', href: 'http://localhost' },
    },
    navigator: { userAgent: 'test-agent' },
    document: {
      createElement: () => ({
        setAttribute: () => {},
        appendChild: () => {},
        addEventListener: () => {},
        classList: { add: () => {} },
      }),
      body: {
        appendChild: () => {},
      },
    },
    sessionStorage: {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
    },
    setTimeout: () => {},
    clearTimeout: () => {},
    console: console,
  };

  vm.createContext(context);
  vm.runInContext(code, context);

  return context.window.ErrorHandler;
}

describe('Frontend ErrorHandler - parseErrorResponse', () => {
  const ErrorHandler = loadFrontendErrorHandler();
  const { parseErrorResponse, ErrorCode } = ErrorHandler;

  describe('catch block when response.json() throws', () => {
    it('should fall back to HTTP status when response is non-JSON 500 error', async () => {
      const mockResponse = {
        json: async () => {
          throw new SyntaxError('Unexpected token < in JSON at position 0');
        },
        status: 500,
        statusText: 'Internal Server Error',
      };

      const result = await parseErrorResponse(mockResponse);

      expect(result).toEqual({
        code: ErrorCode.UNKNOWN_ERROR,
        message: 'HTTP 500: Internal Server Error',
        recoverable: true,
        retryable: true,
      });
    });

    it('should mark HTTP 429 as retryable when response.json() throws', async () => {
      const mockResponse = {
        json: async () => {
          throw new Error('Non-JSON response body');
        },
        status: 429,
        statusText: 'Too Many Requests',
      };

      const result = await parseErrorResponse(mockResponse);

      expect(result).toEqual({
        code: ErrorCode.UNKNOWN_ERROR,
        message: 'HTTP 429: Too Many Requests',
        recoverable: true,
        retryable: true,
      });
    });

    it('should mark HTTP 503 as retryable when response.json() throws', async () => {
      const mockResponse = {
        json: async () => {
          throw new Error('HTML gateway error');
        },
        status: 503,
        statusText: 'Service Unavailable',
      };

      const result = await parseErrorResponse(mockResponse);

      expect(result).toEqual({
        code: ErrorCode.UNKNOWN_ERROR,
        message: 'HTTP 503: Service Unavailable',
        recoverable: true,
        retryable: true,
      });
    });

    it('should mark 4xx errors other than 429 as not retryable when response.json() throws', async () => {
      const mock404Response = {
        json: async () => {
          throw new Error('Not found page');
        },
        status: 404,
        statusText: 'Not Found',
      };

      const notFoundResult = await parseErrorResponse(mock404Response);

      expect(notFoundResult).toEqual({
        code: ErrorCode.UNKNOWN_ERROR,
        message: 'HTTP 404: Not Found',
        recoverable: true,
        retryable: false,
      });

      const mock400Response = {
        json: async () => {
          throw new Error('Bad request text');
        },
        status: 400,
        statusText: 'Bad Request',
      };

      const badRequestResult = await parseErrorResponse(mock400Response);

      expect(badRequestResult).toEqual({
        code: ErrorCode.UNKNOWN_ERROR,
        message: 'HTTP 400: Bad Request',
        recoverable: true,
        retryable: false,
      });
    });
  });

  describe('successful JSON response parsing', () => {
    it('should parse well-formed error JSON payload', async () => {
      const mockResponse = {
        json: async () => ({
          code: ErrorCode.RATE_LIMIT_ERROR,
          error: 'Rate limit exceeded',
          recoverable: true,
          retryable: true,
          suggestion: 'Wait 5 seconds and retry',
          action: 'retry',
        }),
        status: 429,
        statusText: 'Too Many Requests',
      };

      const result = await parseErrorResponse(mockResponse);

      expect(result).toEqual({
        code: ErrorCode.RATE_LIMIT_ERROR,
        message: 'Rate limit exceeded',
        recoverable: true,
        retryable: true,
        suggestion: 'Wait 5 seconds and retry',
        action: 'retry',
      });
    });

    it('should fall back to data.message when data.error is not present', async () => {
      const mockResponse = {
        json: async () => ({
          code: ErrorCode.UNKNOWN_ERROR,
          message: 'Server error details',
        }),
        status: 500,
        statusText: 'Internal Server Error',
      };

      const result = await parseErrorResponse(mockResponse);

      expect(result.message).toBe('Server error details');
    });

    it('should respect recoverable: false and retryable: false values', async () => {
      const mockResponse = {
        json: async () => ({
          code: ErrorCode.AUTH_ERROR,
          error: 'Session expired',
          recoverable: false,
          retryable: false,
        }),
        status: 401,
        statusText: 'Unauthorized',
      };

      const result = await parseErrorResponse(mockResponse);

      expect(result.recoverable).toBe(false);
      expect(result.retryable).toBe(false);
    });
  });
});
