    const app = document.getElementById('app');
    const headerActions = document.getElementById('header-actions');

    let genreData = null;
    let selectedGenres = new Set();
    let swedishMode = localStorage.getItem('swedishMode') === 'true';
    let spotifyOnlyMode = false;
    let statsData = null;
    let playlistTemplate = localStorage.getItem('playlistTemplate') || '{genre} (from Likes)';

    // Hidden genres (stored in localStorage)
    let hiddenGenres = new Set(JSON.parse(localStorage.getItem('hiddenGenres') || '[]'));
    let showHiddenGenres = localStorage.getItem('showHiddenGenres') === 'true';

    // Theme preference (respects system preference by default, defaults to dark)
    let lightMode = localStorage.getItem('lightMode');
    if (lightMode === null) {
      // Default to dark mode unless system prefers light
      lightMode = window.matchMedia('(prefers-color-scheme: light)').matches;
      if (!lightMode) localStorage.setItem('lightMode', 'false');
    } else {
      lightMode = lightMode === 'true';
    }
    if (lightMode) document.body.classList.add('light-mode');

    // Add theme toggle to header immediately (visible before login)
    if (headerActions) {
      headerActions.innerHTML = \`
        <button id="theme-toggle" onclick="toggleTheme()" class="btn btn-ghost btn-sm theme-toggle-btn" title="\${lightMode ? 'Switch to dark mode' : 'Switch to light mode'}">
          \${lightMode ? '🌙' : '☀️'}
        </button>
      \`;
    }

    // Stats dashboard state
    let showStatsDashboard = localStorage.getItem('showStatsDashboard') === 'true';

    // === SWEDISH EASTER EGGS ===

    // ABBA quotes for loading messages
    const abbaQuotes = [
      'Take a chance on loading...',
      'I have a dream... of your playlists!',
      'Knowing me, knowing your music!',
      'Money, money, money... but this is free!',
      'Thank you for the music!',
      'The winner takes it all!',
      'Dancing queen, loading up the scene...',
      'Gimme gimme gimme your liked songs!',
      'Waterloo! We surrendered to your library!',
      'Super trouper, lights are gonna blind ya!',
    ];

    // Swedish fun facts for tooltip
    const swedishFacts = [
      'Sweden invented the three-point seatbelt and gave it away for free!',
      'IKEA sells about 2 billion Swedish meatballs every year!',
      'In Sweden, there\\'s a hotel made entirely of ice!',
      'Swedes love fika - coffee breaks are sacred!',
      'Sweden has more islands than any other country!',
      'The Nobel Prize was created by Swedish inventor Alfred Nobel!',
      'Minecraft was created in Sweden!',
      'Spotify was founded in Stockholm!',
      'Sweden has a phone number anyone can call to talk to a random Swede!',
      'Allemansrätten: Swedes can camp anywhere in nature!',
    ];

    // Midsommar check (June)
    const isMidsommarSeason = new Date().getMonth() === 5; // June

    // Fika reminder (25 minutes)
    let fikaTimerStarted = false;
    let fikaTimerId = null;

    function startFikaTimer() {
      if (fikaTimerStarted || !swedishMode) return;
      fikaTimerStarted = true;
      fikaTimerId = setTimeout(() => {
        if (swedishMode) {
          showFikaReminder();
        }
      }, 25 * 60 * 1000); // 25 minutes
    }

    function showFikaReminder() {
      const reminder = document.createElement('div');
      reminder.className = 'fika-reminder';
      reminder.innerHTML = \`
        <div class="fika-content">
          <span class="fika-emoji">☕🍪</span>
          <p>Dags för fika!</p>
          <p style="font-size: 0.9rem; opacity: 0.8;">Time for a coffee break!</p>
          <button class="btn btn-ghost" onclick="this.closest('.fika-reminder').remove()">Tack!</button>
        </div>
      \`;
      document.body.appendChild(reminder);
    }

    function getRandomAbbaQuote() {
      return abbaQuotes[Math.floor(Math.random() * abbaQuotes.length)];
    }

    function getRandomSwedishFact() {
      return swedishFacts[Math.floor(Math.random() * swedishFacts.length)];
    }

    // Update Heidi badge tooltip with random fact
    function updateHeidiBadgeFact() {
      const badge = document.querySelector('.heidi-badge');
      if (badge && swedishMode) {
        badge.title = getRandomSwedishFact();
      }
    }

    // Swedish anthem sound (short piano melody in base64 - plays "Du gamla, Du fria" opening)
    const swedishChime = 'data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//tQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAABhgC7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7//////////////////////////////////////////////////////////////////8AAAAATGF2YzU4LjEzAAAAAAAAAAAAAAAAJAAAAAAAAAAAAYZNYW9jAAAAAAAAAAAAAAAAAAAAAP/7kGQAAAAAADSAAAAAAAAANIAAAAAETEFNRTMuMTAwVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVX/+5JkDw/wAABpAAAACAAADSAAAAEAAAGkAAAAIAAANIAAAARVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV';

    // Deployment Monitor
    let deployStatus = null;
    let clientVersion = null;
    let deployPollInterval = null;
    const DEPLOY_CACHE_KEY = 'genreGenie_deployCache';

    // Load cached deploy status
    function loadCachedDeployStatus() {
      try {
        const cached = localStorage.getItem(DEPLOY_CACHE_KEY);
        return cached ? JSON.parse(cached) : null;
      } catch {
        return null;
      }
    }

    // Save deploy status to cache
    function cacheDeployStatus(data) {
      try {
        localStorage.setItem(DEPLOY_CACHE_KEY, JSON.stringify(data));
      } catch {}
    }

    async function checkDeployStatus() {
      try {
        const response = await fetch('/deploy-status');
        const data = await response.json();

        // Store client version on first load
        if (!clientVersion) {
          clientVersion = data.version;
        }

        deployStatus = data;
        cacheDeployStatus(data);
        updateDeployWidget(data);

        // Check for version mismatch
        if (clientVersion && data.version && clientVersion !== data.version) {
          showVersionMismatchPrompt(data.version);
        }
      } catch {
        // Use cached data if API fails
        const cached = loadCachedDeployStatus();
        if (cached) {
          deployStatus = cached;
          updateDeployWidget(cached, true);
        } else {
          // Show minimal fallback widget
          updateDeployWidget({ version: '?.?.?', deployment: null }, true);
        }
      }
    }

    function updateDeployWidget(data, isOffline = false) {
      const widget = document.getElementById('deploy-widget');
      if (!widget) return;

      const deployment = data?.deployment;
      const statusIcon = widget.querySelector('.status-icon');
      const deployText = widget.querySelector('.deploy-text');

      // ALWAYS show the widget
      widget.style.display = 'flex';
      widget.classList.remove('deploying', 'success', 'failure');

      // Get release name from changelog cache if available
      const releaseName = changelogCache?.changelog?.[0]?.changes?.[0] || '';
      const shortReleaseName = releaseName.length > 20 ? releaseName.substring(0, 20) + '...' : releaseName;

      if (deployment?.status === 'in_progress' || deployment?.status === 'queued') {
        widget.classList.add('deploying');
        statusIcon.innerHTML = '<div class="spinner-small"></div>';
        deployText.textContent = deployment.currentStep || 'Deploying...';
      } else if (deployment?.conclusion === 'success') {
        widget.classList.add('success');
        statusIcon.innerHTML = \`<img class="avatar" src="\${deployment.author?.avatar || ''}" alt="" onerror="this.style.display='none';this.parentElement.textContent='✓'">\`;
        const updatedAt = new Date(deployment.updatedAt);
        const timeAgo = formatTimeAgo(updatedAt);
        // Show version, release hint if available, and time
        let text = \`v\${data.version}\`;
        if (shortReleaseName) text += \` • \${shortReleaseName}\`;
        text += \` • \${timeAgo}\`;
        if (isOffline) text += ' (cached)';
        deployText.textContent = text;
      } else if (deployment?.conclusion === 'failure') {
        widget.classList.add('failure');
        statusIcon.textContent = '❌';
        deployText.textContent = 'Deploy failed';
      } else {
        // Fallback: show version only
        statusIcon.textContent = '✨';
        let text = \`v\${data?.version || '?.?.?'}\`;
        if (shortReleaseName) text += \` • \${shortReleaseName}\`;
        if (isOffline) text += ' (offline)';
        deployText.textContent = text;
      }
    }

    function formatTimeAgo(date) {
      const now = new Date();
      const diff = Math.floor((now - date) / 1000);
      if (diff < 60) return 'just now';
      if (diff < 3600) return \`\${Math.floor(diff / 60)}m ago\`;
      if (diff < 86400) return \`\${Math.floor(diff / 3600)}h ago\`;
      return \`\${Math.floor(diff / 86400)}d ago\`;
    }

    function showVersionMismatchPrompt(newVersion) {
      // Don't show multiple times
      if (document.querySelector('.deploy-overlay')) return;

      const overlay = document.createElement('div');
      overlay.className = 'deploy-overlay';

      const prompt = document.createElement('div');
      prompt.className = 'deploy-refresh-prompt';
      prompt.innerHTML = \`
        <h3>🚀 New Version Available!</h3>
        <p>Version \${newVersion} has been deployed. Refresh to get the latest features.</p>
        <button onclick="location.reload(true)" class="btn btn-primary">Refresh Now</button>
        <button onclick="dismissVersionPrompt()" class="btn btn-secondary" style="margin-left: 0.5rem;">Later</button>
      \`;

      document.body.appendChild(overlay);
      document.body.appendChild(prompt);
    }

    function dismissVersionPrompt() {
      document.querySelector('.deploy-overlay')?.remove();
      document.querySelector('.deploy-refresh-prompt')?.remove();
    }

    let changelogCache = null;

    async function showDeployDetails() {
      // Fetch changelog if not cached
      if (!changelogCache) {
        try {
          const res = await fetch('/api/changelog');
          changelogCache = await res.json();
        } catch {
          showNotification('Failed to load changelog', 'error');
          return;
        }
      }

      // Create overlay
      const overlay = document.createElement('div');
      overlay.className = 'changelog-overlay';
      overlay.onclick = (e) => {
        if (e.target === overlay) closeChangelog();
      };

      // Create timeline panel
      const panel = document.createElement('div');
      panel.className = 'changelog-panel';

      const header = document.createElement('div');
      header.className = 'changelog-header';
      header.innerHTML = \`
        <h3>\${swedishMode ? 'Versionshistorik' : 'Version History'}</h3>
        <button class="changelog-close" onclick="closeChangelog()">&times;</button>
      \`;

      const timeline = document.createElement('div');
      timeline.className = 'changelog-timeline';

      for (const release of changelogCache.changelog) {
        const item = document.createElement('div');
        item.className = 'changelog-item' + (release.version === deployStatus?.version ? ' current' : '');

        const dot = document.createElement('div');
        dot.className = 'changelog-dot';

        const content = document.createElement('div');
        content.className = 'changelog-content';
        content.innerHTML = \`
          <div class="changelog-version">v\${release.version}</div>
          <div class="changelog-date">\${release.date}</div>
          <ul class="changelog-changes">
            \${release.changes.map(c => \`<li>\${c}</li>\`).join('')}
          </ul>
        \`;

        item.appendChild(dot);
        item.appendChild(content);
        timeline.appendChild(item);
      }

      const footer = document.createElement('div');
      footer.className = 'changelog-footer';
      footer.innerHTML = \`<a href="\${changelogCache.repoUrl}/releases" target="_blank">\${swedishMode ? 'Visa alla utgåvor' : 'View all releases'} →</a>\`;

      panel.appendChild(header);
      panel.appendChild(timeline);
      panel.appendChild(footer);
      overlay.appendChild(panel);
      document.body.appendChild(overlay);

      // Animate in
      requestAnimationFrame(() => {
        overlay.classList.add('visible');
        panel.classList.add('visible');
      });
    }

    function closeChangelog() {
      const overlay = document.querySelector('.changelog-overlay');
      const panel = document.querySelector('.changelog-panel');
      if (overlay) {
        overlay.classList.remove('visible');
        panel?.classList.remove('visible');
        setTimeout(() => overlay.remove(), 300);
      }
    }
    // Make changelog functions globally accessible
    window.showDeployDetails = showDeployDetails;
    window.closeChangelog = closeChangelog;

    // Start deployment polling
    function startDeployMonitor() {
      checkDeployStatus();
      deployPollInterval = setInterval(checkDeployStatus, 10000); // Poll every 10s
    }

    // Swedish translations
    const i18n = {
      en: {
        title: 'Genre Genie',
        loading: 'Loading...',
        organiseMusic: 'Organise Your Music',
        organiseDesc: 'Automatically sort your Spotify liked songs into genre-based playlists with one click.',
        signInGithub: 'Sign in with GitHub',
        connectSpotify: 'Connect Your Spotify',
        connectDesc: 'Connect your Spotify account to analyse your liked songs and organise them by genre.',
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
        errorNotAllowed: 'Your GitHub account is not authorised to use this app.',
        errorAuthFailed: 'Authentication failed. Please try again.',
        errorInvalidState: 'Invalid state. Please try again.',
        hallOfFame: 'First Users - Hall of Fame',
        musicLoversJoined: 'music lovers have joined',
        signInSpotify: 'Sign in with Spotify',
        pioneers: 'Pioneers',
        newUsers: 'New Users',
        recentPlaylists: 'Recent Playlists',
        viewScoreboard: 'View Scoreboard',
      },
      sv: {
        title: 'Genre Genie',
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
        hallOfFame: 'Första Användarna',
        musicLoversJoined: 'musikälskare har gått med',
        signInSpotify: 'Logga in med Spotify',
        pioneers: 'Pionjärer',
        newUsers: 'Nya Användare',
        recentPlaylists: 'Senaste Spellistor',
        viewScoreboard: 'Visa Resultattavla',
      }
    };

    function t(key) {
      const lang = swedishMode ? 'sv' : 'en';
      return i18n[lang][key] || i18n.en[key] || key;
    }

    // Centralised Swedish mode application - handles ALL state changes
    function applySwedishMode(enabled, options = {}) {
      const { playSound = false, showNotif = false } = options;

      // Update body classes
      document.body.classList.toggle('swedish-mode', enabled);
      if (enabled && isMidsommarSeason) {
        document.body.classList.add('midsommar');
      } else {
        document.body.classList.remove('midsommar');
      }

      // Update all translatable elements
      document.querySelectorAll('[data-i18n]').forEach(el => {
        el.textContent = t(el.dataset.i18n);
      });

      // Update donation button (durry -> snus)
      const donationBtn = document.getElementById('donation-btn');
      if (donationBtn) {
        const icon = donationBtn.querySelector('.icon');
        const text = donationBtn.querySelector('.text');
        if (enabled) {
          if (icon) icon.textContent = '🫙';
          if (text) text.textContent = 'Bjud mig på snus';
          donationBtn.title = 'Tack för stödet, kompis!';
        } else {
          if (icon) icon.textContent = '🚬';
          if (text) text.textContent = 'Shout me a durry';
          donationBtn.title = 'Chuck us a dart, legend';
        }
      }

      // Update Heidi badge
      const heidiBadge = document.querySelector('.heidi-badge');
      if (heidiBadge) {
        const heidiText = heidiBadge.querySelector('.heidi-text span');
        if (heidiText) {
          heidiText.textContent = enabled ? 'För Heidi' : 'For Heidi';
        }
      }

      // Update placeholder text in search inputs
      const searchInput = document.querySelector('.search-input');
      if (searchInput) {
        searchInput.placeholder = enabled ? 'Sök genrer... (/ för att fokusera)' : 'Search genres... (/ to focus)';
      }

      // Update Hall of Fame title if visible
      const hofTitle = document.querySelector('.hall-of-fame h3');
      if (hofTitle) {
        hofTitle.textContent = enabled ? '🏆 Hedersvägg' : '🏆 Hall of Fame';
      }

      // Update loading messages if loading is in progress
      const loadingMessage = document.querySelector('.progress-message, .loading span');
      if (loadingMessage && loadingMessage.textContent) {
        // Loading messages will be updated by the loading functions
      }

      // Play sound and show notification only on toggle (not on page load)
      if (playSound && enabled) {
        try {
          const audio = new Audio(swedishChime);
          audio.volume = 0.3;
          audio.play().catch(() => {});
        } catch {}
      }

      if (showNotif) {
        if (enabled) {
          showNotification('🇸🇪 Välkommen till svenskt läge! Tack Heidi! 👑', 'success');
        } else {
          showNotification('Back to normal mode!', 'success');
        }
      }

      // Start/stop fika timer
      if (enabled) {
        startFikaTimer();
        updateHeidiBadgeFact();
      }

      // Re-render current view to update all text
      if (genreData) {
        renderGenres();
      }

      // Re-render sidebar content with updated language
      if (typeof renderPioneers === 'function') renderPioneers();
      if (typeof renderNewUsers === 'function') renderNewUsers();
      if (typeof renderRecentPlaylists === 'function') renderRecentPlaylists();
    }

    function toggleSwedishMode() {
      swedishMode = !swedishMode;
      localStorage.setItem('swedishMode', swedishMode);
      applySwedishMode(swedishMode, { playSound: true, showNotif: true });
    }
    // Make toggleSwedishMode globally accessible
    window.toggleSwedishMode = toggleSwedishMode;

    // Apply Swedish mode on load if previously enabled
    if (swedishMode) {
      // Defer to ensure DOM is ready
      setTimeout(() => applySwedishMode(true, { playSound: false, showNotif: false }), 0);
    }

    async function init() {
      // Check for errors in URL
      const params = new URLSearchParams(window.location.search);
      const error = params.get('error');

      // Load stats for user counter
      try {
        statsData = await fetch('/stats').then(r => r.json());
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

      // User counter HTML - now with Swedish translation
      const userCounterHtml = statsData?.userCount ? \`
        <div class="user-counter">
          <span>\${swedishMode ? '🇸🇪' : '🎵'}</span>
          <span><span class="count">\${statsData.userCount}</span> \${t('musicLoversJoined')}</span>
        </div>
      \` : '';

      // Hall of fame removed - now using sidebar Pioneers section

      // Different login button based on mode
      const loginButton = spotifyOnlyMode ? \`
        <a href="/auth/spotify" class="btn btn-primary">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm4.586 14.424a.622.622 0 01-.857.207c-2.348-1.435-5.304-1.76-8.785-.964a.622.622 0 01-.277-1.215c3.809-.87 7.076-.496 9.712 1.115.293.18.386.563.207.857zm1.223-2.722a.78.78 0 01-1.072.257c-2.687-1.652-6.785-2.131-9.965-1.166a.78.78 0 01-.973-.519.781.781 0 01.52-.972c3.632-1.102 8.147-.568 11.233 1.329a.78.78 0 01.257 1.071zm.105-2.835c-3.223-1.914-8.54-2.09-11.618-1.156a.935.935 0 11-.543-1.79c3.533-1.072 9.404-.865 13.115 1.338a.935.935 0 11-.954 1.608z"/>
          </svg>
          <span>\${t('signInSpotify')}</span>
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
              <img src="https://img.shields.io/github/stars/TomsTech/spotify-genre-sorter?style=for-the-badge&logo=github&logoColor=white&label=Star&color=1DB954&labelColor=191414" alt="Star on GitHub" loading="lazy" onerror="this.style.display='none'">
            </a>
            <a href="https://status.houstons.tech" target="_blank">
              <img src="https://uptime.betterstack.com/status-badges/v3/monitor/3843047.svg" alt="Uptime" loading="lazy" onerror="this.style.display='none'">
            </a>
          </div>
        </div>
      \`;
    }

    function renderHeaderUser(session) {
      const avatar = session.avatar || session.spotifyAvatar || session.githubAvatar;
      const user = session.user || session.spotifyUser || session.githubUser;
      const lightMode = document.body.classList.contains('light-mode');
      // Keep theme toggle in header, add user info next to it
      headerActions.innerHTML = \`
        <button id="theme-toggle" onclick="toggleTheme()" class="btn btn-ghost btn-sm theme-toggle-btn" title="\${lightMode ? 'Switch to dark mode' : 'Switch to light mode'}">
          \${lightMode ? '🌙' : '☀️'}
        </button>
        <div class="user-info">
          \${avatar ? \`<img src="\${avatar}" alt="" class="avatar" onerror="this.style.display='none'">\` : ''}
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

    function renderLoading(message, subMessage = '') {
      // Use ABBA quotes in Swedish mode
      const displayMessage = swedishMode ? getRandomAbbaQuote() : message;
      app.innerHTML = \`
        <div class="loading">
          <div class="spinner"></div>
          <span>\${displayMessage}</span>
          \${subMessage ? \`<span class="loading-sub">\${subMessage}</span>\` : ''}
        </div>
      \`;
    }

    // Genre emoji mapping for common genres
    const genreEmojis = {
      'rock': '🎸', 'pop': '🎤', 'hip hop': '🎧', 'rap': '🎤', 'jazz': '🎷',
      'classical': '🎻', 'electronic': '🎹', 'dance': '💃', 'r&b': '🎵', 'soul': '💜',
      'country': '🤠', 'folk': '🪕', 'blues': '🎺', 'metal': '🤘', 'punk': '⚡',
      'indie': '🎪', 'alternative': '🔮', 'reggae': '🌴', 'latin': '💃', 'disco': '🪩',
      'house': '🏠', 'techno': '🔊', 'ambient': '🌙', 'chill': '😌', 'lofi': '📻',
      'k-pop': '🇰🇷', 'j-pop': '🇯🇵', 'swedish': '🇸🇪', 'australian': '🦘',
      'punk rock': '🎸', 'hard rock': '🔥', 'soft rock': '🌸', 'classic rock': '🎸',
      'death metal': '💀', 'black metal': '⬛', 'heavy metal': '🤘',
      'trap': '🔥', 'drill': '🔫', 'grime': '🇬🇧', 'uk garage': '🇬🇧',
      'edm': '🎆', 'dubstep': '📢', 'drum and bass': '🥁', 'trance': '🌀',
      'gospel': '⛪', 'christian': '✝️', 'worship': '🙏',
      'soundtrack': '🎬', 'video game': '🎮', 'anime': '🎌',
      'christmas': '🎄', 'holiday': '🎁', 'summer': '☀️', 'winter': '❄️',
      'workout': '💪', 'party': '🎉', 'sleep': '😴', 'focus': '🧠', 'study': '📚',
      'romantic': '❤️', 'sad': '😢', 'happy': '😊', 'angry': '😠',
    };

    function getGenreEmoji(genreName) {
      const lower = genreName.toLowerCase();
      // Direct match
      if (genreEmojis[lower]) return genreEmojis[lower];
      // Partial match
      for (const [key, emoji] of Object.entries(genreEmojis)) {
        if (lower.includes(key) || key.includes(lower)) return emoji;
      }
      return '🎵'; // Default music note
    }

    // Escape text for safe HTML/JSON output
    function escapeForHtml(text) {
      return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    }

    // Album art carousel state
    let albumArtUrls = [];
    let albumCarouselIndex = 0;
    let albumCarouselInterval = null;

    // Animated counter helper - adds pulse effect when value changes
    function animateCounter(element, newValue) {
      if (!element) return;
      const oldValue = element.textContent;
      if (oldValue !== newValue) {
        element.classList.add('counting');
        element.textContent = newValue;
        setTimeout(() => element.classList.remove('counting'), 300);
      }
    }

    // Rotate album carousel to show different covers
    function rotateAlbumCarousel() {
      if (albumArtUrls.length < 3) return;
      albumCarouselIndex = (albumCarouselIndex + 1) % albumArtUrls.length;
      updateAlbumCarousel();
    }

    // Update album carousel display
    function updateAlbumCarousel() {
      const carousel = document.getElementById('album-carousel');
      if (!carousel || albumArtUrls.length < 3) return;

      const len = albumArtUrls.length;
      const leftIdx = (albumCarouselIndex - 1 + len) % len;
      const centerIdx = albumCarouselIndex;
      const rightIdx = (albumCarouselIndex + 1) % len;

      carousel.innerHTML = [
        '<div class="album-art-item left visible">',
        '<img src="' + albumArtUrls[leftIdx] + '" alt="" loading="lazy">',
        '</div>',
        '<div class="album-art-item center visible">',
        '<img src="' + albumArtUrls[centerIdx] + '" alt="" loading="lazy">',
        '</div>',
        '<div class="album-art-item right visible">',
        '<img src="' + albumArtUrls[rightIdx] + '" alt="" loading="lazy">',
        '</div>'
      ].join('');
    }

    // Update bar chart with top genres
    function updateBarChart(genres) {
      const container = document.getElementById('bar-chart-items');
      if (!container) return;

      const sortedGenres = [...genres].sort((a, b) => b.count - a.count).slice(0, 8);
      const maxCount = sortedGenres[0]?.count || 1;

      container.innerHTML = sortedGenres.map(g => {
        const percentage = (g.count / maxCount) * 100;
        const safeName = escapeForHtml(g.name);
        return [
          '<div class="bar-chart-item">',
          '<div class="bar-chart-label">' + safeName + '</div>',
          '<div class="bar-chart-bar-container">',
          '<div class="bar-chart-bar" style="width: ' + percentage + '%"></div>',
          '</div>',
          '<div class="bar-chart-count">' + g.count + '</div>',
          '</div>'
        ].join('');
      }).join('');
    }

    // Clean up carousel interval when loading completes
    function stopAlbumCarousel() {
      if (albumCarouselInterval) {
        clearInterval(albumCarouselInterval);
        albumCarouselInterval = null;
      }
      albumArtUrls = [];
      albumCarouselIndex = 0;
    }

    // Fireworks celebration effect
    function triggerFireworks() {
      const colors = ['#1DB954', '#1ed760', '#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7'];
      const container = document.createElement('div');
      container.className = 'fireworks-container';
      document.body.appendChild(container);

      // Create celebration text
      const celebText = document.createElement('div');
      celebText.className = 'celebration-text';
      celebText.textContent = swedishMode ? '🎉 Klart!' : '🎉 Done!';
      document.body.appendChild(celebText);

      // Launch multiple fireworks
      for (let i = 0; i < 8; i++) {
        setTimeout(() => launchFirework(container, colors), i * 150);
      }

      // Play a subtle celebration sound (optional, won't play if audio not allowed)
      try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        oscillator.frequency.setValueAtTime(523.25, audioCtx.currentTime); // C5
        oscillator.frequency.setValueAtTime(659.25, audioCtx.currentTime + 0.1); // E5
        oscillator.frequency.setValueAtTime(783.99, audioCtx.currentTime + 0.2); // G5
        gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.5);
        oscillator.start(audioCtx.currentTime);
        oscillator.stop(audioCtx.currentTime + 0.5);
      } catch (e) {
        // Audio not available, that's fine
      }

      // Clean up after animation
      setTimeout(() => {
        celebText.classList.add('fade-out');
        setTimeout(() => {
          container.remove();
          celebText.remove();
        }, 500);
      }, 2000);
    }

    function launchFirework(container, colors) {
      const x = Math.random() * window.innerWidth;
      const y = Math.random() * (window.innerHeight * 0.6) + (window.innerHeight * 0.1);
      const color = colors[Math.floor(Math.random() * colors.length)];
      const particleCount = 20 + Math.floor(Math.random() * 15);

      for (let i = 0; i < particleCount; i++) {
        const particle = document.createElement('div');
        particle.className = 'firework-particle';
        particle.style.left = x + 'px';
        particle.style.top = y + 'px';
        particle.style.backgroundColor = color;
        particle.style.boxShadow = '0 0 6px ' + color;

        const angle = (Math.PI * 2 * i) / particleCount + (Math.random() - 0.5) * 0.5;
        const velocity = 50 + Math.random() * 100;
        const dx = Math.cos(angle) * velocity;
        const dy = Math.sin(angle) * velocity;

        particle.style.animation = 'none';
        particle.animate([
          { transform: 'translate(0, 0) scale(1)', opacity: 1 },
          { transform: 'translate(' + dx + 'px, ' + (dy + 30) + 'px) scale(0)', opacity: 0 }
        ], {
          duration: 1000 + Math.random() * 500,
          easing: 'cubic-bezier(0, 0.5, 0.5, 1)'
        });

        container.appendChild(particle);

        setTimeout(() => particle.remove(), 1500);
      }
    }

    function renderProgressLoading(message, progress, loaded, total, partialGenres = null, partialStats = null) {
      // Check if progress bar already exists
      let progressContainer = document.getElementById('progressive-loading');

      // Calculate partial stats
      const genreCount = partialGenres?.length || 0;
      const artistCount = partialStats?.artistCount || 0;

      if (!progressContainer) {
        // First call - create the full interactive UI
        app.innerHTML = \`
          <div id="progressive-loading" class="progressive-loading-full">
            <div class="album-art-carousel" id="album-carousel"><div class="album-art-item left placeholder visible">🎵</div><div class="album-art-item center placeholder visible">🎶</div><div class="album-art-item right placeholder visible">🎵</div></div><div class="loading-header">
              <h2>\${swedishMode ? '🎵 Laddar ditt bibliotek...' : '🎵 Loading your library...'}</h2>
              <p class="loading-subtitle">\${swedishMode ? 'Du kan redan se dina genrer medan det laddar!' : 'You can already see your genres while loading!'}</p>
            </div>

            <div class="loading-stats-row">
              <div class="loading-stat">
                <div class="loading-stat-value" id="stat-tracks">\${loaded.toLocaleString()}</div>
                <div class="loading-stat-label">\${swedishMode ? 'låtar' : 'tracks'}</div>
              </div>
              <div class="loading-stat">
                <div class="loading-stat-value" id="stat-genres">\${genreCount}</div>
                <div class="loading-stat-label">\${swedishMode ? 'genrer' : 'genres'}</div>
              </div>
              <div class="loading-stat">
                <div class="loading-stat-value" id="stat-artists">\${artistCount}</div>
                <div class="loading-stat-label">\${swedishMode ? 'artister' : 'artists'}</div>
              </div>
              <div class="loading-stat">
                <div class="loading-stat-value" id="stat-progress">\${progress}%</div>
                <div class="loading-stat-label">\${swedishMode ? 'klart' : 'complete'}</div>
              </div>
            </div>

            <div class="progress-container-full">
              <div class="progress-bar-full">
                <div class="progress-fill-full" id="progress-fill" style="width: \${progress}%"></div>
              </div>
              <div class="progress-detail" id="progress-detail">
                \${loaded.toLocaleString()} / \${total.toLocaleString()} \${swedishMode ? 'låtar' : 'tracks'}
              </div>
            </div>

            <div class="live-genres-section">
              <h3>\${swedishMode ? '🎸 Genrer hittade hittills' : '🎸 Genres found so far'}</h3>
              <div class="live-genres-grid" id="live-genres-grid"></div><div class="live-bar-chart" id="live-bar-chart"><h4>\${swedishMode ? "📊 Topp genrer" : "📊 Top Genres"}</h4><div id="bar-chart-items"></div></div></div></div>
        \`;
        progressContainer = document.getElementById('progressive-loading');

        // Start album carousel rotation
        if (!albumCarouselInterval) {
          albumCarouselInterval = setInterval(rotateAlbumCarousel, 1500);
        }
      } else {
        // Update existing stats with animation
        animateCounter(document.getElementById('stat-tracks'), loaded.toLocaleString());
        animateCounter(document.getElementById('stat-genres'), String(genreCount));
        animateCounter(document.getElementById('stat-artists'), String(artistCount));
        animateCounter(document.getElementById('stat-progress'), progress + '%');

        const fill = document.getElementById('progress-fill');
        const detail = document.getElementById('progress-detail');
        if (fill) fill.style.width = \`\${progress}%\`;
        if (detail) detail.textContent = \`\${loaded.toLocaleString()} / \${total.toLocaleString()} \${swedishMode ? 'låtar' : 'tracks'}\`;
      }

      // Update live genres grid with emojis
      if (partialGenres && partialGenres.length > 0) {
        const grid = document.getElementById('live-genres-grid');
        if (grid) {
          // Show top genres with emojis, sorted by count
          const sortedGenres = [...partialGenres].sort((a, b) => b.count - a.count).slice(0, 20);
          grid.innerHTML = sortedGenres.map(g => {
            const emoji = getGenreEmoji(g.name);
            const safeName = escapeForHtml(g.name);
            return \`
              <div class="live-genre-card">
                <span class="live-genre-emoji">\${emoji}</span>
                <span class="live-genre-name">\${safeName}</span>
                <span class="live-genre-count">\${g.count}</span>
              </div>
            \`;
          }).join('');
        }

        // Update bar chart
        updateBarChart(partialGenres);
      }
    }

    // Merge genre data from multiple chunks
    function mergeGenreChunks(existing, newChunk) {
      const merged = new Map();

      // Add existing genres
      if (existing?.genres) {
        for (const g of existing.genres) {
          merged.set(g.name, { count: g.count, trackIds: [...g.trackIds] });
        }
      }

      // Merge new chunk genres
      for (const g of newChunk.genres) {
        if (merged.has(g.name)) {
          const existing = merged.get(g.name);
          existing.count += g.count;
          existing.trackIds.push(...g.trackIds);
        } else {
          merged.set(g.name, { count: g.count, trackIds: [...g.trackIds] });
        }
      }

      // Convert to sorted array
      const genres = [...merged.entries()]
        .map(([name, data]) => ({ name, count: data.count, trackIds: data.trackIds }))
        .sort((a, b) => b.count - a.count);

      return {
        genres,
        totalTracks: (existing?.totalTracks || 0) + newChunk.trackCount,
        totalGenres: genres.length,
        totalArtists: (existing?.totalArtists || 0) + newChunk.artistCount,
        cachedAt: Date.now(),
      };
    }

    // Progressive loading for large libraries
    async function loadGenresProgressively() {
      let offset = 0;
      let accumulated = null;
      let totalInLibrary = 0;

      while (true) {
        const response = await fetch(\`/api/genres/chunk?offset=\${offset}&limit=500\`);
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.details || data.error || 'Failed to load chunk');
        }

        totalInLibrary = data.pagination.totalInLibrary;

        // Merge this chunk first so we can show preview
        accumulated = mergeGenreChunks(accumulated, data.chunk);

        // Update progress UI with accumulated genres preview
        const loadedTracks = offset + data.chunk.trackCount;
        renderProgressLoading(
          swedishMode ? 'Laddar ditt bibliotek...' : 'Loading your library...',
          data.progress,
          loadedTracks,
          totalInLibrary,
          accumulated?.genres || [],
          { artistCount: accumulated?.totalArtists || 0 }
        );

        // Check if done
        if (!data.pagination.hasMore) {
          break;
        }

        offset = data.pagination.nextOffset;
      }

      // Remove truncated flag since we loaded everything
      accumulated.truncated = false;
      accumulated.totalInLibrary = totalInLibrary;

      return accumulated;
    }

    // Load full library using progressive loading
    async function loadFullLibrary() {
      try {
        const fullData = await loadGenresProgressively();
        stopAlbumCarousel(); // Clean up carousel when loading completes
        genreData = fullData;
        triggerFireworks(); // Celebrate completion!
        renderGenres();
        showNotification(
          swedishMode ? '✨ Hela biblioteket laddat!' : '✨ Full library loaded!',
          'success'
        );
      } catch (error) {
        console.error('Progressive load error:', error);
        stopAlbumCarousel(); // Clean up carousel on error too
        showNotification(
          swedishMode ? 'Kunde inte ladda alla låtar' : 'Failed to load all tracks',
          'error'
        );
        // Re-render with partial data
        if (genreData) {
          renderGenres();
        }
      }
    }

    async function loadGenres() {
      try {
        renderLoading(
          swedishMode ? 'Hämtar dina låtar...' : 'Fetching your liked songs...',
          swedishMode ? 'Detta kan ta en stund för stora bibliotek' : 'This may take a moment for large libraries'
        );

        // First, try the standard endpoint (fast for small libraries)
        const response = await fetch('/api/genres');
        const data = await response.json();

        if (!response.ok) {
          // Show detailed error from API
          const errorDetail = data.details || data.error || 'Unknown error';
          const step = data.step || 'unknown';
          const stepLabels = {
            'fetching_tracks': 'while fetching your liked tracks',
            'fetching_artists': 'while fetching artist data',
            'unknown': ''
          };

          app.innerHTML = \`
            <div class="error">
              <strong>Error \${stepLabels[step] || ''}</strong>
              <p>\${errorDetail}</p>
              \${data.tracksFound ? \`<p class="error-detail">Tracks found: \${data.tracksFound}</p>\` : ''}
              \${data.artistsToFetch ? \`<p class="error-detail">Artists to fetch: \${data.artistsToFetch}</p>\` : ''}
            </div>
            <button onclick="loadGenres()" class="btn btn-secondary">Try Again</button>
            <button onclick="location.href='/auth/logout'" class="btn btn-secondary">Reconnect Spotify</button>
          \`;
          return;
        }

        if (data.totalTracks === 0) {
          app.innerHTML = \`
            <div class="card">
              <h2>No Liked Songs Found</h2>
              <p>Your Spotify library doesn't have any liked songs yet. Like some songs on Spotify and come back!</p>
            </div>
          \`;
          return;
        }

        genreData = data;
        triggerFireworks(); // Celebrate completion!
        renderGenres();
      } catch (error) {
        console.error('Load genres error:', error);
        app.innerHTML = \`
          <div class="error">
            <strong>Connection Error</strong>
            <p>Could not connect to the server. Please check your internet connection.</p>
            <p class="error-detail">\${error.message || 'Unknown error'}</p>
          </div>
          <button onclick="loadGenres()" class="btn btn-secondary">Try Again</button>
        \`;
      }
    }

    async function refreshGenres() {
      try {
        renderLoading(
          swedishMode ? 'Uppdaterar från Spotify...' : 'Refreshing from Spotify...',
          swedishMode ? 'Hämtar senaste data' : 'Fetching latest data'
        );

        const response = await fetch('/api/genres?refresh=true');
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.details || data.error || 'Failed to refresh');
        }

        genreData = data;
        renderGenres();
        showNotification(swedishMode ? '✨ Data uppdaterad!' : '✨ Data refreshed!', 'success');
      } catch (error) {
        console.error('Refresh error:', error);
        showNotification(swedishMode ? 'Kunde inte uppdatera' : 'Failed to refresh', 'error');
        // Re-render with existing data if we have it
        if (genreData) {
          renderGenres();
        }
      }
    }

    function formatCacheTime(cachedAt) {
      if (!cachedAt) return '';
      const now = Date.now();
      const diff = Math.floor((now - cachedAt) / 1000);
      if (diff < 60) return swedishMode ? 'Just nu' : 'Just now';
      if (diff < 3600) {
        const mins = Math.floor(diff / 60);
        return swedishMode ? \`\${mins} min sedan\` : \`\${mins}m ago\`;
      }
      const hours = Math.floor(diff / 3600);
      return swedishMode ? \`\${hours} tim sedan\` : \`\${hours}h ago\`;
    }

    // === Hidden Genres Functions ===
    function toggleHideGenre(genre) {
      if (hiddenGenres.has(genre)) {
        hiddenGenres.delete(genre);
      } else {
        hiddenGenres.add(genre);
      }
      saveHiddenGenres();
      filterAndRenderGenres(document.querySelector('.search-input')?.value || '');
      updateHiddenCount();
    }

    function saveHiddenGenres() {
      localStorage.setItem('hiddenGenres', JSON.stringify([...hiddenGenres]));
    }

    function toggleShowHidden() {
      showHiddenGenres = !showHiddenGenres;
      localStorage.setItem('showHiddenGenres', showHiddenGenres.toString());
      filterAndRenderGenres(document.querySelector('.search-input')?.value || '');
      updateHiddenCount();
    }

    function hideSmallGenres(minTracks) {
      if (!genreData?.genres) return;
      genreData.genres.forEach(g => {
        if (g.count < minTracks) {
          hiddenGenres.add(g.name);
        }
      });
      saveHiddenGenres();
      filterAndRenderGenres(document.querySelector('.search-input')?.value || '');
      updateHiddenCount();
    }

    function unhideAllGenres() {
      hiddenGenres.clear();
      saveHiddenGenres();
      filterAndRenderGenres(document.querySelector('.search-input')?.value || '');
      updateHiddenCount();
    }

    function updateHiddenCount() {
      const countEl = document.getElementById('hidden-count');
      if (countEl) {
        countEl.textContent = hiddenGenres.size.toString();
      }
      const toolbar = document.getElementById('hidden-toolbar');
      if (toolbar) {
        toolbar.style.display = hiddenGenres.size > 0 ? 'flex' : 'none';
      }
    }

    // === Theme Toggle Functions ===
    function toggleTheme() {
      lightMode = !lightMode;
      localStorage.setItem('lightMode', lightMode.toString());
      document.body.classList.toggle('light-mode', lightMode);
      updateThemeButton();
    }
    window.toggleTheme = toggleTheme;

    function updateThemeButton() {
      const btn = document.getElementById('theme-toggle');
      if (btn) {
        btn.textContent = lightMode ? '🌙' : '☀️';
        btn.title = lightMode
          ? (swedishMode ? 'Byt till mörkt läge' : 'Switch to dark mode')
          : (swedishMode ? 'Byt till ljust läge' : 'Switch to light mode');
      }
    }

    // === Export Functions ===
    // Sanitize text for safe export - NO REGEX with escape sequences (they break in template literals)
    function sanitizeForExport(text) {
      if (!text || typeof text !== 'string') return '';

      // Normalize unicode to NFC form
      let result = text.normalize('NFC');

      // Remove control characters manually (safer than regex escapes)
      let cleaned = '';
      for (let i = 0; i < result.length; i++) {
        const code = result.charCodeAt(i);
        // Skip control characters: 0x00-0x1F (C0) and 0x7F-0x9F (DEL + C1)
        if ((code >= 0x20 && code <= 0x7E) || code >= 0xA0) {
          cleaned += result[i];
        }
      }

      return cleaned.trim();
    }

    function exportGenresJSON() {
      if (!genreData) return;
      const exportData = {
        exportedAt: new Date().toISOString(),
        totalTracks: genreData.totalTracks,
        totalGenres: genreData.totalGenres,
        totalArtists: genreData.totalArtists,
        genres: genreData.genres.map(g => ({
          name: sanitizeForExport(g.name),
          trackCount: g.count,
          trackIds: g.trackIds
        }))
      };
      // Use UTF-8 BOM for better compatibility with Excel
      const jsonString = JSON.stringify(exportData, null, 2);
      const blob = new Blob(['\\uFEFF' + jsonString], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'spotify-genres-' + new Date().toISOString().slice(0, 10) + '.json';
      a.click();
      URL.revokeObjectURL(url);
    }

    function exportGenresCSV() {
      if (!genreData) return;
      const rows = [['Genre', 'Track Count', 'Track IDs']];
      genreData.genres.forEach(g => {
        // Sanitize genre name and escape for CSV
        const safeName = sanitizeForExport(g.name);
        rows.push([safeName, g.count.toString(), g.trackIds.join(';')]);
      });
      // Escape quotes and wrap in quotes, handle newlines
      const csv = rows.map(row => row.map(cell => {
        const escaped = String(cell).replace(/"/g, '""').replace(/\\r?\\n/g, ' ');
        return '"' + escaped + '"';
      }).join(',')).join('\\r\\n'); // Use CRLF for better compatibility
      // Use UTF-8 BOM for better compatibility with Excel
      const blob = new Blob(['\\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'spotify-genres-' + new Date().toISOString().slice(0, 10) + '.csv';
      a.click();
      URL.revokeObjectURL(url);
    }

    // === Stats Dashboard Functions ===
    function calculateDiversityScore(genres) {
      if (!genres || genres.length === 0) return 0;
      const total = genres.reduce((sum, g) => sum + g.count, 0);
      if (total === 0) return 0;
      // Shannon diversity index (normalized to 0-100)
      let entropy = 0;
      genres.forEach(g => {
        const p = g.count / total;
        if (p > 0) entropy -= p * Math.log(p);
      });
      const maxEntropy = Math.log(genres.length);
      return maxEntropy > 0 ? Math.round((entropy / maxEntropy) * 100) : 0;
    }

    function getDiversityLabel(score) {
      if (score >= 80) return swedishMode ? 'Mycket varierad!' : 'Very diverse!';
      if (score >= 60) return swedishMode ? 'Varierad' : 'Diverse';
      if (score >= 40) return swedishMode ? 'Måttlig' : 'Moderate';
      if (score >= 20) return swedishMode ? 'Fokuserad' : 'Focused';
      return swedishMode ? 'Mycket fokuserad' : 'Very focused';
    }

    function calculateAvgGenresPerTrack() {
      if (!genreData?.genres || genreData.totalTracks === 0) return 0;
      const totalGenreAssignments = genreData.genres.reduce((sum, g) => sum + g.count, 0);
      return (totalGenreAssignments / genreData.totalTracks).toFixed(1);
    }

    function toggleStatsDashboard() {
      showStatsDashboard = !showStatsDashboard;
      localStorage.setItem('showStatsDashboard', showStatsDashboard.toString());
      const dashboard = document.getElementById('stats-dashboard');
      const toggleBtn = document.getElementById('stats-toggle');
      if (dashboard) {
        dashboard.style.display = showStatsDashboard ? 'block' : 'none';
      }
      if (toggleBtn) {
        toggleBtn.textContent = showStatsDashboard
          ? (swedishMode ? 'Dölj statistik' : 'Hide Stats')
          : (swedishMode ? 'Visa statistik' : 'Show Stats');
      }
    }

    function renderStatsDashboard() {
      if (!genreData?.genres) return '';
      const top10 = genreData.genres.slice(0, 10);
      const maxCount = top10[0]?.count || 1;
      const diversityScore = calculateDiversityScore(genreData.genres);
      const avgGenres = calculateAvgGenresPerTrack();

      return \`
        <div class="stats-dashboard" id="stats-dashboard" style="display: \${showStatsDashboard ? 'block' : 'none'}">
          <h3>\${swedishMode ? '📊 Musiksmak Analys' : '📊 Music Taste Analysis'}</h3>

          <div class="stats-section">
            <h4>\${swedishMode ? 'Topp 10 Genrer' : 'Top 10 Genres'}</h4>
            <div class="genre-bars">
              \${top10.map(g => \`
                <div class="genre-bar-row">
                  <span class="genre-bar-name">\${g.name}</span>
                  <div class="genre-bar-container">
                    <div class="genre-bar" style="width: \${(g.count / maxCount * 100)}%"></div>
                  </div>
                  <span class="genre-bar-count">\${g.count}</span>
                </div>
              \`).join('')}
            </div>
          </div>

          <div class="stats-section">
            <h4>\${swedishMode ? 'Mångfaldsmätare' : 'Diversity Score'}</h4>
            <div class="diversity-meter">
              <div class="diversity-fill" style="width: \${diversityScore}%"></div>
            </div>
            <div class="diversity-info">
              <span class="diversity-score">\${diversityScore}%</span>
              <span class="diversity-label">\${getDiversityLabel(diversityScore)}</span>
            </div>
          </div>

          <div class="stats-section stats-grid">
            <div class="stat-box">
              <div class="stat-box-value">\${avgGenres}</div>
              <div class="stat-box-label">\${swedishMode ? 'Genrer per låt (snitt)' : 'Avg genres per track'}</div>
            </div>
            <div class="stat-box">
              <div class="stat-box-value">\${genreData.totalArtists?.toLocaleString() || '—'}</div>
              <div class="stat-box-label">\${swedishMode ? 'Unika artister' : 'Unique artists'}</div>
            </div>
          </div>
        </div>
      \`;
    }

    function renderGenres() {
      const filteredGenres = filterGenres('');
      const cacheInfo = genreData.cachedAt
        ? \`<span class="cache-info" title="\${genreData.fromCache ? (swedishMode ? 'Från cache' : 'From cache') : (swedishMode ? 'Nyss hämtad' : 'Just fetched')}">
            \${genreData.fromCache ? '⚡' : '✨'} \${formatCacheTime(genreData.cachedAt)}
          </span>\`
        : '';

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

        \${genreData.truncated ? \`
        <div class="truncation-warning">
          ⚠️ \${swedishMode
            ? \`Visar \${genreData.totalTracks.toLocaleString()} av \${genreData.totalInLibrary?.toLocaleString()} låtar\`
            : \`Showing \${genreData.totalTracks.toLocaleString()} of \${genreData.totalInLibrary?.toLocaleString()} tracks\`}
          <button onclick="loadFullLibrary()" class="btn btn-ghost btn-sm" style="margin-left: 0.5rem;">
            \${swedishMode ? 'Ladda alla' : 'Load all'}
          </button>
        </div>
        \` : ''}

        <div class="cache-status">
          \${cacheInfo}
          <button onclick="refreshGenres()" class="btn btn-ghost btn-sm" title="\${swedishMode ? 'Hämta ny data från Spotify' : 'Fetch fresh data from Spotify'}">
            🔄 \${swedishMode ? 'Uppdatera' : 'Refresh'}
          </button>
          <button id="theme-toggle" onclick="toggleTheme()" class="btn btn-ghost btn-sm" title="\${lightMode ? (swedishMode ? 'Byt till mörkt läge' : 'Switch to dark mode') : (swedishMode ? 'Byt till ljust läge' : 'Switch to light mode')}">
            \${lightMode ? '🌙' : '☀️'}
          </button>
        </div>

        <div class="toolbar-row">
          <button onclick="toggleStatsDashboard()" class="btn btn-ghost btn-sm stats-toggle" id="stats-toggle">
            \${showStatsDashboard ? (swedishMode ? '📊 Dölj statistik' : '📊 Hide Stats') : (swedishMode ? '📊 Visa statistik' : '📊 Show Stats')}
          </button>
          <button onclick="exportGenresJSON()" class="btn btn-ghost btn-sm" title="\${swedishMode ? 'Exportera som JSON' : 'Export as JSON'}">
            📥 JSON
          </button>
          <button onclick="exportGenresCSV()" class="btn btn-ghost btn-sm" title="\${swedishMode ? 'Exportera som CSV' : 'Export as CSV'}">
            📥 CSV
          </button>
        </div>

        \${renderStatsDashboard()}

        <div class="hidden-toolbar" id="hidden-toolbar" style="display: \${hiddenGenres.size > 0 ? 'flex' : 'none'}">
          <span>\${swedishMode ? 'Dolda genrer:' : 'Hidden genres:'} <strong id="hidden-count">\${hiddenGenres.size}</strong></span>
          <button onclick="toggleShowHidden()" class="btn btn-ghost btn-sm">
            \${showHiddenGenres ? (swedishMode ? '🙈 Dölj dolda' : '🙈 Hide hidden') : (swedishMode ? '👁️ Visa dolda' : '👁️ Show hidden')}
          </button>
          <button onclick="unhideAllGenres()" class="btn btn-ghost btn-sm" title="\${swedishMode ? 'Visa alla genrer' : 'Show all genres'}">
            ↺ \${swedishMode ? 'Visa alla' : 'Unhide all'}
          </button>
          <button onclick="hideSmallGenres(5)" class="btn btn-ghost btn-sm" title="\${swedishMode ? 'Dölj genrer med färre än 5 låtar' : 'Hide genres with fewer than 5 tracks'}">
            \${swedishMode ? 'Dölj små (<5)' : 'Hide small (<5)'}
          </button>
        </div>

        <div class="card">
          <h2 class="card-title" data-i18n="yourGenres">\${t('yourGenres')}</h2>

          <div class="template-settings">
            <label>\${swedishMode ? 'Spellistnamn mall' : 'Playlist Name Template'}</label>
            <div class="template-input-row">
              <input
                type="text"
                class="search-input"
                id="template-input"
                value="\${playlistTemplate.replace(/"/g, '&quot;')}"
                oninput="updatePlaylistTemplate(this.value)"
                placeholder="{genre} (from Likes)"
              >
              <button onclick="resetTemplate()" class="btn btn-ghost btn-sm" title="\${swedishMode ? 'Återställ' : 'Reset'}">↺</button>
            </div>
            <div class="template-preview">
              \${swedishMode ? 'Förhandsvisning:' : 'Preview:'} <span id="template-preview">\${getTemplatePreview()}</span>
            </div>
          </div>

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
      let filtered = genreData.genres;

      // Filter by search query
      if (query) {
        const lower = query.toLowerCase();
        filtered = filtered.filter(g => g.name.toLowerCase().includes(lower));
      }

      // Filter hidden genres (unless showing hidden)
      if (!showHiddenGenres) {
        filtered = filtered.filter(g => !hiddenGenres.has(g.name));
      }

      return filtered;
    }

    function filterAndRenderGenres(query) {
      const filtered = filterGenres(query);
      renderGenreList(filtered);
    }

    function renderGenreList(genres) {
      const list = document.getElementById('genre-list');
      list.innerHTML = genres.map(genre => {
        const isHidden = hiddenGenres.has(genre.name);
        return \`
        <label class="genre-item\${isHidden ? ' hidden' : ''}">
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
            class="btn btn-ghost genre-hide"
            onclick="event.preventDefault(); toggleHideGenre('\${genre.name.replace(/'/g, "\\\\'")}')"
            title="\${isHidden ? (swedishMode ? 'Visa' : 'Show') : (swedishMode ? 'Dölj' : 'Hide')}"
          >
            \${isHidden ? '👁️' : '🙈'}
          </button>
          <button
            class="btn btn-ghost genre-create"
            onclick="event.preventDefault(); createPlaylist('\${genre.name.replace(/'/g, "\\\\'")}')"
            data-i18n="create"
          >
            \${t('create')}
          </button>
        </label>
      \`}).join('');
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
      const mergeBtn = document.getElementById('merge-btn');
      if (mergeBtn) {
        mergeBtn.disabled = selectedGenres.size < 2; // Need at least 2 to merge
      }
    }

    // Playlist template functions
    function getTemplatePreview() {
      const exampleGenre = genreData?.genres?.[0]?.name || 'rock';
      return applyTemplate(exampleGenre);
    }

    function applyTemplate(genre) {
      return playlistTemplate.replace('{genre}', genre);
    }

    function updatePlaylistTemplate(value) {
      playlistTemplate = value || '{genre} (from Likes)';
      localStorage.setItem('playlistTemplate', playlistTemplate);
      const preview = document.getElementById('template-preview');
      if (preview) {
        preview.textContent = getTemplatePreview();
      }
    }

    function resetTemplate() {
      playlistTemplate = '{genre} (from Likes)';
      localStorage.setItem('playlistTemplate', playlistTemplate);
      const input = document.getElementById('template-input');
      const preview = document.getElementById('template-preview');
      if (input) input.value = playlistTemplate;
      if (preview) preview.textContent = getTemplatePreview();
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

    // Show playlist customisation modal
    function showCustomiseModal(genreName) {
      const genre = genreData.genres.find(g => g.name === genreName);
      if (!genre) return;

      const defaultName = genreName + ' (from Likes)';
      const defaultDesc = genreName + ' tracks from your liked songs';

      const modal = document.createElement('div');
      modal.className = 'customise-modal';
      modal.innerHTML = [
        '<div class="customise-panel">',
        '  <div class="customise-header">',
        '    <h3>' + (swedishMode ? '✏️ Anpassa spellista' : '✏️ Customise Playlist') + '</h3>',
        '    <button class="customise-close" onclick="this.closest(\'.customise-modal\').remove()">&times;</button>',
        '  </div>',
        '  <div class="customise-body">',
        '    <div class="customise-field">',
        '      <label>' + (swedishMode ? 'Namn' : 'Name') + '</label>',
        '      <input type="text" id="custom-name" value="' + escapeForHtml(defaultName) + '" maxlength="100">',
        '    </div>',
        '    <div class="customise-field">',
        '      <label>' + (swedishMode ? 'Beskrivning' : 'Description') + '</label>',
        '      <textarea id="custom-desc" maxlength="300">' + escapeForHtml(defaultDesc) + '</textarea>',
        '      <div class="field-hint">' + (swedishMode ? 'Max 300 tecken' : 'Max 300 characters') + '</div>',
        '    </div>',
        '    <div class="customise-preview">',
        '      <div class="customise-preview-title">' + (swedishMode ? 'Förhandsvisning' : 'Preview') + '</div>',
        '      <div class="customise-preview-name" id="preview-name">' + escapeForHtml(defaultName) + '</div>',
        '      <div class="customise-preview-desc" id="preview-desc">' + escapeForHtml(defaultDesc) + '</div>',
        '    </div>',
        '    <div style="display: flex; align-items: center; gap: 0.5rem;">',
        '      <span class="customise-track-count">🎵 ' + genre.count + ' ' + (swedishMode ? 'låtar' : 'tracks') + '</span>',
        '    </div>',
        '  </div>',
        '  <div class="customise-footer">',
        '    <button class="btn btn-ghost" onclick="this.closest(\'.customise-modal\').remove()">',
        '      ' + (swedishMode ? 'Avbryt' : 'Cancel'),
        '    </button>',
        '    <button class="btn btn-primary" id="create-custom-btn">',
        '      ' + (swedishMode ? 'Skapa spellista' : 'Create Playlist'),
        '    </button>',
        '  </div>',
        '</div>'
      ].join('');

      document.body.appendChild(modal);

      // Update preview on input
      const nameInput = document.getElementById('custom-name');
      const descInput = document.getElementById('custom-desc');
      const previewName = document.getElementById('preview-name');
      const previewDesc = document.getElementById('preview-desc');

      nameInput.addEventListener('input', () => {
        previewName.textContent = nameInput.value || defaultName;
      });

      descInput.addEventListener('input', () => {
        previewDesc.textContent = descInput.value || defaultDesc;
      });

      // Handle create button
      document.getElementById('create-custom-btn').addEventListener('click', async () => {
        const customName = nameInput.value.trim();
        const customDesc = descInput.value.trim();
        modal.remove();
        await createPlaylistWithOptions(genreName, customName, customDesc);
      });

      // Close on backdrop click
      modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.remove();
      });

      // Focus name input
      nameInput.focus();
      nameInput.select();
    }

    // Create playlist with custom options
    async function createPlaylistWithOptions(genreName, customName, customDescription, force = false) {
      const genre = genreData.genres.find(g => g.name === genreName);
      if (!genre) return;

      try {
        const response = await fetch('/api/playlist', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            genre: genre.name,
            trackIds: genre.trackIds,
            force,
            customName: customName || undefined,
            customDescription: customDescription || undefined
          }),
        });

        const result = await response.json();

        if (result.success) {
          showNotification(
            (swedishMode ? 'Skapade spellista: ' : 'Created playlist: ') + result.playlist.name + ' (' + genre.count + ' ' + t('tracks') + ')',
            'success'
          );
        } else if (result.duplicate) {
          showNotification(swedishMode ? 'Spellista finns redan' : 'Playlist already exists', 'error');
        } else {
          throw new Error(result.error);
        }
      } catch (error) {
        showNotification(t('failed') + ': ' + error.message, 'error');
      }
    }

    // Show merge modal for combining selected genres
    function showMergeModal() {
      if (selectedGenres.size < 2) return;

      const genreNames = Array.from(selectedGenres);
      const genres = genreNames.map(name => genreData.genres.find(g => g.name === name)).filter(Boolean);
      const totalTracks = genres.reduce((sum, g) => sum + g.count, 0);
      const uniqueTrackIds = [...new Set(genres.flatMap(g => g.trackIds))];

      const defaultName = genreNames.slice(0, 3).join(' + ') + (genreNames.length > 3 ? ' +more' : '') + ' Mix';
      const defaultDesc = 'Combined playlist: ' + genreNames.join(', ');

      const modal = document.createElement('div');
      modal.className = 'customise-modal';
      modal.innerHTML = [
        '<div class="customise-panel">',
        '  <div class="customise-header">',
        '    <h3>' + (swedishMode ? '🔗 Slå ihop genrer' : '🔗 Merge Genres') + '</h3>',
        '    <button class="customise-close" onclick="this.closest(\'.customise-modal\').remove()">&times;</button>',
        '  </div>',
        '  <div class="customise-body">',
        '    <div style="margin-bottom: 1rem; padding: 0.75rem; background: var(--bg); border-radius: 8px;">',
        '      <div style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 0.5rem;">' + (swedishMode ? 'Valda genrer:' : 'Selected genres:') + '</div>',
        '      <div style="display: flex; flex-wrap: wrap; gap: 0.5rem;">',
        genreNames.map(name => '<span class="genre-tag">' + escapeForHtml(name) + '</span>').join(''),
        '      </div>',
        '    </div>',
        '    <div class="customise-field">',
        '      <label>' + (swedishMode ? 'Spellistans namn' : 'Playlist Name') + '</label>',
        '      <input type="text" id="merge-name" value="' + escapeForHtml(defaultName) + '" maxlength="100">',
        '    </div>',
        '    <div class="customise-field">',
        '      <label>' + (swedishMode ? 'Beskrivning' : 'Description') + '</label>',
        '      <textarea id="merge-desc" maxlength="300">' + escapeForHtml(defaultDesc) + '</textarea>',
        '    </div>',
        '    <div style="display: flex; align-items: center; gap: 1rem; flex-wrap: wrap;">',
        '      <span class="customise-track-count">🎵 ' + uniqueTrackIds.length + ' ' + (swedishMode ? 'unika låtar' : 'unique tracks') + '</span>',
        '      <span style="color: var(--text-muted); font-size: 0.85rem;">' + (swedishMode ? '(av ' + totalTracks + ' totalt)' : '(of ' + totalTracks + ' total)') + '</span>',
        '    </div>',
        '  </div>',
        '  <div class="customise-footer">',
        '    <button class="btn btn-ghost" onclick="this.closest(\'.customise-modal\').remove()">',
        '      ' + (swedishMode ? 'Avbryt' : 'Cancel'),
        '    </button>',
        '    <button class="btn btn-primary" id="merge-create-btn">',
        '      ' + (swedishMode ? '🔗 Skapa mix' : '🔗 Create Mix'),
        '    </button>',
        '  </div>',
        '</div>'
      ].join('');

      document.body.appendChild(modal);

      // Handle create button
      document.getElementById('merge-create-btn').addEventListener('click', async () => {
        const customName = document.getElementById('merge-name').value.trim();
        const customDesc = document.getElementById('merge-desc').value.trim();
        modal.remove();
        await createMergedPlaylist(genreNames, uniqueTrackIds, customName, customDesc);
      });

      // Close on backdrop click
      modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.remove();
      });

      // Focus name input
      document.getElementById('merge-name').focus();
    }

    // Create merged playlist from multiple genres
    async function createMergedPlaylist(genreNames, trackIds, customName, customDescription) {
      try {
        const response = await fetch('/api/playlist', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            genre: genreNames[0], // Use first genre as base
            trackIds: trackIds,
            force: true, // Skip duplicate check for merged playlists
            customName: customName || genreNames.join(' + ') + ' Mix',
            customDescription: customDescription || 'Merged: ' + genreNames.join(', ')
          }),
        });

        const result = await response.json();

        if (result.success) {
          showNotification(
            (swedishMode ? '🔗 Skapade mix: ' : '🔗 Created mix: ') + result.playlist.name + ' (' + trackIds.length + ' ' + t('tracks') + ')',
            'success'
          );
          // Clear selection after successful merge
          selectedGenres.clear();
          updateSelectedCount();
          const checkboxes = document.querySelectorAll('.genre-checkbox');
          checkboxes.forEach(cb => cb.checked = false);
        } else {
          throw new Error(result.error);
        }
      } catch (error) {
        showNotification(t('failed') + ': ' + error.message, 'error');
      }
    }

    async function createPlaylist(genreName, force = false) {
      const genre = genreData.genres.find(g => g.name === genreName);
      if (!genre) return;

      const btn = event?.target;
      if (btn) {
        btn.disabled = true;
        btn.textContent = t('creating');
      }

      try {
        const response = await fetch('/api/playlist', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ genre: genre.name, trackIds: genre.trackIds, force }),
        });

        const result = await response.json();

        if (result.success) {
          if (btn) {
            btn.textContent = t('created');
            btn.style.color = 'var(--accent)';
          }
          showNotification(\`\${swedishMode ? 'Skapade spellista' : 'Created playlist'}: \${genre.name} (\${genre.count} \${t('tracks')})\`, 'success');
        } else if (result.duplicate) {
          // Show duplicate confirmation dialog
          showDuplicateDialog(genre, result);
          if (btn) {
            btn.disabled = false;
            btn.textContent = t('create');
          }
          return;
        } else {
          throw new Error(result.error);
        }
      } catch (error) {
        if (btn) {
          btn.textContent = t('failed');
          btn.style.color = 'var(--danger)';
        }
        showNotification(\`\${t('failed')}: \${error.message}\`, 'error');
      }

      if (btn) {
        setTimeout(() => {
          btn.disabled = false;
          btn.textContent = t('create');
          btn.style.color = '';
        }, 3000);
      }
    }

    function showDuplicateDialog(genre, result) {
      const existingCount = result.existingPlaylist.trackCount;
      const newCount = genre.count;

      const modal = document.createElement('div');
      modal.className = 'modal-overlay';
      modal.innerHTML = \`
        <div class="modal">
          <h3>\${swedishMode ? 'Spellista finns redan' : 'Playlist Already Exists'}</h3>
          <p>\${result.message}</p>
          <p style="color: var(--text-muted); font-size: 0.9rem;">
            \${swedishMode
              ? \`Ny: \${newCount} låtar, Befintlig: \${existingCount} låtar\`
              : \`New: \${newCount} tracks, Existing: \${existingCount} tracks\`}
          </p>
          <div class="modal-actions">
            <button class="btn btn-ghost" onclick="this.closest('.modal-overlay').remove()">
              \${swedishMode ? 'Avbryt' : 'Cancel'}
            </button>
            <button class="btn btn-primary" onclick="createPlaylistForce('\${genre.name.replace(/'/g, "\\\\'")}'); this.closest('.modal-overlay').remove();">
              \${swedishMode ? 'Skapa ändå' : 'Create Anyway'}
            </button>
          </div>
        </div>
      \`;
      document.body.appendChild(modal);
    }

    function createPlaylistForce(genreName) {
      createPlaylist(genreName, true);
    }

    // ================== LOADING ANIMATION ==================

    // Get random album art from genre tracks (uses Spotify album images)
    function getAlbumArtForGenre(genreName) {
      // Default album art placeholder
      const defaultArt = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect fill="#282828" width="100" height="100"/><circle cx="50" cy="50" r="40" fill="#1DB954"/><circle cx="50" cy="50" r="15" fill="#282828"/></svg>');

      // If we have track album art in genreData, use it
      const genre = genreData?.genres?.find(g => g.name === genreName);
      if (genre?.albumArts && genre.albumArts.length > 0) {
        // Get up to 5 random album arts
        const shuffled = [...genre.albumArts].sort(() => 0.5 - Math.random());
        return shuffled.slice(0, 5);
      }

      // Return default placeholders
      return [defaultArt, defaultArt, defaultArt, defaultArt, defaultArt];
    }

    // Dynamic completion messages
    const completionMessages = {
      en: [
        "Your playlists are ready! Time to vibe 🎵",
        "Boom! Genre magic complete ✨",
        "Playlists created! Your music, organised 🎧",
        "Done! Your Spotify just got an upgrade 🚀",
        "Nailed it! Happy listening 🎶",
        "All sorted! Your ears will thank you 👂",
        "Genre Genie has worked their magic! 🧞",
        "Playlist perfection achieved! 💯",
      ],
      sv: [
        "Dina spellistor är klara! Dags att njuta 🎵",
        "Klart! Genre-magi slutförd ✨",
        "Spellistor skapade! Din musik, organiserad 🎧",
        "Klart! Din Spotify blev just uppgraderad 🚀",
        "Perfekt! Trevlig lyssning 🎶",
        "Allt sorterat! Dina öron tackar dig 👂",
        "Genre Genie har trollat! 🧞",
        "Spellistperfektion uppnådd! 💯",
      ]
    };

    function getRandomCompletionMessage() {
      const messages = swedishMode ? completionMessages.sv : completionMessages.en;
      return messages[Math.floor(Math.random() * messages.length)];
    }

    // Show loading modal with album art animation
    function showLoadingModal(total) {
      // Collect album art from all selected genres
      const allAlbumArts = [];
      for (const genreName of selectedGenres) {
        const arts = getAlbumArtForGenre(genreName);
        allAlbumArts.push(...arts);
      }
      // Shuffle and take up to 5
      const shuffled = [...new Set(allAlbumArts)].sort(() => 0.5 - Math.random()).slice(0, 5);

      const modal = document.createElement('div');
      modal.className = 'playlist-loading-modal';
      modal.id = 'loading-modal';
      modal.innerHTML = \`
        <div class="album-carousel">
          \${shuffled.map(art => \`<img class="album-art" src="\${art}" alt="" onerror="this.style.background='var(--surface-2)'">\`).join('')}
        </div>
        <div class="loading-text" id="loading-text">\${swedishMode ? 'Skapar spellistor...' : 'Creating playlists...'}</div>
        <div class="loading-progress">
          <div class="loading-progress-bar" id="loading-progress-bar" style="width: 0%"></div>
        </div>
        <div class="loading-stats">
          <div class="loading-stat">
            <span class="loading-stat-value" id="loading-completed">0</span>
            <span>\${swedishMode ? 'Skapade' : 'Created'}</span>
          </div>
          <div class="loading-stat">
            <span class="loading-stat-value">\${total}</span>
            <span>\${swedishMode ? 'Totalt' : 'Total'}</span>
          </div>
        </div>
      \`;
      document.body.appendChild(modal);
    }

    // Update loading progress
    function updateLoadingProgress(completed, total, currentGenre) {
      const progressBar = document.getElementById('loading-progress-bar');
      const completedEl = document.getElementById('loading-completed');
      const textEl = document.getElementById('loading-text');

      if (progressBar) progressBar.style.width = \`\${(completed / total) * 100}%\`;
      if (completedEl) completedEl.textContent = completed;
      if (textEl && currentGenre) {
        textEl.textContent = swedishMode
          ? \`Skapar: \${currentGenre}...\`
          : \`Creating: \${currentGenre}...\`;
      }
    }

    // Hide loading modal
    function hideLoadingModal() {
      document.getElementById('loading-modal')?.remove();
    }

    // Show celebration animation
    function showCelebration(successful) {
      if (successful === 0) return;

      const overlay = document.createElement('div');
      overlay.className = 'celebration-overlay';

      // Create confetti pieces
      const colors = ['#1DB954', '#FFD700', '#FF6B6B', '#4ECDC4', '#9B59B6'];
      for (let i = 0; i < 50; i++) {
        const confetti = document.createElement('div');
        confetti.className = 'confetti';
        confetti.style.left = \`\${Math.random() * 100}%\`;
        confetti.style.background = colors[Math.floor(Math.random() * colors.length)];
        confetti.style.animationDelay = \`\${Math.random() * 0.5}s\`;
        confetti.style.transform = \`rotate(\${Math.random() * 360}deg)\`;
        overlay.appendChild(confetti);
      }

      document.body.appendChild(overlay);

      // Remove after animation
      setTimeout(() => overlay.remove(), 3500);
    }

    async function createSelectedPlaylists() {
      if (selectedGenres.size === 0) return;

      const btn = document.getElementById('create-btn');
      btn.disabled = true;

      const genres = genreData.genres
        .filter(g => selectedGenres.has(g.name))
        .map(g => ({ name: g.name, trackIds: g.trackIds }));

      // Show loading modal with album art animation
      showLoadingModal(genres.length);

      try {
        const response = await fetch('/api/playlists/bulk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ genres, skipDuplicates: true }),
        });

        const result = await response.json();

        // Hide loading modal
        hideLoadingModal();

        // Show celebration if playlists were created
        if (result.successful > 0) {
          showCelebration(result.successful);
        }

        const skippedText = result.skipped > 0
          ? \` (\${result.skipped} \${swedishMode ? 'hoppades över - finns redan' : 'skipped - already exist'})\`
          : '';

        // Show dynamic completion message
        const completionMessage = result.successful > 0 ? getRandomCompletionMessage() : '';

        document.getElementById('results').innerHTML = \`
          <div class="card">
            <h2 class="card-title" data-i18n="results">\${t('results')}</h2>
            \${completionMessage ? \`<p style="margin-bottom: 1rem; font-size: 1.1rem; color: var(--accent);">\${completionMessage}</p>\` : ''}
            <p style="margin-bottom: 1rem;">
              \${t('successCreated')} \${result.successful} \${t('of')} \${result.total} \${t('playlists')}\${skippedText}.
            </p>
            <div class="results">
              \${result.results.map(r => \`
                <div class="result-item">
                  <span>\${r.genre}</span>
                  \${r.success
                    ? \`<a href="\${r.url}" target="_blank" class="result-success" data-i18n="openSpotify">\${t('openSpotify')}</a>\`
                    : r.skipped
                      ? \`<span class="result-skipped">\${swedishMode ? 'Finns redan' : 'Already exists'}</span>\`
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

        // Reload recent playlists to show the new ones
        if (typeof loadRecentPlaylists === 'function') {
          loadRecentPlaylists();
        }
      } catch (error) {
        hideLoadingModal();
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

    // === Keyboard Shortcuts ===
    const SHORTCUTS = {
      '/': { desc: 'Focus search', action: () => document.querySelector('.search-input')?.focus() },
      'Escape': { desc: 'Clear search / close modal', action: handleEscape },
      'a': { desc: 'Select all (with Ctrl/Cmd)', ctrl: true, action: selectAll },
      'A': { desc: 'Select none (with Ctrl/Cmd+Shift)', ctrl: true, shift: true, action: selectNone },
      'Enter': { desc: 'Create playlists', action: () => {
        if (selectedGenres.size > 0 && !document.getElementById('create-btn')?.disabled) {
          createSelectedPlaylists();
        }
      }},
      'r': { desc: 'Refresh data', ctrl: true, action: (e) => { e.preventDefault(); refreshGenres(); }},
      't': { desc: 'Toggle theme', action: toggleTheme },
      's': { desc: 'Toggle stats', action: toggleStatsDashboard },
      '?': { desc: 'Show keyboard shortcuts', action: showKeyboardHelp },
    };

    function handleEscape() {
      // Close any modal first
      const modal = document.querySelector('.modal-overlay, .changelog-overlay, .deploy-overlay');
      if (modal) {
        modal.remove();
        document.querySelector('.changelog-panel, .deploy-refresh-prompt')?.remove();
        return;
      }
      // Clear search input
      const searchInput = document.querySelector('.search-input');
      if (searchInput && searchInput.value) {
        searchInput.value = '';
        filterAndRenderGenres('');
        searchInput.blur();
      }
    }

    function showKeyboardHelp() {
      const existingHelp = document.querySelector('.keyboard-help-overlay');
      if (existingHelp) {
        existingHelp.remove();
        return;
      }

      const overlay = document.createElement('div');
      overlay.className = 'keyboard-help-overlay';
      overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };

      const panel = document.createElement('div');
      panel.className = 'keyboard-help-panel';
      panel.setAttribute('role', 'dialog');
      panel.setAttribute('aria-labelledby', 'keyboard-help-title');

      const shortcuts = [
        { key: '/', desc: swedishMode ? 'Sök genrer' : 'Search genres' },
        { key: 'Esc', desc: swedishMode ? 'Stäng/Rensa' : 'Close/Clear' },
        { key: 'Ctrl+A', desc: swedishMode ? 'Välj alla' : 'Select all' },
        { key: 'Ctrl+Shift+A', desc: swedishMode ? 'Avmarkera alla' : 'Select none' },
        { key: 'Enter', desc: swedishMode ? 'Skapa spellistor' : 'Create playlists' },
        { key: 'Ctrl+R', desc: swedishMode ? 'Uppdatera data' : 'Refresh data' },
        { key: 'T', desc: swedishMode ? 'Växla tema' : 'Toggle theme' },
        { key: 'S', desc: swedishMode ? 'Växla statistik' : 'Toggle stats' },
        { key: '?', desc: swedishMode ? 'Visa denna hjälp' : 'Show this help' },
      ];

      panel.innerHTML = \`
        <h3 id="keyboard-help-title">\${swedishMode ? '⌨️ Tangentbordsgenvägar' : '⌨️ Keyboard Shortcuts'}</h3>
        <div class="shortcuts-list">
          \${shortcuts.map(s => \`
            <div class="shortcut-item">
              <kbd>\${s.key}</kbd>
              <span>\${s.desc}</span>
            </div>
          \`).join('')}
        </div>
        <button class="btn btn-ghost" onclick="this.closest('.keyboard-help-overlay').remove()">
          \${swedishMode ? 'Stäng' : 'Close'}
        </button>
      \`;

      overlay.appendChild(panel);
      document.body.appendChild(overlay);

      // Focus the close button for accessibility
      panel.querySelector('button')?.focus();
    }

    document.addEventListener('keydown', (e) => {
      // Don't trigger shortcuts when typing in inputs
      const isInput = e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA';

      // Escape always works
      if (e.key === 'Escape') {
        handleEscape();
        return;
      }

      // Skip other shortcuts if in input (except Ctrl combos)
      if (isInput && !e.ctrlKey && !e.metaKey) return;

      // Forward slash focuses search (unless already typing)
      if (e.key === '/' && !isInput) {
        e.preventDefault();
        document.querySelector('.search-input')?.focus();
        return;
      }

      // Check for matching shortcut
      const key = e.key;
      const shortcut = SHORTCUTS[key];
      if (!shortcut) return;

      const ctrlOrMeta = e.ctrlKey || e.metaKey;

      // Check modifiers match
      if (shortcut.ctrl && !ctrlOrMeta) return;
      if (shortcut.shift && !e.shiftKey) return;
      if (!shortcut.ctrl && ctrlOrMeta && key !== 'Enter') return;

      // Execute the shortcut
      e.preventDefault();
      shortcut.action(e);
    });

    // === Accessibility Improvements ===

    // Announce changes to screen readers
    function announceToScreenReader(message) {
      let announcer = document.getElementById('sr-announcer');
      if (!announcer) {
        announcer = document.createElement('div');
        announcer.id = 'sr-announcer';
        announcer.setAttribute('role', 'status');
        announcer.setAttribute('aria-live', 'polite');
        announcer.setAttribute('aria-atomic', 'true');
        announcer.className = 'sr-only';
        document.body.appendChild(announcer);
      }
      announcer.textContent = message;
    }

    // Enhanced notification with screen reader support
    const originalShowNotification = showNotification;
    showNotification = function(message, type) {
      originalShowNotification(message, type);
      announceToScreenReader(message);
    };

    // Announce selection changes
    const originalUpdateSelectedCount = updateSelectedCount;
    updateSelectedCount = function() {
      originalUpdateSelectedCount();
      const count = selectedGenres.size;
      if (count > 0) {
        announceToScreenReader(
          swedishMode
            ? \`\${count} genre\${count > 1 ? 'r' : ''} vald\${count > 1 ? 'a' : ''}\`
            : \`\${count} genre\${count > 1 ? 's' : ''} selected\`
        );
      }
    };

    // ================== SIDEBAR FUNCTIONS ==================

    let sidebarData = {
      pioneers: [],
      newUsers: [],
      recentPlaylists: []
    };
    let scoreboardData = null;
    let sidebarPollInterval = null;

    // Load leaderboard data (pioneers + new users)
    async function loadLeaderboard() {
      try {
        const response = await fetch('/api/leaderboard');
        if (!response.ok) return;
        const data = await response.json();
        sidebarData.pioneers = data.pioneers || [];
        sidebarData.newUsers = data.newUsers || [];
        renderPioneers();
        renderNewUsers();
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('Failed to load leaderboard:', err);
      }
    }

    // Load recent playlists
    async function loadRecentPlaylists() {
      try {
        const response = await fetch('/api/recent-playlists');
        if (!response.ok) return;
        const data = await response.json();
        sidebarData.recentPlaylists = data.playlists || [];
        renderRecentPlaylists();
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('Failed to load recent playlists:', err);
      }
    }

    // Render pioneers list in sidebar
    function renderPioneers() {
      const container = document.getElementById('pioneers-list');
      if (!container) return;

      if (sidebarData.pioneers.length === 0) {
        container.innerHTML = '<div class="sidebar-loading">' + (swedishMode ? 'Inga pionjärer än' : 'No pioneers yet') + '</div>';
        return;
      }

      container.innerHTML = sidebarData.pioneers.map((user, i) => {
        const posClass = i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : '';
        const regalia = i === 0 ? '<span class="pioneer-badge first">👑 First!</span>' :
                        i < 3 ? '<span class="pioneer-badge">🏆</span>' :
                        i < 10 ? '<span class="regalia">⭐</span>' : '';
        const delay = i * 50; // Stagger by 50ms

        return \`
          <div class="user-list-item animate-in" style="animation-delay: \${delay}ms" title="\${swedishMode ? 'Gick med' : 'Joined'} \${formatTimeAgo(new Date(user.registeredAt))}">
            <span class="position \${posClass}">#\${i + 1}</span>
            \${user.spotifyAvatar
              ? \`<img class="user-avatar" src="\${user.spotifyAvatar}" alt="" onerror="this.outerHTML='<div class=user-avatar-placeholder>👤</div>'">\`
              : '<div class="user-avatar-placeholder">👤</div>'}
            <span class="user-name">\${escapeHtml(user.spotifyName)}</span>
            \${regalia}
          </div>
        \`;
      }).join('');
    }

    // Render new users list in sidebar
    function renderNewUsers() {
      const container = document.getElementById('new-users-list');
      if (!container) return;

      if (sidebarData.newUsers.length === 0) {
        container.innerHTML = '<div class="sidebar-loading">' + (swedishMode ? 'Inga nya användare' : 'No new users') + '</div>';
        return;
      }

      container.innerHTML = sidebarData.newUsers.map((user, i) => {
        const delay = i * 50; // Stagger by 50ms
        return \`
          <div class="user-list-item animate-in" style="animation-delay: \${delay}ms">
            \${user.spotifyAvatar
              ? \`<img class="user-avatar" src="\${user.spotifyAvatar}" alt="" onerror="this.outerHTML='<div class=user-avatar-placeholder>👤</div>'">\`
              : '<div class="user-avatar-placeholder">👤</div>'}
            <span class="user-name">\${escapeHtml(user.spotifyName)}</span>
            <span class="regalia">\${formatTimeAgo(new Date(user.registeredAt))}</span>
          </div>
        \`;
      }).join('');
    }

    // Render recent playlists in sidebar
    function renderRecentPlaylists() {
      const container = document.getElementById('recent-playlists-list');
      if (!container) return;

      if (sidebarData.recentPlaylists.length === 0) {
        container.innerHTML = '<div class="sidebar-loading">' + (swedishMode ? 'Inga spellistor än' : 'No playlists yet') + '</div>';
        return;
      }

      container.innerHTML = sidebarData.recentPlaylists.slice(0, 10).map((playlist, i) => {
        const delay = i * 50; // Stagger by 50ms
        const genreEmoji = getGenreEmoji(playlist.genre);
        return \`
          <a href="\${playlist.spotifyUrl}" target="_blank" class="playlist-list-item animate-in" style="animation-delay: \${delay}ms" title="\${playlist.trackCount} \${swedishMode ? 'låtar' : 'tracks'}">
            <div class="playlist-icon">\${genreEmoji}</div>
            <div class="playlist-info">
              <div class="playlist-name">\${escapeHtml(playlist.playlistName)}</div>
              <div class="playlist-meta">
                <span class="playlist-creator">
                  \${playlist.createdBy.spotifyAvatar
                    ? \`<img class="creator-avatar" src="\${playlist.createdBy.spotifyAvatar}" alt="">\`
                    : ''}
                  \${escapeHtml(playlist.createdBy.spotifyName)}
                </span>
                <span>•</span>
                <span>\${formatTimeAgo(new Date(playlist.createdAt))}</span>
              </div>
            </div>
          </a>
        \`;
      }).join('');
    }

    // Escape HTML for safe display
    function escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text || '';
      return div.innerHTML;
    }

    // Get emoji for genre (reuse existing or provide fallback)
    function getGenreEmoji(genre) {
      const emojiMap = {
        'rock': '🎸', 'pop': '🎤', 'hip hop': '🎧', 'rap': '🎤', 'jazz': '🎷',
        'classical': '🎻', 'electronic': '🎹', 'dance': '💃', 'country': '🤠',
        'r&b': '🎵', 'soul': '💜', 'blues': '🎺', 'metal': '🤘', 'punk': '⚡',
        'folk': '🪕', 'indie': '🌟', 'alternative': '🎸', 'reggae': '🌴',
        'latin': '💃', 'k-pop': '🇰🇷', 'j-pop': '🇯🇵', 'anime': '🎌'
      };
      const lowerGenre = (genre || '').toLowerCase();
      for (const [key, emoji] of Object.entries(emojiMap)) {
        if (lowerGenre.includes(key)) return emoji;
      }
      return '🎵';
    }

    // Toggle sidebar visibility (mobile)
    function toggleSidebar() {
      const sidebar = document.getElementById('sidebar');
      const toggle = document.getElementById('sidebar-toggle');
      if (!sidebar) return;

      sidebar.classList.toggle('collapsed');
      const isCollapsed = sidebar.classList.contains('collapsed');

      if (toggle) {
        toggle.querySelector('.toggle-icon').textContent = isCollapsed ? '▶' : '◀';
        toggle.setAttribute('aria-expanded', !isCollapsed);
      }
    }
    // Make toggleSidebar globally accessible
    window.toggleSidebar = toggleSidebar;

    // Show scoreboard modal
    async function showScoreboard() {
      // Fetch scoreboard data
      try {
        const response = await fetch('/api/scoreboard');
        if (!response.ok) throw new Error('Failed to fetch');
        scoreboardData = await response.json();
      } catch (err) {
        showNotification(swedishMode ? 'Kunde inte ladda resultattavlan' : 'Failed to load scoreboard', 'error');
        return;
      }

      // Create modal
      const modal = document.createElement('div');
      modal.className = 'scoreboard-modal active';
      modal.id = 'scoreboard-modal';
      modal.onclick = (e) => {
        if (e.target === modal) closeScoreboard();
      };

      modal.innerHTML = \`
        <div class="scoreboard-panel">
          <div class="scoreboard-header">
            <h2>📊 \${swedishMode ? 'Resultattavla' : 'Scoreboard'}</h2>
            <button class="btn btn-ghost" onclick="closeScoreboard()">✕</button>
          </div>
          <div class="scoreboard-tabs">
            <button class="scoreboard-tab active" data-tab="playlists">🎵 \${swedishMode ? 'Spellistor' : 'Playlists'}</button>
            <button class="scoreboard-tab" data-tab="genres">🎸 \${swedishMode ? 'Genrer' : 'Genres'}</button>
            <button class="scoreboard-tab" data-tab="artists">🎤 \${swedishMode ? 'Artister' : 'Artists'}</button>
            <button class="scoreboard-tab" data-tab="tracks">📀 \${swedishMode ? 'Låtar' : 'Tracks'}</button>
          </div>
          <div class="scoreboard-content" id="scoreboard-content">
            \${renderScoreboardTab('playlists')}
          </div>
          <div class="scoreboard-footer" title="\${swedishMode ? 'Statistik uppdateras var 1-24 timme. Donera till Bryan för snabbare uppdateringar!' : 'Stats refresh every 1-24 hours. Shout Bryan a durry for faster updates!'}">
            \${scoreboardData.totalUsers} \${swedishMode ? 'användare totalt' : 'total users'} •
            \${swedishMode ? 'Uppdaterad' : 'Updated'} \${formatTimeAgo(new Date(scoreboardData.updatedAt))}
            <span style="opacity:0.5;font-size:0.7rem;margin-left:0.5rem">ℹ️</span>
          </div>
        </div>
      \`;

      document.body.appendChild(modal);

      // Add tab click handlers
      modal.querySelectorAll('.scoreboard-tab').forEach(tab => {
        tab.onclick = () => {
          modal.querySelectorAll('.scoreboard-tab').forEach(t => t.classList.remove('active'));
          tab.classList.add('active');
          document.getElementById('scoreboard-content').innerHTML = renderScoreboardTab(tab.dataset.tab);
        };
      });
    }
    // Make showScoreboard globally accessible
    window.showScoreboard = showScoreboard;

    // Render a scoreboard tab
    function renderScoreboardTab(tab) {
      if (!scoreboardData) return '';

      const tabMap = {
        playlists: { data: scoreboardData.byPlaylists, label: swedishMode ? 'spellistor' : 'playlists' },
        genres: { data: scoreboardData.byGenres, label: swedishMode ? 'genrer' : 'genres' },
        artists: { data: scoreboardData.byArtists, label: swedishMode ? 'artister' : 'artists' },
        tracks: { data: scoreboardData.byTracks, label: swedishMode ? 'låtar' : 'tracks' }
      };

      const { data, label } = tabMap[tab] || tabMap.playlists;

      if (!data || data.length === 0) {
        return \`<div class="sidebar-loading">\${swedishMode ? 'Inga data än' : 'No data yet'}</div>\`;
      }

      return \`
        <div class="scoreboard-list">
          \${data.map(entry => {
            const rankClass = entry.rank === 1 ? 'gold' : entry.rank === 2 ? 'silver' : entry.rank === 3 ? 'bronze' : '';
            return \`
              <div class="scoreboard-entry">
                <span class="rank \${rankClass}">#\${entry.rank}</span>
                \${entry.spotifyAvatar
                  ? \`<img class="entry-avatar" src="\${entry.spotifyAvatar}" alt="" onerror="this.style.display='none'">\`
                  : '<div class="entry-avatar" style="background:var(--surface-2);display:flex;align-items:center;justify-content:center">👤</div>'}
                <div class="entry-info">
                  <div class="entry-name">\${escapeHtml(entry.spotifyName)}</div>
                </div>
                <span class="entry-count">\${entry.count.toLocaleString()} \${label}</span>
              </div>
            \`;
          }).join('')}
        </div>
      \`;
    }

    // Close scoreboard modal
    function closeScoreboard() {
      document.getElementById('scoreboard-modal')?.remove();
    }
    window.closeScoreboard = closeScoreboard;

    // Initialize sidebar
    function initSidebar() {
      // Load initial data
      loadLeaderboard();
      loadRecentPlaylists();

      // Poll for recent playlists every 30 seconds
      sidebarPollInterval = setInterval(() => {
        loadRecentPlaylists();
      }, 30000);

      // On mobile, start with sidebar collapsed
      if (window.innerWidth <= 1024) {
        const sidebar = document.getElementById('sidebar');
        if (sidebar) sidebar.classList.add('collapsed');
      }
    }

    // Initialize
    init();

    // Start deployment monitor
    startDeployMonitor();

    // Initialize sidebar
    initSidebar();