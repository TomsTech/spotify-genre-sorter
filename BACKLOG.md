# Spotify Genre Sorter - Backlog

> **Automated Implementation**: Run `/backlog all` or `/backlog 16-20` to implement tasks automatically.
> Each task includes validation steps for CI integration.

---

## Status Legend
- ✅ **DONE** - Implemented and deployed
- 🔄 **PARTIAL** - Started but incomplete
- ⏳ **PENDING** - Not started
- 🔥 **CRITICAL** - Blocking issue, fix ASAP

---

## ✅ Completed Tasks

### ✅ 0. Genre Caching in KV
**Status:** DONE (v1.2.0)
- Cache in KV with 1-hour TTL
- Refresh button in UI
- Invalidates on playlist creation

### ✅ 3. Playlist Naming Customisation
**Status:** DONE (v1.2.0)
- Template input with `{genre}` placeholder
- Saved in localStorage
- Preview in UI

### ✅ 4. Genre Filtering/Exclusion
**Status:** DONE (v1.2.0)
- Hide button per genre
- "Show hidden" toggle
- "Hide small genres" bulk action
- localStorage persistence

### ✅ 5. Dark/Light Theme Toggle
**Status:** DONE (v1.2.0)
- Toggle button in header
- System preference detection
- localStorage persistence
- Works with Swedish mode

### ✅ 6. Mobile Responsive Improvements
**Status:** DONE (v1.2.0)
- Larger touch targets
- Better card layout
- Toolbar improvements

### ✅ 7. Export/Import Genre Data
**Status:** DONE (v1.2.0)
- JSON export with full data
- CSV export for spreadsheets

### ✅ 8. Genre Statistics Dashboard
**Status:** DONE (v1.2.0)
- Top 10 bar chart
- Diversity score (Shannon index)
- Stats boxes

---

## 🔥 Critical Issues

### 🔥 16. Fix Broken Embedded Images/Links
**Status:** CRITICAL - Broken in last 5 deploys
**Priority:** P0 - Fix immediately

```
PROBLEM:
Multiple embedded images and links are returning 404s in production.
This has been broken for the last 5 deployments.
Shields.io badges, GitHub avatars, and other external resources failing intermittently.

AFFECTED RESOURCES (verify each):
1. GitHub stars badge: img.shields.io/github/stars/TomsTech/spotify-genre-sorter
2. Uptime badge: img.shields.io/badge/uptime-100%25-1DB954
3. GitHub avatar URLs in deployment widget
4. Any other src="" attributes in index.ts

ROOT CAUSE INVESTIGATION:
- Check if URLs are correctly encoded (special chars like %)
- Check if shields.io rate limiting is occurring
- Check if GitHub API returns valid avatar URLs
- Check CSP headers aren't blocking external images

FILES TO MODIFY:
- src/index.ts (all img src attributes)
- src/routes/api.ts (if serving image URLs)

REQUIREMENTS:
1. Audit ALL external URLs in src/index.ts
2. Add fallback images for when external resources fail
3. Add onerror handlers: <img onerror="this.src='fallback.png'" ...>
4. Consider proxying external images through worker
5. Add loading="lazy" for non-critical images

VALIDATION:
- [ ] npm run build succeeds
- [ ] npm test passes
- [ ] All images load in browser (manual check)
- [ ] No 404s in browser console
- [ ] CSP headers don't block images
```

### 🔥 17. Add Link/Image Validation to CI Pipeline
**Status:** CRITICAL - Prevent future broken links
**Priority:** P0 - Must accompany #16

```
PROBLEM:
No automated validation that embedded URLs are valid.
Broken images ship to production repeatedly.

IMPLEMENTATION:
Add a CI job that extracts and validates all URLs before deployment.

FILES TO CREATE/MODIFY:
- .github/workflows/ci.yml (add new job)
- scripts/validate-links.mjs (new script)

REQUIREMENTS:
1. Create scripts/validate-links.mjs:
   - Parse src/index.ts for all URLs (regex: https?://[^\s"'<>]+)
   - HEAD request each URL to verify 200 response
   - Allow configurable whitelist for known-flaky URLs
   - Exit 1 if any critical URL fails

2. Add CI job in ci.yml:
   - name: Validate embedded links
   - runs-after: build
   - runs: node scripts/validate-links.mjs
   - allow-failure: false (blocks deployment)

3. Create .link-whitelist.json for URLs that may flake:
   - shields.io (rate limited sometimes)
   - GitHub avatars (dynamic)

VALIDATION:
- [ ] scripts/validate-links.mjs exists and is executable
- [ ] Running it locally shows all URLs checked
- [ ] CI workflow includes link validation step
- [ ] Intentionally breaking a URL causes CI failure
```

---

## ⏳ Pending High Priority

### ⏳ 18. Progressive Loading for Unlimited Library Sizes
**Status:** PENDING - Architectural improvement
**Priority:** P1 - Enables large libraries

