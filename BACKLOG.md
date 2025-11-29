# Spotify Genre Sorter - Backlog

> **How to use**: Copy any task below and paste it to Claude when you have spare credits.
> Each task is self-contained with context so Claude can pick it up immediately.

---

## Priority: High (User-Facing Features)

### 1. Genre Caching in KV
```
Implement genre caching in Cloudflare KV to reduce Spotify API calls.

Context:
- Currently we fetch all liked tracks + all artists on every /api/genres call
- This is slow for large libraries and hits Spotify rate limits
- Cache structure: user_genres_{spotify_user_id} -> { genres, timestamp, trackCount }
- Cache TTL: 1 hour (user can force refresh)
- Files: src/routes/api.ts, src/lib/session.ts

Requirements:
- Add cache check before fetching from Spotify
- Add "last updated" indicator in UI
- Add manual refresh button
- Invalidate cache when user creates a playlist (library changed)
```

### 2. Progress Indicator for Large Libraries
```
Add real-time progress indicator when fetching genres for large libraries.

Context:
- Users with 1000+ liked songs see a spinner for 30+ seconds with no feedback
- Spotify API is paginated (50 tracks per request)
- We already have onProgress callback in getAllLikedTracks()
- Files: src/index.ts (frontend), src/lib/spotify.ts, src/routes/api.ts

Requirements:
- Show "Loading tracks... 150/2000" style progress
- Show artist fetching progress separately
- Use Server-Sent Events (SSE) or polling for real-time updates
- Swedish translation for progress messages
```

### 3. Playlist Naming Customisation
```
Let users customise playlist names before creation.

Context:
- Currently hardcoded as "{genre} (from Likes)"
- Users might want different formats or prefixes
- Files: src/index.ts (UI), src/routes/api.ts

Requirements:
- Add template input: "{genre} - My Collection" etc
- Preview what playlists will be named
- Remember preference in localStorage
- Swedish translation support
```

---

## Priority: Medium (Quality of Life)

### 4. Genre Filtering/Exclusion
```
Allow users to filter or exclude certain genres from results.

Context:
- Some users have 100+ genres, many are obscure sub-genres
- Would be nice to hide/exclude unwanted genres
- Files: src/index.ts

Requirements:
- Add "hide" button next to each genre
- Hidden genres saved in localStorage
- "Show hidden" toggle
- Bulk actions: hide all with <5 tracks, etc
```

### 5. Dark/Light Theme Toggle
```
Add proper theme toggle (currently dark-only).

Context:
- App is dark theme only
- Some users prefer light mode
- CSS variables already set up for theming
- Files: src/index.ts (CSS section)

Requirements:
- Add theme toggle button in header
- Save preference in localStorage
- Respect system preference (prefers-color-scheme)
- Swedish mode should still apply its blue/yellow on top
```

### 6. Mobile Responsive Improvements
```
Improve mobile experience.

Context:
- Basic responsive CSS exists but not optimised
- Genre cards too small on mobile
- Buttons hard to tap
- Files: src/index.ts (CSS section)

Requirements:
- Larger touch targets (44px minimum)
- Better genre card layout on mobile
- Sticky header with user info
- Bottom sheet for bulk actions on mobile
```

---

## Priority: Low (Nice to Have)

### 7. Export/Import Genre Data
```
Let users export their genre analysis as JSON/CSV.

Context:
- Users might want to analyse their music taste externally
- Could be useful for sharing/comparison
- Files: src/index.ts, src/routes/api.ts

Requirements:
- Export button that downloads JSON with all genre data
- Include track details, not just IDs
- CSV option for spreadsheet users
```

### 8. Genre Statistics Dashboard
```
Add a stats view showing music taste analysis.

Context:
- Users love seeing data about their listening habits
- We already have all the data, just not visualised
- Files: src/index.ts

Requirements:
- Top 10 genres pie chart (use simple CSS, no libraries)
- "Diversity score" - how spread out genres are
- Average genres per track
- Most common artist
```

### 9. Duplicate Playlist Detection
```
Warn if a genre playlist already exists.

Context:
- Users might accidentally create duplicate playlists
- Spotify API can check existing playlists
- Files: src/lib/spotify.ts, src/routes/api.ts

Requirements:
- Before creating, check if "{genre} (from Likes)" exists
- Show warning with options: skip, rename, or overwrite
- Batch creation should handle this per-genre
```

### 10. More Swedish Easter Eggs
```
Add more Swedish-themed Easter eggs for Heidi.

Context:
- Heidi loves ancient history and Swedish culture
- Current: three crowns, viking ship, snus button
- Files: src/index.ts

Ideas to implement:
- Midsommar theme in June (flowers, maypole)
- Swedish Chef mode (Bork bork bork!)
- Random Swedish facts tooltip
- Dalahäst (Dala horse) cursor in Swedish mode
- ABBA lyrics in loading messages
- Fika break reminder after 25 mins of use
```

---

## Technical Debt

### 11. Extract Embedded HTML/CSS/JS
```
Refactor index.ts to separate concerns.

Context:
- index.ts is 1400+ lines with embedded HTML, CSS, and JS
- Makes editing difficult
- Files: src/index.ts

Requirements:
- Move CSS to separate file (inlined at build time)
- Move frontend JS to separate file
- Use build step to combine (esbuild plugin?)
- Keep single-file deployment benefit
```

### 12. Add More Unit Tests
```
Expand test coverage.

Context:
- Currently have basic tests for spotify.ts, session.ts, api.ts
- Missing edge cases and error paths
- Files: tests/

Requirements:
- Test retry logic with mocked failures
- Test session expiry handling
- Test Swedish mode translations
- Test bulk playlist creation with partial failures
- Aim for 80%+ coverage
```

### 13. Add E2E Tests
```
Add end-to-end tests with Playwright or similar.

Context:
- No E2E tests currently
- OAuth flow is tricky to test
- Could use mock Spotify API

Requirements:
- Test login flow (mocked OAuth)
- Test genre loading and display
- Test playlist creation
- Test Swedish mode toggle
- Run in CI
```

---

## Documentation

### 14. API Documentation
```
Create OpenAPI/Swagger documentation for the API.

Context:
- No formal API docs
- Would help if anyone forks the project
- Files: create new docs/api.md or openapi.yaml

Requirements:
- Document all endpoints
- Include request/response examples
- Document error codes
- Add to README
```

### 15. Architecture Diagram
```
Create visual architecture documentation.

Context:
- Flow is: User → CF Worker → GitHub/Spotify OAuth → KV
- Would help understanding
- Files: README.md or docs/

Requirements:
- Mermaid diagram in README
- Show OAuth flow
- Show data flow for genre analysis
- Show KV storage usage
```

---

## How to Use This File

When you have spare Claude credits, just:

1. Pick a task number
2. Copy the code block content
3. Paste to Claude with "implement this"
4. Claude will have full context to start immediately

Example prompt:
```
Implement task #1 from my BACKLOG.md - Genre Caching in KV
```

---

*Last updated: 2025-11-29*
