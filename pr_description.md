🎯 **What:** The changelog component rendered `release.version`, `release.date`, and `release.changes` directly into the DOM using `innerHTML` without sanitization.

⚠️ **Risk:** **High.** The unescaped input could allow malicious script execution if the data source (GitHub releases proxy) were ever compromised or manipulated to return a crafted payload. Since it renders directly in the user's browser, this is a classic Reflected/Stored XSS vulnerability path.

🛡️ **Solution:** Wrapped the dynamic inputs within the changelog template literals with `escapeHtml(String(variable))` to securely sanitize any HTML characters before rendering.
