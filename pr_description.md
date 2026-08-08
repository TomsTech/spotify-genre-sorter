💡 What: Replaced functional chained methods `.filter().map()` with a single `for` loop that iterates and populates an array directly.
🎯 Why: Chaining methods like `.filter()` and `.map()` allocates intermediate arrays that exist only briefly before being garbage collected. By using a single `for` loop, we construct the final array directly in one pass, avoiding the hidden intermediate allocations. This is highly effective when handling potentially large arrays, especially on hot endpoints.
📊 Impact: Reduces memory allocations and garbage collection pressure when mapping and filtering datasets, achieving measurably faster throughput without intermediate O(n) space overhead.
🔬 Measurement: Verify tests run successfully and memory profile shows fewer intermediate array allocations.
