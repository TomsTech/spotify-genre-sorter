🎯 **What:**
Added unit tests for the `calculateKVTrend` function in `src/routes/api.ts`. This was previously identified as a gap in test coverage. Since it's a pure function, adding tests ensures the reliability of trend calculations for status page monitoring.

📊 **Coverage:**
- Identifies stable trends when writes are within normal range
- Identifies increasing trends when writes exceed 1.5x average
- Identifies decreasing trends when writes fall below 0.5x average
- Gracefully handles edge cases such as zero values for all data points

✨ **Result:**
- Improved test coverage with 4 new dedicated test cases for `calculateKVTrend`.
- Verified deterministic pure function behaviors mapping accurately to requirements.
