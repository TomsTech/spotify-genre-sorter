## 2024-05-04 - [Debouncing Search Input]
**Learning:** The frontend filters the genre list synchronously on every keystroke (`oninput="filterAndRenderGenres(this.value)"`), which can cause main thread blocking and jank when dealing with hundreds or thousands of genres.
**Action:** Implement debouncing for search input handlers to delay the filtering logic until the user pauses typing. This is a classic frontend performance optimization that is simple to add and measurably improves responsiveness.
## 2024-05-07 - [Debouncing Template Inputs]
**Learning:** The frontend updates playlist and description templates synchronously on every keystroke (`oninput="updatePlaylistTemplate(this.value)"`), which causes main thread blocking and unnecessary localStorage writes.
**Action:** Implement debouncing for template input handlers to delay the updates until the user pauses typing. This is a classic frontend performance optimization that prevents jank and excessive IO operations.
## 2024-05-15 - [Interleaved JSON.parse with Promise.all for KV Reads]
**Learning:** When fetching multiple items from Cloudflare KV using `Promise.all` (e.g., `list.keys.map(key => kv.get(key.name))`), parsing the JSON sequentially in a separate loop afterwards blocks the main thread and wastes CPU idle time.
**Action:** Interleave `JSON.parse` directly within the `Promise.all` mapping (e.g., `list.keys.map(async key => { const d = await kv.get(key.name); return d ? JSON.parse(d) : null; })`). This allows the V8 engine to utilize CPU time for parsing completed I/O requests while waiting for the remaining I/O requests to finish, significantly improving overall latency.
