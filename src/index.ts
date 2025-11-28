import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import auth from './routes/auth';
import api from './routes/api';
import { getSession } from './lib/session';

const app = new Hono<{ Bindings: Env }>();

// Global error handler
app.onError((err, c) => {
  console.error('Worker error:', err);
  return c.json({ error: err.message || 'Internal error' }, 500);
});

// Health check - FIRST route, no middleware dependency
app.get('/health', (c) => {
  return c.json({ status: 'ok' });
});

// Middleware (after health check so it doesn't block health)
app.use('*', logger());
app.use('/api/*', cors());

// Mount routes
app.route('/auth', auth);
app.route('/api', api);

// Setup check - verifies required secrets are configured
app.get('/setup', (c) => {
  const missing: string[] = [];
  const spotifyOnly = c.env.SPOTIFY_ONLY_AUTH === 'true' || !c.env.GITHUB_CLIENT_ID;

  // GitHub secrets only required if not in Spotify-only mode
  if (!spotifyOnly) {
    if (!c.env.GITHUB_CLIENT_ID) missing.push('GITHUB_CLIENT_ID');
    if (!c.env.GITHUB_CLIENT_SECRET) missing.push('GITHUB_CLIENT_SECRET');
  }

  // Spotify secrets always required
  if (!c.env.SPOTIFY_CLIENT_ID) missing.push('SPOTIFY_CLIENT_ID');
  if (!c.env.SPOTIFY_CLIENT_SECRET) missing.push('SPOTIFY_CLIENT_SECRET');
  if (!c.env.SESSIONS) missing.push('SESSIONS (KV namespace)');

  if (missing.length > 0) {
    return c.json({
      configured: false,
      missing,
      authMode: spotifyOnly ? 'spotify-only' : 'github+spotify',
      message: 'Set secrets via: npx wrangler secret put SECRET_NAME'
    }, 503);
  }
  return c.json({
    configured: true,
    authMode: spotifyOnly ? 'spotify-only' : 'github+spotify',
  });
});

// Session status endpoint
app.get('/session', async (c) => {
  // Check if KV is configured
  if (!c.env.SESSIONS) {
    return c.json({ authenticated: false, error: 'KV not configured' });
  }

  const spotifyOnly = c.env.SPOTIFY_ONLY_AUTH === 'true' || !c.env.GITHUB_CLIENT_ID;

  try {
    const session = await getSession(c);
    if (!session) {
      return c.json({ authenticated: false, spotifyOnly });
    }

    // In Spotify-only mode, user is authenticated once Spotify is connected
    const isAuthenticated = spotifyOnly
      ? !!session.spotifyAccessToken
      : !!session.githubUser;

    return c.json({
      authenticated: isAuthenticated,
      spotifyOnly,
      // User info (prefer Spotify in spotify-only mode)
      user: spotifyOnly ? session.spotifyUser : session.githubUser,
      avatar: spotifyOnly ? session.spotifyAvatar : session.githubAvatar,
      // Legacy fields for compatibility
      githubUser: session.githubUser,
      githubAvatar: session.githubAvatar,
      spotifyUser: session.spotifyUser,
      spotifyConnected: !!session.spotifyAccessToken,
    });
  } catch {
    return c.json({ authenticated: false, spotifyOnly, error: 'Session error' });
  }
});

// Stats endpoint - user count and hall of fame
app.get('/api/stats', async (c) => {
  try {
    const countStr = await c.env.SESSIONS.get('stats:user_count');
    const count = countStr ? parseInt(countStr, 10) : 0;

    // Get hall of fame (first 10 users for display)
    const hallOfFame: { position: number; spotifyName: string; registeredAt: string }[] = [];
    for (let i = 1; i <= Math.min(count, 10); i++) {
      const hofKey = `hof:${String(i).padStart(3, '0')}`;
      const data = await c.env.SESSIONS.get(hofKey);
      if (data) {
        const entry = JSON.parse(data) as { position: number; spotifyName: string; registeredAt: string };
        hallOfFame.push({
          position: entry.position,
          spotifyName: entry.spotifyName,
          registeredAt: entry.registeredAt,
        });
      }
    }

    return c.json({
      userCount: count,
      launchDate: '2025-11-28',
      hallOfFame,
    });
  } catch {
    return c.json({ userCount: 0, hallOfFame: [] });
  }
});

