import { describe, it, expect, vi, beforeEach } from 'vitest';
import { csrfProtection, optionalCsrfProtection } from '../src/lib/csrf-middleware';
import { getSession } from '../src/lib/session';
import { validateCsrfToken } from '../src/lib/csrf';
import { Context, Next } from 'hono';

// Mock the dependencies
vi.mock('../src/lib/session', () => ({
  getSession: vi.fn(),
}));

vi.mock('../src/lib/csrf', () => ({
  validateCsrfToken: vi.fn(),
}));

describe('CSRF Middleware', () => {
  let mockContext: any;
  let mockNext: Next;

  beforeEach(() => {
    vi.resetAllMocks();

    mockContext = {
      req: {
        method: 'POST',
      },
      json: vi.fn().mockImplementation((data, status) => ({ data, status })),
    };

    mockNext = vi.fn().mockResolvedValue(undefined);
  });

  describe('csrfProtection', () => {
    it('should call next() for non-mutating methods', async () => {
      mockContext.req.method = 'GET';
      await csrfProtection(mockContext as Context<any, any, any>, mockNext);
      expect(mockNext).toHaveBeenCalledTimes(1);
      expect(getSession).not.toHaveBeenCalled();
    });

    it('should return 401 if user is not authenticated', async () => {
      vi.mocked(getSession).mockResolvedValue(null as any);

      const result = await csrfProtection(mockContext as Context<any, any, any>, mockNext);

      expect(getSession).toHaveBeenCalledWith(mockContext);
      expect(mockContext.json).toHaveBeenCalledWith(
        { error: 'Unauthorized', message: 'Authentication required' },
        401
      );
      expect(result).toEqual({
        data: { error: 'Unauthorized', message: 'Authentication required' },
        status: 401
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 403 if CSRF token is invalid', async () => {
      const mockSession = { user: 'test' } as any;
      vi.mocked(getSession).mockResolvedValue(mockSession);
      vi.mocked(validateCsrfToken).mockResolvedValue(false);

      const result = await csrfProtection(mockContext as Context<any, any, any>, mockNext);

      expect(validateCsrfToken).toHaveBeenCalledWith(mockContext, mockSession);
      expect(mockContext.json).toHaveBeenCalledWith(
        {
          error: 'Forbidden',
          message: 'Invalid or missing CSRF token',
          code: 'CSRF_TOKEN_INVALID',
        },
        403
      );
      expect(result).toEqual({
        data: {
          error: 'Forbidden',
          message: 'Invalid or missing CSRF token',
          code: 'CSRF_TOKEN_INVALID',
        },
        status: 403
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should call next() if CSRF token is valid', async () => {
      const mockSession = { user: 'test' } as any;
      vi.mocked(getSession).mockResolvedValue(mockSession);
      vi.mocked(validateCsrfToken).mockResolvedValue(true);

      await csrfProtection(mockContext as Context<any, any, any>, mockNext);

      expect(mockNext).toHaveBeenCalledTimes(1);
    });

    it('should handle all state mutating methods', async () => {
      const methods = ['POST', 'PUT', 'DELETE', 'PATCH'];
      const mockSession = { user: 'test' } as any;
      vi.mocked(getSession).mockResolvedValue(mockSession);
      vi.mocked(validateCsrfToken).mockResolvedValue(true);

      for (const method of methods) {
        mockContext.req.method = method;
        await csrfProtection(mockContext as Context<any, any, any>, mockNext);
      }

      expect(mockNext).toHaveBeenCalledTimes(methods.length);
    });

    it('should gracefully handle method casing', async () => {
      mockContext.req.method = 'post'; // lowercase
      const mockSession = { user: 'test' } as any;
      vi.mocked(getSession).mockResolvedValue(mockSession);
      vi.mocked(validateCsrfToken).mockResolvedValue(true);

      await csrfProtection(mockContext as Context<any, any, any>, mockNext);

      expect(validateCsrfToken).toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalledTimes(1);
    });
  });

  describe('optionalCsrfProtection', () => {
    it('should call next() for non-mutating methods', async () => {
      mockContext.req.method = 'GET';
      await optionalCsrfProtection(mockContext as Context<any, any, any>, mockNext);
      expect(mockNext).toHaveBeenCalledTimes(1);
      expect(getSession).not.toHaveBeenCalled();
    });

    it('should call next() if user is not authenticated', async () => {
      vi.mocked(getSession).mockResolvedValue(null as any);

      await optionalCsrfProtection(mockContext as Context<any, any, any>, mockNext);

      expect(getSession).toHaveBeenCalledWith(mockContext);
      expect(validateCsrfToken).not.toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalledTimes(1);
    });

    it('should return 403 if user is authenticated but CSRF token is invalid', async () => {
      const mockSession = { user: 'test' } as any;
      vi.mocked(getSession).mockResolvedValue(mockSession);
      vi.mocked(validateCsrfToken).mockResolvedValue(false);

      const result = await optionalCsrfProtection(mockContext as Context<any, any, any>, mockNext);

      expect(validateCsrfToken).toHaveBeenCalledWith(mockContext, mockSession);
      expect(mockContext.json).toHaveBeenCalledWith(
        {
          error: 'Forbidden',
          message: 'Invalid or missing CSRF token',
          code: 'CSRF_TOKEN_INVALID',
        },
        403
      );
      expect(result).toEqual({
        data: {
          error: 'Forbidden',
          message: 'Invalid or missing CSRF token',
          code: 'CSRF_TOKEN_INVALID',
        },
        status: 403
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should call next() if user is authenticated and CSRF token is valid', async () => {
      const mockSession = { user: 'test' } as any;
      vi.mocked(getSession).mockResolvedValue(mockSession);
      vi.mocked(validateCsrfToken).mockResolvedValue(true);

      await optionalCsrfProtection(mockContext as Context<any, any, any>, mockNext);

      expect(validateCsrfToken).toHaveBeenCalledWith(mockContext, mockSession);
      expect(mockNext).toHaveBeenCalledTimes(1);
    });
  });
});
