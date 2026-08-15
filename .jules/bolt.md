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
## 2024-06-15 - [Optimize Track Genre Aggregation]
**Learning:** Instantiating a new `Set` inside a nested loop for deduping per-track genres causes massive garbage collection overhead when dealing with large Spotify libraries.
**Action:** Pulled the `Set` instantiation out of the loop and cleared it each iteration to process each track, significantly reducing memory allocation pressure while retaining O(N) lookup/add performance.
## 2024-05-18 - Use waitUntil for background tasks
**Learning:** In Cloudflare Workers / Hono, non-essential background tasks (like analytics tracking or updating user stats) in middleware or route handlers should be wrapped in `c.executionCtx.waitUntil(...)` to return the HTTP response immediately while ensuring the background task completes.
**Action:** Always wrap non-critical background operations in `c.executionCtx.waitUntil()` when writing route handlers in Cloudflare Workers.
## 2024-06-27 - [Optimize .find() call on potentially large playlist arrays]
**Learning:** While Maps/Sets provide O(1) lookups, the overhead of building them entirely inside a hot endpoint loop for a single lookup on arrays up to a few hundred elements often outweighs the benefits compared to a highly optimized standard `for` loop with hoisted target values.
**Action:** Always benchmark collection conversion vs optimized loops for small-medium arrays when only single lookups occur.
## 2025-05-28 - [Parallelizing Spotify API Requests]
**Learning:** Fetching paginated Spotify API data (e.g., liked tracks) with sequential `while` loops causes N+1 network latency issues, significantly slowing down library scans.
**Action:** Always fetch the first page to get the total item count, calculate the required remaining offsets, and fetch the remaining pages concurrently using `Promise.all()` (in chunks to preserve UI progress behavior) to minimize network latency.
## 2025-05-28 - [Parallelizing Spotify API Requests]
**Learning:** Fetching paginated Spotify API data (e.g., playlists, playlist tracks) with sequential `while` loops causes N+1 network latency issues.
**Action:** Always fetch the first page to get the total item count, calculate the required remaining offsets, and fetch the remaining pages concurrently using `Promise.all()` to minimize network latency.

