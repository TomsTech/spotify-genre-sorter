## 2026-09-24 - Add Tests for getArtists in spotify.ts

**Learning:** When mocking global objects like `fetch` using `vi.fn()` in Vitest, it is safer to use `vi.stubGlobal('fetch', ...)` rather than explicitly assigning `(global as any).fetch = ...`. Re-assigning the global variable permanently alters it across test suites, which can break independent test files. In contrast, `vi.stubGlobal()` ensures isolation across suites.

**Action:** Consistently use `vi.stubGlobal` for mocking native global methods to avoid test state pollution.
## 2024-10-17 - Add missing error test for analytics endpoint
**Learning:** Hono API tests can use an internal mock controller approach to simulate internal function failures, but it is often much more accurate and rigorous to mock the external dependency (like `session.getAnalytics`) directly via `vi.spyOn` and perform an actual request via `app.fetch()`. This ensures the full middleware pipeline and error handlers are invoked exactly as they would be in production.
**Action:** Migrated from a shallow internal controller mock to a full request-based integration test for `GET /analytics` by mocking `session.getAnalytics` and using `api.fetch(req, env, ctx)`.
## YYYY-MM-DD - Add missing edge case tests for determineKVStatus
**Learning:** Pure functions processing multi-dimensional inputs against multiple boundary thresholds need explicit combinatorial boundary testing right on those thresholds (e.g. exactly 80, exactly 90). The code behaved as expected falling to correct classification, but previously lacked the specific boundary assertions to ensure `>` strictness vs `>=` in thresholds.
**Action:** Added exact threshold limits and precise decimal fractional coverage (e.g., 90.0001, 80.0001) for strict bounds tracking.
