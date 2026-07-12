## YYYY-MM-DD - Test API Routes directly using Hono api.request
**Learning:** When adding tests for a Hono application (`src/routes/api.ts`), it is easier and more reliable to use `api.request()` instead of mocking the global `fetch` if we want to test the full route pipeline.
**Action:** Next time when testing a Hono route error path, import the `api` object and pass a fake `Request` along with mocked context bindings (like KV) using `api.request(new Request('...'), {}, { BINDING: ... })`.
