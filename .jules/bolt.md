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
## 2024-05-24 - [Use cachedKV for Session Deletion]
**Learning:** When using a memory cache wrapper (like `cachedKV`) over Cloudflare KV for read/write operations (e.g., session management), all operations including `delete` must use the wrapper. Direct calls to `kv.delete` bypass the cache, leaving stale data in memory which can cause inconsistencies or security issues with session management.
**Action:** Ensure all CRUD operations for cached resources route through the caching layer (e.g., `cachedKV.delete`) rather than calling the underlying KV directly.
## 2024-06-14 - [Optimize Genre Aggregation]
**Learning:** When aggregating nested relations (e.g., tracks -> artists -> genres), creating temporary Sets for uniqueness on a per-item basis inside a loop generates massive garbage collection overhead.
**Action:** Instantiate a single reusable Set outside the loop and use .clear() to achieve O(1) deduplication without the memory penalty of continuous object allocation.
## 2024-05-19 - [API Performance] Optimize Loop Over I/O Boundaries
**Learning:** Sequential async operations within a loop over large collections severely limits throughput because both KV writes and Spotify API calls wait idly instead of running in parallel. Standard `Promise.all(array.map())` hits Cloudflare limits or Spotify API rate-limits due to unbounded concurrency.
**Action:** Always employ a bound-concurrency pattern via utilities such as `pMap` with limits (e.g., `concurrency: 3`) to safely parallelize operations within loops, maximizing throughput while remaining beneath limits.
