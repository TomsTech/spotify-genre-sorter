# Spotify Genre Sorter - Feature Implementation Plan

> Comprehensive plan for all requested features

## Summary of Requested Features

### 1. Leaderboard & Hall of Fame Expansion
### 2. User Scoreboard with Persistent Stats
### 3. Loading UX Overhaul (Vinyl Animation)
### 4. Theme Toggle Consistency Fix
### 5. Swedish Mode State Management Fix
### 6. GitHub Version Widget Improvements
### 7. Star/Uptime Badge Improvements
### 8. BetterStack Monitoring Configuration
### 9. Favicon & Branding Update
### 10. Recently Created Playlists Section
### 11. Playlist Creation UX Overhaul
### 12. Light Mode Accessibility Fix
### 13. Backup/DR Documentation

---

## Detailed Implementation Plan

### Phase 1: Data Architecture (KV Schema)

**New KV Keys:**
```
# Hall of Fame (first 10 users - already exists)
hof:001, hof:002, ..., hof:010

# User Statistics (persistent)
user_stats:{spotifyId} -> {
  spotifyId: string,
  spotifyName: string,
  spotifyAvatar: string,
  totalGenresDiscovered: number,
  totalArtistsDiscovered: number,
  totalTracksAnalysed: number,
  playlistsCreated: number,
  firstSeen: ISO string,
  lastActive: ISO string
}

# Recent Playlists Feed (global)
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

# Scoreboard Cache (computed, TTL 5 min)
scoreboard_cache -> {
  byGenres: [{ spotifyId, spotifyName, spotifyAvatar, count }],
  byArtists: [...],
  byTracks: [...],
  byPlaylists: [...],
  updatedAt: ISO string
}
```

### Phase 2: Backend API Endpoints

**New Endpoints:**
```
GET /api/leaderboard
  - Returns: pioneers (first 10), newUsers (last 10), scoreboard

GET /api/scoreboard
  - Returns: top 20 by genres/artists/tracks/playlists

GET /api/recent-playlists
  - Returns: last 10 publicly created playlists

POST /api/playlist (MODIFY)
  - Add to recent_playlists feed after creation
  - Update user_stats on playlist creation
```

**Modify Existing:**
- `GET /api/genres` - Update user_stats after genre analysis
- `POST /api/playlist` - Record in recent_playlists feed
- `/auth/spotify/callback` - Initialize user_stats if new user

### Phase 3: Frontend - Left Sidebar

**Layout Change:**
```
+------------------+-------------------------+
|  LEFT SIDEBAR    |     MAIN CONTENT        |
|  (Leaderboard)   |                         |
|  - Pioneers      |  [Current Genre Grid]   |
|  - New Users     |                         |
|  - Recent        |                         |
|    Playlists     |                         |
+------------------+-------------------------+
```

**Components:**
1. **Pioneer Board** (first 10 users)
   - Gold/Silver/Bronze styling for #1/#2/#3
   - Profile pic + name + crown emoji
   - Joined date

2. **New Users Section**
   - Last 10 registered users
   - Profile pic + name + "just joined"

3. **Recent Playlists Feed**
   - Polls every 30 seconds
   - Shows: playlist emoji + genre + "by @user"
   - Click to save/follow playlist
   - Smooth scroll animation on new entry

4. **Scoreboard Link**
   - "View Full Scoreboard →" button
   - Opens scoreboard modal/page

### Phase 4: Scoreboard Page/Modal

**Categories:**
- 🎸 Most Genres Discovered
- 🎤 Most Artists Analysed
- 🎵 Most Tracks Scanned
- 📋 Most Playlists Created

**UI:**
- Tab-based navigation
- Top 20 per category
- Profile pic + name + count
- Current user highlighted

### Phase 5: Loading UX Overhaul

**Vinyl/Album Animation Concept:**
```
+-----------------------------------+
|                                   |
|   [Album Art]  →→→  [Album Art]   |
|     fading          appearing     |
|                                   |
|   "indie rock"  →  "synthwave"    |
|                                   |
|   Progress: ████████░░ 75%        |
|                                   |
+-----------------------------------+
```

**Implementation:**
1. Extract album art URLs from track data (already available)
2. Create CSS animation for "vinyl flip" effect
3. Genre names cycle with smooth transitions
4. Real-time stats counters (tracks, genres, artists)
5. Completion celebration:
   - Generate dynamic message based on top genres
   - Confetti/fireworks animation (canvas or CSS)
   - Smooth transition to results

