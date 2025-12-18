/**
 * Frontend Error Handler
 *
 * Provides:
 * - API error handling with retry logic
 * - User-friendly error messages
 * - Recovery options
 * - Session recovery
 * - Error telemetry
 */

// Error codes matching backend
const ErrorCode = {
  NETWORK_ERROR: 'NETWORK_ERROR',
  SPOTIFY_API_ERROR: 'SPOTIFY_API_ERROR',
  RATE_LIMIT_ERROR: 'RATE_LIMIT_ERROR',
  AUTH_ERROR: 'AUTH_ERROR',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  KV_ERROR: 'KV_ERROR',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  PLAYLIST_CREATE_ERROR: 'PLAYLIST_CREATE_ERROR',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
};

// Global error tracking
const errorQueue = [];
const MAX_ERROR_QUEUE = 50;
let errorBatchTimeout = null;

/**
 * Enhanced fetch with retry logic and error handling
 */
async function fetchWithRetry(url, options = {}, retryConfig = {}) {
  const {
    maxRetries = 3,
    baseDelay = 1000,
    maxDelay = 10000,
    onRetry = null,
  } = retryConfig;

  let lastError = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);

      // Handle rate limiting
      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After');
        const delay = retryAfter ? parseInt(retryAfter) * 1000 : baseDelay * Math.pow(2, attempt);

        if (attempt < maxRetries) {
          if (onRetry) onRetry(attempt + 1, maxRetries, delay);
          await sleep(Math.min(delay, maxDelay));
          continue;
        }
      }

      // Handle authentication errors
      if (response.status === 401) {
        // Clear session and redirect to login
        sessionStorage.clear();
        window.location.href = '/?error=session_expired';
        throw new Error('Authentication required');
      }

      // Handle server errors with retry
      if (response.status >= 500 && attempt < maxRetries) {
        const delay = baseDelay * Math.pow(2, attempt);
        if (onRetry) onRetry(attempt + 1, maxRetries, delay);
        await sleep(Math.min(delay, maxDelay));
        continue;
      }

      return response;
    } catch (error) {
      lastError = error;

      // Network errors are retryable
      if (attempt < maxRetries && (error.message.includes('fetch') || error.message.includes('network'))) {
        const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 500;
        if (onRetry) onRetry(attempt + 1, maxRetries, delay);
        await sleep(Math.min(delay, maxDelay));
        continue;
      }

      // Don't retry on last attempt
      if (attempt >= maxRetries) {
        throw error;
      }
    }
  }

  throw lastError || new Error('Request failed');
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Parse error response from API
 */
async function parseErrorResponse(response) {
  try {
    const data = await response.json();
    return {
      code: data.code || ErrorCode.UNKNOWN_ERROR,
      message: data.error || data.message || 'An error occurred',
      recoverable: data.recoverable !== false,
      retryable: data.retryable !== false,
      suggestion: data.suggestion,
      action: data.action,
    };
  } catch {
    return {
      code: ErrorCode.UNKNOWN_ERROR,
      message: `HTTP ${response.status}: ${response.statusText}`,
      recoverable: true,
      retryable: response.status >= 500 || response.status === 429,
    };
  }
}

/**
 * Show error notification with recovery options
 */
function showErrorNotification(error, options = {}) {
  const {
    swedish = false,
    onRetry = null,
    onDismiss = null,
    context = 'operation',
  } = options;

  // Get user-friendly message
  const message = getUserFriendlyMessage(error, swedish);

  // Determine if retry is available
  const canRetry = error.retryable !== false && onRetry !== null;

  // Log error for telemetry
  logErrorToBackend(error, context);

  // Show notification UI
  const notification = document.createElement('div');
  notification.className = 'error-notification';
  notification.setAttribute('role', 'alert');
  notification.setAttribute('aria-live', 'assertive');

  const actions = [];

  if (canRetry) {
    actions.push(
      `<button class="btn btn-sm btn-primary" onclick="this.closest('.error-notification').dispatchEvent(new CustomEvent('retry'))">
        ${swedish ? '🔄 Försök igen' : '🔄 Retry'}
      </button>`
    );
  }

  if (error.suggestion) {
    actions.push(`<span class="error-suggestion">${error.suggestion}</span>`);
  }

  actions.push(
    `<button class="btn btn-sm btn-ghost" onclick="this.closest('.error-notification').remove()">
      ${swedish ? 'Stäng' : 'Dismiss'}
    </button>`
  );

  notification.innerHTML = `
    <div class="error-content">
      <div class="error-icon">⚠️</div>
      <div class="error-message">${escapeHtml(message)}</div>
      <div class="error-actions">${actions.join('')}</div>
    </div>
  `;

  // Handle retry
  notification.addEventListener('retry', () => {
    notification.remove();
    if (onRetry) onRetry();
  });

  // Auto-dismiss after 10 seconds if not critical
  if (error.code !== ErrorCode.AUTH_ERROR) {
    setTimeout(() => {
      if (notification.parentNode) {
        notification.classList.add('fade-out');
        setTimeout(() => notification.remove(), 300);
      }
    }, 10000);
  }

  document.body.appendChild(notification);

  return notification;
}

/**
 * Get user-friendly error message
 */
