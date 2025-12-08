    const app = document.getElementById('app');
    const headerActions = document.getElementById('header-actions');

    let genreData = null;
    
    // Create merged playlist from selected genres
    async function createMergedFromSelection() {
      if (selectedGenres.size < 2) {
        showNotification(swedishMode ? 'Välj minst 2 genrer' : 'Select at least 2 genres', 'error');
        return;
      }

      const genreNames = [...selectedGenres];
      const suggestedName = genreNames.slice(0, 3).join(' + ') + (genreNames.length > 3 ? ' +more' : '');

      // Prompt for playlist name
      const playlistName = prompt(
        swedishMode ? 'Namn på sammanslagen spellista:' : 'Name for merged playlist:',
        suggestedName
      );

      if (!playlistName) return;

      // Collect all track IDs
      const trackIds = new Set();
      for (const genreName of selectedGenres) {
        const genre = genreData.genres.find(g => g.name === genreName);
        if (genre && genre.trackIds) {
          genre.trackIds.forEach(id => trackIds.add(id));
        }
      }

      if (trackIds.size === 0) {
        showNotification(swedishMode ? 'Inga låtar hittades' : 'No tracks found', 'error');
        return;
      }

      showNotification(swedishMode ? '⏳ Skapar spellista...' : '⏳ Creating playlist...', 'info');

      try {
        const response = await fetch('/api/playlist', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: playlistName,
            trackIds: [...trackIds],
          }),
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || 'Failed to create playlist');
        }

        const totalTracks = trackIds.size;
        showNotification(
          swedishMode
            ? '✅ ' + playlistName + ' skapad med ' + totalTracks + ' låtar!'
            : '✅ ' + playlistName + ' created with ' + totalTracks + ' tracks!',
          'success'
        );

        triggerConfetti();

        // Clear selection
        selectedGenres.clear();
        renderGenres();

      } catch (error) {
        console.error('Merge error:', error);
        showNotification(swedishMode ? '❌ Kunde inte skapa spellista' : '❌ Failed to create playlist', 'error');
      }
    }

    window.createMergedFromSelection = createMergedFromSelection;

    let selectedGenres = new Set();
    // Genre merging state
    let mergeMode = false;
    let genresToMerge = new Set();

    function toggleMergeMode() {
      mergeMode = !mergeMode;
      genresToMerge.clear();

      if (mergeMode) {
        showNotification(swedishMode ? '📦 Välj genrer att slå ihop' : '📦 Select genres to merge', 'info');
      }

      renderGenres();
    }

    function toggleGenreForMerge(genreName) {
      if (genresToMerge.has(genreName)) {
        genresToMerge.delete(genreName);
      } else {
        genresToMerge.add(genreName);
      }
      updateMergeToolbar();

      // Update visual state
      const cards = document.querySelectorAll('.genre-card');
      cards.forEach(card => {
        const name = card.dataset.genre;
        if (genresToMerge.has(name)) {
          card.classList.add('selected-for-merge');
        } else {
          card.classList.remove('selected-for-merge');
        }
      });
    }

    function updateMergeToolbar() {
      let toolbar = document.getElementById('merge-toolbar');

      if (genresToMerge.size === 0) {
        if (toolbar) toolbar.remove();
        return;
      }

      if (!toolbar) {
        toolbar = document.createElement('div');
        toolbar.id = 'merge-toolbar';
        toolbar.className = 'merge-toolbar';
        const genreGrid = document.querySelector('.genre-grid');
        if (genreGrid) {
          genreGrid.parentNode.insertBefore(toolbar, genreGrid);
        }
      }

      const totalTracks = [...genresToMerge].reduce((sum, name) => {
        const genre = genreData.genres.find(g => g.name === name);
        return sum + (genre ? genre.count : 0);
      }, 0);

      toolbar.innerHTML = [
        '<span class="merge-count">' + genresToMerge.size + (swedishMode ? ' genrer valda' : ' genres selected') + '</span>',
        '<span>(' + totalTracks + (swedishMode ? ' låtar totalt)' : ' tracks total)') + '</span>',
        '<button class="btn btn-ghost btn-sm" onclick="cancelMerge()">' + (swedishMode ? 'Avbryt' : 'Cancel') + '</button>',
        '<button class="btn btn-primary btn-sm" onclick="showMergeModal()">' + (swedishMode ? '📦 Slå ihop' : '📦 Merge') + '</button>',
      ].join('');
    }

    function cancelMerge() {
      mergeMode = false;
      genresToMerge.clear();
      document.querySelectorAll('.genre-card.selected-for-merge').forEach(card => {
        card.classList.remove('selected-for-merge');
      });
      const toolbar = document.getElementById('merge-toolbar');
      if (toolbar) toolbar.remove();
    }

    function showMergeModal() {
      if (genresToMerge.size < 2) {
        showNotification(swedishMode ? 'Välj minst 2 genrer' : 'Select at least 2 genres', 'error');
        return;
      }

      const genreNames = [...genresToMerge];
      const genreItems = genreNames.map(name => {
        const genre = genreData.genres.find(g => g.name === name);
        return { name, count: genre ? genre.count : 0 };
      }).sort((a, b) => b.count - a.count);

      const totalTracks = genreItems.reduce((sum, g) => sum + g.count, 0);
      const suggestedName = genreNames.slice(0, 3).join(' + ') + (genreNames.length > 3 ? ' +more' : '');

      const modal = document.createElement('div');
      modal.className = 'modal-overlay merge-modal';
      modal.onclick = (e) => { if (e.target === modal) modal.remove(); };

      modal.innerHTML = [
        '<div class="modal-content">',
        '  <div class="modal-header">',
        '    <h3>' + (swedishMode ? '📦 Slå ihop genrer' : '📦 Merge Genres') + '</h3>',
        '    <button class="modal-close" onclick="this.closest(\'.modal-overlay\').remove()">×</button>',
        '  </div>',
        '  <div class="modal-body">',
        '    <label>' + (swedishMode ? 'Spellistans namn' : 'Playlist Name') + '</label>',
        '    <input type="text" id="merge-playlist-name" class="search-input" value="' + escapeForHtml(suggestedName) + '" style="margin-bottom: 1rem;">',
        '    <label>' + (swedishMode ? 'Genrer som slås ihop:' : 'Genres to merge:') + '</label>',
        '    <div class="merge-preview">',
        genreItems.map(g => '<div class="merge-preview-item"><span>' + escapeForHtml(g.name) + '</span><span>' + g.count + ' ' + (swedishMode ? 'låtar' : 'tracks') + '</span></div>').join(''),
        '    </div>',
        '    <div class="merge-total">' + (swedishMode ? 'Totalt:' : 'Total:') + ' ' + totalTracks + ' ' + (swedishMode ? 'låtar' : 'tracks') + '</div>',
        '  </div>',
        '  <div class="modal-actions">',
        '    <button class="btn btn-ghost" onclick="this.closest(\'.modal-overlay\').remove()">' + (swedishMode ? 'Avbryt' : 'Cancel') + '</button>',
        '    <button class="btn btn-primary" onclick="createMergedPlaylist()">' + (swedishMode ? '🎵 Skapa spellista' : '🎵 Create Playlist') + '</button>',
        '  </div>',
        '</div>',
      ].join('');

      document.body.appendChild(modal);
      document.getElementById('merge-playlist-name').focus();
    }

    async function createMergedPlaylist() {
      const nameInput = document.getElementById('merge-playlist-name');
      const playlistName = nameInput ? nameInput.value.trim() : 'Merged Playlist';

      if (!playlistName) {
        showNotification(swedishMode ? 'Ange ett namn' : 'Enter a name', 'error');
        return;
      }

      // Collect all track IDs from selected genres
      const trackIds = new Set();
      for (const genreName of genresToMerge) {
        const genre = genreData.genres.find(g => g.name === genreName);
        if (genre && genre.trackIds) {
          genre.trackIds.forEach(id => trackIds.add(id));
        }
      }

      if (trackIds.size === 0) {
        showNotification(swedishMode ? 'Inga låtar hittades' : 'No tracks found', 'error');
        return;
      }

      // Close modal
      const modal = document.querySelector('.merge-modal');
      if (modal) modal.remove();

      showNotification(swedishMode ? '⏳ Skapar spellista...' : '⏳ Creating playlist...', 'info');

      try {
        const response = await fetch('/api/playlist', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: playlistName,
            trackIds: [...trackIds],
          }),
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || 'Failed to create playlist');
        }

        showNotification(
          swedishMode ? '✅ Spellista skapad: ' + playlistName : '✅ Playlist created: ' + playlistName,
          'success'
        );

        // Trigger confetti
        triggerConfetti();

        // Clean up merge state
        cancelMerge();

      } catch (error) {
        console.error('Merge error:', error);
        showNotification(swedishMode ? '❌ Kunde inte skapa spellista' : '❌ Failed to create playlist', 'error');
      }
    }

    // Make functions globally available
    window.toggleMergeMode = toggleMergeMode;
    window.toggleGenreForMerge = toggleGenreForMerge;
    window.cancelMerge = cancelMerge;
    window.showMergeModal = showMergeModal;
    window.createMergedPlaylist = createMergedPlaylist;

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

    // Special user tags
    const SPECIAL_USERS = {
      'tomspseudonym': { tag: 'Creator', class: 'creator', emoji: '👑' },
      'tomstech': { tag: 'Creator', class: 'creator', emoji: '👑' },
      '~oogi~': { tag: 'Queen', class: 'queen', emoji: '💙' },
      'oogi': { tag: 'Queen', class: 'queen', emoji: '💙' },
      'heidi': { tag: 'Queen', class: 'queen', emoji: '💙' },
    };

    function getSpecialUserTag(userName) {
      if (!userName) return '';
      const lowerName = userName.toLowerCase();
      for (const [name, config] of Object.entries(SPECIAL_USERS)) {
        if (lowerName.includes(name.toLowerCase())) {
          return '<span class="user-tag ' + config.class + '">' + config.emoji + ' ' + config.tag + '</span>';
        }
      }
      return '';
    }

    function getSpecialUserClass(userName) {
      if (!userName) return '';
      const lowerName = userName.toLowerCase();
      for (const [name, config] of Object.entries(SPECIAL_USERS)) {
        if (lowerName.includes(name.toLowerCase())) {
          return config.class + '-user';
        }
      }
      return '';
    }
