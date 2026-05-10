## 2024-05-04 - [Debouncing Search Input]
**Learning:** The frontend filters the genre list synchronously on every keystroke (`oninput="filterAndRenderGenres(this.value)"`), which can cause main thread blocking and jank when dealing with hundreds or thousands of genres.
**Action:** Implement debouncing for search input handlers to delay the filtering logic until the user pauses typing. This is a classic frontend performance optimization that is simple to add and measurably improves responsiveness.
## 2024-05-07 - [Debouncing Template Inputs]
**Learning:** The frontend updates playlist and description templates synchronously on every keystroke (`oninput="updatePlaylistTemplate(this.value)"`), which causes main thread blocking and unnecessary localStorage writes.
**Action:** Implement debouncing for template input handlers to delay the updates until the user pauses typing. This is a classic frontend performance optimization that prevents jank and excessive IO operations.
## 2024-05-10 - [Interleaving CPU/IO Bound Work]
**Learning:** Sequential loops that call `JSON.parse()` on the entire results array of a `Promise.all` KV-read batch block the main thread.
**Action:** Interleave the CPU-bound `JSON.parse` work within the `Promise.all` async mapping for parallel IO-bound operations. This improves overall throughput, as the event loop can parse already resolved items while waiting for slower KV network requests.