function getUserFriendlyMessage(error, swedish = false) {
  const messages = {
    en: {
      [ErrorCode.NETWORK_ERROR]: 'Unable to connect to the server. Check your internet connection.',
      [ErrorCode.RATE_LIMIT_ERROR]: 'Too many requests. Please wait a moment and try again.',
      [ErrorCode.AUTH_ERROR]: 'Your session has expired. Please log in again.',
      [ErrorCode.TOKEN_EXPIRED]: 'Your session has expired. Please log in again.',
      [ErrorCode.SPOTIFY_API_ERROR]: 'Unable to connect to Spotify. Please try again.',
      [ErrorCode.KV_ERROR]: 'A storage error occurred. Please try again.',
      [ErrorCode.VALIDATION_ERROR]: error.message || 'Invalid input. Please check your data.',
      [ErrorCode.PLAYLIST_CREATE_ERROR]: 'Failed to create playlist. Please try again.',
      [ErrorCode.UNKNOWN_ERROR]: 'An unexpected error occurred. Please try again.',
    },
    sv: {
      [ErrorCode.NETWORK_ERROR]: 'Kan inte ansluta till servern. Kontrollera din internetanslutning.',
      [ErrorCode.RATE_LIMIT_ERROR]: 'För många förfrågningar. Vänta en stund och försök igen.',
      [ErrorCode.AUTH_ERROR]: 'Din session har gått ut. Logga in igen.',
      [ErrorCode.TOKEN_EXPIRED]: 'Din session har gått ut. Logga in igen.',
      [ErrorCode.SPOTIFY_API_ERROR]: 'Kan inte ansluta till Spotify. Försök igen.',
      [ErrorCode.KV_ERROR]: 'Ett lagringsfel inträffade. Försök igen.',
      [ErrorCode.VALIDATION_ERROR]: error.message || 'Ogiltig inmatning. Kontrollera dina data.',
      [ErrorCode.PLAYLIST_CREATE_ERROR]: 'Kunde inte skapa spellista. Försök igen.',
      [ErrorCode.UNKNOWN_ERROR]: 'Ett oväntat fel inträffade. Försök igen.',
    },
  };

  const lang = swedish ? 'sv' : 'en';
  return messages[lang][error.code] || error.message || messages[lang][ErrorCode.UNKNOWN_ERROR];
}

/**
 * Log error to backend for telemetry
 */
function logErrorToBackend(error, context) {
  const errorInfo = {
    code: error.code,
    message: error.message,
    context,
    timestamp: new Date().toISOString(),
    url: window.location.href,
    userAgent: navigator.userAgent,
    stack: error.stack,
  };

  // Add to queue
  errorQueue.push(errorInfo);
  if (errorQueue.length > MAX_ERROR_QUEUE) {
    errorQueue.shift();
  }

  // Batch send errors to reduce API calls
  if (errorBatchTimeout) {
    clearTimeout(errorBatchTimeout);
  }

  errorBatchTimeout = setTimeout(() => {
    if (errorQueue.length > 0) {
      const errors = [...errorQueue];
      errorQueue.length = 0;

      // Send to backend (don't await, fire and forget)
      fetch('/api/log-error', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ errors }),
      }).catch(err => {
        console.error('Failed to log errors:', err);
      });
    }
  }, 2000); // Batch window of 2 seconds
}

/**
 * Session recovery helper
 */
function recoverSession() {
  // Try to restore from sessionStorage
  const savedState = sessionStorage.getItem('appState');
  if (savedState) {
    try {
      const state = JSON.parse(savedState);
      return state;
    } catch {
      sessionStorage.removeItem('appState');
    }
  }
  return null;
}

/**
 * Save session state for recovery
 */
function saveSessionState(state) {
  try {
    sessionStorage.setItem('appState', JSON.stringify({
      ...state,
      savedAt: new Date().toISOString(),
    }));
  } catch (error) {
    console.warn('Failed to save session state:', error);
  }
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Handle partial success in batch operations
 */
function handlePartialSuccess(results, options = {}) {
  const {
    swedish = false,
    itemName = 'items',
    onViewFailures = null,
  } = options;

  const total = results.total || 0;
  const successful = results.successful || results.successCount || 0;
  const failed = results.failed || results.failureCount || 0;

  if (failed === 0) {
    // Complete success
    return {
      type: 'success',
      message: swedish
        ? `✅ Alla ${total} ${itemName} lyckades!`
        : `✅ All ${total} ${itemName} succeeded!`,
    };
  }

  if (successful === 0) {
    // Complete failure
    return {
      type: 'error',
      message: swedish
        ? `❌ Alla ${total} ${itemName} misslyckades`
        : `❌ All ${total} ${itemName} failed`,
    };
  }

  // Partial success
  const message = swedish
    ? `⚠️ ${successful} av ${total} ${itemName} lyckades. ${failed} misslyckades.`
    : `⚠️ ${successful} of ${total} ${itemName} succeeded. ${failed} failed.`;

  // Show notification with option to view failures
  if (onViewFailures && results.results) {
    const notification = document.createElement('div');
    notification.className = 'partial-success-notification';
    notification.innerHTML = `
      <div class="notification-message">${message}</div>
      <button class="btn btn-sm" onclick="this.dispatchEvent(new CustomEvent('viewFailures', { bubbles: true }))">
        ${swedish ? 'Visa misslyckade' : 'View Failures'}
      </button>
    `;
    notification.addEventListener('viewFailures', () => {
      onViewFailures(results.results.filter(r => !r.success));
    });
    document.body.appendChild(notification);
  }

  return {
    type: 'warning',
    message,
    successful,
    failed,
    total,
  };
}

// Export for use in main app
window.ErrorHandler = {
  fetchWithRetry,
  parseErrorResponse,
  showErrorNotification,
  getUserFriendlyMessage,
  logErrorToBackend,
  recoverSession,
  saveSessionState,
  handlePartialSuccess,
  ErrorCode,
};
