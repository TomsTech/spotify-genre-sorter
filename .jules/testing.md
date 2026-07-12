## 2026-07-12 - Added tests for logError function
**Learning:** Testing loggers that integrate with external APIs (like BetterStack) requires carefully mocking the execution context and custom logger instances, as well as catching side-effects like falling back to `console.error`.
**Action:** Always verify `console.error` and custom loggers are correctly mocked and expected calls match all conditionally required behaviors.
