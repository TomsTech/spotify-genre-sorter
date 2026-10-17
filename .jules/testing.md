## 2026-09-24 - Add Tests for getArtists in spotify.ts

**Learning:** When mocking global objects like `fetch` using `vi.fn()` in Vitest, it is safer to use `vi.stubGlobal('fetch', ...)` rather than explicitly assigning `(global as any).fetch = ...`. Re-assigning the global variable permanently alters it across test suites, which can break independent test files. In contrast, `vi.stubGlobal()` ensures isolation across suites.

**Action:** Consistently use `vi.stubGlobal` for mocking native global methods to avoid test state pollution.
## YYYY-MM-DD - Add missing edge case tests for determineKVStatus
**Learning:** Pure functions processing multi-dimensional inputs against multiple boundary thresholds need explicit combinatorial boundary testing right on those thresholds (e.g. exactly 80, exactly 90). The code behaved as expected falling to correct classification, but previously lacked the specific boundary assertions to ensure `>` strictness vs `>=` in thresholds.
**Action:** Added exact threshold limits and precise decimal fractional coverage (e.g., 90.0001, 80.0001) for strict bounds tracking.
