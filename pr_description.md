🎯 What: Added tests for the `getUserPlaylists` function in `src/lib/spotify.ts` which was missing test coverage.
📊 Coverage: Added tests to ensure it correctly fetches a single page when under limit, correctly paginates and chunks concurrent requests, and successfully caps the total returned playlists to 200.
✨ Result: Increased test reliability and safety for refactoring `spotify.ts`.
