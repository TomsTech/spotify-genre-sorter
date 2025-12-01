# Spotify Genre Sorter - Backlog

> **v2.0 Release Scope** - Major feature expansion

---

## Effort Legend
- **XS** = Trivial (< few lines)
- **S** = Small (single file, straightforward)
- **M** = Medium (multiple files, some complexity)
- **L** = Large (significant feature, testing needed)
- **XL** = Extra Large (architectural change, multiple systems)

## Priority Legend
- **P0** = Critical (blocking/broken)
- **P1** = High (core functionality)
- **P2** = Medium (important enhancement)
- **P3** = Low (nice to have)
- **P4** = Backlog (future consideration)

---

## v1.x Completed Tasks ✅

<details>
<summary>Click to expand completed tasks from v1.0-v1.4</summary>

- ✅ Genre caching in KV (v1.2.0)
- ✅ Playlist naming customisation (v1.2.0)
- ✅ Genre filtering/exclusion (v1.2.0)
- ✅ Dark/light theme toggle (v1.2.0)
- ✅ Mobile responsive improvements (v1.2.0)
- ✅ Export/import genre data (v1.2.0)
- ✅ Genre statistics dashboard (v1.2.0)
- ✅ Progressive loading for large libraries (v1.2.1)
- ✅ Real-time deployment monitor (v1.3.0)
- ✅ Duplicate playlist detection (v1.3.0)
- ✅ Swedish Easter eggs (v1.0.0)
- ✅ Hall of Fame (first 10 users) (v1.0.0)
- ✅ Security headers & CSP (v1.1.0)
- ✅ Keyboard shortcuts (v1.4.0)
- ✅ Accessibility improvements (v1.4.0)
- ✅ PDF documentation (v1.3.0)

</details>

---

## v2.0 Key Decisions ✅

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **App Name** | Genre Genie ✨ | Playful, memorable, magic theme |
| **Loading Animation** | Actual album art | Personal touch, uses user's real tracks |
| **Recent Playlists Feed** | Public | Anyone can see, encourages discovery |
| **Implementation** | Full v2.0 | All 25 tasks in sprint order |

---

## v2.0 Backlog

### 🔧 Bug Fixes & Polish

#### 28. Light Mode Accessibility Fix
**Priority:** P0 | **Effort:** S | **Status:** ⏳ PENDING

```
PROBLEM:
Light mode has poor text contrast - users report they "can't read anything".
Multiple elements invisible or hard to see.

ROOT CAUSE:
- --text-muted too light (#6c757d)
- --surface-2 and --bg too similar
- Missing borders on cards/buttons
- Some elements don't adapt to light mode

FILES TO MODIFY:
- src/frontend/styles.css (light mode CSS variables + specific overrides)

REQUIREMENTS:
1. Increase contrast for --text-muted (use #495057 or darker)
2. Add visible borders to cards, buttons, inputs in light mode
3. Ensure all interactive elements have visible focus states
4. Test WCAG AA compliance (4.5:1 contrast ratio)
5. Verify all components render correctly:
   - Genre cards
   - Stats boxes
   - Buttons (primary, secondary, ghost)
   - Search input
   - Progress bars
   - Modals

VALIDATION:
- [ ] npm run build succeeds
- [ ] All text readable at 4.5:1 contrast
- [ ] No invisible elements
- [ ] Feature parity with dark mode
```

---

#### 29. Theme Toggle Position Consistency
**Priority:** P1 | **Effort:** XS | **Status:** ⏳ PENDING

```
PROBLEM:
Sun/moon theme toggle moves from top header (pre-login) to middle
cache-status area (post-login). Inconsistent UX.

CURRENT BEHAVIOUR:
- Pre-login: Theme toggle in #header-actions (top right)
- Post-login: Theme toggle moves to .cache-status (middle)

DESIRED:
- Theme toggle ALWAYS in header, same position
- User info appears next to it after login

FILES TO MODIFY:
- src/frontend/app.js (renderHeaderUser function, ~line 571)

REQUIREMENTS:
1. Keep theme toggle in #header-actions always
2. Modify renderHeaderUser to ADD user info, not replace
3. Layout: [Theme Toggle] [Avatar] [Username] [Logout]

VALIDATION:
- [ ] Toggle stays in same position before/after login
- [ ] User info displays correctly after login
- [ ] Mobile responsive layout works
```