\n
    // Admin panel state
    let isAdminUser = false;
    let adminData = null;

    async function checkAdminStatus() {
      try {
        const response = await fetch('/api/admin');
        if (response.ok) {
          isAdminUser = true;
          adminData = await response.json();
          showAdminButton();
        }
      } catch { /* Not admin */ }
    }

    function showAdminButton() {
      const headerActions = document.getElementById('header-actions');
      if (headerActions && !document.getElementById('admin-btn')) {
        const adminBtn = document.createElement('button');
        adminBtn.id = 'admin-btn';
        adminBtn.className = 'btn btn-ghost btn-sm admin-btn';
        adminBtn.innerHTML = '⚙️ Admin';
        adminBtn.onclick = showAdminPanel;
        adminBtn.title = 'Open admin debug panel';
        headerActions.insertBefore(adminBtn, headerActions.firstChild);
      }
    }

    function showAdminPanel() {
      if (!adminData) return;

      const modal = document.createElement('div');
      modal.className = 'modal-overlay admin-modal';
      modal.onclick = (e) => { if (e.target === modal) modal.remove(); };

      modal.innerHTML = \`
        <div class="modal-content admin-panel">
          <div class="modal-header">
            <h2>⚙️ Admin Debug Panel</h2>
            <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">×</button>
          </div>
          <div class="admin-grid">
            <div class="admin-card">
              <h3>📊 KV Metrics</h3>
              <div class="admin-stats">
                <div class="stat"><span class="label">Reads:</span> <span class="value">\${adminData.kvMetrics?.reads || 0}</span></div>
                <div class="stat"><span class="label">Writes:</span> <span class="value">\${adminData.kvMetrics?.writes || 0}</span></div>
                <div class="stat"><span class="label">Cache Hits:</span> <span class="value">\${adminData.kvMetrics?.cacheHits || 0}</span></div>
              </div>
            </div>
            <div class="admin-card">
              <h3>👥 Users</h3>
              <div class="admin-stats">
                <div class="stat"><span class="label">Total Users:</span> <span class="value">\${adminData.health?.totalUsers || 0}</span></div>
                <div class="stat"><span class="label">Active Sessions:</span> <span class="value">\${adminData.health?.activeSessions || 0}</span></div>
              </div>
            </div>
            <div class="admin-card">
              <h3>📈 Analytics (Today)</h3>
              <div class="admin-stats">
                <div class="stat"><span class="label">Visits:</span> <span class="value">\${adminData.analytics?.today?.visits || 0}</span></div>
                <div class="stat"><span class="label">Logins:</span> <span class="value">\${adminData.analytics?.today?.logins || 0}</span></div>
                <div class="stat"><span class="label">Playlists:</span> <span class="value">\${adminData.analytics?.today?.playlistsCreated || 0}</span></div>
              </div>
            </div>
            <div class="admin-card">
              <h3>🗑️ Cache Actions</h3>
              <div class="admin-actions">
                <button class="btn btn-secondary btn-sm" onclick="clearCache('leaderboard')">Clear Leaderboard</button>
                <button class="btn btn-secondary btn-sm" onclick="clearCache('scoreboard')">Clear Scoreboard</button>
                <button class="btn btn-secondary btn-sm" onclick="clearCache('all_genre_caches')">Clear All Genre Caches</button>
                <button class="btn btn-primary btn-sm" onclick="rebuildCaches()">Rebuild All Caches</button>
              </div>
            </div>
          </div>
          <div class="admin-footer">
            <small>Version: \${adminData.version || '?'} | User: \${adminData.admin?.user || '?'}</small>
          </div>
        </div>
      \`;

      document.body.appendChild(modal);
    }

    async function clearCache(cache) {
      try {
        const response = await fetch('/api/admin/clear-cache', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cache })
        });
        const result = await response.json();
        showNotification(\`Cleared \${result.keysCleared} keys\`, 'success');
        refreshAdminData();
      } catch (err) {
        showNotification('Failed to clear cache', 'error');
      }
    }

    async function rebuildCaches() {
      try {
        const response = await fetch('/api/admin/rebuild-caches', { method: 'POST' });
        const result = await response.json();
        showNotification('Caches rebuilt!', 'success');
        refreshAdminData();
      } catch (err) {
        showNotification('Failed to rebuild caches', 'error');
      }
    }

    async function refreshAdminData() {
      try {
        const response = await fetch('/api/admin');
        if (response.ok) {
          adminData = await response.json();
        }
      } catch { /* ignore */ }
    }

    window.clearCache = clearCache;
    window.rebuildCaches = rebuildCaches;


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

    // ✨ SECRET: Heidi greeting messages
    const heidiGreetings = [
      'Välkommen tillbaka, min drottning 👑',
      'Hej min kärlek! 💙💛',
      'Du gör min dag ljusare ✨',
      'Min favoritperson är här! 🥰',
      'För dig, alltid 💕',
    ];

    function showHeidiGreeting() {
      const greeting = heidiGreetings[Math.floor(Math.random() * heidiGreetings.length)];

      const overlay = document.createElement('div');
      overlay.className = 'heidi-greeting-overlay';
      overlay.innerHTML = \`
        <div class="heidi-greeting-content">
          <div class="heidi-crown">👑</div>
          <p class="heidi-greeting-text">\${greeting}</p>
          <div class="heidi-hearts">💙💛💙💛💙</div>
        </div>
      \`;

      document.body.appendChild(overlay);

      // Auto-dismiss after 3 seconds
      setTimeout(() => {
        overlay.classList.add('fade-out');
        setTimeout(() => overlay.remove(), 500);
      }, 3000);

      overlay.addEventListener('click', () => {
        overlay.classList.add('fade-out');
        setTimeout(() => overlay.remove(), 500);
      });
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
        requestAccess: 'Request Access',
        requestAccessTitle: 'Request Access to Genre Genie',
        requestAccessDesc: 'Enter your details below to request an invite. The admin will review your request.',
        requestAccessEmail: 'Email (Spotify account email)',
        requestAccessGithub: 'GitHub username (optional)',
        requestAccessMessage: 'Why do you want access? (optional)',
        requestAccessSubmit: 'Submit Request',
        requestAccessSuccess: 'Request submitted! You\'ll receive an email when approved.',
        requestAccessError: 'Failed to submit request. Please try again.',
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
        requestAccess: 'Begär Åtkomst',
        requestAccessTitle: 'Begär Åtkomst till Genre Genie',
        requestAccessDesc: 'Ange dina uppgifter nedan för att begära en inbjudan. Administratören granskar din förfrågan.',
        requestAccessEmail: 'E-post (Spotify-kontots e-post)',
        requestAccessGithub: 'GitHub-användarnamn (valfritt)',
        requestAccessMessage: 'Varför vill du ha åtkomst? (valfritt)',
        requestAccessSubmit: 'Skicka Förfrågan',
        requestAccessSuccess: 'Förfrågan skickad! Du får ett e-postmeddelande när du godkänns.',
        requestAccessError: 'Kunde inte skicka förfrågan. Försök igen.',
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
          // Heidi laughed at "Normal mode huh?" so let's keep the joke!
          const normalJokes = [
            'Normal mode huh? 🤔 How... vanilla',
            'Normal mode huh? 🙄 Okay boomer',
            'Normal mode? 😴 *yawns in Swedish*',
            'Back to boring mode! 🥱',
            'Normal mode huh? Vikings disapprove 🪓',
          ];
          const joke = normalJokes[Math.floor(Math.random() * normalJokes.length)];
          showNotification(joke, 'success');
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

    // Genie click animation and sounds
    const genieSounds = [
      // Short xylophone/magical sound in base64 (very short beep melody)
      'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2teleBlSk9bj2qlhMEdwkK2RaDAJGnSo5Pzyl1cOAGar5/38w3UyBlKG0+z87Yg5Gmi4//zzlmglZJPb/fbWi0EfTI3e9OjNgzQVWaDY19aWTiNJfLbs8t6OPRxMk9bl6MqAMRpXotvh08eAMxhXotvh08eAMxhXotvh08eAMxhXotvh08eAMw==',
    ];

    const geniePhrases = [
      "Your wish is my command! 🧞",
      "Three wishes? I got unlimited! ✨",
      "Genre sorting? Easy peasy! 🎵",
      "Did somebody say playlists? 🎉",
      "Phenomenal cosmic powers! 💫",
      "Itty bitty living space though... 🏠",
      "I've been stuck in that lamp for ages! 💨",
      "Alakazam! *jazz hands* 👐",
    ];

    const geniePhrasesSv = [
      "Din önskan är min lag! 🧞",
      "Tre önskningar? Jag har oändligt! ✨",
      "Genresortering? Lätt som en plätt! 🎵",
      "Sa någon spellistor? 🎉",
      "Fenomenal kosmisk kraft! 💫",
      "Men ganska liten bostad... 🏠",
      "Jag har suttit fast i den lampan i evigheter! 💨",
      "Abrakadabra! *jazzhänder* 👐",
    ];

    // Will Smith slap audio (base64 encoded short clip)
    const willSmithAudio = 'data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//tQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAABhgC7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7//////////////////////////////////////////////////////////////////8AAAAATGF2YzU4LjEzAAAAAAAAAAAAAAAAJAAAAAAAAAAAAYZDvlMeAAAAAAD/+1DEAAAGAAGn9AAAIj4Lbv8xgAAJGkBhgMEBgYHDGqpgEPHA4SEhQ+D4Ph8HygIOfKAh8uf/+XBA5/lwfB8HwfD/l+X/rn/8uD4f/y/+D4Pg+D4IHP/9YPqBz/Lg+UDn+sHwQOdQEP8H/4Pgg+o=';

    function initGenieClick() {
      const genie = document.getElementById('genie-mascot');
      if (!genie || genie.dataset.clickInit) return;
      genie.dataset.clickInit = 'true';

      genie.addEventListener('click', () => {
        // Play Will Smith sound
        try {
          const audio = new Audio(willSmithAudio);
          audio.volume = 0.6;
          audio.play().catch(() => {});
        } catch {}

        // Turn brown (Will Smith mode) and animate
        genie.classList.add('talking', 'will-smith-mode');
        setTimeout(() => {
          genie.classList.remove('talking', 'will-smith-mode');
        }, 2500);

        // Show the iconic line
        const phrase = "KEEP MY WIFE'S NAME OUT YOUR F***ING MOUTH!";
        const phraseSv = "HÅLL MIN FRUS NAMN UTANFÖR DIN J*VLA MUN!";

        const bubble = document.createElement('div');
        bubble.className = 'genie-speech-bubble';
        bubble.textContent = swedishMode ? phraseSv : phrase;

        const rect = genie.getBoundingClientRect();
        bubble.style.left = (rect.left + rect.width / 2 - 100) + 'px';
        bubble.style.bottom = (window.innerHeight - rect.top + 10) + 'px';

        document.body.appendChild(bubble);
        setTimeout(() => bubble.remove(), 2500);
      });
    }

    // Initialize genie click when DOM is ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initGenieClick);
    } else {
      initGenieClick();
    }


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

      // ✨ SECRET: Heidi detection (~oogi~ or Heidi in name)
      const userName = (session.user || session.spotifyUser || '').toLowerCase();
      const isHeidi = userName.includes('oogi') || userName.includes('heidi');

      if (isHeidi) {
        document.body.classList.add('heidi-mode');
        // Auto-enable Swedish mode for Heidi
        if (!swedishMode) {
          swedishMode = true;
          localStorage.setItem('swedishMode', 'true');
          document.body.classList.add('swedish-mode');
        }
        // Show special greeting (once per day)
        const lastHeidiGreeting = localStorage.getItem('heidiGreetingDate');
        const today = new Date().toDateString();
        if (lastHeidiGreeting !== today) {
          localStorage.setItem('heidiGreetingDate', today);
          showHeidiGreeting();
        }
      }

      renderHeaderUser(session);\n      checkAdminStatus(); // Check if user is admin

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

      // Request access button for not_allowed errors
      const requestAccessButton = error === 'not_allowed' ? \`
        <button onclick="showRequestAccessModal()" class="btn btn-secondary request-access-btn">
          🔑 \${t('requestAccess')}
        </button>
      \` : '';

      app.innerHTML = \`
        <div class="welcome">
          \${error ? \`<div class="error">\${errorMessages[error] || error}\${requestAccessButton}</div>\` : ''}
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

      // Store user info for Genre Wrapped
      window.currentUser = {
        display_name: user || 'Music Lover',
        images: avatar ? [{ url: avatar }] : []
      };

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

    // Rotate album carousel to show different covers with vinyl flip animation
    function rotateAlbumCarousel() {
      const carousel = document.getElementById('album-carousel');
      if (!carousel) return;

      // If we have real album art, rotate through it
      if (albumArtUrls.length >= 3) {
        // Add flip animation to center item
        const centerItem = carousel.querySelector('.album-art-item.center');
        if (centerItem) {
          centerItem.style.animation = 'vinylFlip 0.8s ease-in-out';
          setTimeout(() => {
            if (centerItem.style) centerItem.style.animation = '';
          }, 800);
        }

        // Update index and carousel after flip starts
        setTimeout(() => {
          albumCarouselIndex = (albumCarouselIndex + 1) % albumArtUrls.length;
          updateAlbumCarousel();
        }, 400);
      } else {
        // Placeholder animation - rotate emojis with flip
        const items = carousel.querySelectorAll('.album-art-item');
        items.forEach(item => {
          item.style.animation = 'vinylFlip 0.8s ease-in-out';
        });

        setTimeout(() => {
          const emojis = ['🎵', '🎶', '🎸', '🎹', '🥁', '🎺', '🎷', '🎻', '🎤'];
          items.forEach(item => {
            const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];
            item.textContent = randomEmoji;
            if (item.style) item.style.animation = '';
          });
        }, 400);
      }
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
        window.currentGenres = fullData?.genres || []; // For Genre Wrapped
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

        // Auto-switch to progressive loading for large/truncated libraries
        if (data.truncated && data.totalInLibrary > data.totalTracks) {
          console.log('Large library detected, switching to progressive loading');
          showNotification(
            swedishMode ? '📚 Stort bibliotek - laddar alla låtar...' : '📚 Large library - loading all tracks...',
            'info'
          );
          // Start progressive loading automatically
          await loadFullLibrary();
          return;
        }

        genreData = data;
        window.currentGenres = data?.genres || []; // For Genre Wrapped
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
        </div>

        <div class="toolbar-row">
          <button onclick="showGenreWrapped()" class="btn btn-primary btn-sm wrapped-btn" title="\${swedishMode ? 'Dela din musiksmak!' : 'Share your music taste!'}">
            ✨ \${swedishMode ? 'Dela Din Smak' : 'Share Your Taste'}
          </button>
          <button onclick="toggleStatsDashboard()" class="btn btn-ghost btn-sm stats-toggle" id="stats-toggle">
            \${showStatsDashboard ? (swedishMode ? '📊 Dölj statistik' : '📊 Hide Stats') : (swedishMode ? '📊 Visa statistik' : '📊 Show Stats')}
          </button>
          <button onclick="toggleMergeMode()" class="btn btn-ghost btn-sm" title="\${swedishMode ? 'Välj genrer att slå ihop' : 'Select genres to merge into one playlist'}">
            📦 \${swedishMode ? 'Slå ihop' : 'Merge'}
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

      // Show/hide merge selected button based on selection count
      let mergeSelectedBtn = document.getElementById('merge-selected-btn');
      if (selectedGenres.size >= 2) {
        if (!mergeSelectedBtn) {
          const actionsDiv = document.querySelector('.bulk-actions');
          if (actionsDiv) {
            const btn = document.createElement('button');
            btn.id = 'merge-selected-btn';
            btn.className = 'btn btn-secondary';
            btn.onclick = createMergedFromSelection;
            btn.innerHTML = (swedishMode ? '📦 Slå ihop valda' : '📦 Merge Selected');
            actionsDiv.appendChild(btn);
          }
        }
      } else if (mergeSelectedBtn) {
        mergeSelectedBtn.remove();
      }
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
        '    <button class="customise-close" onclick="this.closest(\\'.customise-modal\\').remove()">&times;</button>',
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
        '    <button class="btn btn-ghost" onclick="this.closest(\\'.customise-modal\\').remove()">',
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
        '    <button class="customise-close" onclick="this.closest(\\'.customise-modal\\').remove()">&times;</button>',
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
        '    <button class="btn btn-ghost" onclick="this.closest(\\'.customise-modal\\').remove()">',
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

    function showPlaylistCustomizeModal(genre) {
      const defaultName = playlistTemplate.replace('{genre}', genre.name);
      const defaultDescription = \`\${genre.name} tracks from your liked songs ♫\`;

      const modal = document.createElement('div');
      modal.className = 'modal-overlay';
      modal.innerHTML = \`
        <div class="modal playlist-customize-modal">
          <h3>\${swedishMode ? \`🎵 Anpassa spellista för "\${escapeForHtml(genre.name)}"\` : \`🎵 Customize "\${escapeForHtml(genre.name)}" Playlist\`}</h3>

          <div class="form-group">
            <label for="playlist-name">\${swedishMode ? 'Namn:' : 'Name:'}</label>
            <input
              type="text"
              id="playlist-name"
              class="search-input"
              value="\${escapeForHtml(defaultName)}"
              maxlength="100"
              placeholder="\${swedishMode ? 'Spellistans namn' : 'Playlist name'}"
            />
          </div>

          <div class="form-group">
            <label for="playlist-description">\${swedishMode ? 'Beskrivning:' : 'Description:'}</label>
            <textarea
              id="playlist-description"
              class="search-input"
              rows="3"
              maxlength="300"
              placeholder="\${swedishMode ? 'Valfri beskrivning (max 300 tecken)' : 'Optional description (max 300 chars)'}"
            >\${escapeForHtml(defaultDescription)}</textarea>
            <div class="char-count" style="text-align: right; font-size: 0.8rem; color: var(--text-muted); margin-top: 0.25rem;">
              <span id="desc-char-count">0</span>/300
            </div>
          </div>

          <div class="playlist-preview">
            <div class="preview-icon">\${getGenreEmoji(genre.name)}</div>
            <div class="preview-info">
              <div class="preview-tracks">\${genre.count} \${t('tracks')}</div>
              <div class="preview-hint">\${swedishMode ? 'Kommer att läggas till i spellistan' : 'Will be added to playlist'}</div>
            </div>
          </div>

          <div class="modal-actions">
            <button class="btn btn-ghost" onclick="this.closest('.modal-overlay').remove()">
              \${swedishMode ? 'Avbryt' : 'Cancel'}
            </button>
            <button class="btn btn-primary" id="create-customized-btn">
              \${swedishMode ? 'Skapa Spellista' : 'Create Playlist'}
            </button>
          </div>
        </div>
      \`;

      document.body.appendChild(modal);

      // Update character count
      const descTextarea = modal.querySelector('#playlist-description');
      const charCount = modal.querySelector('#desc-char-count');
      function updateCharCount() {
        charCount.textContent = descTextarea.value.length;
      }
      descTextarea.addEventListener('input', updateCharCount);
      updateCharCount();

      // Handle create button click
      modal.querySelector('#create-customized-btn').addEventListener('click', () => {
        const customName = modal.querySelector('#playlist-name').value.trim();
        const customDescription = modal.querySelector('#playlist-description').value.trim();

        modal.remove();

        createPlaylist(genre.name, false, {
          name: customName || null,
          description: customDescription || null,
        });
      });

      // Close on overlay click
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          modal.remove();
        }
      });

      // Focus name input
      setTimeout(() => {
        modal.querySelector('#playlist-name')?.select();
      }, 100);
    }

    async function createPlaylist(genreName, force = false, customization = null) {
      const genre = genreData.genres.find(g => g.name === genreName);
      if (!genre) return;

      // If no customization provided and not forcing, show customization modal first
      if (!customization && !force) {
        showPlaylistCustomizeModal(genre);
        return;
      }

      const btn = event?.target;
      if (btn) {
        btn.disabled = true;
        btn.textContent = t('creating');
      }

      try {
        const requestBody = {
          genre: genre.name,
          trackIds: genre.trackIds,
          force,
          ...(customization?.name && { customName: customization.name }),
          ...(customization?.description && { customDescription: customization.description }),
        };

        const response = await fetch('/api/playlist', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
        });

        const result = await response.json();

        if (result.success) {
          if (btn) {
            btn.textContent = t('created');
            btn.style.color = 'var(--accent)';
          }
          showNotification(\`\${swedishMode ? 'Skapade spellista' : 'Created playlist'}: \${genre.name} (\${genre.count} \${t('tracks')})\`, 'success');
          // Celebrate with confetti!
          showConfetti();
          // Show share modal after a short delay
          if (result.url) {
            setTimeout(() => {
              showShareModal(customization?.name || genre.name + ' (from Likes)', result.url);
            }, 1500);
          }
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

    // ================== CONFETTI CELEBRATION ==================

    function showConfetti() {
      // Don't show if user prefers reduced motion
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

      const container = document.createElement('div');
      container.className = 'confetti-container';
      document.body.appendChild(container);

      // Spotify green, Swedish colours if in swedish mode
      const colors = swedishMode
        ? ['#006AA7', '#FECC00', '#006AA7', '#FECC00', '#fff']
        : ['#1DB954', '#1ed760', '#fff', '#1DB954', '#b3b3b3'];

      // Create confetti pieces
      for (let i = 0; i < 50; i++) {
        const confetti = document.createElement('div');
        confetti.className = 'confetti-piece';
        confetti.style.left = Math.random() * 100 + '%';
        confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
        confetti.style.animationDelay = Math.random() * 0.5 + 's';
        confetti.style.animationDuration = (Math.random() * 2 + 2) + 's';
        container.appendChild(confetti);
      }

      // Remove after animation
      setTimeout(() => container.remove(), 3000);
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

        const specialClass = getSpecialUserClass(user.spotifyName);
        const specialTag = getSpecialUserTag(user.spotifyName);
        return \`
          <div class="user-list-item animate-in \${specialClass}" style="animation-delay: \${delay}ms" title="\${swedishMode ? 'Gick med' : 'Joined'} \${formatTimeAgo(new Date(user.registeredAt))}">
            <span class="position \${posClass}">#\${i + 1}</span>
            \${user.spotifyAvatar
              ? \`<img class="user-avatar" src="\${user.spotifyAvatar}" alt="" onerror="this.outerHTML='<div class=user-avatar-placeholder>👤</div>'">\`
              : '<div class="user-avatar-placeholder">👤</div>'}
            <span class="user-name">\${escapeHtml(user.spotifyName)}\${specialTag}</span>
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
        const specialClass = getSpecialUserClass(user.spotifyName);
        const specialTag = getSpecialUserTag(user.spotifyName);
        return \`
          <div class="user-list-item animate-in \${specialClass}" style="animation-delay: \${delay}ms">
            \${user.spotifyAvatar
              ? \`<img class="user-avatar" src="\${user.spotifyAvatar}" alt="" onerror="this.outerHTML='<div class=user-avatar-placeholder>👤</div>'">\`
              : '<div class="user-avatar-placeholder">👤</div>'}
            <span class="user-name">\${escapeHtml(user.spotifyName)}\${specialTag}</span>
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
            <button class="scoreboard-tab" data-tab="sorted">📋 \${swedishMode ? 'Sorterade' : 'Sorted'}</button>
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
        tracks: { data: scoreboardData.byTracks, label: swedishMode ? 'låtar' : 'tracks' },
        sorted: { data: scoreboardData.byTracksInPlaylists, label: swedishMode ? 'spår sorterade' : 'tracks sorted' }
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

      // Poll for recent playlists every 3 minutes (was 30s - reduced to save KV usage)
      function startPolling() {
        if (sidebarPollInterval) clearInterval(sidebarPollInterval);
        sidebarPollInterval = setInterval(() => {
          loadRecentPlaylists();
        }, 180000); // 3 minutes
      }

      startPolling();

      // Pause polling when tab is hidden to reduce KV reads
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
          if (sidebarPollInterval) {
            clearInterval(sidebarPollInterval);
            sidebarPollInterval = null;
          }
        } else {
          // Tab became visible - refresh immediately then resume polling
          loadRecentPlaylists();
          startPolling();
        }
      });

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

    // =========================================
    // EASTER EGG: Konami Code - Jeff Goldblum
    // ↑↑↓↓←→←→BA triggers "Life finds a way"
    // =========================================

    const konamiCode = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
    let konamiPosition = 0;
    let goldblumShown = sessionStorage.getItem('goldblumShown') === 'true';

    function showGoldblum() {
      if (goldblumShown) return;
      goldblumShown = true;
      sessionStorage.setItem('goldblumShown', 'true');

      const overlay = document.createElement('div');
      overlay.className = 'goldblum-overlay';
      overlay.innerHTML = \`
        <div class="goldblum-content">
          <div class="goldblum-silhouette">🦖</div>
          <p class="goldblum-quote">"Life, uh... finds a way."</p>
          <p class="goldblum-subtitle">- Dr. Ian Malcolm</p>
        </div>
      \`;

      document.body.appendChild(overlay);

      // Auto-remove after 4 seconds
      setTimeout(() => {
        overlay.classList.add('fade-out');
        setTimeout(() => overlay.remove(), 500);
      }, 4000);

      // Click to dismiss
      overlay.addEventListener('click', () => {
        overlay.classList.add('fade-out');
        setTimeout(() => overlay.remove(), 500);
      });
    }

    document.addEventListener('keydown', (e) => {
      const key = e.key.toLowerCase();
      const expected = konamiCode[konamiPosition].toLowerCase();

      if (key === expected) {
        konamiPosition++;
        if (konamiPosition === konamiCode.length) {
          showGoldblum();
          konamiPosition = 0;
        }
      } else {
        konamiPosition = 0;
      }
    });

    // ====================================
    // Playlist Scanner
    // ====================================

    let userPlaylists = [];
    let scannedPlaylistGenres = null;

    function showPlaylistScanner() {
      const existing = document.querySelector('.playlist-modal');
      if (existing) existing.remove();

      const modal = document.createElement('div');
      modal.className = 'playlist-modal';
      modal.innerHTML = getPlaylistModalHTML();
      document.body.appendChild(modal);

      // Close on backdrop click
      modal.addEventListener('click', (e) => {
        if (e.target === modal) closePlaylistModal();
      });

      // Load playlists
      loadUserPlaylists();
    }

    function getPlaylistModalHTML() {
      const title = swedishMode ? '🎵 Dina Spellistor' : '🎵 Your Playlists';
      const loading = swedishMode ? 'Laddar spellistor...' : 'Loading playlists...';
      return '<div class="playlist-modal-content">' +
        '<div class="playlist-modal-header">' +
          '<h2>' + title + '</h2>' +
          '<button class="playlist-modal-close" onclick="closePlaylistModal()">&times;</button>' +
        '</div>' +
        '<div id="playlist-list-container">' +
          '<div class="scanning-indicator"><div class="spinner"></div>' + loading + '</div>' +
        '</div>' +
      '</div>';
    }

    function closePlaylistModal() {
      const modal = document.querySelector('.playlist-modal');
      if (modal) modal.remove();
      scannedPlaylistGenres = null;
    }

    async function loadUserPlaylists() {
      try {
        const response = await fetch('/api/my-playlists');
        if (!response.ok) throw new Error('Failed to load playlists');
        const data = await response.json();
        userPlaylists = data.playlists;
        renderPlaylistList();
      } catch (err) {
        console.error('Error loading playlists:', err);
        const container = document.getElementById('playlist-list-container');
        if (container) {
          const errorText = swedishMode ? 'Kunde inte ladda spellistor' : 'Failed to load playlists';
          container.innerHTML = '<p style="color: var(--danger)">' + errorText + '</p>';
        }
      }
    }

    function renderPlaylistList() {
      const container = document.getElementById('playlist-list-container');
      if (!container) return;

      if (userPlaylists.length === 0) {
        const noPlaylists = swedishMode ? 'Inga spellistor hittades' : 'No playlists found';
        container.innerHTML = '<p>' + noPlaylists + '</p>';
        return;
      }

      const scanText = swedishMode ? 'Skanna' : 'Scan';
      const ownerText = swedishMode ? 'Din' : 'Yours';
      const tracksText = swedishMode ? 'låtar' : 'tracks';

      let html = '<div class="playlist-list">';
      for (const playlist of userPlaylists) {
        html += '<div class="playlist-item">' +
          '<div class="playlist-item-info">' +
            '<span class="playlist-item-name">' + escapeHtml(playlist.name) + '</span>' +
            '<span class="playlist-item-tracks">' + playlist.trackCount + ' ' + tracksText + '</span>' +
            (playlist.isOwner ? '<span class="playlist-item-owner">' + ownerText + '</span>' : '') +
          '</div>' +
          '<button class="playlist-scan-btn" onclick="scanPlaylist(\'' + playlist.id + '\', \'' + escapeHtml(playlist.name).replace(/'/g, "\\'") + '\')">' +
            scanText +
          '</button>' +
        '</div>';
      }
      html += '</div>';

      container.innerHTML = html;
    }

    function escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }

    async function scanPlaylist(playlistId, playlistName) {
      const container = document.getElementById('playlist-list-container');
      if (!container) return;

      const scanningText = swedishMode ? 'Skannar ' + playlistName + '...' : 'Scanning ' + playlistName + '...';
      container.innerHTML = '<div class="scanning-indicator"><div class="spinner"></div>' + scanningText + '</div>';

      try {
        const response = await fetch('/api/scan-playlist/' + playlistId);
        if (!response.ok) throw new Error('Failed to scan playlist');
        const data = await response.json();
        scannedPlaylistGenres = data;
        renderScannedPlaylistGenres(playlistName);
      } catch (err) {
        console.error('Error scanning playlist:', err);
        const errorText = swedishMode ? 'Kunde inte skanna spellistan' : 'Failed to scan playlist';
        container.innerHTML = '<p style="color: var(--danger)">' + errorText + '</p>' +
          '<button class="back-to-playlists-btn" onclick="renderPlaylistList()">← Back</button>';
      }
    }

    function renderScannedPlaylistGenres(playlistName) {
      const container = document.getElementById('playlist-list-container');
      if (!container || !scannedPlaylistGenres) return;

      const data = scannedPlaylistGenres;
      const backText = swedishMode ? '← Tillbaka' : '← Back';
      const genresText = swedishMode ? 'genrer' : 'genres';
      const tracksText = swedishMode ? 'låtar' : 'tracks';
      const artistsText = swedishMode ? 'artister' : 'artists';

      let html = '<div class="playlist-genres-result">' +
        '<div class="playlist-genres-header">' +
          '<button class="back-to-playlists-btn" onclick="renderPlaylistList()">' + backText + '</button>' +
          '<div class="playlist-genres-stats">' +
            '<span>' + data.totalGenres + ' ' + genresText + '</span>' +
            '<span>' + data.totalTracks + ' ' + tracksText + '</span>' +
            '<span>' + data.totalArtists + ' ' + artistsText + '</span>' +
          '</div>' +
        '</div>' +
        '<h3>' + escapeHtml(playlistName) + '</h3>';

      if (data.truncated) {
        const truncatedText = swedishMode ? 'Visar max 500 låtar' : 'Showing max 500 tracks';
        html += '<p style="color: var(--text-muted); font-size: 0.8rem;">⚠️ ' + truncatedText + '</p>';
      }

      html += '<div class="genre-list" style="max-height: 300px;">';
      for (const genre of data.genres.slice(0, 50)) {
        const emoji = getGenreEmoji(genre.name);
        html += '<div class="genre-item">' +
          '<span class="genre-emoji">' + emoji + '</span>' +
          '<span class="genre-name">' + escapeHtml(genre.name) + '</span>' +
          '<span class="genre-count">' + genre.count + '</span>' +
        '</div>';
      }
      html += '</div></div>';

      container.innerHTML = html;
    }

    // Add playlist scanner button to toolbar
    function addPlaylistScannerButton() {
      const toolbar = document.querySelector('.genre-toolbar');
      if (!toolbar) return;

      // Check if button already exists
      if (document.getElementById('playlist-scanner-btn')) return;

      const btn = document.createElement('button');
      btn.id = 'playlist-scanner-btn';
      btn.className = 'playlist-scanner-btn';
      btn.innerHTML = swedishMode ? '📋 Skanna Spellista' : '📋 Scan Playlist';
      btn.onclick = showPlaylistScanner;

      // Insert at the beginning of toolbar
      toolbar.insertBefore(btn, toolbar.firstChild);
    }

    // ====================================
    // User Preferences Sync
    // ====================================

    let userPreferences = null;

    async function loadUserPreferences() {
      try {
        const response = await fetch('/api/preferences');
        if (response.ok) {
          const data = await response.json();
          userPreferences = data.preferences;
          applyPreferences(userPreferences);
          checkAndShowTutorial();
        }
      } catch (err) {
        console.log('Could not load preferences, using defaults');
      }
    }

    async function savePreference(key, value) {
      try {
        const body = {};
        body[key] = value;
        const response = await fetch('/api/preferences', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });
        if (response.ok) {
          const data = await response.json();
          userPreferences = data.preferences;
        }
      } catch (err) {
        console.error('Could not save preference:', err);
      }
    }

    function applyPreferences(prefs) {
      if (!prefs) return;

      // Apply theme
      if (prefs.theme === 'light') {
        document.body.classList.add('light-mode');
        localStorage.setItem('theme', 'light');
      } else if (prefs.theme === 'dark') {
        document.body.classList.remove('light-mode');
        localStorage.setItem('theme', 'dark');
      }

      // Apply Swedish mode
      if (prefs.swedishMode && !swedishMode) {
        toggleSwedishMode();
      }

      // Apply hidden genres
      if (prefs.hiddenGenres && prefs.hiddenGenres.length > 0) {
        hiddenGenres = new Set(prefs.hiddenGenres);
      }

      // Apply template
      if (prefs.playlistTemplate) {
        playlistNameTemplate = prefs.playlistTemplate;
        const templateInput = document.getElementById('template-input');
        if (templateInput) templateInput.value = prefs.playlistTemplate;
      }
    }

    // Hook into theme toggle to save preference
    const originalToggleTheme = typeof toggleTheme === 'function' ? toggleTheme : null;
    function toggleThemeWithSave() {
      const isLight = document.body.classList.toggle('light-mode');
      localStorage.setItem('theme', isLight ? 'light' : 'dark');
      savePreference('theme', isLight ? 'light' : 'dark');
    }

    // Hook into Swedish mode toggle to save preference
    const originalSwedishToggle = typeof toggleSwedishMode === 'function' ? toggleSwedishMode : null;

    // Load preferences on page load
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(loadUserPreferences, 1000); // After initial load
    });

    // ====================================
    // Tutorial System
    // ====================================

    const tutorialSteps = [
      {
        title: 'Welcome to Genre Genie! 🧞',
        titleSE: 'Välkommen till Genre Genie! 🧞',
        content: 'Let me show you around! I will help you organise your Spotify library by genre.',
        contentSE: 'Låt mig visa dig runt! Jag hjälper dig organisera ditt Spotify-bibliotek efter genre.',
        target: null, // Welcome screen, no specific target
        position: 'center'
      },
      {
        title: 'Your Music Stats 📊',
        titleSE: 'Din Musikstatistik 📊',
        content: 'Here you can see how many tracks, genres, and artists are in your library.',
        contentSE: 'Här kan du se hur många låtar, genrer och artister som finns i ditt bibliotek.',
        target: '.stats',
        position: 'bottom'
      },
      {
        title: 'Browse Genres 🎵',
        titleSE: 'Bläddra Genrer 🎵',
        content: 'Click on any genre to see its tracks. Check the box to select multiple genres.',
        contentSE: 'Klicka på en genre för att se dess låtar. Kryssa i rutan för att välja flera genrer.',
        target: '.genre-list',
        position: 'left'
      },
      {
        title: 'Create Playlists ✨',
        titleSE: 'Skapa Spellistor ✨',
        content: 'Select genres and click "Create Playlist" to add them to Spotify!',
        contentSE: 'Välj genrer och klicka "Skapa Spellista" för att lägga till dem på Spotify!',
        target: '.btn-primary',
        position: 'top'
      },
      {
        title: 'You\'re Ready! 🎉',
        titleSE: 'Du är redo! 🎉',
        content: 'Explore your music, discover hidden genres, and create amazing playlists. Have fun!',
        contentSE: 'Utforska din musik, upptäck dolda genrer och skapa fantastiska spellistor. Ha kul!',
        target: null,
        position: 'center'
      }
    ];

    let currentTutorialStep = 0;

    function showTutorial() {
      // Check if already completed
      if (userPreferences && userPreferences.tutorialCompleted) {
        return;
      }

      currentTutorialStep = 0;
      renderTutorialStep();
    }

    function renderTutorialStep() {
      // Remove existing
      const existing = document.querySelector('.tutorial-overlay');
      if (existing) existing.remove();

      const step = tutorialSteps[currentTutorialStep];
      if (!step) {
        endTutorial();
        return;
      }

      const overlay = document.createElement('div');
      overlay.className = 'tutorial-overlay';

      const title = swedishMode ? step.titleSE : step.title;
      const content = swedishMode ? step.contentSE : step.content;
      const nextText = swedishMode ? 'Nästa' : 'Next';
      const skipText = swedishMode ? 'Hoppa över' : 'Skip';
      const finishText = swedishMode ? 'Klar!' : 'Finish!';

      const isLast = currentTutorialStep === tutorialSteps.length - 1;
      const isFirst = currentTutorialStep === 0;

      // Create dialog
      const dialog = document.createElement('div');
      dialog.className = 'tutorial-dialog';

      if (isFirst) {
        // Welcome screen
        dialog.innerHTML =
          '<div class="tutorial-welcome">' +
            '<div class="genie-icon">🧞</div>' +
            '<h2>' + title + '</h2>' +
            '<p>' + content + '</p>' +
            '<div class="tutorial-welcome-actions">' +
              '<button class="tutorial-btn tutorial-btn-start" onclick="nextTutorialStep()">' +
                (swedishMode ? 'Börja Rundturen' : 'Start Tour') +
              '</button>' +
              '<button class="tutorial-btn tutorial-btn-skip" onclick="endTutorial()">' +
                (swedishMode ? 'Jag kan redan' : 'I know my way around') +
              '</button>' +
            '</div>' +
          '</div>';
        overlay.appendChild(dialog);
        document.body.appendChild(overlay);
        return;
      }

      // Regular step with target highlight
      if (step.target) {
        const target = document.querySelector(step.target);
        if (target) {
          const rect = target.getBoundingClientRect();
          const spotlight = document.createElement('div');
          spotlight.className = 'tutorial-spotlight';
          spotlight.style.top = (rect.top - 10) + 'px';
          spotlight.style.left = (rect.left - 10) + 'px';
          spotlight.style.width = (rect.width + 20) + 'px';
          spotlight.style.height = (rect.height + 20) + 'px';
          overlay.appendChild(spotlight);

          // Position dialog relative to target
          positionTutorialDialog(dialog, rect, step.position);
        }
      }

      dialog.innerHTML =
        '<h3>' + title + '</h3>' +
        '<p>' + content + '</p>' +
        '<div class="tutorial-footer">' +
          '<span class="tutorial-progress">' + (currentTutorialStep + 1) + '/' + tutorialSteps.length + '</span>' +
          '<div class="tutorial-actions">' +
            '<button class="tutorial-btn tutorial-btn-skip" onclick="endTutorial()">' + skipText + '</button>' +
            '<button class="tutorial-btn tutorial-btn-next" onclick="nextTutorialStep()">' +
              (isLast ? finishText : nextText) +
            '</button>' +
          '</div>' +
        '</div>';

      overlay.appendChild(dialog);
      document.body.appendChild(overlay);

      // Click outside to close
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) nextTutorialStep();
      });
    }

    function positionTutorialDialog(dialog, targetRect, position) {
      const margin = 20;

      switch(position) {
        case 'bottom':
          dialog.style.top = (targetRect.bottom + margin) + 'px';
          dialog.style.left = '50%';
          dialog.style.transform = 'translateX(-50%)';
          break;
        case 'top':
          dialog.style.bottom = (window.innerHeight - targetRect.top + margin) + 'px';
          dialog.style.left = '50%';
          dialog.style.transform = 'translateX(-50%)';
          break;
        case 'left':
          dialog.style.top = (targetRect.top) + 'px';
          dialog.style.right = (window.innerWidth - targetRect.left + margin) + 'px';
          break;
        case 'right':
          dialog.style.top = (targetRect.top) + 'px';
          dialog.style.left = (targetRect.right + margin) + 'px';
          break;
        default:
          dialog.style.top = '50%';
          dialog.style.left = '50%';
          dialog.style.transform = 'translate(-50%, -50%)';
      }
    }

    function nextTutorialStep() {
      currentTutorialStep++;
      if (currentTutorialStep >= tutorialSteps.length) {
        endTutorial();
      } else {
        renderTutorialStep();
      }
    }

    function endTutorial() {
      const overlay = document.querySelector('.tutorial-overlay');
      if (overlay) overlay.remove();

      // Save that tutorial was completed
      savePreference('tutorialCompleted', true);
    }

    // Auto-show tutorial for first time users after genres load
    function checkAndShowTutorial() {
      if (userPreferences && !userPreferences.tutorialCompleted && genreData && genreData.genres) {
        setTimeout(showTutorial, 500);
      }
    }

    // ====================================
    // KV Rate Limit Warning Banner
    // ====================================

    let kvUsageData = null;

    async function checkKVUsage() {
      try {
        const response = await fetch('/api/kv-usage');
        if (response.ok) {
          kvUsageData = await response.json();
          if (kvUsageData.status === 'critical' || kvUsageData.status === 'warning') {
            showRateLimitBanner(kvUsageData);
          }
        }
      } catch (err) {
        console.log('Could not check KV usage');
      }
    }

    function showRateLimitBanner(data) {
      // Don't show if already dismissed recently
      const dismissedAt = localStorage.getItem('rateLimitBannerDismissed');
      if (dismissedAt && Date.now() - parseInt(dismissedAt) < 3600000) { // 1 hour
        return;
      }

      const existing = document.querySelector('.rate-limit-banner');
      if (existing) return;

      const isCritical = data.status === 'critical';
      const banner = document.createElement('div');
      banner.className = 'rate-limit-banner' + (isCritical ? '' : ' warning');

      const readPct = data.usage?.reads?.percent || 0;
      const writePct = data.usage?.writes?.percent || 0;
      const maxPct = Math.max(readPct, writePct);

      const titleEN = isCritical
        ? '⚠️ Service Degraded - Rate limits reached (' + maxPct + '% used)'
        : '⚡ High usage detected (' + maxPct + '% of daily limit)';
      const titleSE = isCritical
        ? '⚠️ Tjänsten begränsad - Gränser nådda (' + maxPct + '% använt)'
        : '⚡ Hög användning (' + maxPct + '% av daglig gräns)';

      const msgEN = isCritical
        ? 'Some features may be unavailable until 00:00 UTC. For urgent needs, contact the developer.'
        : 'The service may slow down later today. Everything is still working!';
      const msgSE = isCritical
        ? 'Vissa funktioner kan vara otillgängliga till 00:00 UTC. Kontakta utvecklaren vid behov.'
        : 'Tjänsten kan bli långsammare senare idag. Allt fungerar fortfarande!';

      const title = swedishMode ? titleSE : titleEN;
      const msg = swedishMode ? msgSE : msgEN;

      banner.innerHTML = '<strong>' + title + '</strong> — ' + msg +
        ' <a href="https://status.tomstech.dev" target="_blank">' +
        (swedishMode ? 'Statussida' : 'Status Page') + '</a>' +
        '<button class="close-btn" onclick="dismissRateLimitBanner()">&times;</button>';

      document.body.prepend(banner);
      document.body.classList.add('has-banner');
    }

    function dismissRateLimitBanner() {
      const banner = document.querySelector('.rate-limit-banner');
      if (banner) {
        banner.remove();
        document.body.classList.remove('has-banner');
        localStorage.setItem('rateLimitBannerDismissed', Date.now().toString());
      }
    }

    // ====================================
    // Invite Request System
    // ====================================

    function showInviteRequestModal(errorMessage) {
      const existing = document.querySelector('.invite-modal');
      if (existing) return;

      const modal = document.createElement('div');
      modal.className = 'invite-modal';
      modal.innerHTML = getInviteModalHTML();
      document.body.appendChild(modal);
    }

    function getInviteModalHTML() {
      const title = swedishMode ? '🚫 Endast inbjudan, kompis!' : '🚫 Invite only, buddy!';
      const subtitle = swedishMode
        ? 'Denna app är i testläge och kräver godkännande.'
        : 'This app is in development mode and requires approval.';
      const desc = swedishMode
        ? 'Om jag känner dig, skriv in ditt Spotify-namn eller email så skickar jag en inbjudan!'
        : 'If I know you, drop your Spotify email/name below and I\'ll send you an invite!';
      const emailLabel = swedishMode ? 'Din Spotify-email eller namn' : 'Your Spotify email or display name';
      const noteLabel = swedishMode ? 'Hur känner vi varandra? (valfritt)' : 'How do I know you? (optional)';
      const submitText = swedishMode ? 'Skicka Förfrågan' : 'Send Request';

      return '<div class="invite-modal-content">' +
        '<div class="poop-emoji">💩</div>' +
        '<h2>' + title + '</h2>' +
        '<p>' + subtitle + '</p>' +
        '<p>' + desc + '</p>' +
        '<form class="invite-form" onsubmit="submitInviteRequest(event)">' +
          '<input type="text" id="invite-email" placeholder="' + emailLabel + '" required>' +
          '<textarea id="invite-note" placeholder="' + noteLabel + '"></textarea>' +
          '<button type="submit" class="btn btn-primary">' + submitText + '</button>' +
        '</form>' +
        '<div id="invite-result"></div>' +
      '</div>';
    }

    async function submitInviteRequest(e) {
      e.preventDefault();
      const email = document.getElementById('invite-email').value;
      const note = document.getElementById('invite-note').value;
      const resultDiv = document.getElementById('invite-result');

      const submitBtn = e.target.querySelector('button');
      submitBtn.disabled = true;
      submitBtn.textContent = swedishMode ? 'Skickar...' : 'Sending...';

      try {
        const response = await fetch('/api/invite-request', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, note })
        });

        const data = await response.json();

        if (response.ok) {
          const successTitle = swedishMode ? '✅ Förfrågan skickad!' : '✅ Request sent!';
          const successMsg = swedishMode
            ? 'Du får ett email när jag har granskat din förfrågan. Kolla spam-mappen!'
            : 'You\'ll get an email once I review your request. Check spam!';
          const trackText = swedishMode ? 'Följ din förfrågan' : 'Track your request';

          resultDiv.innerHTML =
            '<div class="invite-success">' +
              '<h3>' + successTitle + '</h3>' +
              '<p>' + successMsg + '</p>' +
              (data.trackingUrl ? '<a href="' + data.trackingUrl + '" class="btn btn-secondary" target="_blank">' + trackText + '</a>' : '') +
            '</div>';

          e.target.style.display = 'none';
        } else {
          resultDiv.innerHTML = '<p style="color: var(--danger);">' + (data.error || 'Failed to submit request') + '</p>';
          submitBtn.disabled = false;
          submitBtn.textContent = swedishMode ? 'Försök igen' : 'Try again';
        }
      } catch (err) {
        resultDiv.innerHTML = '<p style="color: var(--danger);">' + (swedishMode ? 'Nätverksfel' : 'Network error') + '</p>';
        submitBtn.disabled = false;
        submitBtn.textContent = swedishMode ? 'Försök igen' : 'Try again';
      }
    }

    // ====================================
    // Status Page Link in Footer
    // ====================================

    function addStatusLink() {
      const footer = document.querySelector('footer') || document.querySelector('.heidi-badge');
      if (!footer) return;

      // Check if already added
      if (document.getElementById('status-link')) return;

      const link = document.createElement('a');
      link.id = 'status-link';
      link.className = 'status-link';
      link.href = 'https://status.tomstech.dev';
      link.target = '_blank';

      const status = kvUsageData?.status || 'ok';
      const indicatorClass = status === 'critical' ? 'critical' : status === 'warning' ? 'warning' : '';
      const text = swedishMode ? 'Driftstatus' : 'System Status';

      link.innerHTML = '<span class="status-indicator ' + indicatorClass + '"></span>' + text;

      // Add after heidi badge or in footer
      if (footer.classList && footer.classList.contains('heidi-badge')) {
        footer.parentElement.insertBefore(link, footer);
        link.style.position = 'fixed';
        link.style.bottom = '0.5rem';
        link.style.left = '0.5rem';
      } else {
        footer.appendChild(link);
      }
    }

    // Check KV usage and add status link on load
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(() => {
        checkKVUsage().then(addStatusLink);
      }, 2000);
    });

    // Check for Spotify auth errors and show invite modal
    window.addEventListener('load', () => {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('error') === 'spotify_whitelist' || urlParams.get('error') === 'access_denied') {
        showInviteRequestModal();
        // Clean URL
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    });

    // ====================================
    // Error Logging & Monitoring
    // ====================================

    const errorQueue = [];
    let errorFlushTimer = null;

    function logErrorToBackend(error) {
      const errorData = {
        message: error.message || String(error),
        stack: error.stack || null,
        url: window.location.href,
        userAgent: navigator.userAgent,
        timestamp: new Date().toISOString()
      };

      errorQueue.push(errorData);

      // Batch errors - send after 2 seconds of no new errors
      clearTimeout(errorFlushTimer);
      errorFlushTimer = setTimeout(flushErrors, 2000);
    }

    function flushErrors() {
      if (errorQueue.length === 0) return;

      const errors = [...errorQueue];
      errorQueue.length = 0;

      // Send to backend (fire and forget)
      fetch('/api/log-error', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ errors })
      }).catch(() => {}); // Ignore failures
    }

    // Global error handler
    window.onerror = function(message, source, lineno, colno, error) {
      logErrorToBackend({
        message: message,
        stack: error?.stack || (source + ':' + lineno + ':' + colno),
        type: 'error'
      });
      return false; // Let default handler run too
    };

    // Unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      logErrorToBackend({
        message: event.reason?.message || String(event.reason),
        stack: event.reason?.stack || null,
        type: 'unhandledrejection'
      });
    });

    // ====================================
    // Performance Metrics
    // ====================================

    let perfMetrics = null;

    function collectPerformanceMetrics() {
      if (!window.performance || !performance.timing) return null;

      const timing = performance.timing;
      const now = Date.now();

      return {
        // Page load timing
        pageLoadTime: timing.loadEventEnd - timing.navigationStart,
        domContentLoaded: timing.domContentLoadedEventEnd - timing.navigationStart,
        timeToFirstByte: timing.responseStart - timing.navigationStart,
        domInteractive: timing.domInteractive - timing.navigationStart,

        // Network
        dnsLookup: timing.domainLookupEnd - timing.domainLookupStart,
        tcpConnect: timing.connectEnd - timing.connectStart,
        serverResponse: timing.responseEnd - timing.requestStart,

        // Measured at collection time
        collectedAt: now
      };
    }

    // Collect metrics after page fully loads
    window.addEventListener('load', () => {
      setTimeout(() => {
        perfMetrics = collectPerformanceMetrics();
        if (perfMetrics && perfMetrics.pageLoadTime > 0) {
          // Send to backend
          fetch('/api/log-perf', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(perfMetrics)
          }).catch(() => {});
        }
      }, 100);
    });

    // ====================================
    // Health Status Indicator
    // ====================================

    let healthStatus = { ok: true, issues: [] };

    async function checkHealth() {
      try {
        const startTime = Date.now();
        const response = await fetch('/health?detailed=true');
        const responseTime = Date.now() - startTime;

        if (!response.ok) {
          healthStatus = { ok: false, issues: ['API unreachable'], responseTime };
          updateHealthIndicator();
          return;
        }

        const data = await response.json();
        const issues = [];

        // Check response time
        if (responseTime > 3000) {
          issues.push('Slow response (' + Math.round(responseTime/1000) + 's)');
        }

        // Check KV status from /health response
        if (data.components?.kv === 'degraded') {
          issues.push('KV storage issues');
        }

        // Check from our KV usage data
        if (kvUsageData?.status === 'critical') {
          issues.push('Rate limits reached');
        } else if (kvUsageData?.status === 'warning') {
          issues.push('High usage');
        }

        healthStatus = {
          ok: issues.length === 0,
          issues: issues,
          responseTime: responseTime
        };

        updateHealthIndicator();
      } catch (err) {
        healthStatus = { ok: false, issues: ['Cannot reach server'], responseTime: null };
        updateHealthIndicator();
      }
    }

    function updateHealthIndicator() {
      let indicator = document.getElementById('health-indicator');

      if (!indicator) {
        // Create indicator if it doesn't exist
        indicator = document.createElement('div');
        indicator.id = 'health-indicator';
        indicator.className = 'health-indicator';
        indicator.onclick = showHealthDetails;
        document.body.appendChild(indicator);
      }

      // Update status
      indicator.className = 'health-indicator ' + (healthStatus.ok ? 'healthy' : 'unhealthy');

      const statusText = healthStatus.ok
        ? (swedishMode ? 'Allt OK' : 'All Systems OK')
        : (swedishMode ? 'Problem upptäckt' : 'Issues Detected');

      const rtText = healthStatus.responseTime
        ? ' (' + healthStatus.responseTime + 'ms)'
        : '';

      indicator.innerHTML =
        '<span class="health-dot"></span>' +
        '<span class="health-text">' + statusText + rtText + '</span>';
    }

    function showHealthDetails() {
      const details = [
        'Status: ' + (healthStatus.ok ? '✅ Healthy' : '⚠️ Issues'),
        healthStatus.responseTime ? 'Response: ' + healthStatus.responseTime + 'ms' : null,
        healthStatus.issues.length > 0 ? 'Issues: ' + healthStatus.issues.join(', ') : null,
        perfMetrics ? 'Page load: ' + perfMetrics.pageLoadTime + 'ms' : null,
        kvUsageData ? 'KV reads: ' + (kvUsageData.usage?.reads?.percent || 0) + '%' : null,
        kvUsageData ? 'KV writes: ' + (kvUsageData.usage?.writes?.percent || 0) + '%' : null
      ].filter(Boolean);

      showNotification(details.join(' | '), healthStatus.ok ? 'success' : 'warning');
    }

    // Check health on load and periodically
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(checkHealth, 3000); // Initial check after 3s
      setInterval(checkHealth, 60000); // Then every minute
    });

    // ====================================
    // Share Modal (#90)
    // ====================================

    function showShareModal(playlistName, playlistUrl) {
      const existing = document.querySelector('.share-modal-overlay');
      if (existing) existing.remove();

      const qrCodeUrl = 'https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=' + encodeURIComponent(playlistUrl);

      const modal = document.createElement('div');
      modal.className = 'share-modal-overlay';
      modal.innerHTML = [
        '<div class="share-modal">',
        '  <button class="share-close" onclick="this.closest(\'.share-modal-overlay\').remove()">&times;</button>',
        '  <h3>' + (swedishMode ? '🎉 Dela din spellista!' : '🎉 Share your playlist!') + '</h3>',
        '  <p class="share-playlist-name">' + playlistName + '</p>',
        '  <div class="share-qr-container">',
        '    <img src="' + qrCodeUrl + '" alt="QR Code" class="share-qr-code" />',
        '  </div>',
        '  <div class="share-link-container">',
        '    <input type="text" class="share-link-input" value="' + playlistUrl + '" readonly />',
        '    <button class="btn btn-secondary share-copy-btn" onclick="copyShareLink(this)">' + (swedishMode ? 'Kopiera' : 'Copy') + '</button>',
        '  </div>',
        '  <div class="share-social-buttons">',
        '    <a href="https://twitter.com/intent/tweet?url=' + encodeURIComponent(playlistUrl) + '&text=' + encodeURIComponent('Check out my ' + playlistName + ' playlist! 🎵') + '" target="_blank" class="share-social-btn twitter">𝕏</a>',
        '    <a href="https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(playlistUrl) + '" target="_blank" class="share-social-btn facebook">f</a>',
        '    <a href="whatsapp://send?text=' + encodeURIComponent(playlistName + ' - ' + playlistUrl) + '" target="_blank" class="share-social-btn whatsapp">💬</a>',
        '  </div>',
        '  <a href="' + playlistUrl + '" target="_blank" class="btn btn-primary share-open-btn">' + (swedishMode ? 'Öppna i Spotify' : 'Open in Spotify') + '</a>',
        '</div>'
      ].join('');

      document.body.appendChild(modal);

      // Close on backdrop click
      modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.remove();
      });
    }

    function copyShareLink(btn) {
      const input = btn.previousElementSibling;
      input.select();
      document.execCommand('copy');
      btn.textContent = swedishMode ? '✓ Kopierad!' : '✓ Copied!';
      setTimeout(() => {
        btn.textContent = swedishMode ? 'Kopiera' : 'Copy';
      }, 2000);
    }

    window.copyShareLink = copyShareLink;

    // ====================================
    // Genre Family Grouping (#79)
    // ====================================

    const GENRE_FAMILIES = {
      rock: ['rock', 'alt rock', 'indie rock', 'hard rock', 'classic rock', 'punk rock', 'soft rock', 'garage rock', 'progressive rock', 'psychedelic rock', 'grunge', 'post-punk', 'new wave'],
      pop: ['pop', 'dance pop', 'electropop', 'synth-pop', 'indie pop', 'art pop', 'dream pop', 'k-pop', 'j-pop', 'teen pop', 'bubblegum pop'],
      electronic: ['electronic', 'edm', 'house', 'techno', 'trance', 'dubstep', 'drum and bass', 'ambient', 'electro', 'chillwave', 'synthwave', 'future bass'],
      hiphop: ['hip hop', 'rap', 'trap', 'drill', 'boom bap', 'southern hip hop', 'west coast hip hop', 'east coast hip hop', 'conscious hip hop', 'gangsta rap'],
      rnb: ['r&b', 'soul', 'neo soul', 'contemporary r&b', 'funk', 'motown', 'quiet storm'],
      metal: ['metal', 'heavy metal', 'death metal', 'black metal', 'thrash metal', 'doom metal', 'power metal', 'progressive metal', 'metalcore', 'nu metal'],
      jazz: ['jazz', 'smooth jazz', 'bebop', 'cool jazz', 'free jazz', 'fusion', 'swing', 'big band'],
      classical: ['classical', 'baroque', 'romantic', 'contemporary classical', 'opera', 'orchestral', 'chamber music'],
      country: ['country', 'country rock', 'outlaw country', 'americana', 'bluegrass', 'honky tonk'],
      folk: ['folk', 'indie folk', 'folk rock', 'traditional folk', 'singer-songwriter', 'acoustic'],
      reggae: ['reggae', 'dub', 'ska', 'dancehall', 'roots reggae'],
      latin: ['latin', 'reggaeton', 'salsa', 'bachata', 'cumbia', 'bossa nova', 'latin pop'],
      world: ['world', 'afrobeat', 'celtic', 'flamenco', 'indian classical', 'middle eastern']
    };

    let genreViewMode = 'flat'; // 'flat' or 'grouped'

    function getGenreFamily(genreName) {
      const lowerName = genreName.toLowerCase();
      for (const [family, keywords] of Object.entries(GENRE_FAMILIES)) {
        if (keywords.some(kw => lowerName.includes(kw))) {
          return family;
        }
      }
      return 'other';
    }

    function groupGenresByFamily(genres) {
      const grouped = {};
      for (const genre of genres) {
        const family = getGenreFamily(genre.name);
        if (!grouped[family]) {
          grouped[family] = { genres: [], totalCount: 0 };
        }
        grouped[family].genres.push(genre);
        grouped[family].totalCount += genre.count;
      }
      // Sort families by total count
      return Object.entries(grouped)
        .sort((a, b) => b[1].totalCount - a[1].totalCount)
        .reduce((acc, [k, v]) => { acc[k] = v; return acc; }, {});
    }

    function toggleGenreViewMode() {
      genreViewMode = genreViewMode === 'flat' ? 'grouped' : 'flat';
      renderGenres();
      showNotification(
        genreViewMode === 'grouped'
          ? (swedishMode ? 'Visar grupperade genrer' : 'Showing grouped genres')
          : (swedishMode ? 'Visar alla genrer' : 'Showing all genres'),
        'info'
      );
    }

    window.toggleGenreViewMode = toggleGenreViewMode;

    function getFamilyEmoji(family) {
      const emojis = {
        rock: '🎸', pop: '🎤', electronic: '🎹', hiphop: '🎧', rnb: '🎷',
        metal: '🤘', jazz: '🎺', classical: '🎻', country: '🤠', folk: '🪕',
        reggae: '🇯🇲', latin: '💃', world: '🌍', other: '🎵'
      };
      return emojis[family] || '🎵';
    }

    function getFamilyName(family) {
      const names = {
        rock: { en: 'Rock', sv: 'Rock' },
        pop: { en: 'Pop', sv: 'Pop' },
        electronic: { en: 'Electronic', sv: 'Elektronisk' },
        hiphop: { en: 'Hip Hop', sv: 'Hip Hop' },
        rnb: { en: 'R&B / Soul', sv: 'R&B / Soul' },
        metal: { en: 'Metal', sv: 'Metal' },
        jazz: { en: 'Jazz', sv: 'Jazz' },
        classical: { en: 'Classical', sv: 'Klassisk' },
        country: { en: 'Country', sv: 'Country' },
        folk: { en: 'Folk', sv: 'Folk' },
        reggae: { en: 'Reggae', sv: 'Reggae' },
        latin: { en: 'Latin', sv: 'Latin' },
        world: { en: 'World', sv: 'Världsmusik' },
        other: { en: 'Other', sv: 'Övrigt' }
      };
      return swedishMode ? (names[family]?.sv || family) : (names[family]?.en || family);
    }

    // ====================================
    // Swedish Release Codenames (#71)
    // ====================================

    const RELEASE_CODENAMES = {
      '3.0': { sv: 'Förtrollad', en: 'Enchanted' },
      '3.1': { sv: 'Äventyr', en: 'Adventure' },
      '3.2': { sv: 'Skymning', en: 'Twilight' },
      '3.3': { sv: 'Magi', en: 'Magic' },
      '3.4': { sv: 'Stjärnfall', en: 'Starfall' },
      '3.5': { sv: 'Midnatt', en: 'Midnight' },
      '4.0': { sv: 'Gryning', en: 'Dawn' }
    };

    function getVersionWithCodename(version) {
      const majorMinor = version.replace(/^v/, '').split('.').slice(0, 2).join('.');
      const codename = RELEASE_CODENAMES[majorMinor];
      if (codename) {
        return 'v' + version.replace(/^v/, '') + ' - ' + (swedishMode ? codename.sv : codename.en);
      }
      return 'v' + version.replace(/^v/, '');
    }

    // ====================================
    // Dynamic Completion Messages (#41)
    // ====================================

    const GENRE_MESSAGES = {
      rock: { en: "You're a certified rockstar! 🎸", sv: 'Du är en certifierad rockstjärna! 🎸' },
      pop: { en: 'Pop goes your playlist! 🎤', sv: 'Pop går din spellista! 🎤' },
      'hip hop': { en: 'Straight outta your library! 🎧', sv: 'Direkt från ditt bibliotek! 🎧' },
      electronic: { en: "You've got the beats! 🎹", sv: 'Du har beaten! 🎹' },
      metal: { en: 'Heavy metal thunder! 🤘', sv: 'Heavy metal-åska! 🤘' },
      indie: { en: 'Too cool for mainstream! 🎪', sv: 'För cool för mainstream! 🎪' },
      jazz: { en: 'Smooth as butter! 🎷', sv: 'Smidig som smör! 🎷' },
      classical: { en: 'A person of culture! 🎻', sv: 'En person av kultur! 🎻' },
      country: { en: 'Yeehaw! 🤠', sv: 'Yeehaw! 🤠' },
      'k-pop': { en: 'Annyeonghaseyo! 🇰🇷', sv: 'Annyeonghaseyo! 🇰🇷' },
      default: { en: 'Your taste is uniquely yours! ✨', sv: 'Din smak är unikt din! ✨' }
    };

    function getCompletionMessage(topGenres) {
      if (!topGenres || topGenres.length === 0) {
        return swedishMode ? GENRE_MESSAGES.default.sv : GENRE_MESSAGES.default.en;
      }

      const topGenre = topGenres[0].name.toLowerCase();

      for (const [genre, messages] of Object.entries(GENRE_MESSAGES)) {
        if (topGenre.includes(genre)) {
          return swedishMode ? messages.sv : messages.en;
        }
      }

      return swedishMode ? GENRE_MESSAGES.default.sv : GENRE_MESSAGES.default.en;
    }

    // ====================================
    // Artist Deep Dive (#78)
    // ====================================

    function showArtistBreakdown(genreName) {
      const genre = genreData?.genres?.find(g => g.name === genreName);
      if (!genre) return;

      // Collect artist data from genre tracks
      const artistCounts = new Map();
      const artistNames = new Map();

      if (genre.artistIds && genreData.artistsCache) {
        for (const artistId of genre.artistIds) {
          const artist = genreData.artistsCache[artistId];
          if (artist) {
            artistCounts.set(artistId, (artistCounts.get(artistId) || 0) + 1);
            artistNames.set(artistId, artist.name);
          }
        }
      }

      // Sort by count
      const sortedArtists = [...artistCounts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);

      const modal = document.createElement('div');
      modal.className = 'modal-overlay artist-breakdown-modal';

      const artistList = sortedArtists.map(([id, count]) => {
        const name = artistNames.get(id) || 'Unknown';
        return '<div class="artist-breakdown-item">' +
          '<span class="artist-name">' + name + '</span>' +
          '<span class="artist-count">' + count + ' ' + (swedishMode ? 'låtar' : 'tracks') + '</span>' +
          '</div>';
      }).join('');

      modal.innerHTML = [
        '<div class="modal artist-breakdown">',
        '  <h3>' + getFamilyEmoji(getGenreFamily(genreName)) + ' ' + genreName + '</h3>',
        '  <p class="artist-breakdown-subtitle">' + (swedishMode ? 'Topp artister i denna genre' : 'Top artists in this genre') + '</p>',
        '  <div class="artist-breakdown-list">' + (artistList || '<p>' + (swedishMode ? 'Ingen artistdata tillgänglig' : 'No artist data available') + '</p>') + '</div>',
        '  <div class="modal-actions">',
        '    <button class="btn btn-ghost" onclick="this.closest(\'.modal-overlay\').remove()">' + (swedishMode ? 'Stäng' : 'Close') + '</button>',
        '  </div>',
        '</div>'
      ].join('');

      document.body.appendChild(modal);
      modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
    }

    window.showArtistBreakdown = showArtistBreakdown;

    // ====================================
    // Genre Wrapped - Shareable Stats Card
    // ====================================

    const GENRE_GRADIENTS = {
      rock: 'linear-gradient(135deg, #dc2626 0%, #7c2d12 50%, #1a1a2e 100%)',
      pop: 'linear-gradient(135deg, #ec4899 0%, #8b5cf6 50%, #06b6d4 100%)',
      electronic: 'linear-gradient(135deg, #00f5d4 0%, #7209b7 50%, #f72585 100%)',
      hiphop: 'linear-gradient(135deg, #f59e0b 0%, #dc2626 50%, #1f2937 100%)',
      rnb: 'linear-gradient(135deg, #8b5cf6 0%, #ec4899 50%, #f97316 100%)',
      metal: 'linear-gradient(135deg, #1f2937 0%, #dc2626 50%, #000000 100%)',
      jazz: 'linear-gradient(135deg, #1e3a5f 0%, #d4af37 50%, #0f172a 100%)',
      classical: 'linear-gradient(135deg, #fffbeb 0%, #d4af37 50%, #1f2937 100%)',
      country: 'linear-gradient(135deg, #d97706 0%, #92400e 50%, #1c1917 100%)',
      folk: 'linear-gradient(135deg, #84cc16 0%, #a3e635 50%, #365314 100%)',
      reggae: 'linear-gradient(135deg, #16a34a 0%, #facc15 50%, #dc2626 100%)',
      latin: 'linear-gradient(135deg, #f97316 0%, #ef4444 50%, #fbbf24 100%)',
      world: 'linear-gradient(135deg, #0ea5e9 0%, #8b5cf6 50%, #f97316 100%)',
      other: 'linear-gradient(135deg, #1db954 0%, #191414 50%, #1db954 100%)',
      swedish: 'linear-gradient(135deg, #006AA7 0%, #FECC00 50%, #006AA7 100%)'
    };

    const GENRE_PERSONALITIES = {
      rock: {
        en: { title: 'The Rebel Soul', emoji: '🎸', desc: 'You live for the riff. Raw energy courses through your veins.' },
        sv: { title: 'Rebellsjälen', emoji: '🎸', desc: 'Du lever för riffet. Rå energi flödar genom dina ådror.' }
      },
      pop: {
        en: { title: 'The Hitmaker', emoji: '✨', desc: 'You know what slaps. Your playlists are pure vibes.' },
        sv: { title: 'Hitfabriken', emoji: '✨', desc: 'Du vet vad som svänger. Dina spellistor är ren känsla.' }
      },
      electronic: {
        en: { title: 'The Synthesist', emoji: '🎹', desc: 'Bass drops and synth waves fuel your existence.' },
        sv: { title: 'Syntmästaren', emoji: '🎹', desc: 'Basdrops och synthvågor driver din existens.' }
      },
      hiphop: {
        en: { title: 'The Flow Master', emoji: '🎤', desc: 'Bars and beats. You appreciate the art of the rhyme.' },
        sv: { title: 'Flowmästaren', emoji: '🎤', desc: 'Bars och beats. Du uppskattar rimkonsten.' }
      },
      rnb: {
        en: { title: 'The Smooth Operator', emoji: '🎷', desc: 'Silky vocals and groovy basslines are your love language.' },
        sv: { title: 'Den Smidiga', emoji: '🎷', desc: 'Silkeslen sång och groovy baslinjer är ditt kärleksspråk.' }
      },
      metal: {
        en: { title: 'The Thunder God', emoji: '🤘', desc: 'Heavy. Brutal. Unapologetic. You embrace the chaos.' },
        sv: { title: 'Åskguden', emoji: '🤘', desc: 'Tungt. Brutalt. Oförsonligt. Du omfamnar kaoset.' }
      },
      jazz: {
        en: { title: 'The Improviser', emoji: '🎺', desc: 'Complex harmonies speak to your sophisticated soul.' },
        sv: { title: 'Improvisatören', emoji: '🎺', desc: 'Komplexa harmonier talar till din sofistikerade själ.' }
      },
      classical: {
        en: { title: 'The Maestro', emoji: '🎻', desc: 'Timeless compositions move you like nothing else.' },
        sv: { title: 'Maestron', emoji: '🎻', desc: 'Tidlösa kompositioner berör dig som inget annat.' }
      },
      country: {
        en: { title: 'The Storyteller', emoji: '🤠', desc: 'Real lyrics about real life. You feel every word.' },
        sv: { title: 'Berättaren', emoji: '🤠', desc: 'Verkliga texter om verkligt liv. Du känner varje ord.' }
      },
      folk: {
        en: { title: 'The Old Soul', emoji: '🌿', desc: 'Acoustic vibes and honest lyrics speak to your heart.' },
        sv: { title: 'Den Gamla Själen', emoji: '🌿', desc: 'Akustiska vibar och ärliga texter talar till ditt hjärta.' }
      },
      reggae: {
        en: { title: 'The Peaceful Warrior', emoji: '☮️', desc: 'Good vibes only. You spread love through rhythm.' },
        sv: { title: 'Fredskrigaren', emoji: '☮️', desc: 'Bara bra vibbar. Du sprider kärlek genom rytm.' }
      },
      latin: {
        en: { title: 'The Fire Dancer', emoji: '💃', desc: 'Passion and rhythm flow through everything you do.' },
        sv: { title: 'Elddansaren', emoji: '💃', desc: 'Passion och rytm flödar genom allt du gör.' }
      },
      world: {
        en: { title: 'The Explorer', emoji: '🌍', desc: 'Music knows no borders. You discover sounds from everywhere.' },
        sv: { title: 'Upptäckaren', emoji: '🌍', desc: 'Musik känner inga gränser. Du upptäcker ljud överallt.' }
      },
      other: {
        en: { title: 'The Eclectic', emoji: '🎵', desc: 'Your taste defies categories. Truly unique.' },
        sv: { title: 'Den Eklektiska', emoji: '🎵', desc: 'Din smak trotsar kategorier. Verkligt unik.' }
      }
    };

    // Astrology-tier "deep" personality readings - cookie cutter but feels personal
    const PERSONALITY_READINGS = {
      rock: {
        en: [
          'You probably have a playlist you made at 2am that hits different.',
          'People underestimate your emotional depth. Their loss.',
          'You\'re the friend who always controls the aux cord - and everyone\'s grateful.',
          'Your energy is magnetic. You don\'t follow trends, you set them.',
          'Late nights and loud guitars speak to something deep in your soul.'
        ],
        sv: [
          'Du har säkert en spellista du gjorde klockan 2 på natten som träffar annorlunda.',
          'Folk underskattar ditt emotionella djup. Deras förlust.',
          'Du är kompisen som alltid kontrollerar musiken - och alla är tacksamma.',
          'Din energi är magnetisk. Du följer inte trender, du sätter dem.',
          'Sena nätter och höga gitarrer talar till något djupt i din själ.'
        ]
      },
      pop: {
        en: [
          'You radiate main character energy. Own it.',
          'Your vibe is immaculate. People want to be around your energy.',
          'You know exactly what song fits every moment of your life.',
          'Secretly deep, openly fun. That\'s your whole brand.',
          'Your playlist is basically a therapy session disguised as a party.'
        ],
        sv: [
          'Du utstrålar huvudrollsenergi. Äg det.',
          'Din vibe är fläckfri. Folk vill vara runt din energi.',
          'Du vet exakt vilken låt som passar varje ögonblick i ditt liv.',
          'Hemligt djup, öppet rolig. Det är hela ditt varumärke.',
          'Din spellista är i princip en terapisession förklädd till fest.'
        ]
      },
      electronic: {
        en: [
          'You see patterns others miss. Your mind works different.',
          'You\'re probably most creative between midnight and 4am.',
          'Your brain operates on frequencies most can\'t comprehend.',
          'Futuristic thinker with nostalgic tendencies. Complex, like your taste.',
          'You don\'t need lyrics to feel understood. The beat speaks.'
        ],
        sv: [
          'Du ser mönster andra missar. Ditt sinne fungerar annorlunda.',
          'Du är förmodligen mest kreativ mellan midnatt och 4 på morgonen.',
          'Din hjärna arbetar på frekvenser de flesta inte kan förstå.',
          'Futuristisk tänkare med nostalgiska tendenser. Komplex, som din smak.',
          'Du behöver inte texter för att känna dig förstådd. Beaten talar.'
        ]
      },
      hiphop: {
        en: [
          'You appreciate craft. Flow, wordplay, delivery - you notice it all.',
          'Your confidence isn\'t arrogance, it\'s awareness of your worth.',
          'You\'ve got stories to tell and wisdom beyond your years.',
          'Streets smart and emotionally intelligent. Rare combination.',
          'You hear the poetry where others just hear music.'
        ],
        sv: [
          'Du uppskattar hantverk. Flow, ordlekar, leverans - du märker allt.',
          'Ditt självförtroende är inte arrogans, det är medvetenhet om ditt värde.',
          'Du har historier att berätta och visdom bortom dina år.',
          'Gatusmart och emotionellt intelligent. Sällsynt kombination.',
          'Du hör poesin där andra bara hör musik.'
        ]
      },
      rnb: {
        en: [
          'You feel things deeply and that\'s your superpower.',
          'Your love language is definitely quality time with good music.',
          'Sensual, sophisticated, and slightly mysterious. You know who you are.',
          'When you fall, you fall hard. The playlist reflects that.',
          'You make mundane moments feel cinematic. Main character behavior.'
        ],
        sv: [
          'Du känner saker djupt och det är din superkraft.',
          'Ditt kärleksspråk är definitivt kvalitetstid med bra musik.',
          'Sensuell, sofistikerad och lite mystisk. Du vet vem du är.',
          'När du faller, faller du hårt. Spellistan reflekterar det.',
          'Du gör vardagliga stunder filmiska. Huvudrollsbeteende.'
        ]
      },
      metal: {
        en: [
          'You\'re intense and you\'ve made peace with that. Others should too.',
          'Secretly one of the most emotionally intelligent people in the room.',
          'You process life through extremes. It keeps you balanced.',
          'Your loyalty is unmatched. Ride or die energy.',
          'Chaos on the outside, deeply philosophical on the inside.'
        ],
        sv: [
          'Du är intensiv och du har gjort fred med det. Andra borde också.',
          'I hemlighet en av de mest emotionellt intelligenta i rummet.',
          'Du bearbetar livet genom extremer. Det håller dig balanserad.',
          'Din lojalitet är oöverträffad. Ride or die-energi.',
          'Kaos på utsidan, djupt filosofisk på insidan.'
        ]
      },
      jazz: {
        en: [
          'You appreciate nuance in a world that loves to oversimplify.',
          'Old soul energy in a young body. Time moves different for you.',
          'Conversations with you go places people don\'t expect.',
          'You notice the spaces between the notes. That\'s where meaning lives.',
          'Intellectually curious and emotionally deep. A rare combo.'
        ],
        sv: [
          'Du uppskattar nyanser i en värld som älskar att förenkla.',
          'Gammal själsenergi i en ung kropp. Tiden rör sig annorlunda för dig.',
          'Samtal med dig går dit folk inte förväntar sig.',
          'Du märker utrymmena mellan tonerna. Där bor meningen.',
          'Intellektuellt nyfiken och emotionellt djup. En sällsynt kombo.'
        ]
      },
      classical: {
        en: [
          'You see beauty in structure that others find rigid. That\'s depth.',
          'Your inner world is rich beyond what most could imagine.',
          'Patient. Observant. You understand delayed gratification.',
          'You feel connected to something timeless and larger than yourself.',
          'In a world of instant gratification, you appreciate the slow build.'
        ],
        sv: [
          'Du ser skönhet i struktur som andra finner stel. Det är djup.',
          'Din inre värld är rikare än vad de flesta kan föreställa sig.',
          'Tålmodig. Observant. Du förstår fördröjd belöning.',
          'Du känner dig kopplad till något tidlöst och större än dig själv.',
          'I en värld av omedelbar belöning uppskattar du den långsamma uppbyggnaden.'
        ]
      },
      country: {
        en: [
          'You value authenticity over everything. Can\'t fake real.',
          'Your heart is bigger than your problems, and that\'s saying something.',
          'You tell it like it is. People respect that more than you know.',
          'Nostalgic but not stuck. You honor the past while moving forward.',
          'Community matters to you. You remember where you came from.'
        ],
        sv: [
          'Du värderar autenticitet över allt annat. Kan inte fejka äkta.',
          'Ditt hjärta är större än dina problem, och det säger något.',
          'Du säger som det är. Folk respekterar det mer än du vet.',
          'Nostalgisk men inte fast. Du hedrar det förflutna medan du går framåt.',
          'Gemenskap betyder något för dig. Du kommer ihåg varifrån du kom.'
        ]
      },
      folk: {
        en: [
          'You find poetry in the ordinary. That\'s a gift.',
          'Genuine to your core. People trust you instantly.',
          'You listen more than you speak, and notice more than you say.',
          'Nature probably recharges you. Cities drain your energy.',
          'Simplicity isn\'t boring to you - it\'s honest.'
        ],
        sv: [
          'Du hittar poesi i det vardagliga. Det är en gåva.',
          'Genuin in i kärnan. Folk litar på dig direkt.',
          'Du lyssnar mer än du talar, och märker mer än du säger.',
          'Naturen laddar förmodligen om dig. Städer dränerar din energi.',
          'Enkelhet är inte tråkigt för dig - det är ärligt.'
        ]
      },
      reggae: {
        en: [
          'Your calm is contagious. People feel better around you.',
          'You understand that life flows better when you don\'t fight it.',
          'Spiritual without being preachy. You just radiate peace.',
          'Problems exist, but so does perspective. You\'ve got both.',
          'You bring people together without trying. Natural connector.'
        ],
        sv: [
          'Ditt lugn är smittsamt. Folk mår bättre runt dig.',
          'Du förstår att livet flyter bättre när man inte kämpar emot.',
          'Spirituell utan att predika. Du utstrålar bara fred.',
          'Problem finns, men det gör perspektiv också. Du har båda.',
          'Du för samman människor utan att försöka. Naturlig sammankopplare.'
        ]
      },
      latin: {
        en: [
          'You live with intention. Every moment matters.',
          'Your passion is inspiring and slightly intimidating. Good.',
          'You express emotions freely. Bottling up isn\'t your style.',
          'Life is for living loudly. You understood the assignment.',
          'Your energy is magnetic. People are drawn to your fire.'
        ],
        sv: [
          'Du lever med intention. Varje ögonblick spelar roll.',
          'Din passion är inspirerande och lite skrämmande. Bra.',
          'Du uttrycker känslor fritt. Att hålla inne är inte din stil.',
          'Livet är till för att levas högt. Du förstod uppgiften.',
          'Din energi är magnetisk. Folk dras till din eld.'
        ]
      },
      world: {
        en: [
          'Curious soul. You\'re not satisfied with the obvious.',
          'Borders are just lines to you. Your mind travels freely.',
          'You see connections others miss. Global perspective is rare.',
          'Open-minded doesn\'t even begin to describe you.',
          'Your empathy extends beyond your own experience. That\'s growth.'
        ],
        sv: [
          'Nyfiken själ. Du nöjer dig inte med det uppenbara.',
          'Gränser är bara linjer för dig. Ditt sinne reser fritt.',
          'Du ser kopplingar andra missar. Globalt perspektiv är sällsynt.',
          'Öppensinnad börjar inte ens beskriva dig.',
          'Din empati sträcker sig bortom din egen erfarenhet. Det är tillväxt.'
        ]
      },
      other: {
        en: [
          'Labels don\'t define you. Your taste is authentically yours.',
          'You\'re drawn to what resonates, not what\'s expected.',
          'Category-defying taste usually means category-defying person.',
          'Your mind makes connections that surprise even you.',
          'Different isn\'t a phase for you. It\'s just who you are.'
        ],
        sv: [
          'Etiketter definierar inte dig. Din smak är autentiskt din.',
          'Du dras till det som resonerar, inte det som förväntas.',
          'Kategoribrytande smak brukar betyda kategoribrytande person.',
          'Ditt sinne gör kopplingar som överraskar även dig.',
          'Annorlunda är inte en fas för dig. Det är bara vem du är.'
        ]
      }
    };

    function getRandomReading(family, lang) {
      const readings = PERSONALITY_READINGS[family]?.[lang] || PERSONALITY_READINGS.other[lang];
      return readings[Math.floor(Math.random() * readings.length)];
    }

    const WRAPPED_FACTS = {
      en: [
        'Your music taste is in the top {pct}% for variety!',
        'You\'ve discovered {count} unique genres - that\'s impressive!',
        'Your library spans {artists} different artists',
        'If your genres were a party, it\'d be legendary',
        'Your ears have traveled through {genres} different sonic worlds'
      ],
      sv: [
        'Din musiksmak är bland topp {pct}% för variation!',
        'Du har upptäckt {count} unika genrer - imponerande!',
        'Ditt bibliotek spänner över {artists} olika artister',
        'Om dina genrer var en fest, skulle den vara legendarisk',
        'Dina öron har rest genom {genres} olika soniska världar'
      ]
    };

    function calculateDiversityScore(genres) {
      if (!genres || genres.length === 0) return 0;
      const totalTracks = genres.reduce((sum, g) => sum + g.count, 0);
      if (totalTracks === 0) return 0;

      // Shannon diversity index normalized to 0-100
      let entropy = 0;
      for (const genre of genres) {
        const p = genre.count / totalTracks;
        if (p > 0) entropy -= p * Math.log2(p);
      }
      const maxEntropy = Math.log2(genres.length);
      return maxEntropy > 0 ? Math.round((entropy / maxEntropy) * 100) : 0;
    }

    function showGenreWrapped() {
      // Get current genre data from the app state
      const genres = window.currentGenres || [];
      if (genres.length === 0) {
        alert(swedishMode ? 'Analysera dina låtar först!' : 'Analyze your tracks first!');
        return;
      }

      const existing = document.querySelector('.wrapped-overlay');
      if (existing) existing.remove();

      // Calculate stats
      const totalTracks = genres.reduce((sum, g) => sum + g.count, 0);
      const topGenres = genres.slice(0, 5);
      const topFamily = getGenreFamily(topGenres[0]?.name || '');
      const diversityScore = calculateDiversityScore(genres);
      const personality = GENRE_PERSONALITIES[topFamily] || GENRE_PERSONALITIES.other;
      const lang = swedishMode ? 'sv' : 'en';
      const gradient = swedishMode ? GENRE_GRADIENTS.swedish : (GENRE_GRADIENTS[topFamily] || GENRE_GRADIENTS.other);
      const reading = getRandomReading(topFamily, lang);

      // Get unique artists count (estimate from genres)
      const uniqueArtists = Math.round(totalTracks * 0.6); // rough estimate

      // Random fun fact
      const facts = WRAPPED_FACTS[lang];
      const fact = facts[Math.floor(Math.random() * facts.length)]
        .replace('{pct}', Math.max(5, 100 - diversityScore))
        .replace('{count}', genres.length)
        .replace('{artists}', uniqueArtists)
        .replace('{genres}', genres.length);

      // Build top genres bars
      const maxCount = topGenres[0]?.count || 1;
      const genreBars = topGenres.map((g, i) => {
        const pct = Math.round((g.count / maxCount) * 100);
        const delay = i * 0.1;
        return '<div class="wrapped-genre-bar" style="animation-delay: ' + delay + 's">' +
               '  <span class="wrapped-genre-name">' + g.name + '</span>' +
               '  <div class="wrapped-bar-container">' +
               '    <div class="wrapped-bar-fill" style="width: ' + pct + '%"></div>' +
               '    <span class="wrapped-bar-count">' + g.count + '</span>' +
               '  </div>' +
               '</div>';
      }).join('');

      // Get user info
      const userName = window.currentUser?.display_name || 'Music Lover';
      const userAvatar = window.currentUser?.images?.[0]?.url || '';

      const modal = document.createElement('div');
      modal.className = 'wrapped-overlay';
      modal.innerHTML = [
        '<div class="wrapped-container">',
        '  <button class="wrapped-close" onclick="this.closest(\'.wrapped-overlay\').remove()">&times;</button>',
        '  <div class="wrapped-card" id="wrapped-card" style="background: ' + gradient + '">',
        '    <div class="wrapped-header">',
        '      <div class="wrapped-logo">',
        '        <span class="wrapped-logo-icon">🧞</span>',
        '        <span class="wrapped-logo-text">Genre Genie</span>',
        '      </div>',
        userAvatar ? '      <img src="' + userAvatar + '" class="wrapped-avatar" alt="' + userName + '" />' : '',
        '    </div>',
        '    <div class="wrapped-personality">',
        '      <span class="wrapped-emoji">' + personality[lang].emoji + '</span>',
        '      <h2 class="wrapped-title">' + personality[lang].title + '</h2>',
        '      <p class="wrapped-desc">' + personality[lang].desc + '</p>',
        '      <p class="wrapped-reading">"' + reading + '"</p>',
        '    </div>',
        '    <div class="wrapped-stats">',
        '      <div class="wrapped-stat">',
        '        <span class="wrapped-stat-value">' + totalTracks + '</span>',
        '        <span class="wrapped-stat-label">' + (swedishMode ? 'Låtar' : 'Tracks') + '</span>',
        '      </div>',
        '      <div class="wrapped-stat">',
        '        <span class="wrapped-stat-value">' + genres.length + '</span>',
        '        <span class="wrapped-stat-label">' + (swedishMode ? 'Genrer' : 'Genres') + '</span>',
        '      </div>',
        '      <div class="wrapped-stat">',
        '        <span class="wrapped-stat-value">' + diversityScore + '%</span>',
        '        <span class="wrapped-stat-label">' + (swedishMode ? 'Mångfald' : 'Diversity') + '</span>',
        '      </div>',
        '    </div>',
        '    <div class="wrapped-top-genres">',
        '      <h3>' + (swedishMode ? 'Dina Toppgenrer' : 'Your Top Genres') + '</h3>',
        '      ' + genreBars,
        '    </div>',
        '    <div class="wrapped-fact">',
        '      <p>"' + fact + '"</p>',
        '    </div>',
        '    <div class="wrapped-footer">',
        '      <span class="wrapped-user">' + userName + '</span>',
        '      <span class="wrapped-date">' + new Date().toLocaleDateString(swedishMode ? 'sv-SE' : 'en-US', { month: 'short', year: 'numeric' }) + '</span>',
        '    </div>',
        '  </div>',
        '  <div class="wrapped-actions">',
        '    <button class="btn btn-primary wrapped-download" onclick="downloadWrappedCard()">',
        '      ' + (swedishMode ? '📥 Ladda ner' : '📥 Download') + '',
        '    </button>',
        '    <button class="btn btn-secondary wrapped-copy" onclick="copyWrappedToClipboard()">',
        '      ' + (swedishMode ? '📋 Kopiera' : '📋 Copy') + '',
        '    </button>',
        '    <button class="btn btn-ghost wrapped-share-social" onclick="shareWrappedNative()">',
        '      ' + (swedishMode ? '📤 Dela' : '📤 Share') + '',
        '    </button>',
        '  </div>',
        '</div>'
      ].join('');

      document.body.appendChild(modal);
      modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });

      // Animate in
      requestAnimationFrame(() => {
        modal.classList.add('wrapped-visible');
      });
    }

    async function downloadWrappedCard() {
      const card = document.getElementById('wrapped-card');
      if (!card) return;

      try {
        // Use html2canvas if available, otherwise fallback to simple method
        if (typeof html2canvas !== 'undefined') {
          const canvas = await html2canvas(card, {
            backgroundColor: null,
            scale: 2,
            logging: false
          });
          const link = document.createElement('a');
          link.download = 'my-genre-wrapped.png';
          link.href = canvas.toDataURL('image/png');
          link.click();
        } else {
          // Fallback: prompt user to screenshot
          alert(swedishMode
            ? 'Ta en skärmbild av ditt kort! (html2canvas behövs för automatisk nedladdning)'
            : 'Take a screenshot of your card! (html2canvas needed for automatic download)');
        }
      } catch (err) {
        console.error('Download error:', err);
        alert(swedishMode ? 'Kunde inte ladda ner. Ta en skärmbild istället!' : 'Could not download. Take a screenshot instead!');
      }
    }

    async function copyWrappedToClipboard() {
      const card = document.getElementById('wrapped-card');
      if (!card) return;

      try {
        if (typeof html2canvas !== 'undefined') {
          const canvas = await html2canvas(card, {
            backgroundColor: null,
            scale: 2,
            logging: false
          });
          canvas.toBlob(async (blob) => {
            await navigator.clipboard.write([
              new ClipboardItem({ 'image/png': blob })
            ]);
            showToast(swedishMode ? '✓ Kopierat till urklipp!' : '✓ Copied to clipboard!');
          });
        } else {
          // Copy text summary instead
          const personality = document.querySelector('.wrapped-title')?.textContent || '';
          const genres = Array.from(document.querySelectorAll('.wrapped-genre-name')).map(el => el.textContent).join(', ');
          const text = (swedishMode
            ? 'Mitt Genre Genie resultat: ' + personality + '!\nMina toppgenrer: ' + genres + '\n🧞 geniegenie.com'
            : 'My Genre Genie result: ' + personality + '!\nMy top genres: ' + genres + '\n🧞 geniegenie.com');
          await navigator.clipboard.writeText(text);
          showToast(swedishMode ? '✓ Text kopierad!' : '✓ Text copied!');
        }
      } catch (err) {
        console.error('Copy error:', err);
        showToast(swedishMode ? '✗ Kunde inte kopiera' : '✗ Could not copy');
      }
    }

    async function shareWrappedNative() {
      const personality = document.querySelector('.wrapped-title')?.textContent || '';
      const reading = document.querySelector('.wrapped-reading')?.textContent || '';
      const text = swedishMode
        ? 'Jag är en ' + personality + '! 🧞\n\n' + reading + '\n\nVad är du? Kolla din musikpersonlighet på Genre Genie!'
        : 'I\'m a ' + personality + '! 🧞\n\n' + reading + '\n\nWhat are you? Check your music personality on Genre Genie!';

      // Try native share first (works on mobile, offers TikTok/Instagram/Stories etc)
      if (navigator.share) {
        try {
          // Try to share with image if possible
          const card = document.getElementById('wrapped-card');
          if (card && typeof html2canvas !== 'undefined') {
            const canvas = await html2canvas(card, {
              scale: 2,
              useCORS: true,
              backgroundColor: null,
              logging: false
            });
            canvas.toBlob(async (blob) => {
              if (blob) {
                const file = new File([blob], 'genre-genie-wrapped.png', { type: 'image/png' });
                try {
                  await navigator.share({
                    title: swedishMode ? 'Min Musikpersonlighet' : 'My Music Personality',
                    text: text,
                    files: [file]
                  });
                  return;
                } catch (e) {
                  // File sharing not supported, fall through to text-only
                }
              }
            }, 'image/png');
          }
          // Text-only share
          await navigator.share({
            title: swedishMode ? 'Min Musikpersonlighet' : 'My Music Personality',
            text: text
          });
        } catch (err) {
          if (err.name !== 'AbortError') {
            console.error('Share failed:', err);
            showToast(swedishMode ? '✗ Kunde inte dela' : '✗ Could not share');
          }
        }
      } else {
        // Fallback: copy to clipboard
        try {
          await navigator.clipboard.writeText(text);
          showToast(swedishMode ? '✓ Kopierad till urklipp!' : '✓ Copied to clipboard!');
        } catch (err) {
          console.error('Copy failed:', err);
          showToast(swedishMode ? '✗ Kunde inte kopiera' : '✗ Could not copy');
        }
      }
    }

    function showToast(message) {
      const existing = document.querySelector('.toast-notification');
      if (existing) existing.remove();

      const toast = document.createElement('div');
      toast.className = 'toast-notification';
      toast.textContent = message;
      document.body.appendChild(toast);

      setTimeout(() => toast.classList.add('toast-visible'), 10);
      setTimeout(() => {
        toast.classList.remove('toast-visible');
        setTimeout(() => toast.remove(), 300);
      }, 2000);
    }

    // Request Access Modal
    function showRequestAccessModal() {
      const existing = document.querySelector('.request-access-overlay');
      if (existing) existing.remove();

      const modal = document.createElement('div');
      modal.className = 'request-access-overlay';
      modal.innerHTML = \`
        <div class="request-access-modal">
          <button class="modal-close" onclick="this.closest('.request-access-overlay').remove()">&times;</button>
          <h2>🔑 \${t('requestAccessTitle')}</h2>
          <p>\${t('requestAccessDesc')}</p>
          <form onsubmit="submitAccessRequest(event)" class="request-access-form">
            <div class="form-group">
              <label for="request-email">\${t('requestAccessEmail')}</label>
              <input type="email" id="request-email" required placeholder="your@email.com" />
            </div>
            <div class="form-group">
              <label for="request-github">\${t('requestAccessGithub')}</label>
              <input type="text" id="request-github" placeholder="username" />
            </div>
            <div class="form-group">
              <label for="request-message">\${t('requestAccessMessage')}</label>
              <textarea id="request-message" rows="3" placeholder="I'd like to try Genre Genie because..."></textarea>
            </div>
            <button type="submit" class="btn btn-primary request-submit-btn">
              \${t('requestAccessSubmit')}
            </button>
          </form>
        </div>
      \`;

      document.body.appendChild(modal);
      modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });

      // Focus first input
      requestAnimationFrame(() => {
        modal.querySelector('#request-email')?.focus();
      });
    }

    async function submitAccessRequest(event) {
      event.preventDefault();

      const email = document.getElementById('request-email')?.value?.trim();
      const github = document.getElementById('request-github')?.value?.trim();
      const message = document.getElementById('request-message')?.value?.trim();

      if (!email) return;

      const submitBtn = document.querySelector('.request-submit-btn');
      const originalText = submitBtn.textContent;
      submitBtn.textContent = swedishMode ? 'Skickar...' : 'Submitting...';
      submitBtn.disabled = true;

      try {
        const response = await fetch('/api/request-access', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, github, message })
        });

        if (response.ok) {
          showToast(t('requestAccessSuccess'));
          document.querySelector('.request-access-overlay')?.remove();
        } else {
          throw new Error('Request failed');
        }
      } catch (err) {
        console.error('Access request error:', err);
        showToast(t('requestAccessError'));
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
      }
    }

    window.showGenreWrapped = showGenreWrapped;
    window.downloadWrappedCard = downloadWrappedCard;
    window.copyWrappedToClipboard = copyWrappedToClipboard;
    window.shareWrappedNative = shareWrappedNative;
    window.showRequestAccessModal = showRequestAccessModal;
    window.submitAccessRequest = submitAccessRequest;
