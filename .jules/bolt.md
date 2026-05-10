## 2024-05-04 - [Debouncing Search Input]
**Learning:** The frontend filters the genre list synchronously on every keystroke (`oninput="filterAndRenderGenres(this.value)"`), which can cause main thread blocking and jank when dealing with hundreds or thousands of genres.
**Action:** Implement debouncing for search input handlers to delay the filtering logic until the user pauses typing. This is a classic frontend performance optimization that is simple to add and measurably improves responsiveness.

## 2024-05-07 - [Interleaving JSON Parsing with Parallel I/O]
**Learning:** Performing JSON parsing in a sequential `for...of` loop after a batch of asynchronous reads (`Promise.all`) creates a synchronous bottleneck. Even in single-threaded environments, interleaving parsing with pending I/O allows the CPU to process already-fetched data while waiting for remaining network responses.
**Action:** Always move `JSON.parse` and other data processing into the `async` map callback within the `Promise.all` chain to maximize concurrent processing and reduce total wall-clock time.