---

#### 30. Swedish Mode State Management Fix
**Priority:** P2 | **Effort:** M | **Status:** ⏳ PENDING

```
PROBLEM:
Toggling Swedish mode causes GUI/buttons/loading to enter "weird states".
Some elements don't update correctly, state inconsistencies.

SYMPTOMS:
- Donation button text may not update
- Loading messages may not change
- Stats labels may be wrong language
- Button states may be incorrect

ROOT CAUSE:
- State changes scattered across multiple functions
- No centralised mode switching
- Some elements not in the re-render cycle

FILES TO MODIFY:
- src/frontend/app.js (toggleSwedishMode and related functions)

REQUIREMENTS:
1. Create centralised applySwedishMode(enabled) function
2. Move ALL Swedish-specific updates into this function
3. Add state validation after toggle
4. Ensure these components update:
   - Donation button (durry ↔ snus)
   - All [data-i18n] elements
   - Loading messages
   - Stats labels
   - Button labels
   - Hall of Fame title
   - Placeholder text
5. Test toggle in all app states:
   - Welcome screen
   - Loading screen
   - Genre list screen
   - Results screen

VALIDATION:
- [ ] No visual glitches on toggle
- [ ] All text updates correctly
- [ ] State persists on reload
- [ ] Works in combination with light/dark mode
```

---

#### 31. Version Widget Reliability
**Priority:** P2 | **Effort:** S | **Status:** ⏳ PENDING

```
PROBLEM:
GitHub version widget "randomly disappears" and doesn't show release name.
Users want it always visible and drill-downable.

ISSUES:
1. Widget hidden when GitHub API fails/slow
2. No release name shown (just version number)
3. Not clear it's clickable

FILES TO MODIFY:
- src/frontend/app.js (updateDeployWidget, ~line 145)
- src/frontend/styles.css (widget styling)

REQUIREMENTS:
1. ALWAYS show widget (even if API fails)
2. Cache last known status in localStorage
3. Show release name from /api/changelog
4. Format: "v1.4.0 • Keyboard Shortcuts • 2h ago"
5. Add visual indicator that it's clickable (hover effect)
6. Fallback when offline: show cached version

VALIDATION:
- [ ] Widget visible on every page load
- [ ] Shows release name
- [ ] Clickable indication obvious
- [ ] Works offline (cached)
```

---

### 🏆 Leaderboard & Scoreboard System

#### 32. Expanded User Statistics Schema
**Priority:** P1 | **Effort:** M | **Status:** ⏳ PENDING

```
PROBLEM:
Current user tracking only stores basic info. Need to track:
- Genres discovered per user
- Artists analysed
- Tracks scanned
- Playlists created

NEW KV SCHEMA:
user_stats:{spotifyId} -> {
  spotifyId: string,
  spotifyName: string,
  spotifyAvatar: string,
  totalGenresDiscovered: number,
  totalArtistsDiscovered: number,
  totalTracksAnalysed: number,
  playlistsCreated: number,
  firstSeen: ISO string,
  lastActive: ISO string,
  createdPlaylistIds: string[]  // For future features
}

FILES TO MODIFY:
- src/routes/auth.ts (initialise stats on new user)
- src/routes/api.ts (update stats on genre fetch & playlist create)
- src/lib/session.ts (add helper functions)

REQUIREMENTS:
1. Update registerUser() to create initial stats
2. Update /api/genres to increment stats after analysis
3. Update /api/playlist to increment playlistsCreated
4. Add getUserStats(spotifyId) helper
5. Add updateUserStats(spotifyId, updates) helper

VALIDATION:
- [ ] New users get stats record
- [ ] Stats update on genre fetch
- [ ] Stats update on playlist creation
- [ ] Stats persist across sessions
```

---

#### 33. Scoreboard API Endpoint
**Priority:** P1 | **Effort:** M | **Status:** ⏳ PENDING

