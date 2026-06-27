## 2025-02-27 - Fix Stored XSS via unescaped listener.spotifyAvatar
**Vulnerability:** Stored Cross-Site Scripting (XSS) in the Listening List. The dynamic `listener.spotifyAvatar` and `track.albumArt` fields were not escaped before being concatenated into the HTML DOM.
**Learning:** Even variables meant to store URLs (like avatars and album arts) must be escaped, especially when dynamically generating HTML strings using template literals, as they could be manipulated by an attacker to break out of attributes and inject event handlers (e.g. `onload`, `onerror`).
**Prevention:** Always wrap dynamically inserted variables in HTML output strings with an escaping function (like `escapeHtml`), regardless of whether the source is considered "safe" initially or intended to be a URL.
