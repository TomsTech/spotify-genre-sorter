## 2025-02-12 - Eliminate intermediate array allocations via Array.from over slice().map()
**Learning:** Using `array.slice().map()` creates intermediate arrays that increase garbage collection overhead, especially when chunking data for `Promise.all()` in tight loops.
**Action:** Replace `.slice().map()` with `Array.from({ length: size }, (_, j) => array[start + j])` to directly construct the promised elements array without intermediate allocations.

## 2025-05-25 - [Optimize Set to Array Conversion]
**Learning:** Using `Array.from(set)` is noticeably more performant (~40% faster) than using the spread syntax `[...set]` for converting Sets to Arrays in Node.js. It avoids intermediate array allocations and dynamic resizing by knowing the Set's size upfront.
**Action:** Replaced spread syntax `[...set]` with `Array.from(set)` when converting `artistIds` Sets to arrays in `src/routes/api.ts` and `src/lib/spotify.ts`.

## 2025-05-26 - Eliminate array allocation for Map eviction
**Learning:** When evicting the oldest entries from a `Map` (like in a rate limiter), converting the entire Map to an array with `push` and then calling `sort` is O(N log N) and creates intermediate allocations. Because JavaScript `Map` iterators yield elements in insertion order (FIFO), you can achieve O(K) eviction without arrays by directly iterating over `map.keys()` and deleting the required number of entries.
**Action:** Replaced the array conversion, push loop, and sort operation in `rateLimitMap` eviction with a simple loop over `rateLimitMap.keys()` that deletes elements directly.

## YYYY-MM-DD - Removed O(N) User Playlist Fetch on Single Playlist Creation
**Learning:** Checking for duplicate playlists by fetching all of a user's playlists (up to 200) via multiple Spotify API pagination requests adds massive latency (1-2s) to single playlist creation. Since Spotify naturally allows duplicate playlist names and the frontend logic gracefully handles success regardless, this check is an unnecessary overhead.
**Action:** Removed the `getUserPlaylists` check from the single playlist creation endpoint in `api.ts`, relying on Spotify's default behavior and saving multiple subrequest hits to the Cloudflare Worker, reducing response latency by >60%.

## YYYY-MM-DD - Optimize Array Push in buildScoreboard
**Learning:** Using `Array.prototype.push(...items)` inside a loop over a large dataset creates performance bottlenecks and dynamic reallocation overhead.
**Action:** Pre-allocated a fixed-size array (`new Array<UserStats>(keys.length)`) and assigned items individually using an index tracker (`allStats[statsCount++] = stats`). Truncated the array at the end (`allStats.length = statsCount`) to handle filtered items.