```
IMPLEMENTATION:
Create /api/scoreboard endpoint returning top users by category.

ENDPOINT: GET /api/scoreboard

RESPONSE:
{
  byGenres: [{ rank, spotifyId, spotifyName, spotifyAvatar, count }],
  byArtists: [...],
  byTracks: [...],
  byPlaylists: [...],
  totalUsers: number,
  updatedAt: ISO string
}

CACHING:
- Cache result in KV: scoreboard_cache
- TTL: 5 minutes
- Invalidate on significant changes

FILES TO CREATE/MODIFY:
- src/routes/api.ts (new endpoint)

REQUIREMENTS:
1. Create /api/scoreboard endpoint
2. Query all user_stats:* keys
3. Sort and rank by each category
4. Return top 20 per category
5. Cache results in KV
6. Add cache headers for browser caching

VALIDATION:
- [ ] Endpoint returns correct rankings
- [ ] Rankings update when stats change
- [ ] Cache works correctly
- [ ] Performance acceptable (<500ms)
```

---

#### 34. Leaderboard API Endpoint
**Priority:** P1 | **Effort:** S | **Status:** ⏳ PENDING

```
IMPLEMENTATION:
Create /api/leaderboard endpoint returning pioneers + new users.

ENDPOINT: GET /api/leaderboard

RESPONSE:
{
  pioneers: [{ position, spotifyId, spotifyName, spotifyAvatar, joinedAt }],
  newUsers: [{ spotifyId, spotifyName, spotifyAvatar, joinedAt }],
  totalUsers: number
}

FILES TO MODIFY:
- src/routes/api.ts (new endpoint, can reuse existing /stats logic)

REQUIREMENTS:
1. Pioneers: First 10 users (from hof:* keys)
2. New Users: Last 10 registered (sorted by joinedAt desc)
3. Include avatar URLs for display

VALIDATION:
- [ ] Returns correct pioneers
- [ ] Returns recent users
- [ ] Avatars load correctly
```

---

#### 35. Left Sidebar UI Component
**Priority:** P1 | **Effort:** L | **Status:** ⏳ PENDING

```
IMPLEMENTATION:
Add left sidebar showing leaderboard, new users, recent playlists.

LAYOUT CHANGE:
+------------------+-------------------------+
|  LEFT SIDEBAR    |     MAIN CONTENT        |
|  (300px fixed)   |     (flex: 1)           |
|                  |                         |
|  🏆 Pioneers     |  [Current Content]      |
|  #1 @user ⭐     |                         |
|  #2 @user        |                         |
|  #3 @user        |                         |
|                  |                         |
|  👋 New Users    |                         |
|  @user - just now|                         |
|                  |                         |
|  🎵 Recent       |                         |
|  indie by @user  |                         |
|                  |                         |
+------------------+-------------------------+

FILES TO MODIFY:
- src/frontend/body.html (layout structure)
- src/frontend/styles.css (sidebar styles)
- src/frontend/app.js (sidebar logic)

REQUIREMENTS:
1. Create sidebar container in HTML
2. Fetch /api/leaderboard on load
3. Display pioneers with gold/silver/bronze styling
4. Display new users with "X ago" timestamps
5. Link to full scoreboard
6. Collapsible on mobile (hamburger or bottom sheet)
7. Smooth animations for updates

VALIDATION:
- [ ] Sidebar displays correctly
- [ ] Pioneers show with regalia
- [ ] New users update in real-time
- [ ] Mobile responsive (collapsible)
- [ ] No layout shift on load
```

---

#### 36. Scoreboard Modal/Page
**Priority:** P2 | **Effort:** M | **Status:** ⏳ PENDING

```
IMPLEMENTATION:
Full scoreboard view with all categories.

UI DESIGN:
+-----------------------------------------------+
|  🏆 Scoreboard                           [X]  |
+-----------------------------------------------+
| [Genres] [Artists] [Tracks] [Playlists]       |
+-----------------------------------------------+
|  #1  👤 @username     1,234 genres            |
|  #2  👤 @username       987 genres            |
|  #3  👤 @username       654 genres            |
|  ...                                          |
|  #15 👤 YOU ⭐          123 genres            |
+-----------------------------------------------+

FILES TO MODIFY:
- src/frontend/app.js (scoreboard modal)
- src/frontend/styles.css (scoreboard styles)

REQUIREMENTS:
1. Tab navigation for categories
2. Top 20 per category
3. Highlight current user's position
4. Profile pics + names
5. Smooth animations
6. Swedish translations

VALIDATION:
- [ ] All categories display
- [ ] Current user highlighted
- [ ] Animations smooth
- [ ] Swedish mode works
```

