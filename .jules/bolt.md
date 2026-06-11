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

## 2024-05-24 - [Parallelizing KV Put Operations]
**Learning:** The `flushWriteQueue` function in `kv-cache.ts` used a `for...of` loop with `await kv.put`, creating an N+1 latency bottleneck for batch KV writes. Cloudflare Workers handle concurrent I/O well, so sequential awaits unnecessarily block execution.
**Action:** Use `Promise.all()` with an array of mapped promises to parallelize `kv.put` operations when processing queues or batches, reducing O(N) network latency to O(1).
## 2024-06-08 - Use Promise.all with cursor for parallel KV deletes
**Learning:** When dealing with KV namespaces list method which may return a subset of the results, it is a performance anti-pattern to just delete the returned list and miss entries, a cursor loop is required to iterate over all entries to reliably clear a cache.
**Action:** Iterate with while(cursor) to process the list completely and use Promise.all to fetch concurrent KV requests.
