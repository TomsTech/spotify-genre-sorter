# BetterUptime Setup Guide for Spotify Genre Sorter

> **Free Tier** - 10 HTTP monitors with keywords

---

## Monitor 1: Health Check

| Field | Value |
|-------|-------|
| **Name** | `Health` |
| **URL** | `https://spotify.houstons.tech/health` |
| **Expected** | 200 |
| **Keyword** | `"ok"` |

---

## Monitor 2: Main Application

| Field | Value |
|-------|-------|
| **Name** | `Application` |
| **URL** | `https://spotify.houstons.tech/` |
| **Expected** | 200 |
| **Keyword** | `Spotify Genre Sorter` |

---

## Monitor 3: Database (KV)

| Field | Value |
|-------|-------|
| **Name** | `Database` |
| **URL** | `https://spotify.houstons.tech/stats` |
| **Expected** | 200 |
| **Keyword** | `"userCount"` |

---

## Monitor 4: Config Check

| Field | Value |
|-------|-------|
| **Name** | `Config` |
| **URL** | `https://spotify.houstons.tech/setup` |
| **Expected** | 200 |
| **Keyword** | `"configured":true` |

---

## Monitor 5: Session System

| Field | Value |
|-------|-------|
| **Name** | `Session` |
| **URL** | `https://spotify.houstons.tech/session` |
| **Expected** | 200 |
| **Keyword** | `"authenticated"` |

---

## Monitor 6: API Auth Gate

| Field | Value |
|-------|-------|
| **Name** | `API Genres` |
| **URL** | `https://spotify.houstons.tech/api/genres` |
| **Expected** | 401 |
| **Keyword** | `Not authenticated` |

---

## Monitor 7: User API Gate

| Field | Value |
|-------|-------|
| **Name** | `API Me` |
| **URL** | `https://spotify.houstons.tech/api/me` |
| **Expected** | 401 |
| **Keyword** | `Not authenticated` |

---

## Monitor 8: Deploy Status

| Field | Value |
|-------|-------|
| **Name** | `Deploy Status` |
| **URL** | `https://spotify.houstons.tech/deploy-status` |
| **Expected** | 200 |
| **Keyword** | `"version"` |

---

## Monitor 9: Spotify Auth

| Field | Value |
|-------|-------|
| **Name** | `Spotify Auth` |
| **URL** | `https://spotify.houstons.tech/auth/spotify` |
| **Expected** | 302 |
| **Keyword** | *(none - redirect)* |

---

## Monitor 10: Logout

| Field | Value |
|-------|-------|
| **Name** | `Logout` |
| **URL** | `https://spotify.houstons.tech/auth/logout` |
| **Expected** | 302 |
| **Keyword** | *(none - redirect)* |

---

## Quick Copy URLs

```text
https://spotify.houstons.tech/health
https://spotify.houstons.tech/
https://spotify.houstons.tech/stats
https://spotify.houstons.tech/setup
https://spotify.houstons.tech/session
https://spotify.houstons.tech/api/genres
https://spotify.houstons.tech/api/me
https://spotify.houstons.tech/deploy-status
https://spotify.houstons.tech/auth/spotify
https://spotify.houstons.tech/auth/logout
```

---

## Status Page

1. **Status Pages** > **Create**
2. Add monitors 1-5 (public-facing)
3. Hide monitors 6-10 (internal/security)
4. Copy badge URL

---

## Checklist

- [ ] Monitor 1: Health
- [ ] Monitor 2: Application
- [ ] Monitor 3: Database
- [ ] Monitor 4: Config
- [ ] Monitor 5: Session
- [ ] Monitor 6: API Genres
- [ ] Monitor 7: API Me
- [ ] Monitor 8: Deploy Status
- [ ] Monitor 9: Spotify Auth
- [ ] Monitor 10: Logout
- [ ] Status Page created
- [ ] Badge URL copied

---

Spotify Genre Sorter v1.1.1