---

### 🎵 Recent Playlists Feed

#### 37. Recent Playlists KV Storage
**Priority:** P2 | **Effort:** S | **Status:** ⏳ PENDING

```
IMPLEMENTATION:
Store recently created playlists for social feed.

KV SCHEMA:
recent_playlists -> [
  {
    playlistId: string,
    playlistName: string,
    genre: string,
    trackCount: number,
    createdBy: { spotifyId, spotifyName, spotifyAvatar },
    createdAt: ISO string,
    spotifyUrl: string
  }
] (max 20 entries, FIFO)

FILES TO MODIFY:
- src/routes/api.ts (update POST /api/playlist)

REQUIREMENTS:
1. After playlist creation, add to recent_playlists
2. Keep max 20 entries (remove oldest)
3. Include all display data
4. Handle race conditions (use KV atomic operations)

VALIDATION:
- [ ] Playlists added to feed
- [ ] Max 20 entries maintained
- [ ] Data structure correct
```

---

#### 38. Recent Playlists API Endpoint
**Priority:** P2 | **Effort:** XS | **Status:** ⏳ PENDING

```
ENDPOINT: GET /api/recent-playlists

RESPONSE:
{
  playlists: [
    {
      playlistId: "...",
      playlistName: "indie (from Likes)",
      genre: "indie",
      trackCount: 42,
      createdBy: { spotifyId, spotifyName, spotifyAvatar },
      createdAt: "2025-12-02T10:30:00Z",
      spotifyUrl: "https://open.spotify.com/playlist/..."
    }
  ]
}

FILES TO MODIFY:
- src/routes/api.ts

VALIDATION:
- [ ] Returns recent playlists
- [ ] Correct format
- [ ] Auth not required (public feed)
```

---

#### 39. Recent Playlists UI Component
**Priority:** P2 | **Effort:** M | **Status:** ⏳ PENDING

```
IMPLEMENTATION:
Display recent playlists in left sidebar with auto-refresh.

UI:
🎵 Recent Playlists
┌─────────────────────────┐
│ 🎸 indie                │
│ by @username • just now │
│ [Save]                  │
├─────────────────────────┤
│ 🎤 pop                  │
│ by @otheruser • 5m ago  │
│ [Save]                  │
└─────────────────────────┘

FILES TO MODIFY:
- src/frontend/app.js
- src/frontend/styles.css

REQUIREMENTS:
1. Poll /api/recent-playlists every 30 seconds
2. Animate new entries sliding in
3. Show genre emoji + name
4. Show creator avatar + name
5. "Save" button opens Spotify follow URL
6. Smooth scroll for new entries

VALIDATION:
- [ ] Feed updates automatically
- [ ] New entries animate in
- [ ] Save button works
- [ ] No memory leaks from polling
```

---

### 🎬 Loading Experience Overhaul

#### 40. Vinyl/Album Flip Animation
**Priority:** P2 | **Effort:** L | **Status:** ⏳ PENDING

```
PROBLEM:
Current loading UX is functional but not engaging.
User wants vinyl/album art flipping animation.

CONCEPT:
- Album covers flip like a Rolodex
- Genre names cycle below
- Smooth 3D flip effect

IMPLEMENTATION OPTIONS:
A) Use actual album art from track data
   - Pro: Personalised
   - Con: Need to extract during load

B) Generic vinyl/record images
   - Pro: Simpler, consistent
   - Con: Less personal

C) CSS-only abstract animation
   - Pro: Fast, no images needed
   - Con: Less visually interesting

FILES TO MODIFY:
- src/frontend/app.js (renderProgressLoading)
- src/frontend/styles.css (animation keyframes)

REQUIREMENTS:
1. Create flipAnimation component
2. Cycle through genre names during load
3. Smooth 3D CSS transforms
4. Show album art if available
5. Fallback to vinyl graphic

CSS ANIMATION SKETCH:
@keyframes vinylFlip {
  0% { transform: rotateY(0deg); }
  50% { transform: rotateY(90deg); }
  100% { transform: rotateY(0deg); }
}

VALIDATION:
- [ ] Animation smooth (60fps)
- [ ] Genre names cycle
- [ ] Works on mobile
- [ ] Doesn't block loading
```

---