**Dynamic Completion Messages:**
```javascript
const messages = {
  'rock': "You're a true rockstar! 🎸",
  'pop': "Pop goes your music taste! 🎤",
  'hip hop': "Straight outta your library! 🎧",
  // ... more
  'default': "Your music taste is unique! ✨"
};
```

### Phase 6: Theme Toggle Consistency

**Current Issue:**
- Theme toggle moves from header (pre-login) to cache-status bar (post-login)

**Fix:**
- Keep theme toggle in `#header-actions` ALWAYS
- After login, append user info next to theme toggle
- Never move the toggle to `.cache-status`

**Code Location:** `src/frontend/app.js` lines 571-577 (`renderHeaderUser`)

### Phase 7: Light Mode Accessibility Fix

**Issues:**
- Text contrast too low
- Some elements invisible

**Fixes in `src/frontend/styles.css`:**
```css
body.light-mode {
  --bg: #f8f9fa;
  --surface: #ffffff;
  --surface-2: #e9ecef;  /* Darker */
  --border: #ced4da;      /* Darker */
  --text: #212529;
  --text-muted: #495057;  /* Darker */
}

/* Specific overrides for light mode */
body.light-mode .genre-item {
  border: 1px solid var(--border);
}

body.light-mode .stat {
  border: 1px solid var(--border);
}

body.light-mode .btn-ghost {
  color: var(--text);
}
```

### Phase 8: Swedish Mode State Management

**Issues:**
- GUI/buttons reset to weird states when toggling Swedish mode
- Not all elements properly update

**Fix:**
1. Create `applySwedishMode()` function that handles ALL state changes
2. Store all Swedish-specific DOM updates in one place
3. Add state validation after toggle
4. Test all components after mode switch

**Components to Validate:**
- [ ] Theme toggle text
- [ ] Donation button (durry → snus)
- [ ] All i18n strings
- [ ] Loading messages
- [ ] Stats labels
- [ ] Button states
- [ ] Hall of Fame styling

### Phase 9: GitHub Version Widget Improvements

**Issues:**
- Widget randomly disappears
- No release name shown
- Not always drill-downable

**Fixes:**
1. Always show widget (even if GitHub API fails)
2. Fetch release name from `/api/changelog`
3. Cache deployment status in localStorage
4. Show fallback: "v1.4.0 • Keyboard Shortcuts"

**Widget Content:**
```
Idle:     "v1.4.0 • Keyboard Shortcuts • 2h ago"
Active:   "🚀 Deploying... Step 3/5"
Failed:   "❌ Deploy failed • Retry"
```

### Phase 10: Star/Uptime Badges

**Changes:**
1. Make star badge more prominent
   - Pulsing animation on hover
   - Tooltip: "Love this tool? Star us on GitHub!"

2. Uptime badge links to BetterStack status page
   - `https://tomstech.betteruptime.com` (to be created)

3. Consider adding to footer:
   ```
   ⭐ Star us | 💚 99.9% Uptime | ☕ Buy me a coffee
   ```

### Phase 11: BetterStack Monitoring Configuration

**Using provided tokens:**
- Status Page API: `MKkrifmzXkVGfCaez6KHYQmy`
- Telemetry API: `SXdEYrG5Y1jCNjdN11PKBiHe`

**10 Monitor Configuration (Free Tier):**
1. **Primary Endpoint** - `https://swedify.se/health` (every 1 min)
2. **API Genres** - `https://swedify.se/api/genres/chunk?offset=0&limit=1` (every 3 min)
3. **OAuth Flow** - `https://swedify.se/auth/spotify` (every 5 min, check redirect)
4. **Stats Endpoint** - `https://swedify.se/stats` (every 3 min)
5. **Session Check** - `https://swedify.se/session` (every 3 min)
6. **Deploy Status** - `https://swedify.se/deploy-status` (every 5 min)
7. **SSL Certificate** - Monitor SSL expiry (weekly)
8. **DNS Resolution** - Check A/CNAME records (hourly)
9. **Custom Heartbeat** - For KV backup monitoring (if implemented)
10. **GitHub Actions** - Monitor workflow status

**Status Page Setup:**
- Public URL: `https://tomstech.betteruptime.com`
- Components: Worker, KV Storage, Spotify API, GitHub OAuth