```
PROBLEM:
Cloudflare Workers free tier has 50 subrequest limit.
Users with >1000 tracks hit "Too many subrequests" error.
Current workaround limits to 1000 tracks (truncated).

ARCHITECTURE:
Client-side progressive loading across multiple requests.
Each request stays under 50 subrequests.

FILES TO MODIFY:
- src/routes/api.ts (add /api/genres/chunk endpoint)
- src/index.ts (add progressive loading UI)
- src/lib/spotify.ts (add chunked fetching)

NEW API ENDPOINT:
GET /api/genres/chunk?offset=0&limit=500

Response:
{
  "chunk": {
    "genres": [...],
    "trackCount": 500
  },
  "pagination": {
    "offset": 0,
    "limit": 500,
    "hasMore": true,
    "nextOffset": 500,
    "totalInLibrary": 2500
  },
  "progress": 20
}

REQUIREMENTS:
1. Add /api/genres/chunk endpoint:
   - Accept offset and limit query params
   - Fetch only requested track range
   - Get artists only for those tracks
   - Return pagination metadata
   - Stay under 50 subrequests (~15 track + ~15 artist calls)

2. Update frontend:
   - Add loadGenresProgressively() function
   - Show progress bar during loading
   - Merge genres from each chunk
   - Handle errors gracefully (retry individual chunks)
   - Remove "truncated" warning once complete

3. Add chunk caching:
   - Cache each chunk in KV: genre_chunk_{userId}_{offset}
   - Merge cached chunks on subsequent loads
   - Show "cached" indicator per chunk

SUBREQUEST BUDGET PER CHUNK (limit=500):
- Get 500 tracks: 10 requests (50 per page)
- Get ~200 artists: 4 requests (50 per batch)
- Get user info: 1 request
- Total: ~15 requests (well under 50)

VALIDATION:
- [ ] /api/genres/chunk endpoint exists
- [ ] Returns correct pagination metadata
- [ ] Progress bar shows in UI during load
- [ ] Large library (2000+ tracks) loads fully
- [ ] Each chunk request stays under 50 subrequests
- [ ] Cached chunks load instantly
```

### 🔄 1. Real-time GitHub Deployment Monitor
**Status:** PARTIAL - Polls but needs progress indicator
**Priority:** P1 - UX improvement

```
CURRENT STATE:
- Widget exists in top-right
- Shows version and polls every 10s
- Detects version mismatch

MISSING:
- Active deployment progress (step name, percentage)
- Circular progress indicator during deploy
- Author avatar on idle state

FILES TO MODIFY:
- src/index.ts (deployment widget section)

REQUIREMENTS:
1. During active deployment:
   - Show circular progress spinner
   - Display current step name from GitHub API
   - Show "Deploying v1.2.3..." text

2. On idle:
   - Show last deploy time
   - Show deployer's GitHub avatar
   - Show "v1.2.3 • 2h ago by @user"

3. Use GitHub API:
   - GET /repos/{owner}/{repo}/actions/runs?status=in_progress
   - Parse workflow run steps for progress

VALIDATION:
- [ ] Widget shows progress during deployment
- [ ] Circular spinner animates
- [ ] Step names display correctly
- [ ] Avatar shows on idle state
```

