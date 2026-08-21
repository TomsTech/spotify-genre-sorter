## 2025-02-12 - Hono Context Types Update
**Issue:** ESLint suppressions for `@typescript-eslint/no-explicit-any` and `@typescript-eslint/no-unsafe-argument` were used in multiple files when defining Hono Context.
**Learning:** Using `c: Context<{ Bindings: Env }, any, any>` triggers ESLint warnings for `any` types. Passing this context to cookie helper functions (`getCookie`, `setCookie`) propagates the `any` type, causing `no-unsafe-argument` warnings.
**Fix:** Changing the Context generic parameters from `any, any` to `string, unknown` (i.e. `Context<{ Bindings: Env }, string, unknown>`) conforms to expected type constraints while avoiding `any`. This resolves the explicit any warning and allows removal of the unsafe argument suppressions.
