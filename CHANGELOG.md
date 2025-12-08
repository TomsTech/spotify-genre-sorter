# Changelog

All notable changes to Genre Genie (Spotify Genre Sorter) will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
