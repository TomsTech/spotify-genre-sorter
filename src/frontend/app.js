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

    async function checkDeployStatus() {
      try {
        const response = await fetch('/deploy-status');
        const data = await response.json();

        // Store client version on first load
        if (!clientVersion) {
          clientVersion = data.version;
        }

        deployStatus = data;
        updateDeployWidget(data);

        // Check for version mismatch
        if (clientVersion && data.version && clientVersion !== data.version) {
          showVersionMismatchPrompt(data.version);
        }
      } catch {
        // Silently fail - widget just stays hidden
      }
    }

    function updateDeployWidget(data) {
      const widget = document.getElementById('deploy-widget');
      if (!widget) return;

      const deployment = data.deployment;
      const statusIcon = widget.querySelector('.status-icon');
      const deployText = widget.querySelector('.deploy-text');

      widget.style.display = 'flex';
      widget.classList.remove('deploying', 'success', 'failure');

      if (!deployment) {
        widget.style.display = 'none';
        return;
      }

      if (deployment.status === 'in_progress' || deployment.status === 'queued') {
        widget.classList.add('deploying');
        statusIcon.innerHTML = '<div class="spinner-small"></div>';
        deployText.textContent = deployment.currentStep || 'Deploying...';
      } else if (deployment.conclusion === 'success') {
        widget.classList.add('success');
        statusIcon.innerHTML = \`<img class="avatar" src="\${deployment.author.avatar}" alt="" onerror="this.style.display='none';this.parentElement.textContent='✓'">\`;
        const updatedAt = new Date(deployment.updatedAt);
        const timeAgo = formatTimeAgo(updatedAt);
        deployText.textContent = \`v\${data.version} • \${timeAgo} by @\${deployment.author.name}\`;
      } else if (deployment.conclusion === 'failure') {
        widget.classList.add('failure');
        statusIcon.textContent = '❌';
        deployText.textContent = 'Deploy failed';
      } else {
        widget.style.display = 'none';
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

    // Start deployment polling
    function startDeployMonitor() {
      checkDeployStatus();
      deployPollInterval = setInterval(checkDeployStatus, 10000); // Poll every 10s
    }

    // Swedish translations
    const i18n = {
      en: {
        title: 'Genre Sorter',
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
        hallOfFame: 'Första Användarna',
        musicLoversJoined: 'musikälskare har gått med',
        signInSpotify: 'Logga in med Spotify',
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

      // Add Midsommar mode in June
      if (swedishMode && isMidsommarSeason) {
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
        if (swedishMode) {
          icon.textContent = '🫙';
          text.textContent = 'Bjud mig på snus';
          donationBtn.title = 'Tack för stödet, kompis!';
        } else {
          icon.textContent = '🚬';
          text.textContent = 'Shout me a durry';
          donationBtn.title = 'Chuck us a dart, legend';
        }
      }

      // Play Swedish chime when entering Swedish mode
      if (swedishMode) {
        try {
          const audio = new Audio(swedishChime);
          audio.volume = 0.3;
          audio.play().catch(() => {}); // Ignore autoplay restrictions
        } catch {}
        showNotification('🇸🇪 Välkommen till svenskt läge! Tack Heidi! 👑', 'success');
        // Start fika timer
        startFikaTimer();
        // Update badge tooltip
        updateHeidiBadgeFact();
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
      // Add Midsommar mode in June
      if (isMidsommarSeason) {
        document.body.classList.add('midsommar');
      }
      // Also update the donation button on load
      const donationBtn = document.getElementById('donation-btn');
      if (donationBtn) {
        const icon = donationBtn.querySelector('.icon');
        const text = donationBtn.querySelector('.text');
        if (icon) icon.textContent = '🫙';
        if (text) text.textContent = 'Bjud mig på snus';
        donationBtn.title = 'Tack för stödet, kompis!';
      }
      // Start fika timer and update tooltip
      startFikaTimer();
      updateHeidiBadgeFact();
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

      // Hall of fame HTML - using i18n
      const hofHtml = statsData?.hallOfFame?.length ? \`
        <div class="hall-of-fame">
          <h3>🏆 \${t('hallOfFame')}</h3>
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
            <a href="https://stats.uptimerobot.com/tomstech" target="_blank">
              <img src="https://img.shields.io/badge/uptime-100%25-1DB954?style=for-the-badge&logo=checkmarx&logoColor=white&labelColor=191414" alt="Uptime" loading="lazy" onerror="this.style.display='none'">
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
            <div class="loading-header">
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
              <div class="live-genres-grid" id="live-genres-grid"></div>
            </div>
          </div>
        \`;
        progressContainer = document.getElementById('progressive-loading');
      } else {
        // Update existing stats smoothly
        const statTracks = document.getElementById('stat-tracks');
        const statGenres = document.getElementById('stat-genres');
        const statArtists = document.getElementById('stat-artists');
        const statProgress = document.getElementById('stat-progress');
        const fill = document.getElementById('progress-fill');
        const detail = document.getElementById('progress-detail');

        if (statTracks) statTracks.textContent = loaded.toLocaleString();
        if (statGenres) statGenres.textContent = genreCount;
        if (statArtists) statArtists.textContent = artistCount;
        if (statProgress) statProgress.textContent = \`\${progress}%\`;
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
        genreData = fullData;
        renderGenres();
        showNotification(
          swedishMode ? '✨ Hela biblioteket laddat!' : '✨ Full library loaded!',
          'success'
        );
      } catch (error) {
        console.error('Progressive load error:', error);
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
    // Sanitize genre name for safe export (handle unicode)
    function sanitizeForExport(text) {
      // Normalize unicode to NFC form and escape problematic characters
      return text
        .normalize('NFC')
        .replace(/[\u0000-\u001F\u007F-\u009F]/g, '') // Remove control characters
        .replace(/[\uD800-\uDFFF]/g, ''); // Remove unpaired surrogates
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
          body: JSON.stringify({ genres, skipDuplicates: true }),
        });

        const result = await response.json();

        const skippedText = result.skipped > 0
          ? \` (\${result.skipped} \${swedishMode ? 'hoppades över - finns redan' : 'skipped - already exist'})\`
          : '';

        document.getElementById('results').innerHTML = \`
          <div class="card">
            <h2 class="card-title" data-i18n="results">\${t('results')}</h2>
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

    // Start deployment monitor
    startDeployMonitor();