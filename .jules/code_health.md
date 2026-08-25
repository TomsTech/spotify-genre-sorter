## 2026-08-21 - [Code Health] Use explicit unknown type in catch blocks
**Learning:** Implicit `any` in Promise `.catch((err) => ...)` callbacks can lead to unsafe type assumptions.
**Action:** Always explicitly type caught errors as `err: unknown` to enforce type narrowing and improve type safety across the application.
