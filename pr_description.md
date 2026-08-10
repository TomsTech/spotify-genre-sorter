💡 **What:** Batched the concurrent subrequests (via chunking loops) in `getUserPlaylists` and `getPlaylistTracks` to a `CONCURRENCY_LIMIT` of 10.
🎯 **Why:** To prevent triggering Cloudflare Worker's 50 concurrent subrequest limits when a user has a lot of playlists/tracks to fetch.
📊 **Impact:** Reduces the number of concurrent active fetches, capping at 10 to ensure we don't exceed the environment quotas without severely regressing fetching performance.
🔬 **Measurement:** Using a mock test script for 5000 `getPlaylistTracks` requests simulated with 10ms network latency each, we limited the number of active fetches concurrently to a maximum of 10 instead of scaling up to 99 simultaneously.