#### 41. Dynamic Completion Messages
**Priority:** P3 | **Effort:** S | **Status:** ⏳ PENDING

```
IMPLEMENTATION:
Generate funny/personalised message based on user's top genres.

MESSAGES BY GENRE:
{
  'rock': "You're a certified rockstar! 🎸",
  'pop': "Pop goes your playlist! 🎤",
  'hip hop': "Straight outta your library! 🎧",
  'electronic': "You've got the beats! 🎹",
  'metal': "Heavy metal thunder! 🤘",
  'indie': "Too cool for mainstream! 🎪",
  'jazz': "Smooth as butter! 🎷",
  'classical': "A person of culture! 🎻",
  'country': "Yeehaw! 🤠",
  'k-pop': "Annyeonghaseyo! 🇰🇷",
  'default': "Your taste is uniquely yours! ✨"
}

FILES TO MODIFY:
- src/frontend/app.js

REQUIREMENTS:
1. Analyse top 3 genres after load complete
2. Select appropriate message
3. Display with celebration animation
4. Add Swedish translations

VALIDATION:
- [ ] Message relevant to top genres
- [ ] Swedish translations work
- [ ] Displays after load complete
```

---

#### 42. Celebration Animation
**Priority:** P3 | **Effort:** M | **Status:** ⏳ PENDING

```
IMPLEMENTATION:
Confetti/fireworks animation on load complete.

OPTIONS:
A) CSS-only particles
B) Canvas-based confetti (e.g., canvas-confetti)
C) SVG animation

RECOMMENDED: CSS-only for simplicity

FILES TO MODIFY:
- src/frontend/styles.css
- src/frontend/app.js

REQUIREMENTS:
1. Trigger on 100% load complete
2. ~2 second duration
3. Colours match theme (Spotify green, Swedish blue/yellow)
4. Smooth transition to results view
5. Respects prefers-reduced-motion

VALIDATION:
- [ ] Animation triggers correctly
- [ ] Doesn't block interaction
- [ ] Respects reduced motion preference
- [ ] Theme-appropriate colours
```

---

### 📝 Playlist Creation UX

#### 43. Enhanced Playlist Create Modal
**Priority:** P2 | **Effort:** L | **Status:** ⏳ PENDING

```
CURRENT:
Single "Create" button, no customisation before creation.

DESIRED:
Modal with preview and customisation options.

UI:
+----------------------------------------+
|  Create "emo" Playlist              [X] |
+----------------------------------------+
|  🖤 Title:                              |
|  [Emo (from Likes)           ]          |
|                                         |
|  📝 Description:                        |
|  [Your emo tracks since 2019 from...]   |
|                                         |
|  🖼️ Cover: [Upload] [URL] [Default]     |
|  [Preview Image]                        |
|                                         |
|  ℹ️ 42 tracks will be added             |
|                                         |
|  [Cancel]         [Create Playlist]     |
+----------------------------------------+

FILES TO MODIFY:
- src/frontend/app.js (new modal component)
- src/frontend/styles.css (modal styles)
- src/routes/api.ts (accept description/cover)

REQUIREMENTS:
1. Modal opens on "Create" click
2. Pre-fill title with template
3. Editable description with smart default
4. Optional cover image (URL or upload)
5. Track count preview
6. Swedish translations

VALIDATION:
- [ ] Modal opens correctly
- [ ] Title customisable
- [ ] Description customisable
- [ ] Cover upload works
- [ ] Creates correct playlist
```

---

#### 44. Genre Merge Feature
**Priority:** P3 | **Effort:** L | **Status:** ⏳ PENDING

```
IMPLEMENTATION:
Allow selecting multiple genres and merging into one playlist.

UI:
1. Select multiple genres (existing checkbox system)
2. New button: "Merge Selected into One"
3. Opens modal with combined track list
4. Custom name: "Rock + Metal + Punk"

FILES TO MODIFY:
- src/frontend/app.js
- src/routes/api.ts (new endpoint or modify existing)

REQUIREMENTS:
1. Combine track IDs from selected genres
2. Deduplicate tracks
3. Custom playlist name
4. Description lists included genres
5. Show combined track count

VALIDATION:
- [ ] Tracks combined correctly
- [ ] No duplicates
- [ ] Description accurate
- [ ] Works with 2+ genres
```

---