### ⏳ 2. Progress Indicator for Large Libraries
**Status:** PENDING (superseded by #18 but still useful)
**Priority:** P2 - Enhanced after #18

```
PROBLEM:
Even with progressive loading, users see no feedback during each chunk.

REQUIREMENTS:
1. Show "Loading tracks... 150/2000" during fetch
2. Show artist fetching progress: "Fetching artists... 45/200"
3. Animate smoothly between steps
4. Swedish translations

This integrates with #18 Progressive Loading.

FILES TO MODIFY:
- src/index.ts (progress UI components)

VALIDATION:
- [ ] Progress text updates during load
- [ ] Numbers increment smoothly
- [ ] Swedish mode shows Swedish text
```

---

## ⏳ Pending Medium Priority

### ⏳ 9. Duplicate Playlist Detection
**Status:** PENDING
**Priority:** P2

```
PROBLEM:
Users accidentally create duplicate playlists.

IMPLEMENTATION:
Check existing playlists before creation.

FILES TO MODIFY:
- src/lib/spotify.ts (add getUserPlaylists function)
- src/routes/api.ts (check before create)
- src/index.ts (warning UI)

REQUIREMENTS:
1. Add getUserPlaylists() to spotify.ts:
   - GET /me/playlists
   - Return playlist names

2. Before playlist creation:
   - Check if "{genre} (from Likes)" exists
   - Return warning in API response

3. UI shows warning modal:
   - "A playlist named 'rock (from Likes)' already exists"
   - Options: Skip, Rename, Create Anyway

VALIDATION:
- [ ] API returns warning when duplicate detected
- [ ] UI shows warning modal
- [ ] Skip/Rename/Create options work
- [ ] Bulk create handles per-genre
```

### ⏳ 10. More Swedish Easter Eggs
**Status:** PENDING
**Priority:** P3 - Fun feature

```
IDEAS:
- Midsommar theme in June (flowers, maypole)
- Swedish Chef mode ("Bork bork bork!")
- Random Swedish facts tooltip
- Dalahäst cursor in Swedish mode
- ABBA lyrics in loading messages
- Fika break reminder after 25 mins

FILES TO MODIFY:
- src/index.ts

REQUIREMENTS:
1. Add date check for June → Midsommar theme
2. Add Swedish facts array, show random on hover
3. Add cursor: url(dalahast.cur) in Swedish mode CSS
4. Add ABBA quotes to loading messages array
5. Add 25-minute timer → "Dags för fika!" popup

VALIDATION:
- [ ] Each easter egg triggers correctly
- [ ] Doesn't break normal functionality
- [ ] Fika reminder can be dismissed
```

---

## ⏳ Pending Low Priority

### ⏳ 11. Extract Embedded HTML/CSS/JS
**Status:** PENDING
**Priority:** P3 - Technical debt

```
PROBLEM:
src/index.ts is 2500+ lines with embedded HTML, CSS, and JS.
Hard to maintain and edit.

IMPLEMENTATION:
Separate into files, combine at build time.

FILES TO CREATE:
- src/frontend/index.html
- src/frontend/styles.css
- src/frontend/app.js
- scripts/build-frontend.mjs

REQUIREMENTS:
1. Extract HTML template to index.html
2. Extract CSS to styles.css
3. Extract JS to app.js
4. Build script combines and inlines them
5. Output goes to src/generated/frontend.ts
6. index.ts imports from generated

VALIDATION:
- [ ] npm run build succeeds
- [ ] Output identical to current embedded version
- [ ] Hot reload works in dev
- [ ] No increase in bundle size
```

### ⏳ 12. Add More Unit Tests
**Status:** PENDING
**Priority:** P3 - Quality

```
CURRENT COVERAGE:
- spotify.ts: Basic tests
- session.ts: Basic tests
- api.ts: Response format tests
- frontend.test.ts: UI logic tests

MISSING:
- Retry logic with mocked failures
- Session expiry handling
- Token refresh edge cases
- Bulk playlist partial failures
- Rate limiting behaviour

FILES TO MODIFY:
- tests/*.test.ts

REQUIREMENTS:
1. Add tests for fetchWithRetry():
   - 429 response triggers retry
   - 500 response triggers retry
   - Retry-After header respected
   - Max retries exhausted

2. Add tests for session refresh:
   - Token refresh on expiry
   - Refresh token missing
   - Refresh fails → logout

3. Add tests for bulk playlist:
   - Partial failures handled
   - Results array correct

VALIDATION:
- [ ] npm test passes
- [ ] Coverage > 80%
- [ ] All edge cases covered
```

### ⏳ 13. Add E2E Tests
**Status:** PENDING
**Priority:** P4 - Nice to have

```
IMPLEMENTATION:
Add Playwright tests with mocked OAuth.

FILES TO CREATE:
- tests/e2e/login.spec.ts
- tests/e2e/genres.spec.ts
- tests/e2e/playlist.spec.ts
- playwright.config.ts

REQUIREMENTS:
1. Mock Spotify OAuth responses
2. Test login flow
3. Test genre loading
4. Test playlist creation
5. Test Swedish mode toggle
6. Run in CI

VALIDATION:
- [ ] npx playwright test passes
- [ ] CI runs E2E tests
- [ ] Tests don't require real Spotify account
```

### ⏳ 14. API Documentation
**Status:** PENDING
**Priority:** P4

```
CREATE:
- docs/api.md or openapi.yaml

REQUIREMENTS:
1. Document all endpoints
2. Request/response examples
3. Error codes
4. Auth requirements
5. Add link to README

VALIDATION:
- [ ] docs/api.md exists
- [ ] All endpoints documented
- [ ] Examples are accurate
```

### ⏳ 15. Architecture Diagram
**Status:** PENDING
**Priority:** P4

```
CREATE:
- Mermaid diagram in README

REQUIREMENTS:
1. Show OAuth flow
2. Show data flow
3. Show KV usage
4. Show Spotify API calls

VALIDATION:
- [ ] Diagram renders in GitHub
- [ ] Accurately represents system
```

---

## Automation Command

Run tasks automatically with the `/backlog` command:

```bash
# Implement single task
/backlog 16

# Implement range
/backlog 16-18

# Implement specific tasks
/backlog 16,17,18

# Implement ALL pending tasks
/backlog all
```

The command will:
1. Parse task numbers from BACKLOG.md
2. Skip already-completed tasks (✅)
3. Implement each task following requirements
4. Run validation checks
5. Commit changes
6. Update this file to mark complete
7. Continue to next task without interaction

---

## Task Dependencies

```
#16 (Fix Images) ──┐
                   ├──► #17 (CI Validation) ──► Can deploy safely
#18 (Progressive) ─┴──► #2 (Progress UI) ──► #1 (Deploy Monitor)

#11 (Extract Files) ──► Makes all other UI tasks easier

#9 (Duplicates) ──► Standalone

#10 (Easter Eggs) ──► Fun, do whenever
```

---

*Last updated: 2025-12-01*
