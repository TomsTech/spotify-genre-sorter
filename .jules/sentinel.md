## 2024-05-04 - [XSS] DOM-based Cross-Site Scripting in Playlist Share Modal
**Vulnerability:** The `playlistName` variable was being directly concatenated into the HTML string of the share modal without any sanitization or escaping (`'<p class="share-playlist-name">' + playlistName + '</p>'`). This could allow an attacker to craft a malicious playlist name containing JavaScript code (e.g., `<script>alert('XSS')</script>`), which would be executed when a user views the share modal for that playlist.
**Learning:** This occurred because the share modal's HTML was being constructed manually via string concatenation and then injected into the DOM. This is a common pattern for introducing DOM-based XSS vulnerabilities.
**Prevention:** Always sanitize or escape user-provided data before inserting it into the DOM. In this case, wrapping the variable with `escapeHtml(playlistName)` effectively mitigates the vulnerability by converting potentially dangerous characters into their safe HTML entity equivalents.

## 2024-05-18 - [CSRF] Missing CSRF Protection Middleware on API Routes
**Vulnerability:** The API routes (`/api/*`) were missing CSRF protection, leaving state-changing endpoints (like playlist creation) vulnerable to Cross-Site Request Forgery attacks if the attacker can trick an authenticated user into submitting a malicious request.
**Learning:** Although the application implemented a CSRF protection middleware in `src/lib/csrf-middleware.ts`, it was never applied to the main API router in `src/routes/api.ts`.
**Prevention:** Ensure that all state-changing endpoints (POST, PUT, DELETE, PATCH) are protected by a CSRF token. Apply `optionalCsrfProtection` globally to the API router so it covers authenticated state-changing requests while bypassing unauthenticated ones (like public logs).
## 2024-05-18 - [Auth] Hardcoded Admin Backdoor
**Vulnerability:** Several admin endpoints (`/admin/invites`, `/admin/errors`, `/admin/perf`) contained a locally defined `adminUsers` array (`['tomspseudonym', 'tomstech']`) that bypassed the proper environment-based `getAdminUsers` implementation.
**Learning:** Hardcoding administrative usernames directly in route handlers overrides centralized environment configuration and creates an unauthorized backdoor for those specific users.
**Prevention:** Always use the centralized authorization functions (like `isAdmin()`) that rely on environment variables rather than hardcoding user identifiers in specific routes.

## 2025-10-24 - [XSS Prevention] **Vulnerability:** Unescaped external data (Spotify artist names, user display names, playlist URLs) injected into `innerHTML`. **Learning:** Even when data comes from a trusted third-party API (like Spotify), it must be treated as untrusted user input and escaped before being rendered in the DOM, as users control their display names and artist names can contain malicious payloads. **Prevention:** Always use `escapeHtml` (or `textContent`) when dynamically generating HTML strings that include external or user-provided data.

## 2024-05-24 - DOM-based XSS via Error Messages
**Vulnerability:** Unescaped error messages (`err.message`) were interpolated directly into DOM elements via `innerHTML` in multiple admin error handlers.
**Learning:** Client-side error messages returned from APIs or catching generic exceptions may contain user-controllable input or API payload data, making them unsafe to render directly without escaping.
**Prevention:** Always wrap dynamically generated strings or error properties in an escaping function (like `escapeHtml()`) before assigning them to `innerHTML`.
## 2025-10-24 - [XSS] DOM-based Cross-Site Scripting in Artist Breakdown Modal
**Vulnerability:** The `genreName` variable was being directly concatenated into the HTML string of the artist breakdown modal without any sanitization or escaping (`'  <h3>' + getFamilyEmoji(getGenreFamily(genreName)) + ' ' + genreName + '</h3>'`). This could allow an attacker to craft a malicious genre name containing JavaScript code.
**Learning:** This occurred because the artist breakdown modal's HTML was being constructed manually via string concatenation and then injected into the DOM. This is a common pattern for introducing DOM-based XSS vulnerabilities.
**Prevention:** Always sanitize or escape user-provided data before inserting it into the DOM. In this case, wrapping the variable with `escapeHtml(genreName)` effectively mitigates the vulnerability by converting potentially dangerous characters into their safe HTML entity equivalents.
## 2025-02-28 - [XSS] DOM-based Cross-Site Scripting in Playlist Scan Text
**Vulnerability:** The `playlistName` variable was being directly concatenated into the HTML string of the playlist scan loading indicator without any sanitization or escaping (`const scanningText = swedishMode ? 'Skannar ' + playlistName + '...' : 'Scanning ' + playlistName + '...'; container.innerHTML = '<div class="scanning-indicator"><div class="spinner"></div>' + scanningText + '</div>';`). This could allow an attacker to craft a malicious playlist name containing JavaScript code, leading to XSS execution when a user clicks the "Scan Playlist" button.
**Learning:** This occurred because the scanning loading indicator's text was dynamically generated using the `playlistName` property without applying the existing `escapeHtml` function before assigning it to `innerHTML`.
**Prevention:** Always sanitize or escape user-provided data, including seemingly safe fields like a playlist's name, before inserting it into the DOM via `innerHTML`. In this case, wrapping the variable with `escapeHtml(playlistName)` effectively mitigates the vulnerability.
## 2026-06-08 - [XSS] DOM-based Cross-Site Scripting via IP Address spoofing in Admin Errors Log
**Vulnerability:** The `error.ip` variable, sourced from the `cf-connecting-ip` header in the backend, was inserted directly into the `src/frontend/app.js` DOM without any sanitization in the admin panel errors tab.
**Learning:** IP address strings sourced from HTTP headers can be spoofed by attackers (e.g. via `X-Forwarded-For`) to contain malicious HTML/JS payloads. If these are rendered back to administrators without escaping, they represent a stored XSS vector targeting privileged users.
**Prevention:** Even seemingly safe metadata like IP addresses must be escaped using `escapeHtml()` before being rendered into the DOM using `.innerHTML`.

## 2026-06-10 - Unsafe JSON injection in innerHTML
**Vulnerability:** XSS vulnerability where JSON.stringify(data.value) from a KV key was inserted directly into innerHTML.
**Learning:** Stringifying a JSON object does NOT make it safe for HTML injection, as malicious HTML tags inside string values will still be interpreted by the browser.
**Prevention:** Always wrap JSON.stringify outputs with escapeHtml() when interpolating into innerHTML, or assign it via textContent instead.
