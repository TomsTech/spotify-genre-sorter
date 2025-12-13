/**
 * App Logging API Handlers
 *
 * Mock handlers for frontend error and performance logging endpoints.
 */
import { http, HttpResponse } from 'msw';

// Track logged errors and performance data for test assertions
const loggedErrors: Array<{
  errors: unknown[];
  serverTime: string;
}> = [];

const loggedPerf: Array<{
  pageLoadTime: number;
  domContentLoaded?: number;
  timeToFirstByte?: number;
  serverResponse?: number;
  timestamp: string;
}> = [];

export function getLoggedErrors(): typeof loggedErrors {
  return [...loggedErrors];
}

export function getLoggedPerf(): typeof loggedPerf {
  return [...loggedPerf];
}

export function resetLoggingState(): void {
  loggedErrors.length = 0;
  loggedPerf.length = 0;
}

export const appLoggingHandlers = [
  // POST /api/log-error - Log frontend JS errors
  http.post('*/api/log-error', async ({ request }) => {
    try {
      const body = await request.json() as { errors?: unknown[] };
      const errors = Array.isArray(body.errors) ? body.errors : [];

      if (errors.length > 0) {
        loggedErrors.push({
          errors: errors.slice(0, 10),
          serverTime: new Date().toISOString(),
        });
      }

      return HttpResponse.json({ ok: true, logged: errors.length });
    } catch {
      return HttpResponse.json({ ok: true });
    }
  }),

  // POST /api/log-perf - Log frontend performance metrics
  http.post('*/api/log-perf', async ({ request }) => {
    try {
      const body = await request.json() as Record<string, unknown>;

      if (typeof body.pageLoadTime === 'number') {
        loggedPerf.push({
          pageLoadTime: body.pageLoadTime as number,
          domContentLoaded: body.domContentLoaded as number | undefined,
          timeToFirstByte: body.timeToFirstByte as number | undefined,
          serverResponse: body.serverResponse as number | undefined,
          timestamp: new Date().toISOString(),
        });
      }

      return HttpResponse.json({ ok: true });
    } catch {
      return HttpResponse.json({ ok: true });
    }
  }),
];
