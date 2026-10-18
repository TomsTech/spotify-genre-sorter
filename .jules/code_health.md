## 2026-08-21 - [Code Health] Use explicit unknown type in catch blocks
**Learning:** Implicit `any` in Promise `.catch((err) => ...)` callbacks can lead to unsafe type assumptions.
**Action:** Always explicitly type caught errors as `err: unknown` to enforce type narrowing and improve type safety across the application.
## YYYY-MM-DD - [Code Health] Use generic typing for Hono c.req.json()
**Learning:** Relying on `eslint-disable-next-line @typescript-eslint/no-unsafe-assignment` when parsing JSON requests masks underlying type issues and reduces safety.
**Action:** Always use Hono's generic typing `c.req.json<Type>()` to cleanly establish type context while satisfying lint rules.
