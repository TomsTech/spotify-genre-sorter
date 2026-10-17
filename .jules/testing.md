## 2026-09-24 - Add Tests for getArtists in spotify.ts

**Learning:** When mocking global objects like `fetch` using `vi.fn()` in Vitest, it is safer to use `vi.stubGlobal('fetch', ...)` rather than explicitly assigning `(global as any).fetch = ...`. Re-assigning the global variable permanently alters it across test suites, which can break independent test files. In contrast, `vi.stubGlobal()` ensures isolation across suites.

**Action:** Consistently use `vi.stubGlobal` for mocking native global methods to avoid test state pollution.
## 2026-10-17 - Add test coverage for generated frontend output
**Learning:** Build artifacts containing generated templates lack safety nets. When a script like `build-frontend.mjs` generates templates dynamically, adding specific tests for the exported module ensures the output contains correctly escaped interpolations and essential HTML structure.
**Action:** Added `tests/generated-frontend.test.ts` to assert that `getHtml(nonce)` properly interpolates the nonce and verifies critical elements are preserved in the final HTML.
