/**
 * BetterStack Logs integration for in-worker logging
 * Sends logs via HTTP POST to BetterStack's Logs API
 */

// BetterStack source endpoint - configured for Genre Genie Worker
const BETTERSTACK_ENDPOINT = 'https://s1624750.eu-nbg-2.betterstackdata.com';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  service: string;
  // Optional context
  requestId?: string;
  path?: string;
  method?: string;
  status?: number;
  duration?: number;
  userId?: string;
  error?: string;
  stack?: string;
  [key: string]: unknown;
}

/**
 * Send a log entry to BetterStack
 * Uses waitUntil to not block the response
 */
export function sendLog(
  ctx: ExecutionContext,
  token: string | undefined,
  entry: LogEntry
): void {
  if (!token) {
    // No token configured, fallback to console (intentional for local dev)
    // eslint-disable-next-line no-console
    console.log(`[${entry.level.toUpperCase()}] ${entry.message}`);
    return;
  }

  // Use waitUntil to send log without blocking response
  ctx.waitUntil(
    fetch(BETTERSTACK_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(entry),
    }).catch((err) => {
      // Don't let logging failures affect the app
      console.error('Failed to send log to BetterStack:', err);
    })
  );
}

/**
 * Logger factory - creates a logger bound to a request context
 */
export function createLogger(
  ctx: ExecutionContext,
  token: string | undefined,
  requestContext?: {
    requestId?: string;
    path?: string;
    method?: string;
    userId?: string;
  }
) {
  const baseEntry = {
    service: 'genre-genie',
    ...requestContext,
  };

  const log = (level: LogLevel, message: string, extra?: Record<string, unknown>) => {
    const entry: LogEntry = {
      ...baseEntry,
      level,
      message,
      timestamp: new Date().toISOString(),
      ...extra,
    };
    sendLog(ctx, token, entry);
  };

  return {
    debug: (message: string, extra?: Record<string, unknown>) => log('debug', message, extra),
    info: (message: string, extra?: Record<string, unknown>) => log('info', message, extra),
    warn: (message: string, extra?: Record<string, unknown>) => log('warn', message, extra),
    error: (message: string, extra?: Record<string, unknown>) => log('error', message, extra),

    // Convenience method for logging errors with stack traces
    logError: (message: string, error: unknown, extra?: Record<string, unknown>) => {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const stack = error instanceof Error ? error.stack : undefined;
      log('error', message, { error: errorMessage, stack, ...extra });
    },

    // Log request completion with timing
    logRequest: (status: number, duration: number, extra?: Record<string, unknown>) => {
      const level: LogLevel = status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info';
      log(level, `${requestContext?.method} ${requestContext?.path} ${status}`, {
        status,
        duration,
        ...extra,
      });
    },
  };
}

/**
 * Generate a unique request ID
 */
export function generateRequestId(): string {
  return crypto.randomUUID().slice(0, 8);
}
