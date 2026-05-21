## 2024-05-04 - [Debouncing Search Input]
**Learning:** The frontend filters the genre list synchronously on every keystroke (`oninput="filterAndRenderGenres(this.value)"`), which can cause main thread blocking and jank when dealing with hundreds or thousands of genres.
**Action:** Implement debouncing for search input handlers to delay the filtering logic until the user pauses typing. This is a classic frontend performance optimization that is simple to add and measurably improves responsiveness.
## 2024-05-07 - [Debouncing Template Inputs]
**Learning:** The frontend updates playlist and description templates synchronously on every keystroke (`oninput="updatePlaylistTemplate(this.value)"`), which causes main thread blocking and unnecessary localStorage writes.
**Action:** Implement debouncing for template input handlers to delay the updates until the user pauses typing. This is a classic frontend performance optimization that prevents jank and excessive IO operations.
## 2024-05-08 - [Interleaving JSON.parse with KV fetches]
**Learning:** Sequential processing of `Promise.all` results for KV fetches causes a large synchronous parsing block and delays CPU-bound work until all I/O is finished. By moving `JSON.parse` and data transformations directly into the async `map` closure, parsing can execute as soon as each individual KV read completes, reducing peak memory usage and overall wall-clock time.
**Action:** Always interleave parsing with async KV fetches by performing `JSON.parse` inside the `async` callback passed to `map`, rather than iterating over raw JSON results afterwards.
## 2024-05-14 - [Parallelizing KV Delete and List Operations]
**Learning:** Sequential `await kv.delete()` and `await kv.list()` operations inside `for...of` loops cause massive N+1 slowdowns in Cloudflare Workers, significantly increasing wall-clock time for API routes like `/admin/clear-cache` and `/admin`.
**Action:** Always wrap concurrent `kv` operations (e.g., `list`, `delete`, `get`, `put`) in `Promise.all()` to execute them in parallel, effectively binding total latency to the slowest single operation instead of the sum of all operations.
## 2024-05-21 - [Parallelizing Array of Known Keys in KV Delete]
**Learning:** We previously saw N+1 latency from `list` combined with `delete`. It turns out there's another N+1 bottleneck when deleting a hardcoded list of keys using a `for...of` loop (`for (const key of keysToDelete) { await kv.delete(key); }`). This forces sequential network requests.
**Action:** Any synchronous sequence of predictable `await kv.delete()` (or get/put) operations based on a known array should be executed concurrently using `await Promise.all(keys.map(key => kv.delete(key)))` to maximize throughput.
