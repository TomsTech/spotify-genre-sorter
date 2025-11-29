# Spotify Genre Sorter

[![Stars](https://img.shields.io/github/stars/TomsTech/spotify-genre-sorter?style=flat-square&logo=github&label=Stars&color=gold)](https://github.com/TomsTech/spotify-genre-sorter/stargazers)
[![CI](https://github.com/TomsTech/spotify-genre-sorter/actions/workflows/ci.yml/badge.svg)](https://github.com/TomsTech/spotify-genre-sorter/actions/workflows/ci.yml)
[![Deploy](https://github.com/TomsTech/spotify-genre-sorter/actions/workflows/deploy.yml/badge.svg)](https://github.com/TomsTech/spotify-genre-sorter/actions/workflows/deploy.yml)
[![Status](https://img.shields.io/badge/status-operational-brightgreen)](https://spotify.houstons.tech/health)
[![License: Personal Use](https://img.shields.io/badge/License-Personal%20Use-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue.svg)](https://www.typescriptlang.org/)
[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-orange.svg)](https://workers.cloudflare.com/)

Organise your Spotify liked songs into genre-based playlists with one click.

> *For Heidi x, hopefully you know why I disappear for so long, I'm just dicking my keyboard for countless hours instead*

## Quick Start

### TL;DR - What You Need

1. **Cloudflare account** with Workers enabled (free tier works)
2. **GitHub OAuth App** - for login
3. **Spotify Developer App** - for accessing your music
4. **5 minutes** to set it all up

---

## Complete Setup Guide

### Step 1: Fork & Clone

```bash
git clone https://github.com/TomsTech/spotify-genre-sorter.git
cd spotify-genre-sorter
npm install
```

### Step 2: Create Cloudflare API Token

You need this for GitHub Actions to deploy automatically.

1. Go to [Cloudflare API Tokens](https://dash.cloudflare.com/profile/api-tokens)
2. Click **Create Token**
3. Use **Edit Cloudflare Workers** template
4. Add these permissions:
   - `Account > Workers Scripts > Edit`
   - `Account > Workers KV Storage > Edit`
   - `Account > Account Settings > Read`
   - `Zone > DNS > Edit` (only if using custom domain)
5. Create token and **copy it**

### Step 3: Add Token to GitHub

1. Go to your repo → **Settings** → **Secrets and variables** → **Actions**
2. Click **New repository secret**
3. Name: `CLOUDFLARE_API_TOKEN`
4. Value: paste the token from Step 2

### Step 4: Create GitHub OAuth App

This lets users log in with their GitHub account.

1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Click **OAuth Apps** → **New OAuth App**
3. Fill in:

| Field | Value |
|-------|-------|
| Application name | `Spotify Genre Sorter` |
| Homepage URL | `https://spotify-genre-sorter.<your-subdomain>.workers.dev` |
| Authorization callback URL | `https://spotify-genre-sorter.<your-subdomain>.workers.dev/auth/github/callback` |

> **Find your subdomain**: Check your Cloudflare Workers dashboard - it's usually `<something>.workers.dev`. For example: `dev-playground-df5.workers.dev`

4. Click **Register application**
5. **Copy the Client ID** (you'll need this)
6. Click **Generate a new client secret** and **copy it immediately**

### Step 5: Create Spotify Developer App

This lets the app access your Spotify library.

1. Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Click **Create App**
3. Fill in:

| Field | Value |
|-------|-------|
| App name | `Spotify Genre Sorter` |
| App description | `Organise liked songs into genre playlists` |
| Redirect URI | `https://spotify-genre-sorter.<your-subdomain>.workers.dev/auth/spotify/callback` |

4. Check **Web API** under APIs
5. Click **Save**
6. Go to **Settings** → **copy Client ID and Client Secret**

### Step 6: Deploy the Worker

Push to GitHub to trigger the first deploy:

```bash
git push origin main
```

Wait for the GitHub Action to complete (check the Actions tab).

### Step 7: Set Worker Secrets (THE IMPORTANT BIT)

**This is where most people get stuck.** The secrets must be set on the Cloudflare Worker, NOT in GitHub.

Run these commands in your terminal:

```bash
# GitHub OAuth credentials
npx wrangler secret put GITHUB_CLIENT_ID
# Paste your GitHub Client ID when prompted

npx wrangler secret put GITHUB_CLIENT_SECRET
# Paste your GitHub Client Secret when prompted

# Spotify OAuth credentials
npx wrangler secret put SPOTIFY_CLIENT_ID
# Paste your Spotify Client ID when prompted

npx wrangler secret put SPOTIFY_CLIENT_SECRET
# Paste your Spotify Client Secret when prompted
```

Each command will prompt you to enter the value. It won't show what you type (that's normal - it's hidden for security).

### Step 8: Verify It Works

1. Visit `https://spotify-genre-sorter.<your-subdomain>.workers.dev/health`
   - Should show: `{"status":"ok"}`
2. Visit `https://spotify-genre-sorter.<your-subdomain>.workers.dev/setup`
   - Should show: `{"configured":true}`
   - If it shows missing secrets, go back to Step 7

---

## Custom Domain Setup (Optional)

Want to use your own domain like `spotify.example.com`?

### Option A: Via GitHub Actions (Recommended)

1. Go to your repo → **Settings** → **Variables** → **Actions**
2. Add variable: `CUSTOM_DOMAIN` = `spotify.example.com`
3. Run the Deploy workflow manually with "Force DNS update" checked

### Option B: Manual Setup

```bash
# Add the domain via Cloudflare dashboard
# Workers & Pages → your worker → Settings → Triggers → Custom Domains
```

**Important**: Update your OAuth callback URLs in both GitHub and Spotify apps to use the new domain!

---

## Troubleshooting

### "Worker returns error 1042"
The worker is crashing. Usually means secrets aren't set. Run:
```bash
npx wrangler secret list
```
Should show all 4 secrets. If not, set them with `npx wrangler secret put`.

### "/setup shows missing secrets but I set them"
Secrets are per-worker. Make sure you're setting them on the right worker:
```bash
npx wrangler secret put GITHUB_CLIENT_ID --name spotify-genre-sorter
```

### "redirect_uri_mismatch" error
Your OAuth callback URL doesn't match. Check:
1. The URL in your GitHub/Spotify app settings
2. Must match EXACTLY: `https://your-domain/auth/github/callback` or `/auth/spotify/callback`

### "DNS not resolving for custom domain"
DNS can take a few minutes to propagate. Try:
```bash
# Check if DNS is working
nslookup your-domain.com 8.8.8.8
```

### "Pipeline succeeds but site shows error"
The health check passed but OAuth isn't configured. Check `/setup` endpoint.

---

## How It Works

1. User logs in with GitHub (whitelist specific users if you want)
2. User connects their Spotify account
3. App fetches all liked songs
4. Extracts genres from artists (Spotify assigns genres to artists, not tracks)
5. User can create playlists for any genre

---

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `/` | Main UI |
| `/health` | Health check (returns `{"status":"ok"}`) |
| `/setup` | Check if secrets are configured |
| `/session` | Current session status |
| `/auth/github` | Start GitHub login |
| `/auth/spotify` | Connect Spotify |
| `/auth/logout` | Log out |
| `/api/genres` | Get all genres from liked songs |
| `/api/playlist` | Create a playlist |

---

## Testing

Run the test suite:

```bash
npm test              # Run all tests
npm run test:watch    # Watch mode
npm run test:coverage # With coverage report
```

Tests cover:

- Spotify OAuth URL generation
- Genre extraction and counting logic
- Playlist creation chunking
- Session management
- API response formats

---

## Local Development

Create a `.dev.vars` file:

```
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
SPOTIFY_CLIENT_ID=your_spotify_client_id
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret
```

Then:
```bash
npm run dev
```

Update OAuth callback URLs to `http://localhost:8787/auth/*/callback` for local testing.

---

## Architecture

```
User → Cloudflare Worker → GitHub OAuth (login)
                        → Spotify API (music data)
                        → KV Storage (sessions)
```

---

## Security

Your data and tokens are protected with industry best practices:

### Token Protection

| Measure | Description |
|---------|-------------|
| **Server-side only** | OAuth tokens stored in Cloudflare KV, never sent to browser |
| **HttpOnly cookies** | Session ID cookie cannot be accessed by JavaScript |
| **Secure flag** | Cookies only transmitted over HTTPS |
| **SameSite=Lax** | Prevents cross-site request forgery (CSRF) |
| **Single-use state** | OAuth state tokens deleted after verification |

### API Hardening

| Protection | Implementation |
|------------|----------------|
| **Rate limiting** | 30 requests/minute per IP (429 with Retry-After) |
| **CORS restriction** | Same-origin only - no cross-site API access |
| **Input validation** | Track IDs validated (22-char alphanumeric) |
| **Genre sanitisation** | Dangerous characters stripped, max 100 chars |
| **Request limits** | Max 10,000 tracks, 50 genres per bulk request |
| **Error sanitisation** | Internal details never exposed to clients |

### Security Headers

All responses include:

- `Content-Security-Policy` - strict source restrictions
- `X-Frame-Options: DENY` - prevents clickjacking
- `X-Content-Type-Options: nosniff` - prevents MIME sniffing
- `Strict-Transport-Security` - enforces HTTPS
- `Referrer-Policy` - limits referrer leakage
- `Permissions-Policy` - disables camera/microphone/geolocation

### CI/CD Security

- **CodeQL** analysis on every push
- **Snyk** vulnerability scanning
- **npm audit** for dependency checks

---

## Notes

- Genres come from **artists**, not individual tracks
- Large libraries take longer (paginated API calls)
- Playlists are created as **private** by default
- Session expires after 7 days

## License

Free for personal use. Commercial use requires a paid license — see [LICENSE](LICENSE).

---

<sub><img src="https://flagcdn.com/16x12/se.png" width="16" height="12" alt="SE"> *For Heidi*</sub>
