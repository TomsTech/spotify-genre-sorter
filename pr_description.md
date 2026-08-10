🎯 **What:** Replaced all hardcoded `console.error` calls across `src/routes/api.ts` with a new `logError` helper function that leverages the application's built-in BetterStack logger utility.

💡 **Why:** Using `console.error` bypasses the centralized logging setup, meaning critical production errors would only appear in transient server logs rather than the observability platform. Replacing it ensures all API errors capture structured context (`path`, `method`, execution context) and are correctly routed to BetterStack, significantly improving observability, readability, and maintainability.

✅ **Verification:**
- Formatted and linted the code successfully using `pnpm run lint`.
- Executed the full unit test suite via `pnpm run test` (293/293 passing), ensuring no regressions and that context-related errors were resolved by mocking execution context where appropriate.
- Code review passed after refactoring to use a centralized helper function instead of duplicated inline instantiations.

✨ **Result:** A cleaner `api.ts` file with consistent error handling and reliable structured logging across all route handlers.