#### 45. Custom Playlist Thumbnail
**Priority:** P3 | **Effort:** M | **Status:** ⏳ PENDING

```
IMPLEMENTATION:
Allow setting custom cover image before playlist creation.

SPOTIFY API:
PUT /playlists/{playlist_id}/images
Body: Base64 JPEG image (max 256KB)

UI:
- Upload button in create modal
- URL input option
- Preview before create
- Convert to base64 on client

FILES TO MODIFY:
- src/frontend/app.js (upload/preview logic)
- src/routes/api.ts (pass image to Spotify)
- src/lib/spotify.ts (add setPlaylistImage function)

REQUIREMENTS:
1. Accept image upload or URL
2. Validate size (<256KB) and format (JPEG)
3. Convert to base64
4. Send to Spotify after playlist creation
5. Preview in modal

VALIDATION:
- [ ] Upload works
- [ ] URL input works
- [ ] Preview displays
- [ ] Image appears on Spotify playlist
```

---

### 📊 Monitoring & Infrastructure

#### 46. BetterStack Monitor Configuration
**Priority:** P1 | **Effort:** M | **Status:** ⏳ PENDING

```
IMPLEMENTATION:
Configure BetterStack monitors using provided API tokens.

API TOKENS:
- Status Page: MKkrifmzXkVGfCaez6KHYQmy
- Telemetry: SXdEYrG5Y1jCNjdN11PKBiHe

10 MONITORS (FREE TIER):
1. Primary Health - GET /health (1 min)
2. Detailed Health - GET /health?detailed=true (5 min)
3. Stats Endpoint - GET /stats (5 min)
4. Session Check - GET /session (5 min)
5. Deploy Status - GET /deploy-status (5 min)
6. OAuth Redirect - GET /auth/spotify (10 min)
7. API Response - GET /api/changelog (5 min)
8. SSL Certificate - SSL expiry monitor
9. DNS Resolution - DNS check
10. Heartbeat - Custom heartbeat for cron jobs

FILES TO CREATE:
- docs/monitoring.md (setup guide)
- scripts/setup-betterstack.mjs (optional automation)

REQUIREMENTS:
1. Create monitors via BetterStack API
2. Configure alert thresholds
3. Set up status page
4. Document setup process
5. Add status page link to UI

VALIDATION:
- [ ] All monitors active
- [ ] Alerts working
- [ ] Status page accessible
- [ ] Documentation complete
```

---

#### 47. Uptime Badge Integration
**Priority:** P2 | **Effort:** XS | **Status:** ⏳ PENDING

```
IMPLEMENTATION:
Update uptime badge to link to BetterStack status page.

CURRENT:
Static badge linking to uptimerobot

DESIRED:
Dynamic badge from BetterStack status page

FILES TO MODIFY:
- src/frontend/app.js (renderWelcome function)

REQUIREMENTS:
1. Create BetterStack status page
2. Get badge embed URL
3. Replace current badge
4. Link to public status page

VALIDATION:
- [ ] Badge displays correctly
- [ ] Links to status page
- [ ] Status page shows real data
```

---

#### 48. Star Badge Prominence
**Priority:** P3 | **Effort:** XS | **Status:** ⏳ PENDING

```
IMPLEMENTATION:
Make GitHub star badge more noticeable as "thank you" option.

CURRENT:
Static badge, easy to miss

DESIRED:
- Pulsing glow on hover
- Tooltip: "Love this? Star us! ⭐"
- Slightly larger

FILES TO MODIFY:
- src/frontend/styles.css

REQUIREMENTS:
1. Add hover animation
2. Add tooltip
3. Increase size slightly
4. Position prominently

VALIDATION:
- [ ] Animation works
- [ ] Tooltip displays
- [ ] Not annoying/intrusive
```

---

### 📚 Documentation & DR

#### 49. Backup & Disaster Recovery Documentation
**Priority:** P1 | **Effort:** M | **Status:** ⏳ PENDING

