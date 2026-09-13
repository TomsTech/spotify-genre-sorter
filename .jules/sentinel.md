## 2026-09-13 - [HIGH] Refactor DOM text insertion and URL validation
**Vulnerability:** Possible Cross-Site Scripting (XSS) via `getSafeUrl` and string concatenation to `.innerHTML`.
**Learning:** Using regex replacements for protocol checks in URL validation is brittle against browser parsing quirks. Additionally, using `.innerHTML` with unsanitized data strings exposes the app to XSS.
**Prevention:** Always use the browser's native `URL` parsing capabilities to validate URL protocols safely, and fallback to safe DOM manipulation (`document.createElement`, `.textContent`, `.appendChild`) instead of direct HTML concatenation.