// Swedish-themed favicon (Spotify logo in Swedish colors)
app.get('/favicon.svg', (c) => {
  c.header('Content-Type', 'image/svg+xml');
  return c.body(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
  <defs>
    <linearGradient id="swedish" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#006AA7"/>
      <stop offset="50%" style="stop-color:#FECC00"/>
      <stop offset="100%" style="stop-color:#006AA7"/>
    </linearGradient>
  </defs>
  <circle cx="12" cy="12" r="10" fill="url(#swedish)"/>
  <path fill="#fff" d="M16.586 16.424a.622.622 0 01-.857.207c-2.348-1.435-5.304-1.76-8.785-.964a.622.622 0 01-.277-1.215c3.809-.87 7.076-.496 9.712 1.115.293.18.386.563.207.857zm1.223-2.722a.78.78 0 01-1.072.257c-2.687-1.652-6.785-2.131-9.965-1.166a.78.78 0 01-.973-.519.781.781 0 01.52-.972c3.632-1.102 8.147-.568 11.233 1.329a.78.78 0 01.257 1.071zm.105-2.835c-3.223-1.914-8.54-2.09-11.618-1.156a.935.935 0 11-.543-1.79c3.533-1.072 9.404-.865 13.115 1.338a.935.935 0 11-.954 1.608z"/>
</svg>`);
});

// PNG favicon (Swedish Spotify logo from favicon_io)
app.get('/favicon.png', (c) => {
  c.header('Content-Type', 'image/png');
  c.header('Cache-Control', 'public, max-age=31536000');
  // Base64 decoded at runtime - Swedish-themed Spotify logo
  const base64 = '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';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return c.body(bytes);
});

// ICO favicon redirect
app.get('/favicon.ico', (c) => {
  return c.redirect('/favicon.png');
});

// Main UI
app.get('/', (c) => {
  return c.html(getHtml());
});

function getHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Spotify Genre Sorter</title>
  <link rel="icon" type="image/png" href="/favicon.png">
  <link rel="icon" type="image/svg+xml" href="/favicon.svg">
  <style>
    :root {
      --bg: #0a0a0a;
      --surface: #141414;
      --surface-2: #1e1e1e;
      --border: #2a2a2a;
      --text: #fafafa;
      --text-muted: #888;
      --accent: #1DB954;
      --accent-hover: #1ed760;
      --danger: #e74c3c;
      --swedish-blue: #006AA7;
      --swedish-yellow: #FECC00;
    }

    body.swedish-mode {
      --accent: #006AA7;
      --accent-hover: #0077b6;
      --bg: #001428;
      --surface: #002244;
      --surface-2: #003366;
      --border: #004488;
    }

    body.swedish-mode .stat-value {
      background: linear-gradient(135deg, var(--swedish-blue), var(--swedish-yellow));
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }

    body.swedish-mode .btn-primary {
      background: linear-gradient(135deg, var(--swedish-blue), var(--swedish-yellow));
    }

    body.swedish-mode header h1 svg {
      fill: url(#swedish-grad);
    }

    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: var(--bg);
      color: var(--text);
      min-height: 100vh;
      line-height: 1.6;
      transition: all 0.3s ease;
    }

    .container {
      max-width: 900px;
      margin: 0 auto;
      padding: 2rem;
    }

    header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 3rem;
      padding-bottom: 1.5rem;
      border-bottom: 1px solid var(--border);
    }

    h1 {
      font-size: 1.5rem;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .user-info {
      display: flex;
      align-items: center;
      gap: 1rem;
    }

    .avatar {
      width: 36px;
      height: 36px;
      border-radius: 50%;
    }

    .btn {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.625rem 1.25rem;
      border-radius: 6px;
      border: none;
      font-size: 0.875rem;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.15s ease;
      text-decoration: none;
    }

    .btn-primary {
      background: var(--accent);
      color: #000;
    }

    .btn-primary:hover {
      background: var(--accent-hover);
    }

    .btn-secondary {
      background: var(--surface-2);
      color: var(--text);
      border: 1px solid var(--border);
    }

    .btn-secondary:hover {
      background: var(--border);
    }

    .btn-ghost {
      background: transparent;
      color: var(--text-muted);
    }

    .btn-ghost:hover {
      color: var(--text);
    }

    .btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 1.5rem;
      margin-bottom: 1.5rem;
    }

    .card-title {
      font-size: 1rem;
      font-weight: 600;
      margin-bottom: 1rem;
    }

    .stats {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 1rem;
      margin-bottom: 1.5rem;
    }

    .stat {
      background: var(--surface-2);
      padding: 1rem;
      border-radius: 6px;
      text-align: center;
    }

    .stat-value {
      font-size: 1.75rem;
      font-weight: 700;
      color: var(--accent);
    }

    .stat-label {
      font-size: 0.75rem;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .genre-list {
      display: grid;
      gap: 0.5rem;
      max-height: 500px;
      overflow-y: auto;
    }

    .genre-item {
      display: flex;
      align-items: center;
      gap: 1rem;
      padding: 0.75rem 1rem;
      background: var(--surface-2);
      border-radius: 6px;
      transition: background 0.15s ease;
    }

    .genre-item:hover {
      background: var(--border);
    }

    .genre-checkbox {
      width: 18px;
      height: 18px;
      accent-color: var(--accent);
    }

    .genre-name {
      flex: 1;
      font-size: 0.9rem;
    }

    .genre-count {
      font-size: 0.8rem;
      color: var(--text-muted);
      background: var(--surface);
      padding: 0.25rem 0.5rem;
      border-radius: 4px;
    }

    .genre-create {
      opacity: 0;
      transition: opacity 0.15s ease;
    }

    .genre-item:hover .genre-create {
      opacity: 1;
    }

    .actions {
      display: flex;
      gap: 1rem;
      margin-top: 1.5rem;
      padding-top: 1.5rem;
      border-top: 1px solid var(--border);
    }

    .loading {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 3rem;
      color: var(--text-muted);
    }

    .spinner {
      width: 32px;
      height: 32px;
      border: 3px solid var(--border);
      border-top-color: var(--accent);
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      margin-bottom: 1rem;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    .error {
      background: rgba(231, 76, 60, 0.1);
      border: 1px solid var(--danger);
      color: var(--danger);
      padding: 1rem;
      border-radius: 6px;
      margin-bottom: 1rem;
    }

    .success {
      background: rgba(29, 185, 84, 0.1);
      border: 1px solid var(--accent);
      color: var(--accent);
      padding: 1rem;
      border-radius: 6px;
      margin-bottom: 1rem;
    }

    .welcome {
      text-align: center;
      padding: 4rem 2rem;
    }

    .welcome h2 {
      font-size: 2rem;
      margin-bottom: 1rem;
    }

    .welcome p {
      color: var(--text-muted);
      margin-bottom: 2rem;
      max-width: 400px;
      margin-left: auto;
      margin-right: auto;
    }

    .search-input {
      width: 100%;
      padding: 0.75rem 1rem;
      background: var(--surface-2);
      border: 1px solid var(--border);
      border-radius: 6px;
      color: var(--text);
      font-size: 0.9rem;
      margin-bottom: 1rem;
    }

    .search-input:focus {
      outline: none;
      border-color: var(--accent);
    }

    .search-input::placeholder {
      color: var(--text-muted);
    }

    .results {
      margin-top: 1rem;
    }

    .result-item {
      display: flex;
      justify-content: space-between;
      padding: 0.5rem 0;
      border-bottom: 1px solid var(--border);
    }

    .result-item:last-child {
      border-bottom: none;
    }

    .result-success {
      color: var(--accent);
    }

    .result-error {
      color: var(--danger);
    }

    /* Heidi Easter Egg Badge */
    .heidi-badge {
      position: fixed;
      bottom: 1rem;
      right: 1rem;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.5rem 0.75rem;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 20px;
      font-size: 0.7rem;
      color: var(--text-muted);
      cursor: pointer;
      transition: all 0.3s ease;
      z-index: 100;
      opacity: 0.6;
    }

    .heidi-badge:hover {
      opacity: 1;
      transform: scale(1.05);
      border-color: var(--swedish-yellow);
      box-shadow: 0 0 20px rgba(254, 204, 0, 0.2);
    }

    .heidi-badge svg {
      width: 20px;
      height: 20px;
    }

    .heidi-badge .heidi-text {
      display: flex;
      flex-direction: column;
      line-height: 1.2;
    }

    .heidi-badge .heart {
      color: #e74c3c;
      animation: pulse 1.5s ease infinite;
    }

    @keyframes pulse {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.1); }
    }

    body.swedish-mode .heidi-badge {
      background: linear-gradient(135deg, var(--swedish-blue), var(--swedish-yellow));
      color: #fff;
      opacity: 1;
    }

    /* Swedish mode decorations */
    .swedish-crown {
      display: none;
      position: absolute;
      top: -15px;
      right: 10px;
      font-size: 1.5rem;
    }

    body.swedish-mode .swedish-crown {
      display: block;
      animation: float 2s ease-in-out infinite;
    }

    @keyframes float {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-5px); }
    }

    .viking-ship {
      display: none;
      position: fixed;
      bottom: 60px;
      left: -100px;
      font-size: 2rem;
      animation: sail 15s linear infinite;
    }

    body.swedish-mode .viking-ship {
      display: block;
    }

    @keyframes sail {
      0% { left: -100px; }
      100% { left: calc(100% + 100px); }
    }

    /* User counter */
    .user-counter {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.5rem 1rem;
      background: var(--surface-2);
      border-radius: 20px;
      font-size: 0.75rem;
      color: var(--text-muted);
    }

    .user-counter .count {
      color: var(--accent);
      font-weight: 700;
    }

    /* Hall of Fame */
    .hall-of-fame {
      margin-top: 2rem;
      padding-top: 1.5rem;
      border-top: 1px solid var(--border);
    }

    .hall-of-fame h3 {
      font-size: 0.9rem;
      margin-bottom: 1rem;
      color: var(--text-muted);
    }

    .hof-list {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
    }

    .hof-entry {
      display: flex;
      align-items: center;
      gap: 0.25rem;
      padding: 0.25rem 0.5rem;
      background: var(--surface-2);
      border-radius: 4px;
      font-size: 0.7rem;
    }

    .hof-entry .position {
      color: var(--swedish-yellow);
      font-weight: 700;
    }

    /* Donation button - Aussie style */
    .durry-btn {
      position: fixed;
      bottom: 1rem;
      left: 1rem;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.5rem 0.75rem;
      background: linear-gradient(135deg, #8B4513, #D2691E);
      border: none;
      border-radius: 20px;
      font-size: 0.7rem;
      color: #fff;
      cursor: pointer;
      transition: all 0.3s ease;
      text-decoration: none;
      z-index: 100;
      opacity: 0.8;
    }

    .durry-btn:hover {
      opacity: 1;
      transform: scale(1.05);
      box-shadow: 0 0 15px rgba(210, 105, 30, 0.4);
    }

    .durry-btn .smoke {
      animation: smoke 2s ease-in-out infinite;
    }

    @keyframes smoke {
      0%, 100% { opacity: 0.5; transform: translateY(0); }
      50% { opacity: 1; transform: translateY(-2px); }
    }

    /* Footer badges */
    .footer-badges {
      display: flex;
      gap: 0.5rem;
      margin-top: 2rem;
      flex-wrap: wrap;
      justify-content: center;
    }

    .footer-badges a {
      opacity: 0.7;
      transition: opacity 0.2s;
    }

    .footer-badges a:hover {
      opacity: 1;
    }
  </style>
</head>
<body>
  <!-- SVG Gradient Definition for Swedish mode -->
  <svg style="position:absolute;width:0;height:0;">
    <defs>
      <linearGradient id="swedish-grad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style="stop-color:#006AA7"/>
        <stop offset="50%" style="stop-color:#FECC00"/>
        <stop offset="100%" style="stop-color:#006AA7"/>
      </linearGradient>
    </defs>
  </svg>

  <!-- Viking ship Easter egg (only in Swedish mode) -->
  <div class="viking-ship" title="Vikingaskepp!">⛵</div>

  <div class="container">
    <header style="position: relative;">
      <h1>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm4.586 14.424a.622.622 0 01-.857.207c-2.348-1.435-5.304-1.76-8.785-.964a.622.622 0 01-.277-1.215c3.809-.87 7.076-.496 9.712 1.115.293.18.386.563.207.857zm1.223-2.722a.78.78 0 01-1.072.257c-2.687-1.652-6.785-2.131-9.965-1.166a.78.78 0 01-.973-.519.781.781 0 01.52-.972c3.632-1.102 8.147-.568 11.233 1.329a.78.78 0 01.257 1.071zm.105-2.835c-3.223-1.914-8.54-2.09-11.618-1.156a.935.935 0 11-.543-1.79c3.533-1.072 9.404-.865 13.115 1.338a.935.935 0 11-.954 1.608z"/>
        </svg>
        <span data-i18n="title">Genre Sorter</span>
      </h1>
      <span class="swedish-crown" title="Sveriges kungakrona">👑</span>
      <div id="header-actions"></div>
    </header>

    <main id="app">
      <div class="loading">
        <div class="spinner"></div>
        <span data-i18n="loading">Loading...</span>
      </div>
    </main>
  </div>

  <!-- Shout me a durry button (Aussie style) -->
  <a href="https://buymeacoffee.com/tomstech" target="_blank" class="durry-btn" title="Chuck us a dart, legend">
    <span class="smoke">🚬</span>
    <span>Shout me a durry</span>
  </a>

  <!-- Heidi Easter Egg Badge -->
  <div class="heidi-badge" onclick="toggleSwedishMode()" title="Click for a Swedish surprise!">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <circle cx="12" cy="8" r="4"/>
      <path d="M4 20c0-4 4-6 8-6s8 2 8 6"/>
      <path d="M9 4c1-2 5-2 6 0" stroke="#FECC00"/>
    </svg>
    <span class="heidi-text">
      <span>Made with inspiration from</span>
      <span><strong>Heidi</strong> <span class="heart">♥</span></span>
    </span>
  </div>

  <script>
    const app = document.getElementById('app');
    const headerActions = document.getElementById('header-actions');

    let genreData = null;
    let selectedGenres = new Set();
    let swedishMode = localStorage.getItem('swedishMode') === 'true';
    let spotifyOnlyMode = false;
    let statsData = null;

    // Swedish anthem sound (short piano melody in base64 - plays "Du gamla, Du fria" opening)
    const swedishChime = 'data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//tQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAABhgC7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7//////////////////////////////////////////////////////////////////8AAAAATGF2YzU4LjEzAAAAAAAAAAAAAAAAJAAAAAAAAAAAAYZNYW9jAAAAAAAAAAAAAAAAAAAAAP/7kGQAAAAAADSAAAAAAAAANIAAAAAETEFNRTMuMTAwVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVX/+5JkDw/wAABpAAAACAAADSAAAAEAAAGkAAAAIAAANIAAAARVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV';


    // Swedish translations
    const i18n = {
      en: {
        title: 'Genre Sorter',
        loading: 'Loading...',
        organiseMusic: 'Organise Your Music',
        organiseDesc: 'Automatically sort your Spotify liked songs into genre-based playlists with one click.',
        signInGithub: 'Sign in with GitHub',
        connectSpotify: 'Connect Your Spotify',
        connectDesc: 'Connect your Spotify account to analyze your liked songs and organise them by genre.',
        connectBtn: 'Connect Spotify',
        fetchingGenres: 'Fetching your liked songs and genres...',
        likedSongs: 'Liked Songs',
        genresFound: 'Genres Found',
        selected: 'Selected',
        yourGenres: 'Your Genres',
        searchGenres: 'Search genres...',
        selectAll: 'Select All',
        selectNone: 'Select None',
        createPlaylists: 'Create Playlists',
        create: 'Create',
        creating: 'Creating...',
        created: 'Created!',
        failed: 'Failed',
        results: 'Results',
        successCreated: 'Successfully created',
        of: 'of',
        playlists: 'playlists',
        openSpotify: 'Open in Spotify',
        logout: 'Logout',
        errorLoad: 'Failed to load your genres. Please try refreshing the page.',
        refresh: 'Refresh',
        tracks: 'tracks',
        errorGithubDenied: 'GitHub authorization was denied.',
        errorNotAllowed: 'Your GitHub account is not authorized to use this app.',
        errorAuthFailed: 'Authentication failed. Please try again.',
        errorInvalidState: 'Invalid state. Please try again.',
      },
      sv: {
        title: 'Genresorterare',
        loading: 'Laddar...',
        organiseMusic: 'Organisera Din Musik',
        organiseDesc: 'Sortera automatiskt dina gillade Spotify-låtar i genrebaserade spellistor med ett klick.',
        signInGithub: 'Logga in med GitHub',
        connectSpotify: 'Anslut Din Spotify',
        connectDesc: 'Anslut ditt Spotify-konto för att analysera dina gillade låtar och organisera dem efter genre.',
        connectBtn: 'Anslut Spotify',
        fetchingGenres: 'Hämtar dina gillade låtar och genrer...',
        likedSongs: 'Gillade Låtar',
        genresFound: 'Genrer Hittade',
        selected: 'Valda',
        yourGenres: 'Dina Genrer',
        searchGenres: 'Sök genrer...',
        selectAll: 'Välj Alla',
        selectNone: 'Välj Ingen',
        createPlaylists: 'Skapa Spellistor',
        create: 'Skapa',
        creating: 'Skapar...',
        created: 'Skapad!',
        failed: 'Misslyckades',
        results: 'Resultat',
        successCreated: 'Lyckades skapa',
        of: 'av',
        playlists: 'spellistor',
        openSpotify: 'Öppna i Spotify',
        logout: 'Logga ut',
        errorLoad: 'Kunde inte ladda dina genrer. Försök att uppdatera sidan.',
        refresh: 'Uppdatera',
        tracks: 'låtar',
        errorGithubDenied: 'GitHub-auktorisering nekades.',
        errorNotAllowed: 'Ditt GitHub-konto är inte behörigt att använda denna app.',
        errorAuthFailed: 'Autentisering misslyckades. Försök igen.',
        errorInvalidState: 'Ogiltigt tillstånd. Försök igen.',
      }
    };

    function t(key) {
      const lang = swedishMode ? 'sv' : 'en';
      return i18n[lang][key] || i18n.en[key] || key;
    }

    function toggleSwedishMode() {
      swedishMode = !swedishMode;
      localStorage.setItem('swedishMode', swedishMode);
      document.body.classList.toggle('swedish-mode', swedishMode);

      // Update all translatable elements
      document.querySelectorAll('[data-i18n]').forEach(el => {
        el.textContent = t(el.dataset.i18n);
      });

      // Play Swedish chime when entering Swedish mode
      if (swedishMode) {
        try {
          const audio = new Audio(swedishChime);
          audio.volume = 0.3;
          audio.play().catch(() => {}); // Ignore autoplay restrictions
        } catch {}
        showNotification('🇸🇪 Välkommen till svenskt läge! Tack Heidi! 👑', 'success');
      } else {
        showNotification('Back to normal mode!', 'success');
      }

      // Re-render current view to update all text
      if (genreData) {
        renderGenres();
      }
    }

    // Apply Swedish mode on load if previously enabled
    if (swedishMode) {
      document.body.classList.add('swedish-mode');
    }

    async function init() {
      // Check for errors in URL
      const params = new URLSearchParams(window.location.search);
      const error = params.get('error');

      // Load stats for user counter
      try {
        statsData = await fetch('/api/stats').then(r => r.json());
      } catch {}

      // Check session
      const session = await fetch('/session').then(r => r.json());
      spotifyOnlyMode = session.spotifyOnly || false;

      if (!session.authenticated) {
        renderWelcome(error);
        return;
      }

      renderHeaderUser(session);

      // In Spotify-only mode, we're already connected if authenticated
      if (!spotifyOnlyMode && !session.spotifyConnected) {
        renderConnectSpotify();
        return;
      }

      renderLoading(t('fetchingGenres'));
      await loadGenres();
    }

    function renderWelcome(error) {
      const errorMessages = {
        'github_denied': t('errorGithubDenied'),
        'not_allowed': t('errorNotAllowed'),
        'auth_failed': t('errorAuthFailed'),
        'invalid_state': t('errorInvalidState'),
        'spotify_denied': 'Spotify authorisation was denied.',
        'spotify_auth_failed': 'Spotify authentication failed. Please try again.',
      };

      // User counter HTML
      const userCounterHtml = statsData?.userCount ? \`
        <div class="user-counter">
          <span>🎵</span>
          <span><span class="count">\${statsData.userCount}</span> music lovers have joined</span>
        </div>
      \` : '';

      // Hall of fame HTML
      const hofHtml = statsData?.hallOfFame?.length ? \`
        <div class="hall-of-fame">
          <h3>\${swedishMode ? '🏆 Första Användarna' : '🏆 First Users - Hall of Fame'}</h3>
          <div class="hof-list">
            \${statsData.hallOfFame.map(u => \`
              <div class="hof-entry">
                <span class="position">#\${u.position}</span>
                <span>\${u.spotifyName}</span>
              </div>
            \`).join('')}
          </div>
        </div>
      \` : '';

      // Different login button based on mode
      const loginButton = spotifyOnlyMode ? \`
        <a href="/auth/spotify" class="btn btn-primary">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm4.586 14.424a.622.622 0 01-.857.207c-2.348-1.435-5.304-1.76-8.785-.964a.622.622 0 01-.277-1.215c3.809-.87 7.076-.496 9.712 1.115.293.18.386.563.207.857zm1.223-2.722a.78.78 0 01-1.072.257c-2.687-1.652-6.785-2.131-9.965-1.166a.78.78 0 01-.973-.519.781.781 0 01.52-.972c3.632-1.102 8.147-.568 11.233 1.329a.78.78 0 01.257 1.071zm.105-2.835c-3.223-1.914-8.54-2.09-11.618-1.156a.935.935 0 11-.543-1.79c3.533-1.072 9.404-.865 13.115 1.338a.935.935 0 11-.954 1.608z"/>
          </svg>
          <span>\${swedishMode ? 'Logga in med Spotify' : 'Sign in with Spotify'}</span>
        </a>
      \` : \`
        <a href="/auth/github" class="btn btn-primary">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/>
          </svg>
          <span data-i18n="signInGithub">\${t('signInGithub')}</span>
        </a>
      \`;

      app.innerHTML = \`
        <div class="welcome">
          \${error ? \`<div class="error">\${errorMessages[error] || error}</div>\` : ''}
          \${userCounterHtml}
          <h2 data-i18n="organiseMusic">\${t('organiseMusic')}</h2>
          <p data-i18n="organiseDesc">\${t('organiseDesc')}</p>
          \${loginButton}
          <div class="footer-badges">
            <a href="https://github.com/TomsTech/spotify-genre-sorter" target="_blank">
              <img src="https://img.shields.io/github/stars/TomsTech/spotify-genre-sorter?style=social" alt="Star on GitHub">
            </a>
            <a href="https://stats.uptimerobot.com/tomstech" target="_blank">
              <img src="https://img.shields.io/badge/uptime-100%25-brightgreen" alt="Uptime">
            </a>
          </div>
          \${hofHtml}
        </div>
      \`;
    }

    function renderHeaderUser(session) {
      const avatar = session.avatar || session.spotifyAvatar || session.githubAvatar;
      const user = session.user || session.spotifyUser || session.githubUser;
      headerActions.innerHTML = \`
        <div class="user-info">
          \${avatar ? \`<img src="\${avatar}" alt="" class="avatar">\` : ''}
          <span>\${user || 'User'}</span>
          <a href="/auth/logout" class="btn btn-ghost" data-i18n="logout">\${t('logout')}</a>
        </div>
      \`;
    }

    function renderConnectSpotify() {
      app.innerHTML = \`
        <div class="card">
          <h2 class="card-title" data-i18n="connectSpotify">\${t('connectSpotify')}</h2>
          <p style="color: var(--text-muted); margin-bottom: 1.5rem;" data-i18n="connectDesc">
            \${t('connectDesc')}
          </p>
          <a href="/auth/spotify" class="btn btn-primary">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm4.586 14.424a.622.622 0 01-.857.207c-2.348-1.435-5.304-1.76-8.785-.964a.622.622 0 01-.277-1.215c3.809-.87 7.076-.496 9.712 1.115.293.18.386.563.207.857zm1.223-2.722a.78.78 0 01-1.072.257c-2.687-1.652-6.785-2.131-9.965-1.166a.78.78 0 01-.973-.519.781.781 0 01.52-.972c3.632-1.102 8.147-.568 11.233 1.329a.78.78 0 01.257 1.071zm.105-2.835c-3.223-1.914-8.54-2.09-11.618-1.156a.935.935 0 11-.543-1.79c3.533-1.072 9.404-.865 13.115 1.338a.935.935 0 11-.954 1.608z"/>
            </svg>
            <span data-i18n="connectBtn">\${t('connectBtn')}</span>
          </a>
        </div>
      \`;
    }

    function renderLoading(message) {
      app.innerHTML = \`
        <div class="loading">
          <div class="spinner"></div>
          <span>\${message}</span>
        </div>
      \`;
    }

    async function loadGenres() {
      try {
        const response = await fetch('/api/genres');
        if (!response.ok) {
          throw new Error('Failed to load genres');
        }
        genreData = await response.json();
        renderGenres();
      } catch (error) {
        app.innerHTML = \`
          <div class="error" data-i18n="errorLoad">
            \${t('errorLoad')}
          </div>
          <button onclick="location.reload()" class="btn btn-secondary" data-i18n="refresh">\${t('refresh')}</button>
        \`;
      }
    }

    function renderGenres() {
      const filteredGenres = filterGenres('');

      app.innerHTML = \`
        <div class="stats">
          <div class="stat">
            <div class="stat-value">\${genreData.totalTracks.toLocaleString()}</div>
            <div class="stat-label" data-i18n="likedSongs">\${t('likedSongs')}</div>
          </div>
          <div class="stat">
            <div class="stat-value">\${genreData.totalGenres.toLocaleString()}</div>
            <div class="stat-label" data-i18n="genresFound">\${t('genresFound')}</div>
          </div>
          <div class="stat">
            <div class="stat-value" id="selected-count">0</div>
            <div class="stat-label" data-i18n="selected">\${t('selected')}</div>
          </div>
        </div>

        <div class="card">
          <h2 class="card-title" data-i18n="yourGenres">\${t('yourGenres')}</h2>
          <input
            type="text"
            class="search-input"
            placeholder="\${t('searchGenres')}"
            data-i18n-placeholder="searchGenres"
            oninput="filterAndRenderGenres(this.value)"
          >
          <div class="genre-list" id="genre-list"></div>
          <div class="actions">
            <button onclick="selectAll()" class="btn btn-secondary" data-i18n="selectAll">\${t('selectAll')}</button>
            <button onclick="selectNone()" class="btn btn-secondary" data-i18n="selectNone">\${t('selectNone')}</button>
            <button onclick="createSelectedPlaylists()" class="btn btn-primary" id="create-btn" disabled data-i18n="createPlaylists">
              \${t('createPlaylists')}
            </button>
          </div>
        </div>

        <div id="results"></div>
      \`;

      renderGenreList(filteredGenres);
    }

    function filterGenres(query) {
      if (!query) return genreData.genres;
      const lower = query.toLowerCase();
      return genreData.genres.filter(g => g.name.toLowerCase().includes(lower));
    }

    function filterAndRenderGenres(query) {
      const filtered = filterGenres(query);
      renderGenreList(filtered);
    }

    function renderGenreList(genres) {
      const list = document.getElementById('genre-list');
      list.innerHTML = genres.map(genre => \`
        <label class="genre-item">
          <input
            type="checkbox"
            class="genre-checkbox"
            value="\${genre.name}"
            \${selectedGenres.has(genre.name) ? 'checked' : ''}
            onchange="toggleGenre('\${genre.name.replace(/'/g, "\\\\'")}', this.checked)"
          >
          <span class="genre-name">\${genre.name}</span>
          <span class="genre-count">\${genre.count} \${t('tracks')}</span>
          <button
            class="btn btn-ghost genre-create"
            onclick="event.preventDefault(); createPlaylist('\${genre.name.replace(/'/g, "\\\\'")}')"
            data-i18n="create"
          >
            \${t('create')}
          </button>
        </label>
      \`).join('');
    }

    function toggleGenre(name, checked) {
      if (checked) {
        selectedGenres.add(name);
      } else {
        selectedGenres.delete(name);
      }
      updateSelectedCount();
    }

    function updateSelectedCount() {
      document.getElementById('selected-count').textContent = selectedGenres.size;
      document.getElementById('create-btn').disabled = selectedGenres.size === 0;
    }

    function selectAll() {
      const checkboxes = document.querySelectorAll('.genre-checkbox');
      checkboxes.forEach(cb => {
        cb.checked = true;
        selectedGenres.add(cb.value);
      });
      updateSelectedCount();
    }

    function selectNone() {
      selectedGenres.clear();
      const checkboxes = document.querySelectorAll('.genre-checkbox');
      checkboxes.forEach(cb => cb.checked = false);
      updateSelectedCount();
    }

    async function createPlaylist(genreName) {
      const genre = genreData.genres.find(g => g.name === genreName);
      if (!genre) return;

      const btn = event.target;
      btn.disabled = true;
      btn.textContent = t('creating');

      try {
        const response = await fetch('/api/playlist', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ genre: genre.name, trackIds: genre.trackIds }),
        });

        const result = await response.json();

        if (result.success) {
          btn.textContent = t('created');
          btn.style.color = 'var(--accent)';
          showNotification(\`\${swedishMode ? 'Skapade spellista' : 'Created playlist'}: \${genre.name} (\${genre.count} \${t('tracks')})\`, 'success');
        } else {
          throw new Error(result.error);
        }
      } catch (error) {
        btn.textContent = t('failed');
        btn.style.color = 'var(--danger)';
        showNotification(\`\${t('failed')}: \${error.message}\`, 'error');
      }

      setTimeout(() => {
        btn.disabled = false;
        btn.textContent = t('create');
        btn.style.color = '';
      }, 3000);
    }

    async function createSelectedPlaylists() {
      if (selectedGenres.size === 0) return;

      const btn = document.getElementById('create-btn');
      btn.disabled = true;
      btn.textContent = \`\${t('creating').replace('...', '')} \${selectedGenres.size} \${t('playlists')}...\`;

      const genres = genreData.genres
        .filter(g => selectedGenres.has(g.name))
        .map(g => ({ name: g.name, trackIds: g.trackIds }));

      try {
        const response = await fetch('/api/playlists/bulk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ genres }),
        });

        const result = await response.json();

        document.getElementById('results').innerHTML = \`
          <div class="card">
            <h2 class="card-title" data-i18n="results">\${t('results')}</h2>
            <p style="margin-bottom: 1rem;">
              \${t('successCreated')} \${result.successful} \${t('of')} \${result.total} \${t('playlists')}.
            </p>
            <div class="results">
              \${result.results.map(r => \`
                <div class="result-item">
                  <span>\${r.genre}</span>
                  \${r.success
                    ? \`<a href="\${r.url}" target="_blank" class="result-success" data-i18n="openSpotify">\${t('openSpotify')}</a>\`
                    : \`<span class="result-error">\${r.error}</span>\`
                  }
                </div>
              \`).join('')}
            </div>
          </div>
        \`;

        selectedGenres.clear();
        updateSelectedCount();
        renderGenreList(filterGenres(''));
      } catch (error) {
        showNotification(\`\${t('failed')}: \${error.message}\`, 'error');
      }

      btn.disabled = false;
      btn.textContent = t('createPlaylists');
    }

    function showNotification(message, type) {
      const existing = document.querySelector('.notification');
      if (existing) existing.remove();

      const div = document.createElement('div');
      div.className = \`notification \${type}\`;
      div.style.cssText = \`
        position: fixed;
        bottom: 4rem;
        right: 2rem;
        padding: 1rem 1.5rem;
        border-radius: 8px;
        background: \${type === 'success' ? 'var(--accent)' : 'var(--danger)'};
        color: \${type === 'success' ? '#000' : '#fff'};
        font-weight: 500;
        z-index: 1000;
        animation: slideIn 0.3s ease;
        max-width: 300px;
      \`;
      div.textContent = message;
      document.body.appendChild(div);

      setTimeout(() => div.remove(), 5000);
    }

    // Initialize
    init();
  </script>
</body>
</html>`;
}

export default app;
