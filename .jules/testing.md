## 2024-05-15 - Mocking Hono routes

**Learning:** When using `app.fetch` to test Hono routes locally in Vitest (especially when using Cloudflare environment variables or execution contexts), you must pass a mock execution context as the third argument if your application uses it (e.g., for BetterStack logging or `waitUntil` features): `app.fetch(req, envMock, { passThroughOnException: vi.fn(), waitUntil: vi.fn() })`.

**Action:** When creating integration tests for Hono edge/Cloudflare Workers apps, always mock both the `env` and `executionCtx` in the `app.fetch` calls to prevent null-reference errors deep within middleware or logging utilities.
## 2026-07-16 - Add tests for index.ts API routes error handling
**Learning:** Testing Hono's global `app.onError` handler can be tricky if you try to wrap it in a mock app or send requests through the framework because of `ExecutionContext` typing/availability. A cleaner approach is to extract the anonymous inline error handler function into a named exported function (e.g. `export const errorHandler = ...`), and then test that function directly in isolation by mocking its inputs.
**Action:** Extract inline anonymous handlers (like global error handlers) into named exported functions to make unit testing isolated, easier, and not reliant on booting up the entire web framework.
