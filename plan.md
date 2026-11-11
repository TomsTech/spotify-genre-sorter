1. **Explore & Analyze**:
   - The memory suggests: "When multiple separate functions frequently query the same rarely-changing array using `.find()` (which is O(N)), replace the local lookups or redundant local `Map` instantiations with a single globally cached `Map`. Instantiate this global `Map` once when the source data is updated, enabling O(1) lookups across all function calls without repeated allocation overhead."
   - `src/frontend/app.js` has multiple functions (`showCustomiseModal`, `createPlaylistWithOptions`, `createPlaylist`, `getAlbumArtForGenre`, `showArtistBreakdown`) using `genreData.genres.find(g => g.name === genreName)` or `genreData?.genres?.find(g => g.name === genreName)`.
2. **Apply Optimizations**:
   - Use `run_in_bash_session` to apply the changes via a node script (`patch_find.cjs`) onto `src/frontend/app.js`.
   - The patch will create a `globalGenreMap` (a `Map`) and a function `updateGlobalGenreMap(data)` that updates both `genreData` and `globalGenreMap`.
   - Replace assignments `genreData = ...` with `updateGlobalGenreMap(...)`.
   - Replace the 5 `.find()` calls in `app.js` with `globalGenreMap.get(genreName)` to achieve O(1) lookup. Include a comment with the "⚡ Bolt" persona.
   - Run `npm run build:frontend` to regenerate `src/generated/frontend.ts`.
3. **Verify Modifications**:
   - Execute `git diff` using `run_in_bash_session` to inspect the changes and verify they are correct and follow performance guidelines.
4. **Testing and Verification**:
   - Run tests `npm run test` and `npm run lint`.
5. **Update Journal**:
   - Add a journal entry in `.jules/bolt.md` documenting this learning using `write_file` or a bash `cat` redirect.
6. **Pre-commit Steps**:
   - Complete pre-commit steps to ensure proper testing, verification, review, and reflection are done.
7. **Submit**:
   - Execute `submit` with the appropriate branch, commit message, and description (conforming to the `⚡ Bolt:` persona).