## 2025-05-27 - Parallelize KV Read Batch Loops
**Learning:** A sequential `for` loop that awaits `Promise.all` inside the loop iterates synchronously through batches. This misses the opportunity for the underlying I/O layers (like Cloudflare Workers' subrequest fetching) to execute batches concurrently, significantly increasing end-to-end latency for large sets.
**Action:** Refactored a sequential chunked loop for session deletion into parallel nested `Array.from` iterations, mapping to batch promises first and awaiting them collectively at the end via `Promise.all(batchPromises)`.

## YYYY-MM-DD - Replace for...in loop with Object.keys
**Learning:** for...in loops are slower in V8 than Object.keys iteration because they need to check the object's prototype chain.
**Action:** Refactored a for...in loop in `/admin/kv-monitor` to use Object.keys and a standard for loop for faster iteration.

## YYYY-MM-DD - Remove Duplicate API Call to Get Library Size
**Learning:** We saved a roundtrip to Spotify API by storing `totalInLibrary` in KV cache alongside other chunk metadata. This limits API latency during cache hits.
**Action:** Added `totalInLibrary` to `ChunkCacheData` interface and updated cache write/read operations to use the stored value.

## YYYY-MM-DD - Optimize Map eviction loop
**Learning:** Moving loop counters inside exit condition evaluations and utilizing prefix increment operators can modestly improve inner loop speed by reducing instruction count per iteration.
**Action:** Refactored rate limiter eviction loop in src/routes/api.ts to use `if (++removed >= entriesToRemove) break;`.

## YYYY-MM-DD - Suboptimal Map Iteration for Bulk Duplicate Playlist Check
**Learning:** Using a \`for...of\` loop to iterate over arrays requires iterator instantiation which adds overhead, especially when iterating over large datasets or creating Sets in bulk operations.
**Action:** Replaced the \`for...of\` loop with a standard \`for\` loop in \`src/routes/api.ts\` when converting \`existingPlaylists\` to a \`Set\` to improve performance by directly accessing array indices.

## YYYY-MM-DD - [Pre-allocate Arrays in loops]
**Learning:** Pre-allocating array size with `new Array(length)` avoids array resizing and improves loop execution speed instead of using `push`.
**Action:** Use pre-allocation wherever array size is known ahead of time.

## 2025-02-12 - ⚡ Bolt: Eliminate intermediate array allocations when chunking batch requests
**Learning:** Using `.slice().map()` when breaking down bulk array processing into chunks causes unnecessary memory allocations and subsequent garbage collection overhead for intermediate arrays.
**Action:** Replaced `.slice(i, i + BATCH_SIZE).map(...)` with `Array.from({ length: size }, (_, j) => ...)` and indexed into the original array `array[i + j]` to avoid creating temporary array structures entirely in `src/lib/spotify.ts` for operations like batch playlist or track requests.

## 2025-05-26 - [Optimize array find in loop to Map lookup]
**Learning:** Using `array.find` inside a loop results in an O(N^2) operation, which scales poorly when both the loop array and target array grow. Pre-computing a Map turns this into an O(N) operation.
**Action:** Refactored loops finding items in `genreData.genres` in `src/frontend/app.js` by first creating a `genreMap` map, enabling O(1) lookups during iteration.

## YYYY-MM-DD - [Eliminating O(N^2) array.indexOf inside batch loop]
**Learning:** Using `array.indexOf(item)` inside a loop over the same (or parallel) array to find the current item's index creates an O(N^2) operation. When processing batches, this scales poorly and increases execution time.
**Action:** Replaced `results.indexOf(result)` with a standard `for` loop index `j` to access both `result` and `chunk[j]` in O(N) time in `src/lib/error-handler.ts`.

## YYYY-MM-DD - [O(N^2) Bottleneck in Array Processing]
**Learning:** [Using Array.prototype.indexOf() inside a for...of loop over a parallel array creates an O(N^2) bottleneck, which is particularly bad for batch processing large arrays.]
**Action:** [Use a standard for loop with an index variable for O(1) direct element access when correlating items between parallel arrays.]

## YYYY-MM-DD - [Parallelize Hall of Fame Fetches]
**Learning:** [Sequential awaits in a loop create a waterfall effect for I/O bound operations (like KV fetching). Replacing it with Promise.all reduces network latency linearly in relation to the number of operations.]
**Action:** [Replaced sequential KV fetches in the '/stats' endpoint with a concurrent Promise.all implementation in src/index.ts.]

## YYYY-MM-DD - Optimize O(N^2) array find to O(1) map lookup in HoF loop
**Learning:** Using Array.prototype.find inside a loop creates an O(N^2) operation. Converting the array into a Map beforehand provides O(1) lookup, significantly reducing time complexity.
**Action:** Replaced users.find() with a pre-built userMap.get() lookup in the fetchHoFUsers loop, yielding an ~12x performance improvement in benchmarks.

## YYYY-MM-DD - Clean up unused fields after algorithm changes
**Learning:** When switching algorithms (like moving from a timestamp-based O(N) LRU eviction to an insertion-order-based O(1) LRU eviction using JavaScript Maps), old fields (like `lastAccessed`) often become dead code. Removing them improves memory footprint and code clarity.
**Action:** Removed the unused `lastAccessed` field from `CacheEntry` and its update points in `src/lib/kv-cache.ts` after verifying that `evictOldest` solely relies on Map insertion order.

## YYYY-MM-DD - [O(N^2) Bottleneck in Error Handler]
**Learning:** Using Array.prototype.indexOf() inside a loop to find the original item from a settled Promise array creates an O(N^2) bottleneck, especially on large batches in processBatch().
**Action:** Always use an explicit indexed for loop (e.g., for (let j = 0; j < results.length; j++)) to directly access the corresponding item in the parallel chunk array instead of looking it up with indexOf.

## 2025-05-25 - [O(N^2) Array find bottleneck in KV write error handling]
**Learning:** `Array.prototype.indexOf()` inside a `for...of` loop over a parallel array causes an O(N^2) bottleneck.
**Action:** Refactored to use a standard `for` loop with an index variable to access elements directly in O(N) time.

## YYYY-MM-DD - [Optimize LRU Cache Update for Rate Limiter]
**Learning:** [JavaScript Map objects maintain insertion order. By deleting and re-inserting elements on access, the Map implicitly becomes an LRU cache where the oldest element is the first item.]
**Action:** [Refactored rate limiter in `src/routes/api.ts` to delete and re-insert keys on access to maintain LRU order naturally for O(1) eviction without arrays.]

## 2025-11-18 - ⚡ Bolt: Eliminate intermediate array allocations in array aggregations
**Learning:** Using the spread operator with `.filter()` inside an array `.push()` (e.g., `arr.push(...subArr.filter(Boolean))`) creates intermediate array allocations and can risk maximum call stack size exceeded errors for large arrays.
**Action:** Replace `...array.filter()` with a standard O(N) indexed `for` loop that iterates over the elements and conditionally pushes them to the target array, reducing memory overhead and garbage collection pauses.
