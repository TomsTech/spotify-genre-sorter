## 2024-05-15 - Mocking Hono routes

**Learning:** When using `app.fetch` to test Hono routes locally in Vitest (especially when using Cloudflare environment variables or execution contexts), you must pass a mock execution context as the third argument if your application uses it (e.g., for BetterStack logging or `waitUntil` features): `app.fetch(req, envMock, { passThroughOnException: vi.fn(), waitUntil: vi.fn() })`.

**Action:** When creating integration tests for Hono edge/Cloudflare Workers apps, always mock both the `env` and `executionCtx` in the `app.fetch` calls to prevent null-reference errors deep within middleware or logging utilities.
