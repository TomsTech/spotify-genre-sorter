## 2025-06-27 - Bolt Optimization: Fix N+1 Query in Hall of Fame Retrieval
**Learning:** Sequential KV gets inside a loop (N+1 query) significantly impact performance, increasing latency linearly with the number of items.
**Action:** When fetching multiple items from Cloudflare KV, calculate the required keys and use `Promise.all` to fetch them concurrently, which substantially reduces overall latency and increases throughput.
