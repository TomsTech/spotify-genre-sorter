# Genre Genie v2.1 - Complete UX Overhaul Plan

> **STATUS**: Most items from this plan have been superseded by v3.x releases.
> See CHANGELOG.md for actual completed features.

---

## ✅ Completed Items

| Item | Status | Completed In |
|------|--------|--------------|
| Genre Merging | ✅ Done | v3.2.0 |
| UI/Layout Fixes | ✅ Done | v3.0-v3.3 |
| Extended Caching | ✅ Done | v3.0.0 |
| Sidebar Animations | ✅ Done | v3.3.0 |
| Playlist Customisation | ✅ Done | v3.0.0 |

## ⏳ Remaining Items (Low Priority)

| Item | Status | Notes |
|------|--------|-------|
| Will Smith Intro | BLOCKED | Need video URL |
| Album Art Carousel | Pending | Nice to have |
| Live Bar Chart | Pending | Nice to have |
| Fireworks | ✅ Done | v3.0.0 (confetti) |

## Overview

This plan covers the complete v2.1 experience:

1. **Will Smith binoculars intro sequence**
2. **Dynamic album art loading animation with stats**
3. **Fireworks celebration on completion**
4. **Smooth sidebar animations**
5. **Extended caching for large libraries (24h for 1000+ tracks)**
6. **Playlist customisation before creation (name, description, cover)**
7. **Genre merging feature**
8. **UI/layout fixes (crowns, alignment, scoreboard button)**

---

## Phase 1: Will Smith Binoculars Intro (BLOCKED - need video URL)

### Flow
1. Page loads -> full-screen intro overlay
2. Play Will Smith meme video (0-4 seconds)
3. Hard cut to binoculars overlay (black screen, two oval cutouts)
4. Binoculars wobble subtly (2 seconds)
5. "Woahohoh" audio plays
6. Binoculars fade away -> reveal site
7. Genre analysis auto-starts

### Dependencies
- **BLOCKED**: Need Will Smith video URL from user
- **BLOCKED**: Need "woahohoh" audio clip from user

---

## Phase 2: Dynamic Loading Experience

### Problems with Current State
- Static stats that jump (not animated)
- No album art cycling
- "Load All" button exists (should auto-start)
- No diversity score or live bar chart

### New Experience

#### 2.1 Auto-Start
- Remove "Load All" button - analysis starts immediately on login

#### 2.2 Album Art Carousel
- 3x3 grid of album covers from user's library
- Smooth crossfade/flip transitions
- New albums cycle in as analysis progresses

#### 2.3 Animated Stats Counter
- Numbers count up smoothly (requestAnimationFrame + easing)
- Stats: Tracks, Genres, Artists, Diversity Score

#### 2.4 Diversity Score
- Shannon Diversity Index (0-100)
- Updates in real-time
- Animated circular progress

#### 2.5 Live Bar Chart
- Top 10 genres as horizontal bars
- Bars grow in real-time
- Staggered animation

---

## Phase 3: Completion Celebration

### Flow
1. Analysis 100% -> brief pause
2. Canvas fireworks explosion (5 bursts)
3. Celebration sound effect
4. Stats pulse/glow
5. Smooth transition to genre selection

---

## Phase 4: Extended Caching

### Logic
- < 1000 tracks: 1 hour cache
- >= 1000 tracks: 24 hour cache
- Manual refresh button available

---

## Phase 5: Playlist Customisation

### Features
1. **Edit Before Create Modal** - name, description, cover for each
2. **Genre Merging** - combine multiple genres into one playlist
3. **Cover Art Upload** - requires `ugc-image-upload` Spotify scope

---

## Phase 6: Smooth Sidebar Animations

- Staggered fade-in on load (50ms delays)
- Pulse animation for new items
- Fade-out for removed items

---

## Phase 7: UI/Layout Fixes

### 7.1 Three Crowns
- Fix: Position relative to h1, not absolute off-screen

### 7.2 Scoreboard Button
- Fix: Sidebar needs `height` not `max-height` for flex to work

### 7.3 Header Alignment
- Fix: Match padding with sidebar width

---

## Implementation Order

| Priority | Phase | Blocked? |
|----------|-------|----------|
| 1 | Phase 7: UI/Layout Fixes | No |
| 2 | Phase 4: Extended Caching | No |
| 3 | Phase 6: Sidebar Animations | No |
| 4 | Phase 2: Dynamic Loading | No |
| 5 | Phase 3: Fireworks | No |
| 6 | Phase 5: Playlist Customisation | No |
| 7 | Phase 1: Will Smith Intro | **YES** |

---

## Questions for User

1. **Will Smith video**: Please provide the URL
2. **Confirm priority order?**

---

*Plan created: 2025-12-02*
