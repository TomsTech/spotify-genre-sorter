🧪 Add comprehensive tests for determineRecoveryStrategy

🎯 **What:**
The `determineRecoveryStrategy` function in `src/lib/error-handler.ts` was lacking dedicated unit tests. Given it is a pure function that relies heavily on branch conditions based on `ErrorContext` inputs, testing it explicitly guarantees predictable error recovery flows.

📊 **Coverage:**
The added test suite comprehensively checks all specific mapped conditional branches and default fallback behaviors for the function:
*   Authentication errors (`AUTH_ERROR`, `TOKEN_EXPIRED`) map to `abort` and login prompt.
*   Rate limiting (`RATE_LIMIT_ERROR`) maps to `retry` and rate-limit specific backoff messaging.
*   Network/Timeout errors (`NETWORK_ERROR`, `TIMEOUT_ERROR`) map to `retry` and connection lost message.
*   Validation errors (`VALIDATION_ERROR`, `INVALID_INPUT`) map to `abort` using the `userMessage` embedded in the error object.
*   Cache errors (`CACHE_ERROR`) map to `fallback` and direct storage message.
*   Default fallback behaviours check that errors marked as `retryable` will trigger `retry`, and errors that are not `retryable` will trigger `abort`.

✨ **Result:**
The test coverage for error-handler components has significantly improved, ensuring the error response mapping logic remains robust against regressions and refactoring.