### Phase 12: Favicon & Branding

**User Request:**
- Use BetterStack-style logo (if possible)
- Better title than "Spotify + Genre Sorter"

**Title Ideas:**
- "Swedify" (already used as domain?)
- "Genre Wizard 🧙‍♂️"
- "Spotify Librarian 📚"
- "TuneSort"
- "VinylVault 💿"
- "Melodify"
- "Genre Genie ✨"

**Favicon Options:**
- Keep Swedish theme (user's friend Heidi)
- Or: Simple music note with gradient
- Or: Custom logo (requires design)

### Phase 13: Recently Created Playlists Section

**Implementation:**
1. Store last 20 playlists in KV: `recent_playlists`
2. Include: genre, user, timestamp, spotify URL
3. Poll every 30 seconds from frontend
4. Smooth animation when new playlist appears
5. Click → opens Spotify to save playlist

**Privacy Consideration:**
- Only show to logged-in users
- Option to opt-out of appearing in feed

### Phase 14: Playlist Creation UX Overhaul

**Features:**
1. **Duplicate Prevention**
   - Already implemented in API
   - Add frontend confirmation modal
   - "Skip duplicates" checkbox for bulk

2. **Enhanced Create Modal:**
   ```
   +----------------------------------+
   |  Create "emo" Playlist           |
   +----------------------------------+
   |  🖤 Title: [Emo (from Likes)]    |
   |                                  |
   |  📝 Description:                 |
   |  [Your emo tracks since 2019...] |
   |                                  |
   |  🖼️ Cover Image: [Upload/URL]    |
   |                                  |
   |  [Cancel]  [Create Playlist]     |
   +----------------------------------+
   ```

3. **Genre Merging:**
   - Multi-select genres
   - "Merge into one playlist" option
   - Combined track list

4. **Custom Thumbnail:**
   - Upload or URL input
   - Preview before creation
   - Use Spotify's playlist image API

### Phase 15: Backup/DR Documentation

**Create `docs/backup-dr.md`:**
```markdown
# Backup & Disaster Recovery

## KV Data Backup

### Automated Backup (Recommended)
- Use Cloudflare KV bulk export API
- Schedule via GitHub Actions (weekly)
- Store in private GitHub repo or R2

### Manual Backup
wrangler kv:key list --namespace-id=XXX > keys.json
# Then iterate and download values

## Restore Procedure
1. Create new KV namespace
2. Import keys from backup
3. Update wrangler.toml
4. Deploy

## Recovery Time Objectives
- RTO: 30 minutes
- RPO: 1 week (backup frequency)

## Testing DR
1. Export current KV to backup
2. Create test namespace
3. Import backup
4. Verify data integrity
5. Run health checks
```

---

## Implementation Order

### Sprint 1: Core Infrastructure
1. ✅ Light mode accessibility fix (quick win)
2. Theme toggle consistency
3. Swedish mode state fix
4. Version widget improvements

### Sprint 2: Leaderboard & Scoreboard
5. KV schema updates
6. API endpoints
7. Left sidebar layout
8. Scoreboard UI

### Sprint 3: Playlist UX
9. Recent playlists feed
10. Enhanced create modal
11. Genre merging
12. Duplicate prevention UI

### Sprint 4: Loading Experience
13. Vinyl animation
14. Dynamic completion messages
15. Celebration animation

### Sprint 5: Monitoring & Polish
16. BetterStack configuration
17. Badge improvements
18. Branding decisions
19. Backup/DR docs

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/frontend/styles.css` | Light mode, sidebar, animations |
| `src/frontend/app.js` | All UI logic, loading UX |
| `src/routes/api.ts` | New endpoints, stats tracking |
| `src/routes/auth.ts` | User stats initialization |
| `src/lib/session.ts` | User stats helper functions |
| `src/index.ts` | Layout changes, new routes |
| `docs/backup-dr.md` | New file |
| `docs/monitoring.md` | BetterStack setup |

---

## Questions Before Implementation

1. **Branding:** Which title do you prefer for the app?
2. **Privacy:** Should recent playlists feed be opt-in or opt-out?
3. **Favicon:** Keep Swedish theme or try new design?
4. **Monitoring:** Confirm BetterStack account is created and ready?
5. **Sidebar:** Always visible or collapsible on mobile?
6. **Album art:** Use actual album art during loading or generic vinyl images?

---

*Plan created: 2025-12-02*
