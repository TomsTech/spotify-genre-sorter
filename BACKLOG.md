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

### ✅ 16. Fix Broken Embedded Images/Links
**Status:** DONE
**Priority:** P0 - Fixed

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

### ✅ 17. Add Link/Image Validation to CI Pipeline
**Status:** DONE
**Priority:** P0 - Fixed

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

### ✅ 18. Progressive Loading for Unlimited Library Sizes
**Status:** DONE
**Priority:** P1 - Implemented

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

### ✅ 1. Real-time GitHub Deployment Monitor
**Status:** DONE
**Priority:** P1 - Implemented

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

### ✅ 2. Progress Indicator for Large Libraries
**Status:** DONE (implemented in #18)
**Priority:** P2 - Implemented

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

### ✅ 9. Duplicate Playlist Detection
**Status:** DONE
**Priority:** P2 - Implemented

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

### ✅ 10. More Swedish Easter Eggs
**Status:** DONE
**Priority:** P3 - Implemented

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

### ✅ 11. Extract Embedded HTML/CSS/JS
**Status:** DONE
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

### ✅ 12. Add More Unit Tests
**Status:** DONE
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

### ✅ 13. Add E2E Tests
**Status:** DONE
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

### ✅ 14. API Documentation
**Status:** DONE
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

### ✅ 15. Architecture Diagram
**Status:** DONE (already in README)
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

## ⏳ New Issues from Testing

### ✅ 19. Fix Version/Release Management
**Status:** DONE
**Priority:** P1 - Critical for traceability

```
PROBLEM:
Versions and releases are not being pushed with proper version numbers.
This causes:
- Incorrect versioning on GitHub releases
- App showing v1.1 instead of current version
- No clear changelog/patch history mermaid diagram

ROOT CAUSE:
1. Version in src/index.ts not updated before tagging
2. Tags created but not pushed to remote
3. No automated version bump in CI
4. No changelog generation from commits

FILES TO MODIFY:
- src/index.ts (APP_VERSION constant)
- package.json (version field)
- .github/workflows/release.yml
- README.md (add mermaid changelog)

REQUIREMENTS:
1. Ensure APP_VERSION in src/index.ts matches package.json
2. Add pre-release hook to sync versions:
   - Extract version from package.json
   - Update APP_VERSION in src/index.ts automatically
3. Update release workflow to:
   - Bump version in both files
   - Generate changelog from conventional commits
   - Create annotated tag with changelog
   - Push tag to remote
4. Add mermaid diagram to README showing version history:
   ```mermaid
   gitGraph
     commit id: "v1.0.0"
     commit id: "v1.1.0"
     commit id: "v1.2.0"
     commit id: "v1.2.1"
   ```
5. Auto-generate changelog.md from git-cliff

VALIDATION:
- [ ] npm run build succeeds
- [ ] Version in UI matches package.json
- [ ] git tag -l shows all versions
- [ ] GitHub releases page shows correct versions
- [ ] Mermaid diagram renders in README
```

### ✅ 20. Interactive Changelog Timeline in Deploy Widget
**Status:** DONE
**Priority:** P2 - UX Enhancement

```
PROBLEM:
Deploy widget shows version but no history/context.
Users can't see what changed between versions.

IMPLEMENTATION:
Add clickable changelog timeline that expands on widget click.

FILES TO MODIFY:
- src/index.ts (deployment widget section)
- src/routes/api.ts (add /api/changelog endpoint)

REQUIREMENTS:
1. Store changelog data in KV:
   - Key: changelog
   - Value: JSON array of { version, date, changes[] }

2. Add /api/changelog endpoint:
   - Returns last 10 versions with changes
   - Include commit hashes for linking

3. Update deploy widget UI:
   - On click: expand to show timeline
   - Show version → date → bullet points
   - Link each version to GitHub release
   - Smooth expand/collapse animation

4. Timeline design:
   - Vertical timeline with version dots
   - Latest version at top
   - Click version to expand changes
   - "View all on GitHub" link at bottom

5. Swedish mode translations

VALIDATION:
- [ ] Widget expands on click
- [ ] Shows version history
- [ ] Links work to GitHub releases
- [ ] Swedish translations present
- [ ] Smooth animation
```

### ✅ 21. Smooth Progressive Loading UX
**Status:** DONE
**Priority:** P1 - User Experience

```
PROBLEM:
Loading between chunks looks like progress is lost.
Each chunk appears to reset, not accumulate.
Not a smooth, continuous loading experience.

CURRENT BEHAVIOUR:
- Chunk loads → genres display
- Next chunk starts → feels like reset
- No visual continuity between chunks

DESIRED BEHAVIOUR:
- Single progress bar fills continuously
- Genre cards accumulate smoothly
- No visual "reset" between chunks
- Clear indication of total progress

FILES TO MODIFY:
- src/index.ts (progressive loading UI)
- src/frontend/app.js (if extracted)

REQUIREMENTS:
1. Unified progress bar:
   - Show "Loading tracks: 500/2500 (20%)"
   - Single bar that fills across ALL chunks
   - Never resets, only increases

2. Genre card accumulation:
   - Keep existing cards visible
   - New genres slide in smoothly
   - Update existing genre counts in place
   - Sort animation for reordering

3. Loading state persistence:
   - Store partial results in memory
   - Merge new chunk with existing
   - Update counts without full re-render

4. Visual feedback:
   - Pulsing glow on loading cards
   - "Loading more..." indicator
   - Disable actions during load
   - Success animation on complete

5. Error recovery:
   - If chunk fails, show retry for that chunk
   - Don't lose already-loaded data
   - "Retry chunk 3/5" button

VALIDATION:
- [ ] Progress bar never resets
- [ ] Genre counts accumulate visibly
- [ ] Large library (2000+ tracks) loads smoothly
- [ ] No jarring visual resets
- [ ] Error retry works for individual chunks
```

### ✅ 22. Theme Toggle Before Login
**Status:** DONE
**Priority:** P2 - Accessibility

```
PROBLEM:
Dark/light mode toggle only visible after Spotify login.
Users should be able to set theme preference immediately.
Dark mode should be default (easier on eyes).

CURRENT:
- Landing page has no theme toggle
- Toggle appears only after authentication
- No system preference detection on landing

DESIRED:
- Theme toggle visible on landing page
- Detect system preference (prefers-color-scheme)
- Dark mode as default if no preference
- Persist choice in localStorage before login

FILES TO MODIFY:
- src/index.ts (landing page HTML)

REQUIREMENTS:
1. Add theme toggle to landing page header:
   - Same design as authenticated header
   - Position: top-right corner
   - Icon: sun/moon toggle

2. System preference detection:
   - Check window.matchMedia('(prefers-color-scheme: dark)')
   - Listen for changes
   - Apply immediately on page load

3. Default to dark mode:
   - If no localStorage preference
   - If no system preference
   - Default: dark

4. Persist before login:
   - Store in localStorage: theme
   - Read on page load
   - Apply before render (prevent flash)

5. Carry preference through OAuth:
   - Preference survives login redirect
   - Same theme on return from Spotify

VALIDATION:
- [ ] Toggle visible on landing page
- [ ] System preference detected
- [ ] Dark mode is default
- [ ] Preference persists through login
- [ ] No white flash on dark mode load
```

### ✅ 23. Fix README Status Badge Image
**Status:** DONE
**Priority:** P2 - Professional appearance

```
PROBLEM:
README status badge shows hyperlink text instead of embedded image.
Unprofessional appearance on GitHub repo page.

ROOT CAUSE:
- Incorrect markdown syntax
- Missing alt text
- Or shields.io URL issue

FILES TO MODIFY:
- README.md

REQUIREMENTS:
1. Audit all badges in README:
   - GitHub stars badge
   - CI status badge
   - Deploy status badge
   - Any other badges

2. Fix markdown syntax:
   - Correct: ![Alt](https://img.shields.io/...)
   - Incorrect: [Alt](https://img.shields.io/...)

3. Test each badge URL:
   - Open in browser
   - Verify returns SVG image
   - Check for rate limiting

4. Add fallback images:
   - Static badge SVGs in /docs/badges/
   - Use if shields.io fails

5. Consider badge alternatives:
   - GitHub native badges where possible
   - Reduce external dependencies

VALIDATION:
- [ ] All badges render as images
- [ ] No raw URLs visible
- [ ] Badges load within 2 seconds
- [ ] Works in GitHub dark/light mode
```

### ✅ 24. Security Architecture Review
**Status:** DONE
**Priority:** P1 - Security

```
REVIEW AREAS:

1. OAuth Token Storage:
   - Are tokens encrypted in KV?
   - Session ID entropy sufficient?
   - Token refresh handling secure?

2. CORS Configuration:
   - Only allow required origins
   - No wildcard in production
   - Preflight handling correct?

3. Content Security Policy:
   - Review current CSP headers
   - Ensure no unsafe-inline where avoidable
   - Block unexpected script sources

4. Input Validation:
   - All user inputs sanitised?
   - SQL injection (N/A but check patterns)
   - XSS prevention in rendered content

5. Rate Limiting:
   - Per-IP rate limits?
   - Per-session rate limits?
   - Spotify API rate limit handling?

6. Secret Management:
   - No secrets in code
   - Secrets rotation plan
   - Minimum required permissions

7. Dependency Security:
   - npm audit clean?
   - Snyk findings addressed?
   - Outdated packages?

FILES TO REVIEW:
- src/index.ts (headers, sanitisation)
- src/lib/session.ts (token storage)
- src/routes/auth.ts (OAuth flow)
- src/routes/api.ts (input validation)
- package.json (dependencies)

REQUIREMENTS:
1. Document current security posture
2. Identify gaps
3. Create remediation tasks
4. Add security.md with threat model

VALIDATION:
- [ ] Security review document created
- [ ] All high-priority issues addressed
- [ ] npm audit shows 0 high/critical
- [ ] CSP headers verified
```

### ✅ 25. Operational Efficiency & Caching Review
**Status:** DONE
**Priority:** P2 - Performance

```
REVIEW AREAS:

1. KV Caching Strategy:
   - What's cached? (genres, sessions, user data)
   - TTL appropriate? (1 hour for genres)
   - Cache invalidation correct?
   - Cache hit rate tracking?

2. User Data Storage:
   - What user data stored in KV?
   - Is it necessary?
   - GDPR compliance?
   - Data retention policy?

3. API Call Efficiency:
   - Unnecessary Spotify API calls?
   - Batch operations used where possible?
   - Parallel requests where appropriate?

4. Bundle Size:
   - Current size of worker?
   - Dead code elimination?
   - Tree shaking working?

5. Cold Start Performance:
   - Time to first byte?
   - Initialisation overhead?

6. Memory Usage:
   - Large arrays in memory?
   - Streaming possible for large data?

FILES TO REVIEW:
- src/routes/api.ts (caching logic)
- src/lib/session.ts (session storage)
- src/lib/spotify.ts (API efficiency)
- wrangler.toml (KV configuration)

REQUIREMENTS:
1. Document current caching strategy
2. Measure cache hit rates
3. Review user data storage necessity
4. Optimise API call patterns
5. Add cache metrics to /health endpoint

VALIDATION:
- [ ] Cache strategy documented
- [ ] Unnecessary data storage removed
- [ ] API calls minimised
- [ ] Health endpoint shows cache metrics
```

### ✅ 26. High Availability During Deployments
**Status:** DONE
**Priority:** P1 - Reliability

```
PROBLEM:
Need zero-downtime deployments.
Current pipeline deploys to production directly.

REVIEW AREAS:

1. Blue-Green Deployment:
   - Is staging worker used correctly?
   - Health checks before traffic switch?
   - Rollback mechanism?

2. DNS Cutover:
   - TTL appropriate for fast rollback?
   - CNAME vs A record implications?
   - Cloudflare proxy settings?

3. KV Data Compatibility:
   - Schema changes handled?
   - Old sessions work with new code?
   - Migration strategy?

4. Graceful Degradation:
   - Spotify API down → what happens?
   - KV down → what happens?
   - Partial failures handled?

5. Health Check Coverage:
   - /health endpoint comprehensive?
   - Checks Spotify connectivity?
   - Checks KV connectivity?

FILES TO REVIEW:
- .github/workflows/deploy.yml
- src/index.ts (/health endpoint)

REQUIREMENTS:
1. Review current deployment pipeline
2. Add comprehensive health checks
3. Implement proper blue-green with health gates
4. Add rollback automation
5. Document incident response

VALIDATION:
- [ ] Zero-downtime deployment tested
- [ ] Health checks pass before traffic switch
- [ ] Rollback completes in <1 minute
- [ ] Graceful degradation works
```

### ✅ 27. BetterStack Monitoring Review
**Status:** DONE
**Priority:** P2 - Observability

```
CURRENT STATE:
Unknown what monitoring exists.
Need comprehensive monitoring strategy.

REQUIREMENTS:

1. Heartbeat Monitor:
   - Set up heartbeat endpoint
   - BetterStack cron checks every 1 minute
   - Alert on 3 consecutive failures

2. HTTP Status Monitoring:
   - Monitor /health endpoint
   - Track response times
   - Alert on >2s response time
   - Alert on non-200 status

3. Health Check Validation:
   - /health must verify:
     - Worker responsive
     - KV accessible
     - Spotify API reachable (cached check)
   - Return JSON with component status

4. Custom Metrics:
   - Track: requests/minute
   - Track: playlist creations
   - Track: error rate
   - Track: cache hit rate

5. Alerting Strategy:
   - Critical: Service down > 5 minutes
   - Warning: Error rate > 5%
   - Info: Deployment completed

6. Status Page:
   - Public status page URL
   - Show uptime history
   - Incident history

FILES TO CREATE/MODIFY:
- src/index.ts (/health endpoint enhancement)
- docs/monitoring.md (monitoring setup guide)

VALIDATION:
- [ ] BetterStack monitors configured
- [ ] /health returns comprehensive status
- [ ] Alerts trigger correctly (test)
- [ ] Status page accessible
```

---

*Last updated: 2025-12-01*
