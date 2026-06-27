## 2025-06-27 - [Optimize KV List Keys Lookup]
**Learning:** [When checking a paginated API response that is restricted to one element (e.g., `limit: 1`), using O(N) functional array methods like `.find()` incurs unnecessary callback allocation and function invocation overhead. A direct indexed lookup combined with optional chaining is more than 60% faster.]
**Action:** [Use index access (e.g., `arr[0]?.name === target ? arr[0] : undefined`) instead of `.find()` when array length is guaranteed to be 0 or 1.]
