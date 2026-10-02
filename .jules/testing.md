## 2026-09-24 - Add Tests for getArtists in spotify.ts

**Learning:** When mocking global objects like `fetch` using `vi.fn()` in Vitest, it is safer to use `vi.stubGlobal('fetch', ...)` rather than explicitly assigning `(global as any).fetch = ...`. Re-assigning the global variable permanently alters it across test suites, which can break independent test files. In contrast, `vi.stubGlobal()` ensures isolation across suites.

**Action:** Consistently use `vi.stubGlobal` for mocking native global methods to avoid test state pollution.