## 2024-05-18 - Replacing Sequential Pagination Chunking with Unbounded Concurrency
**Learning:** Artificially throttling API requests into small, sequential chunks (e.g., waiting for one block of 5 requests to resolve before firing the next 5) introduces severe N+1 latency, especially when the total number of subrequests is inherently capped by environmental limits (like Cloudflare's 50 subrequests).
**Action:** Replace arbitrary `for`-loop chunking with fully concurrent mapped `Promise.all` arrays for independent offsets. Maintain iterative progress callbacks (like UI progress bars) by incrementing a shared `loadedCount` inside the mapped asynchronous functions rather than awaiting entire batches at a time.
## 2025-05-28 - [Eliminating Intermediate Collections]
**Learning:** Chaining array methods like `.filter()` and `.map()` before passing to a `Set` creates hidden intermediate arrays, unnecessarily increasing memory allocations and garbage collection pressure in hot endpoints.
**Action:** Replace functional `.filter().map()` chains with a single `for` loop that iteratively populates the destination collection (e.g. `Set`) in one pass to achieve better throughput and reduced memory pressure.
## 2024-05-24 - Async Map Interleaving
**Learning:** In Node.js/V8, using `Array.prototype.map` to create an array of async functions automatically interleaves I/O operations and synchronous processing (like JSON.parse) when passed to `Promise.all`. The runtime processes microtasks independently as soon as each I/O completes. Attempting to "optimize" this with shared array mutation inside `.then()` callbacks introduces race conditions and breaks data ordering because I/O resolution order is non-deterministic.
**Action:** Recognize that `await Promise.all(arr.map(async () => ...))` already provides optimal, ordered, interleaved execution. Avoid shared state mutation in asynchronous callbacks.
## 2024-05-19 - Use Map/Return pattern with Promise.all for safe state mutation
**Learning:** When a `Promise.all()` maps over operations that also need to mutate a shared array (like recording successful operations), doing a `.push()` inside the async callback can be prone to logical bugs and order inconsistencies (especially if the underlying operation throws but the `.push()` was executed first or vice-versa).
**Action:** The safer pattern is to map the asynchronous operations to return a value (e.g., returning the ID upon success), await the `Promise.all()`, and then use `.push(...results)` synchronously afterwards. This removes the side-effect from the async callback.
## 2024-05-24 - Chunking Promise.all for Cloudflare KV Deletions
**Learning:** Cloudflare Workers have a hard limit of 50 concurrent subrequests per invocation. Firing `Promise.all` with more than 50 KV operations (like deletes) will trigger exceptions and fail the worker.
**Action:** When performing bulk operations against external APIs or KV stores in a Cloudflare Worker, always chunk the promises into arrays of size < 50 and await each chunk sequentially.
## 2023-10-27 - Optimize Promise.all Concurrency in KV cache writes
**Learning:** Using an unbounded `Promise.all` on operations that trigger network requests (like Cloudflare KV puts) can quickly exceed hard subrequest limits (e.g., Cloudflare Worker's 50 subrequests).
**Action:** When firing concurrent I/O operations from an unbounded array or Map, slice the collection into chunks and process each chunk sequentially, awaiting a batched `Promise.all` for each slice. This bounds concurrency and prevents catastrophic limit exceptions.
## 2026-08-03 - Avoid async wrappers in loops for pure Promise arrays
**Learning:** Wrapping promise-returning functions (like API calls) in `async` mappings just to use `await` sequentially or unnecessarily creates extra overhead and can be flagged as sub-optimal when the array of Promises is already meant for `Promise.all`.
**Action:** Push directly to a promise array using a synchronous loop, chaining `.catch` for error handling, then resolve the array collectively with `Promise.all()`.
## 2024-08-10 - Bounding Concurrent External API/KV Requests
**Learning:** Using an unbounded `Promise.all` on an array of external requests (like Cloudflare KV deletes) can quickly exhaust concurrent request limits (e.g., Cloudflare Workers' 50 subrequest limit per invocation), leading to failed requests and high peak memory usage.
**Action:** When batching operations that perform external or asynchronous resource-intensive requests, always implement a chunking mechanism (using a `for` loop over slices of the array combined with `Promise.all` for each chunk) to limit maximum concurrency to a safe, documented threshold (e.g., 40 for CF Workers).
## 2026-08-03 - Chunk KV deletes to avoid Cloudflare Workers subrequest limits
**Learning:** Cloudflare Workers have a limit of 50 subrequests per worker invocation, which can be easily exceeded when iterating and calling `kv.delete()` on a large list of keys. Additionally, `kv.list()` returns a paginated list of keys.
**Action:** When performing parallel operations like `kv.delete()` on a list of keys in Cloudflare Workers, split the array into smaller chunks (e.g., 45) and iterate over the chunks with `Promise.all()` to respect subrequest limits. Always use cursor pagination for `kv.list()` when checking for a potentially large number of keys.
## 2025-05-28 - [Eliminating Intermediate Collections in Routes]
**Learning:** Chaining array methods like `.flatMap()`, `.map()`, and `.forEach()` in hot endpoint loops (like progressive scanning or playlist analysis) creates hidden intermediate arrays, unnecessarily increasing memory allocations and garbage collection pressure.
**Action:** Replace functional array method chains with standard `for` loops that iteratively populate the destination collection (e.g. `Set` or `Array`) in one pass to achieve better throughput and reduced memory pressure.
## 2025-05-25 - Chunk Promise.all in Cloudflare Workers **Learning:** Cloudflare Workers have a 50 subrequests limit per invocation. Naively mapping Promise.all over large arrays can hit this limit and cause silent failures. **Action:** Always batch or chunk concurrent external/KV calls (e.g. using a chunk size of 25) when dealing with arrays larger than 50 elements in Worker contexts.
## 2024-05-15 - [Batch Parallel Requests to Fix Subrequest Limits] **Learning:** When making parallel requests in Cloudflare Workers using `Promise.all` with a large number of promises, it can hit the 50 subrequests limit and crash. **Action:** Group the parallel requests into chunks (batches) and sequentially await `Promise.all` for each batch (e.g., `batchSize = 5`) to stay within limit but still benefit from parallelism.
## 2024-05-15 - [Batching Parallel Promises for Environment Limits]
**Learning:** When deploying in restricted environments (like Cloudflare Workers, which has a 50 subrequest limit), using `Promise.all()` over an unbounded or large array of external API fetches can lead to sudden crashes.
**Action:** Instead of fetching all items at once, use sequential chunking (e.g. `batchSize = 5`) inside a `for` loop, awaiting `Promise.all(chunk)` iteratively. This keeps concurrency safe without sacrificing the speed benefits of parallel execution. Ensure to clean up any temporary workspace files used during script creation and testing.
## 2026-08-15 - Concurrent KV Cache Deletion
**Learning:** Sequential, independent asynchronous operations (like KV deletes) inside handlers introduce unnecessary N+1 network latency and increase overall request time.
**Action:** When clearing multiple independent cache keys, always execute the operations concurrently using `Promise.all()` to maximize throughput and minimize latency.
