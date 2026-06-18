**Severity:** High
**Vulnerability:** DOM Cross-Site Scripting (XSS) via dynamic global function execution
**Impact:** A malicious payload injected into DOM structures via `onclick` attributes could execute arbitrary `window` properties. While an attacker needs a vector to inject HTML, if achieved, they could bypass Content Security Policy due to the explicit fallback execution of `window[fnName]`.
**Fix:** Removed the `window[fnName]` fallback within the global event delegation block in `app.js`. Replaced it with a strict allowlist of explicit frontend UI functions (`ALLOWED_FUNCTIONS`). This securely mitigates arbitrary execution while maintaining compatibility for existing `onclick` HTML string components.
**Verification:** Validated that the patched event handler correctly invokes allowed functions while preventing unsafe globals, and ran `pnpm run test` ensuring all 215 tests pass without breaking existing application workflows.