```
IMPLEMENTATION:
Create comprehensive backup/DR documentation.

FILE: docs/backup-dr.md

CONTENTS:
1. KV Data Inventory
   - What data is stored
   - Criticality levels
   - Data ownership

2. Backup Strategy
   - Automated backup script
   - GitHub Actions workflow
   - Backup frequency
   - Retention policy

3. Restore Procedure
   - Step-by-step restore
   - Verification steps
   - Rollback plan

4. Recovery Objectives
   - RTO: 30 minutes
   - RPO: 1 week

5. DR Testing
   - Test schedule
   - Test procedure
   - Success criteria

6. Diagrams
   - Data flow diagram
   - Backup architecture
   - Recovery sequence

REQUIREMENTS:
1. Document all KV keys and purpose
2. Create backup script
3. Document restore process
4. Include Mermaid diagrams
5. Add testing checklist

VALIDATION:
- [ ] Documentation complete
- [ ] Backup script works
- [ ] Restore tested
- [ ] Diagrams render
```

---

#### 50. KV Backup Script
**Priority:** P2 | **Effort:** M | **Status:** ⏳ PENDING

```
IMPLEMENTATION:
Automated KV backup to GitHub or R2.

FILE: scripts/backup-kv.mjs

FUNCTIONALITY:
1. List all KV keys
2. Export values
3. Create timestamped backup
4. Push to backup location
5. Verify integrity

OPTIONS:
A) GitHub Repo (free, version controlled)
B) Cloudflare R2 (more storage, cost)
C) Both (redundancy)

GITHUB ACTION:
- Run weekly
- On-demand trigger
- Notification on failure

REQUIREMENTS:
1. Create backup script
2. Add GitHub workflow
3. Configure secrets
4. Add integrity checks
5. Document restore process

VALIDATION:
- [ ] Script exports all data
- [ ] Backup stored securely
- [ ] Restore works
- [ ] Workflow runs successfully
```

---

### 🎨 Branding & Polish

#### 51. Branding Decision
**Priority:** P3 | **Effort:** S | **Status:** ✅ DECIDED

```
DECISION: "Genre Genie ✨"

Playful, memorable, magic theme.

IMPLEMENTATION:
- Update page title to "Genre Genie ✨"
- Update meta tags
- Update README
- Update CLAUDE.md
- Update header text
- Add genie/magic styling
- Keep Swedish Easter egg (for Heidi)
```

---

#### 52. Favicon Update
**Priority:** P4 | **Effort:** S | **Status:** ⏳ PENDING

```
CURRENT:
Swedish-themed Spotify logo (blue/yellow gradient)

OPTIONS:
A) Keep Swedish theme (for Heidi)
B) New custom logo
C) Simple music note
D) Text-based logo

NOTE:
User expressed frustration with previous base64 favicon work.
Keep implementation simple.

FILES TO MODIFY:
- src/index.ts (favicon endpoints)

REQUIREMENTS:
1. Decide on design
2. Create SVG version
3. Generate PNG fallbacks
4. Update favicon endpoints
5. Test across browsers

VALIDATION:
- [ ] Favicon displays correctly
- [ ] Works in all browsers
- [ ] Matches branding
```

---

## Summary: v2.0 Scope

| Category | Tasks | Total Effort |
|----------|-------|--------------|
| Bug Fixes | 28-31 | S + XS + M + S = M |
| Leaderboard | 32-36 | M + M + S + L + M = XL |
| Recent Playlists | 37-39 | S + XS + M = M |
| Loading UX | 40-42 | L + S + M = L |
| Playlist UX | 43-45 | L + L + M = XL |
| Monitoring | 46-48 | M + XS + XS = M |
| Documentation | 49-50 | M + M = L |
| Branding | 51-52 | S + S = S |

**Total: ~25 tasks across 8 categories**

### Recommended Implementation Order

**Sprint 1: Foundation** (Tasks 28-31)
- Fix critical bugs first
- Establish stable base

**Sprint 2: Data Layer** (Tasks 32-34, 37-38)
- KV schema updates
- API endpoints

**Sprint 3: UI Components** (Tasks 35-36, 39)
- Sidebar implementation
- Scoreboard modal

**Sprint 4: Playlist Features** (Tasks 43-45)
- Enhanced create modal
- Genre merging

**Sprint 5: Loading Polish** (Tasks 40-42)
- Vinyl animation
- Celebration effects

**Sprint 6: Infrastructure** (Tasks 46-50)
- BetterStack setup
- Backup/DR

**Sprint 7: Finishing** (Tasks 51-52)
- Branding decisions
- Final polish

---

*Backlog updated: 2025-12-02*
*Target: v2.0.0 Release*
