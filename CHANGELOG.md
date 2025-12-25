# Changelog

All notable changes to Genre Genie (Spotify Genre Sorter) will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [3.5.0] - 2025-12-25

### Fixed
- **What's New Modal** - Replaced inline `onclick` handlers with `addEventListener` for CSP compliance
- **Genre Display** - Resolved `userData is not defined` error breaking genre rendering
- **Genie Easter Egg** - Will Smith speech bubble styling improvements
- **TypeScript Errors** - Resolved deployment-blocking type errors
- **ESLint Errors** - Fixed error handling and KV monitor linting issues
- **CSP Nonce Storage** - TypeScript type fixes for nonce management

### Security
- **BetterStack CSP** - Added uptime.betterstack.com to img-src directive
- **Security Documentation** - Added comprehensive security docs and bundle size monitoring

### Changed
- **Changelog Extraction** - Improved changelog extraction for What's New modal
- **High-Priority Backlog** - Implemented items #53, #57, #58, #74, #76, #84, #87

## [3.4.0] - 2025-12-18

### Added
- **Library Size Display** - shows library stats before scanning (#75)
  - Displays track count and estimated scan time
  - Warning notification for large libraries (>5000 tracks)
  - Swedish translations included
- **Anniversary Mode** - special celebration for Heidi on special dates (#102)
  - Heart rain animation effect
  - Personal messages from Tom
  - Auto-enables Swedish mode
  - Respects prefers-reduced-motion
- **Genre Wrapped** - shareable Spotify Wrapped-style cards
  - Astrology-style personality readings
  - Native Web Share API integration
- **Genre Families** - artist deep dive with genre relationships
- **Share Modal** - completion messages with sharing options
- **Health Monitoring** - health indicator, error logging, performance metrics
- **Request Access** - invite system with rate limit banner

### Security
- **PKCE OAuth Flow** (#99b) - Secure OAuth with code_challenge/verifier
- **CSP Nonces** (#99a) - Replaced unsafe-inline with per-request nonces
- **CSRF Protection** (#99c) - Synchronizer token pattern for state-changing requests
- **CORS Policy** (#99d) - Explicit trusted domains with preflight caching
- **Whitelist Genre Sanitization** (#99e) - Unicode-aware input validation

### Performance
- **KV Read/Write Optimisation** (PERF-009 to PERF-015)
  - Memory cache layer for hot data
  - Write batching for analytics
  - Parallel read operations
  - Analytics sampling (10%)
- **Worker Transaction Efficiency** - Parallel API calls, reduced latency

### Fixed
- **Large Library Bug** (#54) - Properly budget subrequests for tracks + artists
- **KV Stats Sync** - Status widgets layout improvements
- **Template Literal Build** - Fixed JS escape sequences

### Changed
- **Admin User Management** - KV health monitoring with drill-down modal
- **E2E Testing Infrastructure** - Playwright tests with 30/30 passing

## [3.3.0] - 2025-12-08

### Added
- **UI Redesign** - Modern polish with glassmorphism effects
  - Improved card hover animations
  - Better button ripple effects
  - Enhanced scrollbar styling
  - Gradient text headers
  - Tooltips support
- **Playlist Scanning** - Scan any playlist for genre breakdown
  - Browse your playlists from the toolbar
  - See genre distribution for each playlist
  - Swedish translations included
- **User Preferences** - Persistent settings saved to cloud
  - Theme preference synced across sessions
  - Hidden genres saved
  - Playlist template saved
  - Swedish mode preference saved
- **Tutorial System** - Interactive onboarding for new users
  - Welcome screen with tour option
  - Step-by-step feature highlights
  - Skip option for returning users
  - Swedish translations included

## [3.2.0] - 2025-12-08

### Added
- **Special user tags** - display badges next to special users in leaderboard
  - Creator badge (👑) for tomspseudonym and tomstech
  - Queen badge (💙) for ~oogi~ (Heidi)
- **Genre merging** - select 2+ genres and merge them into a single playlist
  - "Merge Selected" button appears when 2+ genres are checked
  - Combines all unique tracks from selected genres
  - Swedish translations included

## [3.1.0] - 2025-12-08

### Added
- **Admin panel UI** - accessible from frontend for admin users (tomspseudonym, tomstech)
  - View KV metrics, user stats, analytics dashboard
  - Clear caches and rebuild leaderboard/scoreboard buttons
  - Orange gradient admin button in header
- **Genie click animation** - click the floating genie for:
  - Talking mouth animation with brown/blue colour shift
  - Random speech bubbles with funny quotes
  - Sound effect on click
- **"Normal mode huh?" jokes** - random funny messages when leaving Swedish mode

### Fixed
- **Progressive scanning** now auto-triggers for large libraries (>2000 tracks)
- **Duplicate theme toggle** removed from cache-status section

### Changed
- Swedish mode exit messages now rotate through funny jokes

## [3.0.1] - 2025-12-08

### Fixed
- **Release workflow** - replaced git-cliff (Debian buster EOL) with simple changelog extraction
- **README** - equal flag sizes, simplified footer text

### Changed
- Removed Claude co-author references from commit history

## [3.0.0] - 2025-12-08

### Added
- **Progressive scanning** for libraries with 2000+ tracks
  - Resume capability with KV progress persistence
  - Real-time progress tracking
  - Stays under Cloudflare subrequest limits
- **Admin debug panel** at `/api/admin` for tomspseudonym
  - View KV metrics, analytics, user stats
  - Clear caches and rebuild leaderboard/scoreboard
  - List active sessions
- **Confetti celebration** on playlist creation
  - Swedish colors (blue/yellow) in Swedish mode
  - Respects `prefers-reduced-motion`
- **Jeff Goldblum Easter egg** via Konami code (↑↑↓↓←→←→BA)
- **Enhanced smoke animation** on durry button with CSS wisps
- **Secret Heidi detection** with auto-Swedish mode and greeting

### Changed
- `MAX_TRACKS_FREE_TIER` increased to 2000
- Replaced EthicalCheck with OWASP ZAP for API security scanning

## [2.2.0] - 2025-12-07

### Added
- **Sorted scoreboard tab** showing users ranked by tracks sorted
- Track total songs added to playlists in user stats
- Cumulative tracks in created playlists metric

## [2.0.0] - 2025-12-01

### Added
- **Genre Genie rebrand** from Spotify Genre Sorter
- **Leaderboard** with pioneers (first 10 users) and new users
- **Scoreboard modal** with rankings by playlists, genres, artists, tracks
- **Recent playlists feed** with 30-second polling
- **Left sidebar** with pioneers, new users, recent playlists
- **Light mode accessibility** with WCAG AA contrast ratios
- **Keyboard shortcuts** for power users

### Changed
- Updated all branding and meta tags
- Mobile-responsive sidebar with collapse toggle
- Swedish translations for sidebar text

## [1.3.0] - 2025-12-01

### Added
- PDF documentation generation
- SEO-friendly playlist descriptions
- Enhanced health endpoint with version info
- Genre emoji icons

## [1.2.1] - 2025-11-29

### Fixed
- Track limit for subrequest errors (limited to 1000 tracks)
- Show truncation warning in UI when library is large

## [1.2.0] - 2025-11-28

### Added
- Dark/light theme toggle with system preference detection
- Hidden genres management (hide/show, bulk hide)
- Genre statistics dashboard with diversity score
- Export to JSON and CSV

## [1.1.0] - 2025-11-27

### Added
- Security headers (CSP, HSTS, X-Frame-Options)
- Retry logic with exponential backoff for Spotify API
- Rate limiting (30 requests/minute per IP)

### Changed
- Australian English spelling throughout

## [1.0.0] - 2025-11-26

### Added
- Initial release
- Hall of Fame for pioneers
- Swedish Easter eggs (for Heidi)
- Spotify-only auth mode
- Genre extraction from artist data
- Playlist creation (single and bulk)

---

*För Heidi* 💙💛
