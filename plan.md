1. **Optimize `genreData.genres.find` in `src/frontend/app.js` to use a global map `genreMap`**
   - The file `src/frontend/app.js` has multiple calls to `genreData.genres.find(...)`, particularly inside functions like `showCustomiseModal`, `createPlaylistWithOptions`, `createPlaylist`, `getAlbumArtForGenre`, and `showArtistBreakdown`.
   - Also, `createPlaylistWithSelected` creates a new `genreMap` map and destroys it immediately. So do `updateMergeToolbar` and `showMergeModal`.
   - I will define `let globalGenreMap = null;` at the top of the file, around line 4 where `let genreData = null;` is defined.
   - When `genreData` is set/updated, I will update `globalGenreMap` with:
     `globalGenreMap = new Map(genreData?.genres?.map(g => [g.name, g]) || []);`
   - I will replace the instances of `genreData.genres.find` (or `genreData?.genres?.find`) and the local `genreMap` instantiation to use the new `globalGenreMap`.
   - This eliminates multiple `O(N)` loop finds (where `N` is the number of genres) and `O(N)` initializations of new `Map` instances in favor of one globally cached `Map` providing `O(1)` lookup.

2. **Add a performance comment**
   - In accordance with Bolt's persona, I will add an inline comment in `src/frontend/app.js` explaining the optimization.

3. **Complete pre-commit steps to ensure proper testing, verification, review, and reflection are done.**
   - Run `pnpm lint` and `pnpm test` via bash session.
   - Update `pnpm build:frontend` since `app.js` modifies generated files. Wait, `src/frontend/app.js` is part of `spotify-genre-sorter`. The built files must be generated using `npm run build:frontend`.

4. **Submit PR**
   - Title: `⚡ Bolt: Use global genreMap for O(1) genre lookups`
   - Description following the required format.
