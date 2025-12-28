    const app = document.getElementById('app');
    const headerActions = document.getElementById('header-actions');

    let genreData = null;

    // === Global Error Boundary ===
    const errorHistory = [];
    const MAX_ERROR_HISTORY = 10;

    function showErrorModal(error, context = 'Unknown') {
      // Track error for debugging
      const errorInfo = {
        message: error?.message || String(error),
        stack: error?.stack || '',
        context,
        timestamp: new Date().toISOString(),
        url: window.location.href
      };
      errorHistory.push(errorInfo);
      if (errorHistory.length > MAX_ERROR_HISTORY) errorHistory.shift();

      // Don't show multiple error modals
      if (document.querySelector('.error-boundary-overlay')) return;

      const overlay = document.createElement('div');
      overlay.className = 'error-boundary-overlay';

      const friendlyMessages = {
        'Failed to fetch': swedishMode ? 'Kunde inte ansluta till servern' : 'Could not connect to the server',
        'NetworkError': swedishMode ? 'Nätverksfel - kontrollera din anslutning' : 'Network error - check your connection',
        'TypeError': swedishMode ? 'Ett oväntat fel inträffade' : 'An unexpected error occurred',
        'default': swedishMode ? 'Något gick fel' : 'Something went wrong'
      };

      const friendlyMessage = Object.entries(friendlyMessages).find(([key]) =>
        errorInfo.message.includes(key)
      )?.[1] || friendlyMessages.default;

      const issueBody = encodeURIComponent(
        \`## Error Report\\n\\n**Context:** \${context}\\n**Error:** \${errorInfo.message}\\n**URL:** \${errorInfo.url}\\n**Time:** \${errorInfo.timestamp}\\n\\n### Stack Trace\\n\\\`\\\`\\\`\\n\${errorInfo.stack}\\n\\\`\\\`\\\`\`
      );
      const issueUrl = \`https://github.com/thomashoustontech/spotify-genre-sorter/issues/new?title=Error: \${encodeURIComponent(errorInfo.message.slice(0, 50))}&body=\${issueBody}\`;

      overlay.innerHTML = \`
        <div class="error-boundary-modal" role="alertdialog" aria-labelledby="error-title" aria-describedby="error-desc">
          <div class="error-boundary-icon">\${swedishMode ? '😔' : '😵'}</div>
          <h2 id="error-title">\${swedishMode ? 'Oj då!' : 'Oops!'}</h2>
          <p id="error-desc" class="error-boundary-message">\${friendlyMessage}</p>
          <div class="error-boundary-actions">
            <button class="btn btn-primary error-retry-btn" onclick="window.location.reload()">
              \${swedishMode ? '🔄 Försök igen' : '🔄 Try Again'}
            </button>
            <a href="\${issueUrl}" target="_blank" rel="noopener" class="btn btn-ghost error-report-btn">
              \${swedishMode ? '🐛 Rapportera problem' : '🐛 Report Issue'}
            </a>
          </div>
          <details class="error-boundary-details">
            <summary>\${swedishMode ? 'Tekniska detaljer' : 'Technical details'}</summary>
            <pre class="error-boundary-stack">\${escapeForHtml(errorInfo.message)}\\n\\n\${escapeForHtml(errorInfo.stack || 'No stack trace')}</pre>
          </details>
          <button class="btn btn-ghost error-dismiss-btn" onclick="this.closest('.error-boundary-overlay').remove()">
            \${swedishMode ? 'Avfärda' : 'Dismiss'}
          </button>
        </div>
      \`;

      document.body.appendChild(overlay);

      // Focus the retry button for accessibility
      overlay.querySelector('.error-retry-btn')?.focus();
    }

    // Register global error handlers
    window.addEventListener('error', (event) => {
      console.error('Global error:', event.error);
      showErrorModal(event.error, 'Global error handler');
    });

    window.addEventListener('unhandledrejection', (event) => {
      console.error('Unhandled promise rejection:', event.reason);
      showErrorModal(event.reason, 'Unhandled promise rejection');
    });

    // Helper to wrap async operations with error boundary
    function withErrorBoundary(fn, context) {
      return async (...args) => {
        try {
          return await fn(...args);
        } catch (error) {
          showErrorModal(error, context);
          throw error; // Re-throw for local handling if needed
        }
      };
    }

    window.showErrorModal = showErrorModal; // Expose for manual triggering

    // Custom prompt modal to replace native prompt()
    function showPromptModal(message, defaultValue = '') {
      return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.className = 'prompt-modal-overlay';

        const cleanup = (value) => {
          overlay.remove();
          resolve(value);
        };

        overlay.onclick = (e) => { if (e.target === overlay) cleanup(null); };

        const modal = document.createElement('div');
        modal.className = 'prompt-modal';
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-modal', 'true');
        modal.setAttribute('aria-labelledby', 'prompt-title');

        modal.innerHTML = [
          '<h3 id="prompt-title">' + (swedishMode ? '📝 Ange namn' : '📝 Enter name') + '</h3>',
          '<p class="prompt-message">' + message + '</p>',
          '<input type="text" class="prompt-input" id="prompt-input" value="' + escapeForHtml(defaultValue) + '" maxlength="100">',
          '<div class="prompt-buttons">',
          '  <button class="btn btn-ghost" id="prompt-cancel">' + (swedishMode ? 'Avbryt' : 'Cancel') + '</button>',
          '  <button class="btn btn-primary" id="prompt-confirm">' + (swedishMode ? 'OK' : 'OK') + '</button>',
          '</div>',
        ].join('\\n');

        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        const input = document.getElementById('prompt-input');
        const confirmBtn = document.getElementById('prompt-confirm');
        const cancelBtn = document.getElementById('prompt-cancel');

        // Focus input and select text
        input.focus();
        input.select();

        // Handle Enter key
        input.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            cleanup(input.value.trim() || null);
          } else if (e.key === 'Escape') {
            e.preventDefault();
            cleanup(null);
          }
        });

        confirmBtn.onclick = () => cleanup(input.value.trim() || null);
        cancelBtn.onclick = () => cleanup(null);

        // Apply focus trap to keep keyboard navigation within modal
        trapFocus(modal);
      });
    }

    // Focus trap utility for modals - keeps Tab cycling within the modal
    function trapFocus(container) {
      const focusableSelector = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
      const focusableElements = container.querySelectorAll(focusableSelector);
      if (focusableElements.length === 0) return;

      const firstFocusable = focusableElements[0];
      const lastFocusable = focusableElements[focusableElements.length - 1];

      container.addEventListener('keydown', (e) => {
        if (e.key !== 'Tab') return;

        if (e.shiftKey) {
          // Shift+Tab: if on first element, wrap to last
          if (document.activeElement === firstFocusable) {
            e.preventDefault();
            lastFocusable.focus();
          }
        } else {
          // Tab: if on last element, wrap to first
          if (document.activeElement === lastFocusable) {
            e.preventDefault();
            firstFocusable.focus();
          }
        }
      });
    }

    // Create merged playlist from selected genres
    async function createMergedFromSelection() {
      if (selectedGenres.size < 2) {
        showNotification(swedishMode ? 'Välj minst 2 genrer' : 'Select at least 2 genres', 'error');
        return;
      }

      const genreNames = [...selectedGenres];
      const suggestedName = genreNames.slice(0, 3).join(' + ') + (genreNames.length > 3 ? ' +more' : '');

      // Show custom prompt modal for playlist name
      const playlistName = await showPromptModal(
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
        '    <button class="modal-close" onclick="this.closest(\'.modal-overlay\').remove()" aria-label="Close modal">×</button>',
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
    let playlistDescTemplate = localStorage.getItem('playlistDescTemplate') || '{genre} tracks from your liked songs ♫ • {count} tracks • Created {date}';

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

    // Add theme toggle and Swedish toggle to header immediately (visible before login)
    if (headerActions) {
      headerActions.innerHTML = \`
        <button id="swedish-toggle" class="btn btn-ghost btn-sm swedish-toggle-btn" title="\${swedishMode ? 'Switch to English' : 'Switch to Swedish'}" aria-label="\${swedishMode ? 'Switch to English' : 'Switch to Swedish'}">
          \${swedishMode ? '<svg viewBox="0 0 60 30" width="20" height="10" style="vertical-align:middle"><clipPath id="t"><path d="M30,15 h30 v15 z v15 h-30 z h-30 v-15 z v-15 h30 z"/></clipPath><path d="M0,0 v30 h60 v-30 z" fill="#00247d"/><path d="M0,0 L60,30 M60,0 L0,30" stroke="#fff" stroke-width="6"/><path d="M0,0 L60,30 M60,0 L0,30" clip-path="url(#t)" stroke="#cf142b" stroke-width="4"/><path d="M30,0 v30 M0,15 h60" stroke="#fff" stroke-width="10"/><path d="M30,0 v30 M0,15 h60" stroke="#cf142b" stroke-width="6"/></svg>' : '<svg viewBox="0 0 16 10" width="20" height="12" style="vertical-align:middle"><rect width="16" height="10" fill="#006aa7"/><rect x="5" width="2" height="10" fill="#fecc00"/><rect y="4" width="16" height="2" fill="#fecc00"/></svg>'}
        </button>
        <button id="theme-toggle" class="btn btn-ghost btn-sm theme-toggle-btn" title="\${lightMode ? 'Switch to dark mode' : 'Switch to light mode'}" aria-label="\${lightMode ? 'Switch to dark mode' : 'Switch to light mode'}">
          \${lightMode ? '🌙' : '☀️'}
        </button>
      \`;
      // Attach event listeners (CSP blocks inline onclick)
      document.getElementById('theme-toggle').addEventListener('click', () => toggleTheme());
      document.getElementById('swedish-toggle').addEventListener('click', () => toggleSwedishMode());
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

    // Special user tags - Owners get Swedish crowns 👑👑👑
    const SPECIAL_USERS = {
      'tomspseudonym': { tag: 'Owner', class: 'owner', emoji: '👑' },
      'tomstech': { tag: 'Owner', class: 'owner', emoji: '👑' },
      '~oogi~': { tag: 'Heidi', class: 'heidi', emoji: '💙' },
      'oogi': { tag: 'Heidi', class: 'heidi', emoji: '💙' },
      'heidi': { tag: 'Heidi', class: 'heidi', emoji: '💙' },
    };

    // Check if user is an owner (for special leaderboard treatment)
    function isOwner(userName) {
      if (!userName) return false;
      const lowerName = userName.toLowerCase();
      return lowerName.includes('tomspseudonym') || lowerName.includes('tomstech') ||
             lowerName.includes('~oogi~') || lowerName.includes('oogi') || lowerName.includes('heidi');
    }

    // Rotating donation button configurations - changes on each page load
    const DONATION_CONFIGS = [
      { icon: '☕', text: 'Buy me a coffee', title: 'Support the developer', theme: 'coffee' },
      { icon: '🧞', text: 'Grant the Genie a wish', title: 'Make the Genie happy', theme: 'genie' },
      { icon: '🎵', text: 'Tip the DJ', title: 'Keep the music playing', theme: 'spotify' },
      { icon: '🍺', text: 'Shout me a coldie', title: 'Cheers legend', theme: 'beer' },
      { icon: '🥧', text: 'Buy me a pie', title: 'Aussie dev needs pies', theme: 'pie' },
      { icon: '💸', text: 'Fund my Spotify Premium', title: 'The irony...', theme: 'money' },
      { icon: '🎧', text: 'Keep the tunes flowing', title: 'Support development', theme: 'spotify' },
    ];
    const DONATION_CONFIGS_SE = [
      { icon: '🫙', text: 'Bjud mig på snus', title: 'Tack för stödet!', theme: 'snus' },
      { icon: '☕', text: 'Bjud på fika', title: 'Fika är livet', theme: 'coffee' },
      { icon: '🧞', text: 'Uppfyll en Genie-önskan', title: 'Gör Genien glad', theme: 'genie' },
      { icon: '🍺', text: 'Bjud på en öl', title: 'Skål kompis!', theme: 'beer' },
      { icon: '🎵', text: 'Ge DJ:n dricks', title: 'Håll musiken igång', theme: 'spotify' },
    ];
    let currentDonationConfig = null;

    // Initialize donation button with random config
    function initDonationButton() {
      const configs = swedishMode ? DONATION_CONFIGS_SE : DONATION_CONFIGS;
      currentDonationConfig = configs[Math.floor(Math.random() * configs.length)];
      applyDonationConfig(currentDonationConfig);
    }

    function applyDonationConfig(config) {
      const btn = document.getElementById('donation-btn');
      if (!btn) return;
      const icon = btn.querySelector('.icon');
      const text = btn.querySelector('.text');
      if (icon) icon.textContent = config.icon;
      if (text) text.innerHTML = config.text;
      btn.title = config.title;
      // Apply theme class
      btn.className = 'sidebar-donate-btn donate-' + config.theme;
    }

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

    // Admin panel state - reuses existing caches to minimize API calls
    let isAdminUser = false;
    let isOwnerUser = false; // Set to true if logged in as owner (shows KV stats)
    const OWNER_USERNAMES = ['tomstech', 'tom_houston', 'tom houston']; // Owner's Spotify display names (case-insensitive)
    let analyticsCache = null;
    let analyticsLastFetch = 0;
    const ANALYTICS_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

    // Show admin button for logged-in users (uses existing session check)
    function showAdminButton() {
      const headerActions = document.getElementById('header-actions');
      if (headerActions && !document.getElementById('admin-btn')) {
        const adminBtn = document.createElement('button');
        adminBtn.id = 'admin-btn';
        adminBtn.className = 'btn btn-ghost btn-sm admin-btn';
        adminBtn.innerHTML = '⚙️';
        adminBtn.onclick = showAdminPanel;
        adminBtn.title = 'Debug panel - reuses cached data';
        headerActions.insertBefore(adminBtn, headerActions.firstChild);
        isAdminUser = true;
      }
    }

    // Show KV status indicator only for the owner
    function showKVStatusIndicator() {
      if (!isOwnerUser) return;
      const kvIndicator = document.getElementById('kv-status-indicator');
      if (kvIndicator) {
        kvIndicator.style.display = 'flex';
      }
    }

    // Check if current user is the owner (matches OWNER_USERNAMES)
    function checkOwnerStatus(session) {
      const userName = (session.user || session.spotifyUser || '').toLowerCase().trim();
      isOwnerUser = OWNER_USERNAMES.some(name => userName.includes(name.toLowerCase()));
      if (isOwnerUser) {
        showKVStatusIndicator();
      }
    }

    // Get analytics from cache or fetch once (5 min TTL)
    async function getAnalyticsData() {
      const now = Date.now();
      if (analyticsCache && (now - analyticsLastFetch) < ANALYTICS_CACHE_TTL) {
        return analyticsCache;
      }
      try {
        const response = await fetch('/api/analytics');
        if (response.ok) {
          analyticsCache = await response.json();
          analyticsLastFetch = now;
        }
      } catch { /* Use stale cache */ }
      return analyticsCache;
    }

    async function showAdminPanel() {
      // Gather data from existing caches - NO new API calls for KV/version
      const version = deployStatus?.version || changelogCache?.changelog?.[0]?.version || '?';
      const kvMetrics = kvUsageCache?.realtime || {};
      const kvUsage = kvUsageCache || {};

      // Only fetch analytics if cache expired (5 min TTL)
      const analytics = await getAnalyticsData();
      const today = analytics?.today || {};
      const totalUsers = analytics?.totalUsers || 0;

      const modal = document.createElement('div');
      modal.className = 'modal-overlay admin-modal';
      modal.onclick = (e) => { if (e.target === modal) modal.remove(); };

      // Calculate KV usage percentages - use correct API response structure
      const readPct = kvUsage.usage?.readsPercent || 0;
      const writePct = kvUsage.usage?.writesPercent || 0;
      const estimatedReads = kvUsage.estimated?.reads || 0;
      const estimatedWrites = kvUsage.estimated?.writes || 0;
      const readStatus = readPct > 80 ? 'critical' : readPct > 50 ? 'warning' : 'ok';
      const writeStatus = writePct > 80 ? 'critical' : writePct > 50 ? 'warning' : 'ok';

      modal.innerHTML = \`
        <div class="modal-content admin-panel">
          <div class="modal-header">
            <h2>⚙️ Admin Panel</h2>
            <button class="modal-close" onclick="this.closest('.modal-overlay').remove()" aria-label="Close admin panel">×</button>
          </div>
          <div class="admin-tabs">
            <button class="admin-tab active" data-tab="stats">📊 Stats</button>
            <button class="admin-tab" data-tab="kv">🗄️ KV Monitor</button>
            <button class="admin-tab" data-tab="cache">💾 Cache</button>
            <button class="admin-tab" data-tab="health">🏥 Health</button>
            <button class="admin-tab" data-tab="errors">🐛 Errors</button>
            <button class="admin-tab" data-tab="perf">⚡ Performance</button>
            <button class="admin-tab" data-tab="users">👥 Users</button>
          </div>
          <div class="admin-tab-content" id="admin-tab-content">
            <div class="admin-grid">
              <div class="admin-card">
                <h3>📊 KV Usage (Today)</h3>
                <div class="admin-stats">
                  <div class="stat">
                    <span class="label">Reads:</span>
                    <span class="value kv-\${readStatus}">\${estimatedReads} / 100k (\${readPct}%)</span>
                  </div>
                  <div class="stat">
                    <span class="label">Writes:</span>
                    <span class="value kv-\${writeStatus}">\${estimatedWrites} / 1k (\${writePct}%)</span>
                  </div>
                  <div class="stat">
                    <span class="label">Cache Hits:</span>
                    <span class="value">\${kvMetrics.cacheHits || 0} (\${kvMetrics.cacheHitRate || 0}%)</span>
                  </div>
                </div>
              </div>
              <div class="admin-card">
                <h3>📈 Analytics (Today)</h3>
                <div class="admin-stats">
                  <div class="stat"><span class="label">Page Views:</span> <span class="value">\${today.pageViews || 0}</span></div>
                  <div class="stat"><span class="label">Sign-ins:</span> <span class="value">\${today.signIns || 0}</span></div>
                  <div class="stat"><span class="label">Playlists:</span> <span class="value">\${today.playlistsCreated || 0}</span></div>
                  <div class="stat"><span class="label">Library Scans:</span> <span class="value">\${today.libraryScans || 0}</span></div>
                </div>
              </div>
              <div class="admin-card">
                <h3>👥 Users</h3>
                <div class="admin-stats">
                  <div class="stat"><span class="label">Total Users:</span> <span class="value">\${totalUsers}</span></div>
                  <div class="stat"><span class="label">Unique Artists:</span> <span class="value">\${today.uniqueArtists || 0}</span></div>
                  <div class="stat"><span class="label">Unique Genres:</span> <span class="value">\${today.uniqueGenres || 0}</span></div>
                </div>
              </div>
              <div class="admin-card">
                <h3>⚡ Realtime (This Worker)</h3>
                <div class="admin-stats">
                  <div class="stat"><span class="label">KV Reads:</span> <span class="value">\${kvMetrics.reads || 0}</span></div>
                  <div class="stat"><span class="label">KV Writes:</span> <span class="value">\${kvMetrics.writes || 0}</span></div>
                  <div class="stat"><span class="label">Cache Misses:</span> <span class="value">\${kvMetrics.cacheMisses || 0}</span></div>
                </div>
              </div>
            </div>
          </div>
          <div class="admin-footer">
            <small>
              v\${version} |
              Data from existing caches (no extra API calls) |
              Analytics TTL: 5min
            </small>
          </div>
        </div>
      \`;

      document.body.appendChild(modal);

      // Apply focus trap for accessibility
      trapFocus(modal.querySelector('.admin-panel'));

      // Handle tab switching
      modal.querySelectorAll('.admin-tab').forEach(tab => {
        tab.onclick = async () => {
          modal.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
          tab.classList.add('active');
          const tabName = tab.dataset.tab;

          if (tabName === 'users') {
            await loadAdminUsersTab(modal);
          } else if (tabName === 'kv') {
            await loadAdminKVMonitorTab(modal);
          } else if (tabName === 'cache') {
            await loadAdminCacheTab(modal);
          } else if (tabName === 'health') {
            await loadAdminHealthTab(modal);
          } else if (tabName === 'errors') {
            await loadAdminErrorsTab(modal);
          } else if (tabName === 'perf') {
            await loadAdminPerfTab(modal);
          } else {
            // Reload stats tab content
            const content = modal.querySelector('#admin-tab-content');
            content.innerHTML = \`
              <div class="admin-grid">
                <div class="admin-card">
                  <h3>📊 KV Usage (Today)</h3>
                  <div class="admin-stats">
                    <div class="stat">
                      <span class="label">Reads:</span>
                      <span class="value kv-\${readStatus}">\${estimatedReads} / 100k (\${readPct}%)</span>
                    </div>
                    <div class="stat">
                      <span class="label">Writes:</span>
                      <span class="value kv-\${writeStatus}">\${estimatedWrites} / 1k (\${writePct}%)</span>
                    </div>
                    <div class="stat">
                      <span class="label">Cache Hits:</span>
                      <span class="value">\${kvMetrics.cacheHits || 0} (\${kvMetrics.cacheHitRate || 0}%)</span>
                    </div>
                  </div>
                </div>
                <div class="admin-card">
                  <h3>📈 Analytics (Today)</h3>
                  <div class="admin-stats">
                    <div class="stat"><span class="label">Page Views:</span> <span class="value">\${today.pageViews || 0}</span></div>
                    <div class="stat"><span class="label">Sign-ins:</span> <span class="value">\${today.signIns || 0}</span></div>
                    <div class="stat"><span class="label">Playlists:</span> <span class="value">\${today.playlistsCreated || 0}</span></div>
                    <div class="stat"><span class="label">Library Scans:</span> <span class="value">\${today.libraryScans || 0}</span></div>
                  </div>
                </div>
                <div class="admin-card">
                  <h3>👥 Users</h3>
                  <div class="admin-stats">
                    <div class="stat"><span class="label">Total Users:</span> <span class="value">\${totalUsers}</span></div>
                    <div class="stat"><span class="label">Unique Artists:</span> <span class="value">\${today.uniqueArtists || 0}</span></div>
                    <div class="stat"><span class="label">Unique Genres:</span> <span class="value">\${today.uniqueGenres || 0}</span></div>
                  </div>
                </div>
                <div class="admin-card">
                  <h3>⚡ Realtime (This Worker)</h3>
                  <div class="admin-stats">
                    <div class="stat"><span class="label">KV Reads:</span> <span class="value">\${kvMetrics.reads || 0}</span></div>
                    <div class="stat"><span class="label">KV Writes:</span> <span class="value">\${kvMetrics.writes || 0}</span></div>
                    <div class="stat"><span class="label">Cache Misses:</span> <span class="value">\${kvMetrics.cacheMisses || 0}</span></div>
                  </div>
                </div>
              </div>
            \`;
          }
        };
      });
    }

    async function loadAdminUsersTab(modal) {
      const content = modal.querySelector('#admin-tab-content');
      content.innerHTML = '<div class="admin-loading">Loading users...</div>';

      try {
        const response = await fetch('/api/admin/users');
        if (!response.ok) throw new Error('Failed to load users');
        const data = await response.json();

        if (data.users.length === 0) {
          content.innerHTML = '<div class="admin-empty">No users found</div>';
          return;
        }

        content.innerHTML = \`
          <div class="admin-users-header">
            <span>\${data.total} users total</span>
            <input type="text" class="admin-search" id="admin-user-search" placeholder="Search users..." />
          </div>
          <div class="admin-users-list" id="admin-users-list">
            \${data.users.map(user => \`
              <div class="admin-user-row" data-spotify-id="\${user.spotifyId}" data-name="\${user.spotifyName.toLowerCase()}">
                <div class="admin-user-avatar">
                  \${user.spotifyAvatar
                    ? \`<img src="\${user.spotifyAvatar}" alt="" />\`
                    : '<span class="avatar-placeholder">👤</span>'}
                </div>
                <div class="admin-user-info">
                  <div class="admin-user-name">\${escapeHtml(user.spotifyName)}</div>
                  <div class="admin-user-meta">
                    <span title="Spotify ID">\${user.spotifyId.substring(0, 8)}...</span>
                    <span>•</span>
                    <span>\${user.playlistCount} playlists</span>
                    <span>•</span>
                    <span>Joined \${formatTimeAgo(new Date(user.registeredAt))}</span>
                  </div>
                </div>
                <button class="btn btn-danger btn-sm admin-delete-user" onclick="confirmDeleteUser('\${user.spotifyId}', '\${escapeForHtml(user.spotifyName)}')" title="Remove user">
                  🗑️
                </button>
              </div>
            \`).join('')}
          </div>
        \`;

        // Add search functionality
        const searchInput = content.querySelector('#admin-user-search');
        searchInput?.addEventListener('input', (e) => {
          const query = e.target.value.toLowerCase();
          content.querySelectorAll('.admin-user-row').forEach(row => {
            const name = row.dataset.name || '';
            const id = row.dataset.spotifyId || '';
            row.style.display = (name.includes(query) || id.includes(query)) ? '' : 'none';
          });
        });
      } catch (err) {
        content.innerHTML = \`<div class="admin-error">Failed to load users: \${err.message}</div>\`;
      }
    }

    async function confirmDeleteUser(spotifyId, userName) {
      const confirmed = confirm(\`Are you sure you want to delete user "\${userName}"?\\n\\nThis will remove:\\n- Their session (logging them out)\\n- User statistics\\n- Hall of Fame entry\\n- Genre cache\\n\\nThis action cannot be undone.\`);

      if (!confirmed) return;

      try {
        const response = await fetch(\`/api/admin/user/\${spotifyId}\`, { method: 'DELETE' });
        const result = await response.json();

        if (result.success) {
          showNotification(\`User "\${userName}" removed successfully. Deleted \${result.keysDeleted.length} keys.\`, 'success');
          // Remove the row from the UI
          const row = document.querySelector(\`.admin-user-row[data-spotify-id="\${spotifyId}"]\`);
          if (row) row.remove();
        } else {
          throw new Error(result.error || 'Failed to delete user');
        }
      } catch (err) {
        showNotification(\`Failed to delete user: \${err.message}\`, 'error');
      }
    }

    window.confirmDeleteUser = confirmDeleteUser;

    // Admin KV Monitor Tab - comprehensive KV namespace monitoring
    async function loadAdminKVMonitorTab(modal) {
      const content = modal.querySelector('#admin-tab-content');
      content.innerHTML = '<div class="admin-loading">Loading KV monitoring data...</div>';

      try {
        const response = await fetch('/api/admin/kv-monitor');
        if (!response.ok) throw new Error('Failed to load KV monitor data');
        const data = await response.json();

        const { summary, limits, usage, realTimeMetrics, namespaces } = data;

        // Calculate health status
        const getHealthStatus = (percent) => {
          if (percent > 80) return { icon: '🔴', text: 'Critical', class: 'status-critical' };
          if (percent > 50) return { icon: '🟡', text: 'Warning', class: 'status-warning' };
          return { icon: '🟢', text: 'Healthy', class: 'status-healthy' };
        };

        const readPercent = (realTimeMetrics.reads / limits.dailyReads) * 100;
        const writePercent = (realTimeMetrics.writes / limits.dailyWrites) * 100;
        const readHealth = getHealthStatus(readPercent);
        const writeHealth = getHealthStatus(writePercent);

        content.innerHTML = \`
          <div class="admin-grid">
            <div class="admin-card">
              <h3>📊 KV Summary</h3>
              <div class="admin-stats">
                <div class="stat">
                  <span class="label">Total Keys:</span>
                  <span class="value">\${summary.totalKeys.toLocaleString()}</span>
                </div>
                <div class="stat">
                  <span class="label">Total Size:</span>
                  <span class="value">\${(summary.totalSize / 1024).toFixed(2)} KB</span>
                </div>
                <div class="stat">
                  <span class="label">Avg Key Size:</span>
                  <span class="value">\${summary.avgKeySize} bytes</span>
                </div>
                <div class="stat">
                  <span class="label">Namespaces:</span>
                  <span class="value">\${summary.namespaceCount}</span>
                </div>
              </div>
            </div>

            <div class="admin-card">
              <h3>⚡ Real-Time Operations</h3>
              <div class="admin-stats">
                <div class="stat">
                  <span class="label">KV Reads:</span>
                  <span class="value \${readHealth.class}">\${realTimeMetrics.reads} / \${limits.dailyReads.toLocaleString()}</span>
                </div>
                <div class="stat">
                  <span class="label">KV Writes:</span>
                  <span class="value \${writeHealth.class}">\${realTimeMetrics.writes} / \${limits.dailyWrites.toLocaleString()}</span>
                </div>
                <div class="stat">
                  <span class="label">KV Deletes:</span>
                  <span class="value">\${realTimeMetrics.deletes}</span>
                </div>
                <div class="stat">
                  <span class="label">Status:</span>
                  <span class="value">\${readHealth.icon} \${readHealth.text}</span>
                </div>
              </div>
            </div>

            <div class="admin-card">
              <h3>💾 Cache Performance</h3>
              <div class="admin-stats">
                <div class="stat">
                  <span class="label">Cache Hits:</span>
                  <span class="value">\${realTimeMetrics.cacheHits.toLocaleString()}</span>
                </div>
                <div class="stat">
                  <span class="label">Cache Misses:</span>
                  <span class="value">\${realTimeMetrics.cacheMisses.toLocaleString()}</span>
                </div>
                <div class="stat">
                  <span class="label">Hit Rate:</span>
                  <span class="value">\${realTimeMetrics.cacheHitRate}%</span>
                </div>
                <div class="stat">
                  <span class="label">KV Reads Saved:</span>
                  <span class="value">\${realTimeMetrics.cacheHits.toLocaleString()}</span>
                </div>
              </div>
            </div>

            <div class="admin-card">
              <h3>📈 Usage & Limits</h3>
              <div class="admin-stats">
                <div class="stat">
                  <span class="label">Daily Read Limit:</span>
                  <span class="value">\${limits.dailyReads.toLocaleString()}</span>
                </div>
                <div class="stat">
                  <span class="label">Daily Write Limit:</span>
                  <span class="value">\${limits.dailyWrites.toLocaleString()}</span>
                </div>
                <div class="stat">
                  <span class="label">Max Value Size:</span>
                  <span class="value">\${(limits.maxValueSize / 1024 / 1024).toFixed(0)} MB</span>
                </div>
                <div class="stat">
                  <span class="label">Last Reset:</span>
                  <span class="value">\${new Date(realTimeMetrics.lastReset).toLocaleTimeString()}</span>
                </div>
              </div>
            </div>
          </div>

          <div class="admin-card" style="margin-top: 1rem;">
            <h3>🗄️ Namespace Breakdown</h3>
            <div class="kv-namespace-table">
              <table style="width: 100%; border-collapse: collapse;">
                <thead>
                  <tr style="border-bottom: 2px solid var(--border); text-align: left;">
                    <th style="padding: 0.75rem;">Namespace</th>
                    <th style="padding: 0.75rem;">Keys</th>
                    <th style="padding: 0.75rem;">Total Size</th>
                    <th style="padding: 0.75rem;">Avg Size</th>
                    <th style="padding: 0.75rem;">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  \${namespaces.map(ns => \`
                    <tr style="border-bottom: 1px solid var(--border);">
                      <td style="padding: 0.75rem;">
                        <strong>\${ns.name}</strong>
                        <br>
                        <small style="color: var(--text-muted);">\${ns.description}</small>
                        \${ns.truncated ? '<br><small style="color: orange;">⚠️ Truncated (1000+ keys)</small>' : ''}
                      </td>
                      <td style="padding: 0.75rem;">\${ns.keyCount.toLocaleString()}</td>
                      <td style="padding: 0.75rem;">\${(ns.totalSize / 1024).toFixed(2)} KB</td>
                      <td style="padding: 0.75rem;">\${ns.avgSize} bytes</td>
                      <td style="padding: 0.75rem;">
                        <button class="btn btn-ghost btn-sm" onclick="browseKVKeys('\${ns.prefix}', '\${ns.name}')">
                          🔍 Browse
                        </button>
                      </td>
                    </tr>
                  \`).join('')}
                </tbody>
              </table>
            </div>
          </div>

          \${readPercent > 80 || writePercent > 80 ? \`
            <div class="admin-card" style="margin-top: 1rem; border-color: #ff4444; background: rgba(255, 68, 68, 0.1);">
              <h3>⚠️ Quota Warning</h3>
              <p style="margin: 0; color: var(--text);">
                You are approaching your daily KV quota limits. Consider:
              </p>
              <ul style="margin: 0.5rem 0 0 1.5rem; color: var(--text);">
                <li>Increasing cache TTLs to reduce reads</li>
                <li>Batching write operations</li>
                <li>Clearing unnecessary cached data</li>
                <li>Upgrading to a paid Workers plan for higher limits</li>
              </ul>
            </div>
          \` : ''}
        \`;
      } catch (err) {
        console.error('Failed to load KV monitor:', err);
        content.innerHTML = \`<div class="admin-error">Failed to load KV monitoring data: \${err.message}</div>\`;
      }
    }

    // Browse KV keys in a specific namespace
    async function browseKVKeys(prefix, namespaceName) {
      const modal = document.querySelector('.admin-modal');
      const content = modal.querySelector('#admin-tab-content');

      content.innerHTML = '<div class="admin-loading">Loading keys...</div>';

      try {
        const response = await fetch(\`/api/admin/kv-keys?prefix=\${encodeURIComponent(prefix)}&limit=50\`);
        if (!response.ok) throw new Error('Failed to load keys');
        const data = await response.json();

        content.innerHTML = \`
          <div class="admin-card">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
              <h3>🗄️ Keys in "\${namespaceName}"</h3>
              <button class="btn btn-ghost btn-sm" onclick="document.querySelector('[data-tab=kv]').click()">
                ← Back to KV Monitor
              </button>
            </div>

            <div style="margin-bottom: 1rem;">
              <strong>Prefix:</strong> <code style="background: var(--surface-2); padding: 0.25rem 0.5rem; border-radius: 4px;">\${prefix}</code>
              <br>
              <strong>Keys Found:</strong> \${data.total} \${data.list_complete ? '' : '(showing first 50)'}
            </div>

            \${data.keys.length === 0 ? '<p>No keys found in this namespace.</p>' : \`
              <div style="max-height: 500px; overflow-y: auto; border: 1px solid var(--border); border-radius: 6px;">
                <table style="width: 100%; border-collapse: collapse;">
                  <thead style="position: sticky; top: 0; background: var(--card-bg); border-bottom: 2px solid var(--border);">
                    <tr style="text-align: left;">
                      <th style="padding: 0.75rem;">Key Name</th>
                      <th style="padding: 0.75rem;">Expiration</th>
                      <th style="padding: 0.75rem;">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    \${data.keys.map(key => \`
                      <tr style="border-bottom: 1px solid var(--border);">
                        <td style="padding: 0.75rem;">
                          <code style="font-size: 0.85rem; word-break: break-all;">\${escapeHtml(key.name)}</code>
                        </td>
                        <td style="padding: 0.75rem; white-space: nowrap;">
                          \${key.expiresAt ? new Date(key.expiresAt).toLocaleString() : 'Never'}
                        </td>
                        <td style="padding: 0.75rem; white-space: nowrap;">
                          <button class="btn btn-ghost btn-sm" onclick="viewKVKey('\${escapeHtml(key.name).replace(/'/g, "\\\\'")}')">
                            👁️ View
                          </button>
                          <button class="btn btn-ghost btn-sm" style="color: #ff4444;" onclick="deleteKVKey('\${escapeHtml(key.name).replace(/'/g, "\\\\'")}', '\${prefix}', '\${namespaceName}')">
                            🗑️ Delete
                          </button>
                        </td>
                      </tr>
                    \`).join('')}
                  </tbody>
                </table>
              </div>
            \`}
          </div>
        \`;
      } catch (err) {
        console.error('Failed to browse keys:', err);
        content.innerHTML = \`<div class="admin-error">Failed to load keys: \${err.message}</div>\`;
      }
    }

    // View details of a specific KV key
    async function viewKVKey(keyName) {
      try {
        const response = await fetch(\`/api/admin/kv-key/\${encodeURIComponent(keyName)}\`);
        if (!response.ok) throw new Error('Failed to load key');
        const data = await response.json();

        const valueDisplay = data.valueType === 'json'
          ? \`<pre style="background: var(--surface-2); padding: 1rem; border-radius: 6px; overflow-x: auto; max-height: 400px;">\${JSON.stringify(data.value, null, 2)}</pre>\`
          : \`<pre style="background: var(--surface-2); padding: 1rem; border-radius: 6px; overflow-x: auto; max-height: 400px;">\${escapeHtml(data.rawValue)}</pre>\`;

        const infoModal = document.createElement('div');
        infoModal.className = 'modal-overlay';
        infoModal.innerHTML = \`
          <div class="modal-content" style="max-width: 800px;">
            <div class="modal-header">
              <h2>🔍 Key Details</h2>
              <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">×</button>
            </div>
            <div style="padding: 1.5rem;">
              <div style="margin-bottom: 1rem;">
                <strong>Key:</strong><br>
                <code style="background: var(--surface-2); padding: 0.5rem; border-radius: 4px; display: block; margin-top: 0.25rem; word-break: break-all;">\${escapeHtml(data.key)}</code>
              </div>
              <div style="margin-bottom: 1rem;">
                <strong>Size:</strong> \${data.size.toLocaleString()} bytes (\${(data.size / 1024).toFixed(2)} KB)
              </div>
              <div style="margin-bottom: 1rem;">
                <strong>Type:</strong> \${data.valueType}
              </div>
              \${data.expiresAt ? \`
                <div style="margin-bottom: 1rem;">
                  <strong>Expires At:</strong> \${new Date(data.expiresAt).toLocaleString()}
                </div>
              \` : ''}
              <div>
                <strong>Value:</strong>
                \${valueDisplay}
              </div>
            </div>
          </div>
        \`;
        document.body.appendChild(infoModal);
      } catch (err) {
        showNotification(\`Failed to load key: \${err.message}\`, 'error');
      }
    }

    // Delete a specific KV key
    async function deleteKVKey(keyName, prefix, namespaceName) {
      if (!confirm(\`Are you sure you want to delete this key?\\n\\n\${keyName}\`)) return;

      try {
        const response = await fetch(\`/api/admin/kv-key/\${encodeURIComponent(keyName)}\`, {
          method: 'DELETE'
        });

        if (!response.ok) throw new Error('Failed to delete key');

        showNotification('Key deleted successfully', 'success');

        // Reload the key browser
        await browseKVKeys(prefix, namespaceName);
      } catch (err) {
        showNotification(\`Failed to delete key: \${err.message}\`, 'error');
      }
    }

    window.browseKVKeys = browseKVKeys;
    window.viewKVKey = viewKVKey;
    window.deleteKVKey = deleteKVKey;

    // Admin Cache Tab - cache management controls
    async function loadAdminCacheTab(modal) {
      const content = modal.querySelector('#admin-tab-content');
      content.innerHTML = `
        <div class="admin-grid">
          <div class="admin-card">
            <h3>💾 Cache Controls</h3>
            <div class="admin-actions">
              <button class="btn btn-primary btn-sm" onclick="adminClearCache('leaderboard')">
                🏆 Clear Leaderboard Cache
              </button>
              <button class="btn btn-primary btn-sm" onclick="adminClearCache('scoreboard')">
                📊 Clear Scoreboard Cache
              </button>
              <button class="btn btn-primary btn-sm" onclick="adminClearCache('all_genre_caches')">
                🎵 Clear All Genre Caches
              </button>
              <button class="btn btn-warning btn-sm" onclick="adminRebuildCaches()">
                🔄 Rebuild All Caches
              </button>
            </div>
          </div>
          <div class="admin-card">
            <h3>📦 Cache Status</h3>
            <div class="admin-stats">
              <div class="stat">
                <span class="label">Leaderboard Cache:</span>
                <span class="value" id="cache-status-leaderboard">Checking...</span>
              </div>
              <div class="stat">
                <span class="label">Scoreboard Cache:</span>
                <span class="value" id="cache-status-scoreboard">Checking...</span>
              </div>
              <div class="stat">
                <span class="label">Analytics Cache:</span>
                <span class="value">${analyticsCache ? 'Active' : 'Empty'}</span>
              </div>
            </div>
          </div>
        </div>
      `;

      // Check cache status by making lightweight API calls
      try {
        const leaderboardRes = await fetch('/api/leaderboard');
        const leaderboardData = await leaderboardRes.json();
        document.getElementById('cache-status-leaderboard').textContent =
          leaderboardData._cache?.fromCache ? '✅ Cached' : '⚠️ Fresh Build';

        const scoreboardRes = await fetch('/api/scoreboard');
        const scoreboardData = await scoreboardRes.json();
        document.getElementById('cache-status-scoreboard').textContent =
          scoreboardData._cache?.fromCache ? '✅ Cached' : '⚠️ Fresh Build';
      } catch (err) {
        console.error('Failed to check cache status:', err);
      }
    }

    async function adminClearCache(cacheType) {
      const cacheNames = {
        'leaderboard': 'Leaderboard',
        'scoreboard': 'Scoreboard',
        'all_genre_caches': 'All Genre Caches'
      };

      showNotification(`Clearing ${cacheNames[cacheType]}...`, 'info');

      try {
        const response = await fetch('/api/admin/clear-cache', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cache: cacheType })
        });

        const result = await response.json();

        if (result.success) {
          showNotification(`✅ Cleared ${result.keysCleared} cache entries`, 'success');
          // Reload the cache tab to show updated status
          const modal = document.querySelector('.admin-modal');
          if (modal) await loadAdminCacheTab(modal);
        } else {
          throw new Error(result.error || 'Failed to clear cache');
        }
      } catch (err) {
        showNotification(`❌ Failed to clear cache: ${err.message}`, 'error');
      }
    }

    async function adminRebuildCaches() {
      showNotification('🔄 Rebuilding all caches...', 'info');

      try {
        const response = await fetch('/api/admin/rebuild-caches', {
          method: 'POST'
        });

        const result = await response.json();

        if (result.success) {
          showNotification('✅ All caches rebuilt successfully', 'success');
          // Reload the cache tab
          const modal = document.querySelector('.admin-modal');
          if (modal) await loadAdminCacheTab(modal);
        } else {
          throw new Error(result.error || 'Failed to rebuild caches');
        }
      } catch (err) {
        showNotification(`❌ Failed to rebuild caches: ${err.message}`, 'error');
      }
    }

    // Admin Health Tab - system health monitoring
    async function loadAdminHealthTab(modal) {
      const content = modal.querySelector('#admin-tab-content');
      content.innerHTML = '<div class="admin-loading">Loading health metrics...</div>';

      try {
        const [kvUsageRes, analyticsRes] = await Promise.all([
          fetch('/api/kv-usage'),
          fetch('/api/analytics')
        ]);

        const kvUsage = await kvUsageRes.json();
        const analytics = await analyticsRes.json();

        const readPct = kvUsage.usage?.readsPercent || 0;
        const writePct = kvUsage.usage?.writesPercent || 0;
        const readStatus = readPct > 80 ? '🔴 Critical' : readPct > 50 ? '🟡 Warning' : '🟢 Healthy';
        const writeStatus = writePct > 80 ? '🔴 Critical' : writePct > 50 ? '🟡 Warning' : '🟢 Healthy';

        content.innerHTML = `
          <div class="admin-grid">
            <div class="admin-card">
              <h3>🏥 System Health</h3>
              <div class="admin-stats">
                <div class="stat">
                  <span class="label">KV Reads Health:</span>
                  <span class="value">${readStatus}</span>
                </div>
                <div class="stat">
                  <span class="label">KV Writes Health:</span>
                  <span class="value">${writeStatus}</span>
                </div>
                <div class="stat">
                  <span class="label">Trend:</span>
                  <span class="value">${kvUsage.trend?.direction || 'stable'}</span>
                </div>
                <div class="stat">
                  <span class="label">Cache Hit Rate:</span>
                  <span class="value">${kvUsage.realtime?.cacheHitRate || 0}%</span>
                </div>
              </div>
            </div>
            <div class="admin-card">
              <h3>📊 Daily Limits</h3>
              <div class="admin-stats">
                <div class="stat">
                  <span class="label">Reads Remaining:</span>
                  <span class="value">${kvUsage.usage?.readsRemaining?.toLocaleString() || 'N/A'}</span>
                </div>
                <div class="stat">
                  <span class="label">Writes Remaining:</span>
                  <span class="value">${kvUsage.usage?.writesRemaining?.toLocaleString() || 'N/A'}</span>
                </div>
                <div class="stat">
                  <span class="label">Status:</span>
                  <span class="value">${kvUsage.status || 'ok'}</span>
                </div>
              </div>
            </div>
            <div class="admin-card">
              <h3>⚡ Activity (Today)</h3>
              <div class="admin-stats">
                <div class="stat">
                  <span class="label">Sign-ins:</span>
                  <span class="value">${kvUsage.activity?.signIns || 0}</span>
                </div>
                <div class="stat">
                  <span class="label">Library Scans:</span>
                  <span class="value">${kvUsage.activity?.libraryScans || 0}</span>
                </div>
                <div class="stat">
                  <span class="label">Playlists Created:</span>
                  <span class="value">${kvUsage.activity?.playlistsCreated || 0}</span>
                </div>
                <div class="stat">
                  <span class="label">Auth Failures:</span>
                  <span class="value">${kvUsage.activity?.authFailures || 0}</span>
                </div>
              </div>
            </div>
            <div class="admin-card">
              <h3>💡 Optimizations</h3>
              <div class="admin-stats" style="font-size: 0.85rem;">
                <div class="stat">
                  <span class="label">Leaderboard Cache:</span>
                  <span class="value">15 min</span>
                </div>
                <div class="stat">
                  <span class="label">Scoreboard Cache:</span>
                  <span class="value">1 hour</span>
                </div>
                <div class="stat">
                  <span class="label">Analytics Sampling:</span>
                  <span class="value">10%</span>
                </div>
                <div class="stat">
                  <span class="label">Polling Interval:</span>
                  <span class="value">3 min</span>
                </div>
              </div>
            </div>
          </div>
          ${kvUsage.recommendations && kvUsage.recommendations.length > 0 ? `
            <div class="admin-card" style="margin-top: 1rem; grid-column: 1 / -1;">
              <h3>💡 Recommendations</h3>
              <ul style="margin: 0; padding-left: 1.5rem;">
                ${kvUsage.recommendations.map(rec => `<li style="margin: 0.5rem 0;">${rec}</li>`).join('')}
              </ul>
            </div>
          ` : ''}
        `;
      } catch (err) {
        content.innerHTML = `<div class="admin-error">Failed to load health metrics: ${err.message}</div>`;
      }
    }

    // Admin Errors Tab - view client-side error logs
    async function loadAdminErrorsTab(modal) {
      const content = modal.querySelector('#admin-tab-content');
      content.innerHTML = '<div class="admin-loading">Loading error logs...</div>';

      try {
        const response = await fetch('/api/admin/errors');
        const data = await response.json();

        if (!data.errors || data.errors.length === 0) {
          content.innerHTML = '<div class="admin-empty">🎉 No errors logged!</div>';
          return;
        }

        content.innerHTML = `
          <div style="margin-bottom: 1rem; display: flex; justify-content: space-between; align-items: center;">
            <span><strong>${data.count}</strong> errors logged (last 100)</span>
            <button class="btn btn-ghost btn-sm" onclick="document.getElementById('admin-tab-content').scrollTop = 0">↑ Top</button>
          </div>
          <div class="admin-errors-list">
            ${data.errors.slice(0, 50).map((error, idx) => `
              <div class="admin-error-entry">
                <div class="admin-error-header">
                  <span class="admin-error-num">#${idx + 1}</span>
                  <span class="admin-error-time">${new Date(error.serverTime || error.timestamp).toLocaleString()}</span>
                  <span class="admin-error-ip">${error.ip || 'unknown'}</span>
                </div>
                <div class="admin-error-message">${escapeHtml(error.message || error.raw || 'Unknown error')}</div>
                ${error.stack ? `
                  <details class="admin-error-details">
                    <summary>Stack trace</summary>
                    <pre class="admin-error-stack">${escapeHtml(error.stack)}</pre>
                  </details>
                ` : ''}
                ${error.context ? `<div class="admin-error-context">Context: ${escapeHtml(error.context)}</div>` : ''}
              </div>
            `).join('')}
          </div>
        `;
      } catch (err) {
        content.innerHTML = `<div class="admin-error">Failed to load errors: ${err.message}</div>`;
      }
    }

    // Admin Performance Tab - view performance metrics
    async function loadAdminPerfTab(modal) {
      const content = modal.querySelector('#admin-tab-content');
      content.innerHTML = '<div class="admin-loading">Loading performance metrics...</div>';

      try {
        const response = await fetch('/api/admin/perf');
        const data = await response.json();

        if (!data.samples || data.samples.length === 0) {
          content.innerHTML = '<div class="admin-empty">No performance data collected yet</div>';
          return;
        }

        const avg = data.averages || {};

        content.innerHTML = `
          <div class="admin-grid">
            <div class="admin-card">
              <h3>⚡ Average Metrics</h3>
              <div class="admin-stats">
                <div class="stat">
                  <span class="label">Page Load Time:</span>
                  <span class="value">${avg.pageLoadTime || 0}ms</span>
                </div>
                <div class="stat">
                  <span class="label">DOM Content Loaded:</span>
                  <span class="value">${avg.domContentLoaded || 0}ms</span>
                </div>
                <div class="stat">
                  <span class="label">Time to First Byte:</span>
                  <span class="value">${avg.timeToFirstByte || 0}ms</span>
                </div>
                <div class="stat">
                  <span class="label">Server Response:</span>
                  <span class="value">${avg.serverResponse || 0}ms</span>
                </div>
              </div>
            </div>
            <div class="admin-card">
              <h3>📊 Sample Data</h3>
              <div class="admin-stats">
                <div class="stat">
                  <span class="label">Total Samples:</span>
                  <span class="value">${data.totalSamples || 0}</span>
                </div>
                <div class="stat">
                  <span class="label">Showing:</span>
                  <span class="value">Last ${data.samples.length}</span>
                </div>
              </div>
            </div>
          </div>
          <div class="admin-card" style="margin-top: 1rem;">
            <h3>📈 Recent Samples</h3>
            <div class="admin-perf-samples">
              ${data.samples.map((sample, idx) => `
                <div class="admin-perf-sample">
                  <div class="admin-perf-sample-header">
                    <span>${new Date(sample.timestamp).toLocaleTimeString()}</span>
                    <span class="admin-perf-sample-load">${sample.pageLoadTime}ms</span>
                  </div>
                  <div class="admin-perf-sample-bar">
                    <div class="admin-perf-bar-fill" style="width: ${Math.min(100, (sample.pageLoadTime / 5000) * 100)}%"></div>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        `;
      } catch (err) {
        content.innerHTML = `<div class="admin-error">Failed to load performance data: ${err.message}</div>`;
      }
    }

    window.adminClearCache = adminClearCache;
    window.adminRebuildCaches = adminRebuildCaches;
    window.showAdminPanel = showAdminPanel;


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
          <button class="btn btn-ghost fika-dismiss-btn">Tack!</button>
        </div>
      \`;
      document.body.appendChild(reminder);
      // CSP-compliant event listener instead of inline onclick
      reminder.querySelector('.fika-dismiss-btn').addEventListener('click', () => reminder.remove());
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

    // ✨ SECRET: Anniversary celebration for Heidi (#102)
    // Special dates that deserve celebration
    const ANNIVERSARY_DATES = [
      { month: 12, day: 25, message: 'God Jul, min kärlek! 🎄❤️' },
      { month: 2, day: 14, message: 'Happy Valentine\'s Day, mitt hjärta! 💝' },
      { month: 1, day: 1, message: 'Gott Nytt År, min drottning! 🎆💙' },
      // Add more special dates as needed
    ];

    function checkAnniversary() {
      const now = new Date();
      const month = now.getMonth() + 1; // JS months are 0-indexed
      const day = now.getDate();
      return ANNIVERSARY_DATES.find(d => d.month === month && d.day === day);
    }

    function showAnniversaryCelebration(anniversary) {
      // Create heart rain container
      const heartRain = document.createElement('div');
      heartRain.className = 'heart-rain-container';
      heartRain.id = 'heart-rain';

      // Create many falling hearts
      const hearts = ['💙', '💛', '❤️', '💕', '💗', '💖'];
      for (let i = 0; i < 50; i++) {
        const heart = document.createElement('span');
        heart.className = 'falling-heart';
        heart.textContent = hearts[Math.floor(Math.random() * hearts.length)];
        heart.style.left = Math.random() * 100 + 'vw';
        heart.style.animationDuration = (2 + Math.random() * 3) + 's';
        heart.style.animationDelay = (Math.random() * 2) + 's';
        heart.style.fontSize = (1 + Math.random() * 1.5) + 'rem';
        heartRain.appendChild(heart);
      }
      document.body.appendChild(heartRain);

      // Create celebration overlay
      const overlay = document.createElement('div');
      overlay.className = 'anniversary-overlay';
      overlay.innerHTML = \`
        <div class="anniversary-content">
          <div class="anniversary-hearts">💙💛💙💛💙</div>
          <h2 class="anniversary-title">✨ Special Day ✨</h2>
          <p class="anniversary-message">\${anniversary.message}</p>
          <p class="anniversary-signature">– Tom 💙</p>
          <div class="anniversary-hearts">💛💙💛💙💛</div>
        </div>
      \`;

      document.body.appendChild(overlay);

      // Auto-dismiss after 6 seconds
      setTimeout(() => {
        overlay.classList.add('fade-out');
        heartRain.classList.add('fade-out');
        setTimeout(() => {
          overlay.remove();
          heartRain.remove();
        }, 500);
      }, 6000);

      overlay.addEventListener('click', () => {
        overlay.classList.add('fade-out');
        heartRain.classList.add('fade-out');
        setTimeout(() => {
          overlay.remove();
          heartRain.remove();
        }, 500);
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
      // Handle invalid dates (NaN, Invalid Date, "Unknown" strings)
      if (!date || isNaN(date.getTime())) return 'Unknown';

      const now = new Date();
      const diff = Math.floor((now - date) / 1000);

      // Handle future dates or very old dates
      if (diff < 0) return 'just now';
      if (diff < 60) return 'just now';
      if (diff < 3600) return \`\${Math.floor(diff / 60)}m ago\`;
      if (diff < 86400) return \`\${Math.floor(diff / 3600)}h ago\`;
      if (diff < 2592000) return \`\${Math.floor(diff / 86400)}d ago\`; // Less than 30 days
      return \`\${Math.floor(diff / 2592000)}mo ago\`; // Months
    }

    // Update all relative timestamps periodically
    function refreshRelativeTimestamps() {
      document.querySelectorAll('.relative-time[data-timestamp]').forEach(el => {
        const timestamp = el.dataset.timestamp;
        if (timestamp) {
          el.textContent = formatTimeAgo(new Date(timestamp));
        }
      });
    }

    // Refresh timestamps every 30 seconds
    setInterval(refreshRelativeTimestamps, 30000);

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
        <button class="btn btn-primary version-refresh-btn">Refresh Now</button>
        <button class="btn btn-secondary version-later-btn" style="margin-left: 0.5rem;">Later</button>
      \`;

      document.body.appendChild(overlay);
      document.body.appendChild(prompt);

      // Attach event listeners (CSP blocks inline onclick handlers)
      prompt.querySelector('.version-refresh-btn').addEventListener('click', () => {
        location.reload(true);
      });
      prompt.querySelector('.version-later-btn').addEventListener('click', () => {
        dismissVersionPrompt();
      });
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
        <button class="changelog-close" aria-label="Close changelog">&times;</button>
      \`;
      // Attach event listener (CSP blocks inline onclick)
      header.querySelector('.changelog-close').addEventListener('click', () => closeChangelog());

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

    // =====================================
    // What's New Modal (#104)
    // =====================================
    const LAST_SEEN_VERSION_KEY = 'geniegenie_lastSeenVersion';
    const WHATS_NEW_DISMISSED_KEY = 'geniegenie_whatsNewDismissed';

    async function checkWhatsNew() {
      // Don't show if user permanently dismissed
      if (localStorage.getItem(WHATS_NEW_DISMISSED_KEY) === 'true') return;

      // Fetch changelog if not cached
      if (!changelogCache) {
        try {
          const res = await fetch('/api/changelog');
          changelogCache = await res.json();
        } catch {
          return; // Silently fail - not critical
        }
      }

      const currentVersion = changelogCache?.changelog?.[0]?.version;
      if (!currentVersion) return;

      const lastSeenVersion = localStorage.getItem(LAST_SEEN_VERSION_KEY);

      // Show modal if new version or first visit
      if (!lastSeenVersion || lastSeenVersion !== currentVersion) {
        showWhatsNewModal(currentVersion);
      }
    }

    function showWhatsNewModal(version) {
      // Don't show multiple modals
      if (document.querySelector('.whats-new-overlay')) return;

      const latestRelease = changelogCache?.changelog?.[0];
      if (!latestRelease) return;

      // Parse changes and add icons
      const parseChange = (change) => {
        const lower = change.toLowerCase();
        if (lower.includes('fix') || lower.includes('bug')) return { icon: '🐛', type: 'fix' };
        if (lower.includes('add') || lower.includes('new')) return { icon: '✨', type: 'new' };
        if (lower.includes('improve') || lower.includes('enhance') || lower.includes('update')) return { icon: '💫', type: 'improve' };
        if (lower.includes('remove') || lower.includes('deprecat')) return { icon: '🗑️', type: 'remove' };
        if (lower.includes('security')) return { icon: '🔒', type: 'security' };
        if (lower.includes('performance') || lower.includes('faster') || lower.includes('speed')) return { icon: '⚡', type: 'perf' };
        return { icon: '📝', type: 'other' };
      };

      const changesHtml = latestRelease.changes.map(change => {
        const { icon } = parseChange(change);
        return \`<li><span class="change-icon">\${icon}</span> \${change}</li>\`;
      }).join('');

      const overlay = document.createElement('div');
      overlay.className = 'whats-new-overlay';
      overlay.onclick = (e) => {
        if (e.target === overlay) dismissWhatsNew(version, false);
      };

      overlay.innerHTML = \`
        <div class="whats-new-panel">
          <div class="whats-new-header">
            <div class="whats-new-badge">✨ \${swedishMode ? 'Nytt' : 'New'}</div>
            <h3>\${swedishMode ? 'Vad är nytt i' : "What's New in"} v\${version}</h3>
            <button class="whats-new-close" aria-label="Close">&times;</button>
          </div>
          <div class="whats-new-date">\${latestRelease.date}</div>
          <ul class="whats-new-changes">
            \${changesHtml}
          </ul>
          <div class="whats-new-footer">
            <label class="whats-new-dismiss-forever">
              <input type="checkbox" id="whats-new-dismiss-checkbox">
              <span>\${swedishMode ? 'Visa inte igen' : "Don't show again"}</span>
            </label>
            <div class="whats-new-actions">
              <a href="\${changelogCache?.repoUrl || 'https://github.com/TomsTech/spotify-genre-sorter'}/releases" target="_blank" class="btn btn-ghost">
                \${swedishMode ? 'Alla utgåvor' : 'All releases'}
              </a>
              <button class="btn btn-primary whats-new-gotit">
                \${swedishMode ? 'Förstått!' : 'Got it!'}
              </button>
            </div>
          </div>
        </div>
      \`;

      document.body.appendChild(overlay);

      // Attach event listeners (CSP blocks inline onclick handlers)
      overlay.querySelector('.whats-new-close').addEventListener('click', () => {
        dismissWhatsNew(version, false);
      });
      overlay.querySelector('.whats-new-gotit').addEventListener('click', () => {
        const dismissForever = document.getElementById('whats-new-dismiss-checkbox')?.checked;
        dismissWhatsNew(version, dismissForever);
      });

      // Animate in
      requestAnimationFrame(() => {
        overlay.classList.add('visible');
      });
    }

    function dismissWhatsNew(version, dismissForever = false) {
      // Save current version as seen
      localStorage.setItem(LAST_SEEN_VERSION_KEY, version);

      // If user checked "don't show again", save that preference
      if (dismissForever) {
        localStorage.setItem(WHATS_NEW_DISMISSED_KEY, 'true');
      }

      const overlay = document.querySelector('.whats-new-overlay');
      if (overlay) {
        overlay.classList.remove('visible');
        setTimeout(() => overlay.remove(), 300);
      }
    }

    // Make globally accessible
    window.dismissWhatsNew = dismissWhatsNew;

    // =====================================
    // KV Status Monitoring
    // =====================================
    let kvUsageCache = null;
    // PERF-006 FIX: Reduced polling frequencies to save API calls
    const KV_POLL_INTERVAL = 300000; // Poll every 5 minutes (was 1 min)

    async function checkKVUsage() {
      // Fetch KV usage for all users (needed for rate limit banner)
      // But only update KV status indicator for owner
      try {
        const response = await fetch('/api/kv-usage');
        const data = await response.json();
        kvUsageCache = data;
        kvUsageData = data; // Also update kvUsageData for banner/reporting

        // Update KV status indicator (owner only)
        if (isOwnerUser) {
          updateKVStatusIndicator(data);
        }

        // Show rate limit banner for all users when critical/warning
        if (data.status === 'critical' || data.status === 'warning') {
          showRateLimitBanner(data);
        }
      } catch (err) {
        console.warn('Failed to fetch KV usage:', err);
        // Update indicator to show unknown state (owner only)
        if (isOwnerUser) {
          updateKVStatusIndicator(null);
        }
      }
    }

    function updateKVStatusIndicator(data) {
      const indicator = document.getElementById('kv-status-indicator');
      if (!indicator) return;

      indicator.classList.remove('kv-ok', 'kv-warning', 'kv-critical');

      if (!data) {
        indicator.innerHTML = '<span class="kv-icon">📊</span><span class="kv-text">KV: ?</span>';
        return;
      }

      const statusClass = 'kv-' + data.status;
      indicator.classList.add(statusClass);

      const statusEmoji = data.status === 'ok' ? '✅' : data.status === 'warning' ? '⚠️' : '🔴';
      const writePercent = data.usage?.writesPercent || 0;
      const readPercent = data.usage?.readsPercent || 0;

      // Show the more critical percentage with clear "Daily" label
      const displayPercent = Math.max(writePercent, readPercent);
      const displayType = writePercent >= readPercent ? 'writes' : 'reads';

      indicator.innerHTML = \`<span class="kv-icon">\${statusEmoji}</span><span class="kv-text">Daily: \${displayPercent}%</span>\`;
      indicator.title = \`KV Free Tier Usage Today: \${readPercent}% reads, \${writePercent}% writes (click for details)\`;
    }

    async function showKVStatusModal() {
      // Fetch fresh data
      try {
        const response = await fetch('/api/kv-usage');
        kvUsageCache = await response.json();
      } catch {
        showNotification('Failed to load KV stats', 'error');
        return;
      }

      const data = kvUsageCache;

      // Create overlay
      const overlay = document.createElement('div');
      overlay.className = 'changelog-overlay';
      overlay.onclick = (e) => {
        if (e.target === overlay) closeKVModal();
      };

      // Create panel (reuse changelog styling)
      const panel = document.createElement('div');
      panel.className = 'changelog-panel kv-status-panel';

      const statusEmoji = data.status === 'ok' ? '✅' : data.status === 'warning' ? '⚠️' : '🔴';
      const statusText = data.status === 'ok' ? (swedishMode ? 'Bra' : 'Healthy') :
                         data.status === 'warning' ? (swedishMode ? 'Varning' : 'Warning') :
                         (swedishMode ? 'Kritisk' : 'Critical');

      panel.innerHTML = \`
        <div class="changelog-header">
          <h3>\${swedishMode ? '📊 KV Lagring Status' : '📊 KV Storage Status'}</h3>
          <button class="changelog-close kv-modal-close" aria-label="Close KV status">&times;</button>
        </div>
        <div class="kv-status-content">
          <div class="kv-status-summary">
            <div class="kv-status-badge \${data.status}">\${statusEmoji} \${statusText}</div>
            <div class="kv-status-date">\${data.date}</div>
          </div>

          <div class="kv-usage-bars">
            <div class="kv-bar-section">
              <div class="kv-bar-label">\${swedishMode ? 'Läsningar' : 'Reads'} (\${data.estimated?.reads?.toLocaleString() || 0} / \${data.limits?.reads?.toLocaleString() || '100,000'})</div>
              <div class="kv-bar-container">
                <div class="kv-bar kv-bar-reads" style="width: \${Math.min(data.usage?.readsPercent || 0, 100)}%"></div>
              </div>
              <div class="kv-bar-percent">\${data.usage?.readsPercent || 0}%</div>
            </div>
            <div class="kv-bar-section">
              <div class="kv-bar-label">\${swedishMode ? 'Skrivningar' : 'Writes'} (\${data.estimated?.writes?.toLocaleString() || 0} / \${data.limits?.writes?.toLocaleString() || '1,000'})</div>
              <div class="kv-bar-container">
                <div class="kv-bar kv-bar-writes" style="width: \${Math.min(data.usage?.writesPercent || 0, 100)}%"></div>
              </div>
              <div class="kv-bar-percent">\${data.usage?.writesPercent || 0}%</div>
            </div>
          </div>

          <div class="kv-breakdown">
            <h4>\${swedishMode ? 'Nedbrytning per kategori' : 'Usage by Category'}</h4>
            <table class="kv-breakdown-table">
              <thead>
                <tr>
                  <th>\${swedishMode ? 'Kategori' : 'Category'}</th>
                  <th>\${swedishMode ? 'Läsningar' : 'Reads'}</th>
                  <th>\${swedishMode ? 'Skrivningar' : 'Writes'}</th>
                </tr>
              </thead>
              <tbody>
                \${Object.entries(data.breakdown || {}).map(([key, val]) => \`
                  <tr>
                    <td>\${key}</td>
                    <td>\${val.reads?.toLocaleString() || 0}</td>
                    <td>\${val.writes?.toLocaleString() || 0}</td>
                  </tr>
                \`).join('')}
              </tbody>
            </table>
          </div>

          \${data.realtime ? \`
          <div class="kv-realtime">
            <h4>\${swedishMode ? 'Realtidsstatistik (denna worker)' : 'Realtime Stats (this worker)'}</h4>
            <div class="kv-realtime-grid">
              <div class="kv-stat">
                <span class="kv-stat-value">\${data.realtime.reads}</span>
                <span class="kv-stat-label">\${swedishMode ? 'Läsningar' : 'Reads'}</span>
              </div>
              <div class="kv-stat">
                <span class="kv-stat-value">\${data.realtime.writes}</span>
                <span class="kv-stat-label">\${swedishMode ? 'Skrivningar' : 'Writes'}</span>
              </div>
              <div class="kv-stat">
                <span class="kv-stat-value">\${data.realtime.cacheHitRate}%</span>
                <span class="kv-stat-label">\${swedishMode ? 'Cache träff' : 'Cache Hit Rate'}</span>
              </div>
              <div class="kv-stat">
                <span class="kv-stat-value">\${data.realtime.cacheHits}</span>
                <span class="kv-stat-label">\${swedishMode ? 'Cache träffar' : 'Cache Hits'}</span>
              </div>
            </div>
          </div>
          \` : ''}

          <div class="kv-trend">
            <h4>\${swedishMode ? 'Trend' : 'Trend'}</h4>
            <p>\${swedishMode ? 'Riktning' : 'Direction'}: <strong>\${data.trend?.direction || 'stable'}</strong></p>
            <p>\${swedishMode ? 'Idag vs genomsnitt' : 'Today vs Average'}: \${data.trend?.todayVsAvg || 'N/A'}</p>
          </div>

          \${data.recommendations && data.recommendations.length > 0 ? \`
          <div class="kv-recommendations">
            <h4>\${swedishMode ? '💡 Rekommendationer' : '💡 Recommendations'}</h4>
            <ul>
              \${data.recommendations.map(r => \`<li>\${r}</li>\`).join('')}
            </ul>
          </div>
          \` : ''}

          <div class="kv-activity">
            <h4>\${swedishMode ? 'Dagens aktivitet' : 'Today\\'s Activity'}</h4>
            <div class="kv-activity-grid">
              <div class="kv-activity-item">
                <span class="kv-activity-num">\${data.activity?.signIns || 0}</span>
                <span class="kv-activity-label">\${swedishMode ? 'Inloggningar' : 'Sign-ins'}</span>
              </div>
              <div class="kv-activity-item">
                <span class="kv-activity-num">\${data.activity?.libraryScans || 0}</span>
                <span class="kv-activity-label">\${swedishMode ? 'Skanningar' : 'Scans'}</span>
              </div>
              <div class="kv-activity-item">
                <span class="kv-activity-num">\${data.activity?.playlistsCreated || 0}</span>
                <span class="kv-activity-label">\${swedishMode ? 'Spellistor' : 'Playlists'}</span>
              </div>
            </div>
          </div>
        </div>
      \`;

      overlay.appendChild(panel);
      document.body.appendChild(overlay);

      // Attach event listener for close button (CSP blocks inline onclick)
      panel.querySelector('.kv-modal-close').addEventListener('click', () => closeKVModal());

      // Animate in
      requestAnimationFrame(() => {
        overlay.classList.add('visible');
        panel.classList.add('visible');
      });
    }

    function closeKVModal() {
      const overlay = document.querySelector('.changelog-overlay');
      const panel = document.querySelector('.kv-status-panel');
      if (overlay) {
        overlay.classList.remove('visible');
        panel?.classList.remove('visible');
        setTimeout(() => overlay.remove(), 300);
      }
    }

    window.showKVStatusModal = showKVStatusModal;
    window.closeKVModal = closeKVModal;

    // PERF-006 FIX: Track all polling intervals for visibility API cleanup
    let kvPollInterval = null;

    // Start deployment and KV status polling
    function startDeployMonitor() {
      checkDeployStatus();
      checkKVUsage(); // Also check KV status
      // PERF-006 FIX: Reduced deploy polling from 10s to 60s
      deployPollInterval = setInterval(checkDeployStatus, 60000); // Poll every 60s (was 10s)
      kvPollInterval = setInterval(checkKVUsage, KV_POLL_INTERVAL); // Poll KV usage every 5 min
    }

    // PERF-006 FIX: Stop polling intervals
    function stopDeployMonitor() {
      if (deployPollInterval) {
        clearInterval(deployPollInterval);
        deployPollInterval = null;
      }
      if (kvPollInterval) {
        clearInterval(kvPollInterval);
        kvPollInterval = null;
      }
    }

    // ====================================
    // Now Playing Widget
    // ====================================
    let nowPlayingInterval = null;
    let currentTrackId = null;
    let progressInterval = null;
    let currentProgress = 0;
    let currentDuration = 0;

    async function updateNowPlaying() {
      try {
        const response = await fetch('/api/now-playing');
        if (!response.ok) return;

        const data = await response.json();
        const widget = document.getElementById('now-playing-widget');
        const trackEl = document.getElementById('now-playing-track');
        const artistEl = document.getElementById('now-playing-artist');
        const artEl = document.getElementById('now-playing-art');
        const progressEl = document.getElementById('now-playing-progress');

        if (!widget || !trackEl || !artistEl || !artEl || !progressEl) return;

        if (data.playing && data.track) {
          // Show widget
          widget.style.display = 'flex';
          widget.classList.add('is-playing');

          // Update track info
          trackEl.textContent = data.track.name;
          artistEl.textContent = data.track.artists;

          // Update album art
          if (data.track.albumArt) {
            artEl.src = data.track.albumArt;
            artEl.alt = data.track.album;
          }

          // Set up click to open in Spotify
          if (data.track.url) {
            widget.onclick = () => window.open(data.track.url, '_blank');
            widget.style.cursor = 'pointer';
            widget.title = t('openInSpotify');
          }

          // Update progress
          currentProgress = data.track.progress || 0;
          currentDuration = data.track.duration || 1;
          updateProgressBar();

          // Start local progress updates if track changed
          if (currentTrackId !== data.track.id) {
            currentTrackId = data.track.id;
            startProgressUpdates();
          }
        } else {
          // Hide widget or show not playing state
          widget.classList.remove('is-playing');
          widget.style.display = 'none';
          currentTrackId = null;
          stopProgressUpdates();
        }
      } catch (err) {
        // Silently fail - Now Playing is non-critical
        console.debug('Now Playing fetch failed:', err);
      }
    }

    function updateProgressBar() {
      const progressEl = document.getElementById('now-playing-progress');
      if (!progressEl || currentDuration <= 0) return;

      const percent = Math.min((currentProgress / currentDuration) * 100, 100);
      progressEl.style.width = \`\${percent}%\`;
    }

    function startProgressUpdates() {
      stopProgressUpdates();
      // Update progress locally every second for smooth animation
      progressInterval = setInterval(() => {
        currentProgress += 1000;
        if (currentProgress >= currentDuration) {
          currentProgress = currentDuration;
        }
        updateProgressBar();
      }, 1000);
    }

    function stopProgressUpdates() {
      if (progressInterval) {
        clearInterval(progressInterval);
        progressInterval = null;
      }
    }

    function startNowPlayingMonitor() {
      // Initial fetch
      updateNowPlaying();
      // PERF-006 FIX: Reduced polling from 10s to 30s
      nowPlayingInterval = setInterval(updateNowPlaying, 30000); // Poll every 30s (was 10s)
    }

    function stopNowPlayingMonitor() {
      if (nowPlayingInterval) {
        clearInterval(nowPlayingInterval);
        nowPlayingInterval = null;
      }
      stopProgressUpdates();
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
        nowListening: 'Now Listening',
        recentPlaylists: 'Recent Playlists',
        viewScoreboard: 'View Scoreboard',
        privacyTitle: 'What permissions does this need?',
        privacyReadLibrary: 'Read your liked songs',
        privacyReadLibraryDesc: 'To analyse genres from your saved tracks',
        privacyReadProfile: 'View your profile',
        privacyReadProfileDesc: 'To display your name and avatar',
        privacyCreatePlaylists: 'Create playlists',
        privacyCreatePlaylistsDesc: 'To make genre-sorted playlists for you',
        privacyNoDelete: 'We never delete anything',
        privacyNoDeleteDesc: 'Your library stays exactly as it is',
        privacyTempData: 'Temporary data only',
        privacyTempDataDesc: 'Session expires after 7 days, no permanent storage',
        privacySecure: 'Enterprise-grade security',
        privacySecureDesc: 'Built by a Solutions Architect with security-first design',
        privacyReviewDocs: 'Review our security architecture',
        nowPlaying: 'Now Playing',
        notPlaying: 'Not playing',
        openInSpotify: 'Open in Spotify',
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
        nowListening: 'Lyssnar Nu',
        recentPlaylists: 'Senaste Spellistor',
        viewScoreboard: 'Visa Resultattavla',
        privacyTitle: 'Vilka behörigheter behövs?',
        privacyReadLibrary: 'Läsa dina gillade låtar',
        privacyReadLibraryDesc: 'För att analysera genrer från dina sparade låtar',
        privacyReadProfile: 'Visa din profil',
        privacyReadProfileDesc: 'För att visa ditt namn och avatar',
        privacyCreatePlaylists: 'Skapa spellistor',
        privacyCreatePlaylistsDesc: 'För att göra genresorterade spellistor åt dig',
        privacyNoDelete: 'Vi tar aldrig bort något',
        privacyNoDeleteDesc: 'Ditt bibliotek förblir exakt som det är',
        privacyTempData: 'Endast tillfällig data',
        privacyTempDataDesc: 'Sessionen upphör efter 7 dagar, ingen permanent lagring',
        privacySecure: 'Företagsklass säkerhet',
        privacySecureDesc: 'Byggd av en lösningsarkitekt med säkerhet i fokus',
        privacyReviewDocs: 'Granska vår säkerhetsarkitektur',
        nowPlaying: 'Spelar nu',
        notPlaying: 'Spelar inte',
        openInSpotify: 'Öppna i Spotify',
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

      // Update donation button for Swedish mode (pick new random option)
      initDonationButton();

      // Update Heidi badge - preserve the two-span structure
      const heidiBadge = document.querySelector('.heidi-badge');
      if (heidiBadge) {
        const heidiTextSpans = heidiBadge.querySelectorAll('.heidi-text > span');
        if (heidiTextSpans.length >= 2) {
          // First span: "Made with inspiration from" / "Gjord med inspiration från"
          heidiTextSpans[0].textContent = enabled ? 'Gjord med inspiration från' : 'Made with inspiration from';
          // Second span keeps the name and heart structure
          heidiTextSpans[1].innerHTML = enabled
            ? '<strong>Heidi</strong> <span class="heart">💛</span>'
            : '<strong>Heidi</strong> <span class="heart">♥</span>';
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
            'Leaving Sweden? 🥺 The IKEA furniture will miss you',
            'Normal mode? 😴 *yawns in Swedish*',
            'Back to boring mode! 🥱',
            'Normal mode huh? Vikings disapprove 🪓',
            'Fine, go. More meatballs for me 🍝',
            '*sad ABBA noises* 🎵',
            'You just made a fjord cry 🏔️💧',
            'The vikings will remember this betrayal ⚔️',
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
      if (typeof renderNowListening === 'function') renderNowListening();
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

    // GI Jane audio (Will Smith slap reference) (base64 encoded short clip)
    const giJaneAudio = 'data:audio/mp3;base64,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VVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVQ==';

    function initGenieClick() {
      const genie = document.getElementById('genie-mascot');
      if (!genie || genie.dataset.clickInit) return;
      genie.dataset.clickInit = 'true';

      genie.addEventListener('click', () => {
        // Play Will Smith "Gettin' Jiggy Wit It" sound (GI Jane slap reference)
        try {
          const audio = new Audio(giJaneAudio);
          audio.volume = 0.6;
          // Attempt to play - user click provides interaction for autoplay policy
          audio.play().catch(err => {
            console.warn('[Genie] Audio play failed:', err.message);
          });
        } catch (err) {
          console.warn('[Genie] Audio init failed:', err.message);
        }

        // Turn brown (Will Smith mode) and animate
        genie.classList.add('talking', 'will-smith-mode');
        setTimeout(() => {
          genie.classList.remove('talking', 'will-smith-mode');
        }, 2500);

        // Show the iconic line
        const phrase = "KEEP MY WIFE'S NAME OUT YOUR F***ING MOUTH!";
        const phraseSv = "HÅLL MIN FRUS NAMN UTANFÖR DIN J*VLA MUN!";

        const bubble = document.createElement('div');
        bubble.className = 'genie-speech-bubble will-smith-bubble';
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
        // Check for anniversary celebration (#102)
        const anniversary = checkAnniversary();
        const lastAnniversary = localStorage.getItem('heidiAnniversaryDate');
        const today = new Date().toDateString();

        if (anniversary && lastAnniversary !== today) {
          // Anniversary takes priority - show celebration with heart rain
          localStorage.setItem('heidiAnniversaryDate', today);
          localStorage.setItem('heidiGreetingDate', today); // Skip regular greeting
          showAnniversaryCelebration(anniversary);
        } else if (localStorage.getItem('heidiGreetingDate') !== today) {
          // Regular daily greeting
          localStorage.setItem('heidiGreetingDate', today);
          showHeidiGreeting();
        }
      }

      renderHeaderUser(session);
      showAdminButton(); // Show debug panel button (no API call needed)
      checkOwnerStatus(session); // Check if owner to show KV status

      // Start Now Playing monitor for authenticated users
      startNowPlayingMonitor();

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
        <a href="/auth/spotify" class="btn btn-primary" data-testid="sign-in-button">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm4.586 14.424a.622.622 0 01-.857.207c-2.348-1.435-5.304-1.76-8.785-.964a.622.622 0 01-.277-1.215c3.809-.87 7.076-.496 9.712 1.115.293.18.386.563.207.857zm1.223-2.722a.78.78 0 01-1.072.257c-2.687-1.652-6.785-2.131-9.965-1.166a.78.78 0 01-.973-.519.781.781 0 01.52-.972c3.632-1.102 8.147-.568 11.233 1.329a.78.78 0 01.257 1.071zm.105-2.835c-3.223-1.914-8.54-2.09-11.618-1.156a.935.935 0 11-.543-1.79c3.533-1.072 9.404-.865 13.115 1.338a.935.935 0 11-.954 1.608z"/>
          </svg>
          <span>\${t('signInSpotify')}</span>
        </a>
      \` : \`
        <a href="/auth/github" class="btn btn-primary" data-testid="sign-in-button">
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

      // Privacy explainer HTML - collapsible section
      const privacyExplainer = \`
        <details class="privacy-explainer">
          <summary>\${t('privacyTitle')}</summary>
          <div class="privacy-grid">
            <div class="privacy-item privacy-permission">
              <span class="privacy-icon">📖</span>
              <div>
                <strong>\${t('privacyReadLibrary')}</strong>
                <span>\${t('privacyReadLibraryDesc')}</span>
              </div>
            </div>
            <div class="privacy-item privacy-permission">
              <span class="privacy-icon">👤</span>
              <div>
                <strong>\${t('privacyReadProfile')}</strong>
                <span>\${t('privacyReadProfileDesc')}</span>
              </div>
            </div>
            <div class="privacy-item privacy-permission">
              <span class="privacy-icon">📝</span>
              <div>
                <strong>\${t('privacyCreatePlaylists')}</strong>
                <span>\${t('privacyCreatePlaylistsDesc')}</span>
              </div>
            </div>
            <div class="privacy-divider"></div>
            <div class="privacy-item privacy-reassurance">
              <span class="privacy-icon">🛡️</span>
              <div>
                <strong>\${t('privacyNoDelete')}</strong>
                <span>\${t('privacyNoDeleteDesc')}</span>
              </div>
            </div>
            <div class="privacy-item privacy-reassurance">
              <span class="privacy-icon">⏱️</span>
              <div>
                <strong>\${t('privacyTempData')}</strong>
                <span>\${t('privacyTempDataDesc')}</span>
              </div>
            </div>
            <div class="privacy-item privacy-reassurance">
              <span class="privacy-icon">🔒</span>
              <div>
                <strong>\${t('privacySecure')}</strong>
                <span>\${t('privacySecureDesc')}</span>
              </div>
            </div>
          </div>
          <a href="https://github.com/TomsTech/spotify-genre-sorter/blob/main/docs/security.md" target="_blank" class="privacy-docs-link">
            📄 \${t('privacyReviewDocs')}
          </a>
        </details>
      \`;

      app.innerHTML = \`
        <div class="welcome">
          \${error ? \`<div class="error">\${errorMessages[error] || error}\${requestAccessButton}</div>\` : ''}
          \${userCounterHtml}
          <h2 data-i18n="organiseMusic">\${t('organiseMusic')}</h2>
          <p data-i18n="organiseDesc">\${t('organiseDesc')}</p>
          \${privacyExplainer}
          \${loginButton}
          <div class="footer-badges">
            <a href="https://github.com/TomsTech/spotify-genre-sorter" target="_blank" class="github-star-badge" title="\${swedishMode ? 'Gillar du det? Stjärnmärk oss! ⭐' : 'Love this? Star us! ⭐'}">
              <img src="https://img.shields.io/github/stars/TomsTech/spotify-genre-sorter?style=for-the-badge&logo=github&logoColor=white&label=Star&color=1DB954&labelColor=191414" alt="Star on GitHub" loading="lazy" onerror="this.style.display='none'">
            </a>
            <a href="https://spotify.houstons.tech" target="_blank" class="uptime-badge" title="\${swedishMode ? 'Tjänststatus' : 'Service Status'}">
              <img src="https://img.shields.io/website?url=https%3A%2F%2Fspotify.houstons.tech&style=for-the-badge&logo=spotify&logoColor=white&label=Status&up_color=1DB954&down_color=e74c3c&labelColor=191414" alt="Service Status" loading="lazy" onerror="this.style.display='none'">
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

      // Keep Swedish toggle, theme toggle and user info in header
      headerActions.innerHTML = \`
        <button id="swedish-toggle" class="btn btn-ghost btn-sm swedish-toggle-btn" title="\${swedishMode ? 'Switch to English' : 'Switch to Swedish'}" aria-label="\${swedishMode ? 'Switch to English' : 'Switch to Swedish'}">
          \${swedishMode ? '<svg viewBox="0 0 60 30" width="20" height="10" style="vertical-align:middle"><clipPath id="t"><path d="M30,15 h30 v15 z v15 h-30 z h-30 v-15 z v-15 h30 z"/></clipPath><path d="M0,0 v30 h60 v-30 z" fill="#00247d"/><path d="M0,0 L60,30 M60,0 L0,30" stroke="#fff" stroke-width="6"/><path d="M0,0 L60,30 M60,0 L0,30" clip-path="url(#t)" stroke="#cf142b" stroke-width="4"/><path d="M30,0 v30 M0,15 h60" stroke="#fff" stroke-width="10"/><path d="M30,0 v30 M0,15 h60" stroke="#cf142b" stroke-width="6"/></svg>' : '<svg viewBox="0 0 16 10" width="20" height="12" style="vertical-align:middle"><rect width="16" height="10" fill="#006aa7"/><rect x="5" width="2" height="10" fill="#fecc00"/><rect y="4" width="16" height="2" fill="#fecc00"/></svg>'}
        </button>
        <button id="theme-toggle" class="btn btn-ghost btn-sm theme-toggle-btn" data-testid="theme-toggle" title="\${lightMode ? 'Switch to dark mode' : 'Switch to light mode'}" aria-label="\${lightMode ? 'Switch to dark mode' : 'Switch to light mode'}">
          \${lightMode ? '🌙' : '☀️'}
        </button>
        <div class="user-info" data-testid="user-info">
          \${avatar ? \`<img src="\${avatar}" alt="" class="avatar" data-testid="user-avatar" onerror="this.style.display='none'">\` : ''}
          <span data-testid="user-name">\${user || 'User'}</span>
          <a href="/auth/logout" class="btn btn-ghost" data-testid="logout-button" data-i18n="logout">\${t('logout')}</a>
        </div>
      \`;
      // Attach event listeners (CSP blocks inline onclick)
      document.getElementById('theme-toggle').addEventListener('click', () => toggleTheme());
      document.getElementById('swedish-toggle').addEventListener('click', () => toggleSwedishMode());
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

            <div class="progress-controls">
              <button class="btn btn-secondary" id="pause-scan-btn" onclick="pauseProgressiveScan()" title="\${swedishMode ? 'Pausa skanningen' : 'Pause scan'}">
                ⏸️ \${swedishMode ? 'Pausa' : 'Pause'}
              </button>
              <button class="btn btn-primary" id="resume-scan-btn" onclick="resumeProgressiveScan()" style="display: none;" title="\${swedishMode ? 'Återuppta skanningen' : 'Resume scan'}">
                ▶️ \${swedishMode ? 'Återuppta' : 'Resume'}
              </button>
              <button class="btn btn-ghost" onclick="stopProgressiveScan()" title="\${swedishMode ? 'Stoppa skanningen' : 'Stop scan'}">
                ⏹️ \${swedishMode ? 'Stoppa' : 'Stop'}
              </button>
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

      // Populate album art URLs from partial genres for the carousel
      if (partialGenres && partialGenres.length > 0 && albumArtUrls.length === 0) {
        const artUrls = [];
        for (const genre of partialGenres) {
          if (genre.albumArts && genre.albumArts.length > 0) {
            artUrls.push(...genre.albumArts);
            if (artUrls.length >= 20) break; // Enough for rotation
          }
        }
        if (artUrls.length >= 3) {
          // Shuffle and set album art URLs
          albumArtUrls = artUrls.sort(() => 0.5 - Math.random()).slice(0, 20);
          updateAlbumCarousel(); // Update carousel with real images
        }
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

    // Progressive scan state management
    let progressiveScanState = {
      isPaused: false,
      shouldStop: false,
      currentOffset: 0,
      accumulated: null,
      totalInLibrary: 0
    };

    // Save scan progress to localStorage for resume capability
    function saveScanState() {
      try {
        localStorage.setItem('genreScanState', JSON.stringify({
          offset: progressiveScanState.currentOffset,
          accumulated: progressiveScanState.accumulated,
          totalInLibrary: progressiveScanState.totalInLibrary,
          timestamp: Date.now()
        }));
      } catch (e) {
        console.warn('Could not save scan state:', e);
      }
    }

    // Load scan progress from localStorage
    function loadScanState() {
      try {
        const saved = localStorage.getItem('genreScanState');
        if (!saved) return null;

        const state = JSON.parse(saved);
        // Only resume if saved within last hour
        if (Date.now() - state.timestamp < 3600000) {
          return state;
        }
        // Clear old state
        localStorage.removeItem('genreScanState');
      } catch (e) {
        console.warn('Could not load scan state:', e);
      }
      return null;
    }

    // Clear saved scan state
    function clearScanState() {
      try {
        localStorage.removeItem('genreScanState');
      } catch (e) {
        console.warn('Could not clear scan state:', e);
      }
    }

    // Pause the progressive scan
    window.pauseProgressiveScan = function() {
      progressiveScanState.isPaused = true;
      saveScanState();
      const pauseBtn = document.getElementById('pause-scan-btn');
      const resumeBtn = document.getElementById('resume-scan-btn');
      if (pauseBtn) pauseBtn.style.display = 'none';
      if (resumeBtn) resumeBtn.style.display = 'inline-flex';
      showNotification(
        swedishMode ? '⏸️ Skanning pausad' : '⏸️ Scan paused',
        'info'
      );
    };

    // Resume the progressive scan
    window.resumeProgressiveScan = function() {
      progressiveScanState.isPaused = false;
      const pauseBtn = document.getElementById('pause-scan-btn');
      const resumeBtn = document.getElementById('resume-scan-btn');
      if (pauseBtn) pauseBtn.style.display = 'inline-flex';
      if (resumeBtn) resumeBtn.style.display = 'none';
      showNotification(
        swedishMode ? '▶️ Skanning återupptas' : '▶️ Scan resuming',
        'info'
      );
      // Trigger continuation
      loadFullLibrary();
    };

    // Stop the progressive scan
    window.stopProgressiveScan = function() {
      progressiveScanState.shouldStop = true;
      progressiveScanState.isPaused = false;
      clearScanState();
      showNotification(
        swedishMode ? '⏹️ Skanning stoppad' : '⏹️ Scan stopped',
        'info'
      );
    };

    // Progressive loading for large libraries with pause/resume
    async function loadGenresProgressively() {
      // Check for saved state (resume capability)
      const savedState = loadScanState();
      let offset = savedState?.offset || 0;
      let accumulated = savedState?.accumulated || null;
      let totalInLibrary = savedState?.totalInLibrary || 0;

      // Update state
      progressiveScanState.currentOffset = offset;
      progressiveScanState.accumulated = accumulated;
      progressiveScanState.totalInLibrary = totalInLibrary;
      progressiveScanState.shouldStop = false;
      progressiveScanState.isPaused = false;

      if (savedState && offset > 0) {
        showNotification(
          swedishMode ? `📚 Återupptar skanning från ${offset.toLocaleString()} låtar` : `📚 Resuming scan from ${offset.toLocaleString()} tracks`,
          'info',
          4000
        );
      }

      while (true) {
        // Check if paused
        if (progressiveScanState.isPaused) {
          saveScanState();
          return accumulated; // Return partial data
        }

        // Check if stopped
        if (progressiveScanState.shouldStop) {
          clearScanState();
          throw new Error('Scan stopped by user');
        }

        const response = await fetch(\`/api/genres/chunk?offset=\${offset}&limit=500\`);
        const data = await response.json();

        if (!response.ok) {
          // Save state before throwing error
          saveScanState();
          throw new Error(data.details || data.error || 'Failed to load chunk');
        }

        totalInLibrary = data.pagination.totalInLibrary;

        // Merge this chunk first so we can show preview
        accumulated = mergeGenreChunks(accumulated, data.chunk);

        // Update state
        progressiveScanState.currentOffset = offset;
        progressiveScanState.accumulated = accumulated;
        progressiveScanState.totalInLibrary = totalInLibrary;

        // Save progress periodically
        if (offset % 2000 === 0) {
          saveScanState();
        }

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

      // Clear saved state on completion
      clearScanState();

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
        // Check for interrupted scan to resume (#76)
        try {
          const statusRes = await fetch('/api/genres/scan-status');
          if (statusRes.ok) {
            const scanStatus = await statusRes.json();
            if (scanStatus.hasProgress && scanStatus.canResume) {
              const timeSince = Math.round((Date.now() - new Date(scanStatus.lastUpdatedAt).getTime()) / 60000);
              const message = swedishMode
                ? `📚 Hittade ofullständig skanning (${scanStatus.progress}% klar, ${timeSince} minuter sedan). Vill du återuppta?`
                : `📚 Found interrupted scan (${scanStatus.progress}% complete, ${timeSince} minutes ago). Resume?`;

              if (confirm(message)) {
                showNotification(
                  swedishMode ? '▶️ Återupptar skanning...' : '▶️ Resuming scan...',
                  'info'
                );
                await loadFullLibrary();
                return;
              } else {
                // Clear the saved state if user doesn't want to resume
                clearScanState();
              }
            }
          }
        } catch (e) {
          console.log('Could not check scan status:', e);
        }

        // First, fetch library size to show user what to expect (#75)
        renderLoading(
          swedishMode ? 'Kontrollerar biblioteksstorlek...' : 'Checking library size...',
          ''
        );

        let libraryInfo = null;
        try {
          const sizeRes = await fetch('/api/library-size');
          if (sizeRes.ok) {
            libraryInfo = await sizeRes.json();
          }
        } catch (e) {
          console.log('Could not fetch library size:', e);
        }

        // Show library size with scan estimate
        if (libraryInfo) {
          const trackCount = libraryInfo.total.toLocaleString();
          const estimate = libraryInfo.estimatedScanTime;

          // Warning for large libraries
          if (libraryInfo.isLarge) {
            showNotification(
              swedishMode
                ? `⚠️ Stort bibliotek (${trackCount} låtar) - skanningen kan ta ${estimate}`
                : `⚠️ Large library (${trackCount} tracks) - scan may take ${estimate}`,
              'info',
              8000
            );
          }

          renderLoading(
            swedishMode ? 'Hämtar dina låtar...' : 'Fetching your liked songs...',
            swedishMode
              ? `📚 ${trackCount} låtar • Beräknad tid: ${estimate}`
              : `📚 ${trackCount} tracks • Estimated time: ${estimate}`
          );
        } else {
          renderLoading(
            swedishMode ? 'Hämtar dina låtar...' : 'Fetching your liked songs...',
            swedishMode ? 'Detta kan ta en stund för stora bibliotek' : 'This may take a moment for large libraries'
          );
        }

        // Now fetch the genres
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

        // Handle large library redirect to progressive loading
        if (data.requiresProgressiveLoad) {
          console.log('Large library detected (' + data.totalInLibrary + ' tracks), switching to progressive loading');
          showNotification(
            swedishMode ? '📚 Stort bibliotek (' + data.totalInLibrary + ' låtar) - laddar progressivt...' : '📚 Large library (' + data.totalInLibrary + ' tracks) - loading progressively...',
            'info'
          );
          await loadFullLibrary();
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

    // Fun Spotify Wrapped-style quotes based on diversity score
    function getDiversityQuote(score) {
      const highDiversityQuotes = swedishMode ? [
        'Din musiksmak? Omöjlig att sätta i ett fack. Du är en genre-anomali!',
        'Du lyssnar på allt från ABBA till death metal. Respekt.',
        'Dina spellistor ger Spotify-algoritmerna existentiell kris.',
        'Du är typ den där personen som DJ:ar på fester med "vänta, ni MÅSTE höra den här".',
        'Musikalisk kameleont med oförutsägbar nästa låt.',
        'Du har sagt "jag gillar typ allt" och faktiskt menat det.',
        'Din shuffle är en berg-och-dalbana ingen bad om men alla behöver.',
        'Genre? Aldrig hört talas om henne.',
      ] : [
        'Your music taste? Impossible to pigeonhole. You are a genre anomaly.',
        'You listen to everything from ABBA to death metal. Respect.',
        'Your playlists give Spotify algorithms an existential crisis.',
        'You are that person who DJs at parties with "wait, you HAVE to hear this one".',
        'Musical chameleon with an unpredictable next track.',
        'You have said "I like basically everything" and actually meant it.',
        'Your shuffle is a rollercoaster nobody asked for but everyone needs.',
        'Genre? Never heard of her.',
      ];

      const diverseQuotes = swedishMode ? [
        'Du gillar variation! Dina öron är nyfikna äventyrare.',
        'Bra blandning! Du vet vad du gillar men är öppen för överraskningar.',
        'Din musiksmak är som en välkryddad måltid - lite av varje.',
        'Du har en bred smak men det är inte kaotiskt. Organiserat eklektiskt.',
        'Du växlar mellan stämningar som en proffs.',
        'Mångsidighet är ditt mellannamn. Eller borde vara.',
        'Du är den vännen alla frågar om musikrekommendationer.',
      ] : [
        'You like variety! Your ears are curious adventurers.',
        'Nice mix! You know what you like but stay open to surprises.',
        'Your music taste is like a well-seasoned meal - a bit of everything.',
        'You have broad taste but it is not chaotic. Organised eclectic.',
        'You switch between moods like a pro.',
        'Versatility is your middle name. Or should be.',
        'You are the friend everyone asks for music recommendations.',
      ];

      const moderateQuotes = swedishMode ? [
        'Du har hittat din groove och du äger den!',
        'Bekväm i dina favoritgenrer, men du tar ibland en omväg.',
        'Solid grund med plats för utforskning när stämningen stämmer.',
        'Du vet vad du gillar - ingen skam i det spelet.',
        'Din musiksmak har en tydlig identitet och det är vackert.',
        'Balanserad som en bra playlist. Lagom är bäst.',
        'Du har dina go-to-genrer och det är helt rätt.',
      ] : [
        'You have found your groove and you own it!',
        'Comfortable in your favourite genres, but you take a detour sometimes.',
        'Solid foundation with room for exploration when the mood strikes.',
        'You know what you like - no shame in that game.',
        'Your music taste has a clear identity and that is beautiful.',
        'Balanced like a good playlist. Goldilocks approved.',
        'You have your go-to genres and that is perfectly valid.',
      ];

      const focusedQuotes = swedishMode ? [
        'Du har en typ och du håller dig till den. Konsekvent legend.',
        'Dedikerad lyssnare alert! Du vet exakt vad du vill ha.',
        'Låt ingen säga att du inte är engagerad.',
        'Genre-specialist! Du har valt din bana och du kör hårt.',
        'Djup kunskap > bred kunskap. Du gräver djupt.',
        'Du är den där vännen som vet ALLT om en specifik genre.',
        'Fokuserad energi. Inga distraktioner. Ren musiksmak.',
      ] : [
        'You have a type and you stick with it. Consistent legend.',
        'Dedicated listener alert! You know exactly what you want.',
        'Let nobody say you are not committed.',
        'Genre specialist! You picked your lane and you are thriving.',
        'Deep knowledge > broad knowledge. You dig deep.',
        'You are that friend who knows EVERYTHING about one specific genre.',
        'Focused energy. No distractions. Pure music taste.',
      ];

      const veryFocusedQuotes = swedishMode ? [
        'En genre att styra dem alla! Du är fullt dedikerad.',
        'Du har hittat DET ljudet och du släpper det inte.',
        'Laser-fokuserad musiksmak. Ingen ifrågasätter din dedikation.',
        'Du vet vad du gillar och du äger det. Absolut inga ursäkter.',
        'Genremästare! 100% koncentrerad passion.',
        'När du gillar något, gillar du det PÅ RIKTIGT.',
        'Din musikbibliotek har en estetik och den är tight.',
        'Dedikation nivå: Expert. Du har valt din grej.',
      ] : [
        'One genre to rule them all! You are fully committed.',
        'You found THE sound and you are not letting go.',
        'Laser-focused music taste. Nobody questions your dedication.',
        'You know what you like and you own it. Zero apologies.',
        'Genre master! 100% concentrated passion.',
        'When you like something, you REALLY like it.',
        'Your music library has an aesthetic and it is tight.',
        'Dedication level: Expert. You picked your thing.',
      ];

      let quotes;
      if (score >= 80) quotes = highDiversityQuotes;
      else if (score >= 60) quotes = diverseQuotes;
      else if (score >= 40) quotes = moderateQuotes;
      else if (score >= 20) quotes = focusedQuotes;
      else quotes = veryFocusedQuotes;

      return quotes[Math.floor(Math.random() * quotes.length)];
    }

    // Get a fun personality type based on diversity score
    function getMusicPersonality(score) {
      if (score >= 80) {
        return swedishMode
          ? { type: 'The Sonic Explorer', emoji: '🌍', desc: 'Gränslös musikresenär' }
          : { type: 'The Sonic Explorer', emoji: '🌍', desc: 'Boundless music traveller' };
      } else if (score >= 60) {
        return swedishMode
          ? { type: 'The Curator', emoji: '🎨', desc: 'Smakfull samlare' }
          : { type: 'The Curator', emoji: '🎨', desc: 'Tasteful collector' };
      } else if (score >= 40) {
        return swedishMode
          ? { type: 'The Comfort Seeker', emoji: '☕', desc: 'Mysig lyssnare' }
          : { type: 'The Comfort Seeker', emoji: '☕', desc: 'Cozy listener' };
      } else if (score >= 20) {
        return swedishMode
          ? { type: 'The Specialist', emoji: '🔬', desc: 'Djupdykare i ljudet' }
          : { type: 'The Specialist', emoji: '🔬', desc: 'Deep diver in sound' };
      } else {
        return swedishMode
          ? { type: 'The Purist', emoji: '💎', desc: 'Kristallklar smak' }
          : { type: 'The Purist', emoji: '💎', desc: 'Crystal clear taste' };
      }
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
              \${top10.map((g, i) => \`
                <div class="genre-bar-row">
                  <span class="genre-bar-name">\${g.name}</span>
                  <div class="genre-bar-container">
                    <div class="genre-bar bar-\${i + 1}" style="width: \${(g.count / maxCount * 100)}%"></div>
                  </div>
                  <span class="genre-bar-count">\${g.count}</span>
                </div>
              \`).join('')}
            </div>
          </div>

          <div class="wrapped-diversity-card">
            <div class="wrapped-content">
              <div class="wrapped-score-display">
                <div class="wrapped-score-big">\${diversityScore}%</div>
                <div class="wrapped-score-label">\${swedishMode ? 'Mångfald' : 'Diversity'}</div>
              </div>
              <div class="wrapped-divider"></div>
              <div class="diversity-quote">
                <span class="quote-text">"\${getDiversityQuote(diversityScore)}"</span>
              </div>
              <div class="wrapped-personality">
                <div class="wrapped-personality-label">\${swedishMode ? 'Din musikpersonlighet' : 'Your music personality'}</div>
                <div class="wrapped-personality-type">\${getMusicPersonality(diversityScore).emoji} \${getMusicPersonality(diversityScore).type}</div>
              </div>
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
              <button onclick="resetTemplate()" class="btn btn-ghost btn-sm" title="\${swedishMode ? 'Återställ' : 'Reset'}" aria-label="\${swedishMode ? 'Återställ mall' : 'Reset template'}">↺</button>
            </div>
            <div class="template-preview">
              \${swedishMode ? 'Förhandsvisning:' : 'Preview:'} <span id="template-preview">\${getTemplatePreview()}</span>
            </div>

            <label style="margin-top: 1rem;">\${swedishMode ? 'Spellistbeskrivning mall' : 'Playlist Description Template'}</label>
            <div class="template-input-row">
              <input
                type="text"
                class="search-input"
                id="desc-template-input"
                value="\${playlistDescTemplate.replace(/"/g, '&quot;')}"
                oninput="updateDescTemplate(this.value)"
                placeholder="{genre} tracks • {count} songs"
              >
              <button onclick="resetDescTemplate()" class="btn btn-ghost btn-sm" title="\${swedishMode ? 'Återställ' : 'Reset'}" aria-label="\${swedishMode ? 'Återställ beskrivningsmall' : 'Reset description template'}">↺</button>
            </div>
            <div class="template-preview">
              \${swedishMode ? 'Förhandsvisning:' : 'Preview:'} <span id="desc-template-preview">\${getDescTemplatePreview()}</span>
            </div>
            <div class="template-hint" style="font-size: 0.75rem; color: var(--text-muted); margin-top: 0.25rem;">
              \${swedishMode ? 'Platshållare: {genre}, {count}, {date}, {username}' : 'Placeholders: {genre}, {count}, {date}, {username}'}
            </div>
          </div>

          <input
            type="text"
            class="search-input"
            placeholder="\${t('searchGenres')}"
            data-i18n-placeholder="searchGenres"
            oninput="filterAndRenderGenres(this.value)"
          >
          <div class="select-all-row">
            <label class="select-all-label">
              <input
                type="checkbox"
                id="select-all-checkbox"
                onchange="toggleSelectAll(this)"
                aria-label="\${swedishMode ? 'Välj alla genrer' : 'Select all genres'}"
              >
              <span>\${swedishMode ? 'Välj alla' : 'Select all'}</span>
            </label>
            <span class="selection-info" id="selection-info"></span>
          </div>
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
      const countEl = document.getElementById('selected-count');
      const createBtn = document.getElementById('create-btn');
      // Guard against elements not existing (e.g., in admin panel)
      if (countEl) countEl.textContent = selectedGenres.size;
      if (createBtn) createBtn.disabled = selectedGenres.size === 0;

      // Update select-all checkbox state
      updateSelectAllCheckbox();

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

    // Update select-all checkbox to reflect current selection state
    function updateSelectAllCheckbox() {
      const selectAllCb = document.getElementById('select-all-checkbox');
      const selectionInfo = document.getElementById('selection-info');
      if (!selectAllCb) return;

      const totalCheckboxes = document.querySelectorAll('.genre-checkbox').length;
      const selectedCount = selectedGenres.size;

      if (selectedCount === 0) {
        selectAllCb.checked = false;
        selectAllCb.indeterminate = false;
      } else if (selectedCount === totalCheckboxes) {
        selectAllCb.checked = true;
        selectAllCb.indeterminate = false;
      } else {
        selectAllCb.checked = false;
        selectAllCb.indeterminate = true;
      }

      // Update selection info text
      if (selectionInfo) {
        if (selectedCount > 0) {
          selectionInfo.textContent = swedishMode
            ? \`\${selectedCount} av \${totalCheckboxes} valda\`
            : \`\${selectedCount} of \${totalCheckboxes} selected\`;
        } else {
          selectionInfo.textContent = '';
        }
      }
    }

    // Toggle select all/none via the master checkbox
    function toggleSelectAll(checkbox) {
      if (checkbox.checked) {
        selectAll();
      } else {
        selectNone();
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

    // Description template functions (#91)
    function applyDescTemplate(genreName, trackCount) {
      const now = new Date();
      const dateStr = now.toLocaleDateString(swedishMode ? 'sv-SE' : 'en-AU', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
      const username = window.currentUser?.display_name || 'User';

      return playlistDescTemplate
        .replace(/{genre}/g, genreName)
        .replace(/{count}/g, trackCount?.toString() || '0')
        .replace(/{date}/g, dateStr)
        .replace(/{username}/g, username);
    }

    function updateDescTemplate(value) {
      playlistDescTemplate = value || '{genre} tracks from your liked songs ♫ • {count} tracks • Created {date}';
      localStorage.setItem('playlistDescTemplate', playlistDescTemplate);
      const preview = document.getElementById('desc-template-preview');
      if (preview) {
        preview.textContent = getDescTemplatePreview();
      }
    }

    function resetDescTemplate() {
      playlistDescTemplate = '{genre} tracks from your liked songs ♫ • {count} tracks • Created {date}';
      localStorage.setItem('playlistDescTemplate', playlistDescTemplate);
      const input = document.getElementById('desc-template-input');
      const preview = document.getElementById('desc-template-preview');
      if (input) input.value = playlistDescTemplate;
      if (preview) preview.textContent = getDescTemplatePreview();
    }

    function getDescTemplatePreview() {
      return applyDescTemplate('Rock', 42);
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
        '    <button class="customise-close" onclick="this.closest(\\'.customise-modal\\').remove()" aria-label="Close">&times;</button>',
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

      // Apply focus trap for accessibility
      trapFocus(modal.querySelector('.customise-panel'));

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

    function showPlaylistCustomizeModal(genre) {
      const defaultName = playlistTemplate.replace('{genre}', genre.name);
      const defaultDescription = applyDescTemplate(genre.name, genre.count);

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

      // Apply focus trap for accessibility
      trapFocus(modal.querySelector('.playlist-customize-modal'));

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
      div.setAttribute('role', 'status');
      div.setAttribute('aria-live', 'polite');
      div.setAttribute('aria-atomic', 'true');
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
      'c': { desc: 'Create playlists', action: () => {
        if (selectedGenres.size > 0 && !document.getElementById('create-btn')?.disabled) {
          createSelectedPlaylists();
        }
      }},
      'r': { desc: 'Refresh data', ctrl: true, action: (e) => { e.preventDefault(); refreshGenres(); }},
      't': { desc: 'Toggle theme', action: toggleTheme },
      's': { desc: 'Toggle stats', action: toggleStatsDashboard },
      '?': { desc: 'Show keyboard shortcuts', action: showKeyboardHelp },
      'j': { desc: 'Next genre', action: navigateGenreDown },
      'k': { desc: 'Previous genre', action: navigateGenreUp },
    };

    // Vim-style two-key sequences (g+h for home, g+s for scoreboard)
    let pendingKey = null;
    let pendingKeyTimeout = null;
    const TWO_KEY_SHORTCUTS = {
      'g': {
        'h': { desc: 'Go home', action: () => window.scrollTo({ top: 0, behavior: 'smooth' }) },
        's': { desc: 'Go scoreboard', action: showScoreboard },
        'g': { desc: 'Go to top', action: () => window.scrollTo({ top: 0, behavior: 'smooth' }) },
      }
    };

    // Track currently focused genre card index
    let focusedGenreIndex = -1;

    function navigateGenreDown() {
      const items = document.querySelectorAll('.genre-item:not(.hidden)');
      if (items.length === 0) return;
      focusedGenreIndex = Math.min(focusedGenreIndex + 1, items.length - 1);
      focusGenreItem(items[focusedGenreIndex]);
    }

    function navigateGenreUp() {
      const items = document.querySelectorAll('.genre-item:not(.hidden)');
      if (items.length === 0) return;
      focusedGenreIndex = Math.max(focusedGenreIndex - 1, 0);
      focusGenreItem(items[focusedGenreIndex]);
    }

    function focusGenreItem(item) {
      if (!item) return;
      // Remove focus from previous
      document.querySelectorAll('.genre-item.keyboard-focused').forEach(i => i.classList.remove('keyboard-focused'));
      // Add focus to current
      item.classList.add('keyboard-focused');
      item.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // Focus the checkbox inside for keyboard interaction
      const checkbox = item.querySelector('.genre-checkbox');
      if (checkbox) checkbox.focus();
    }

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
        { key: 'j / k', desc: swedishMode ? 'Nästa/Föregående genre' : 'Next/Previous genre' },
        { key: 'g h', desc: swedishMode ? 'Gå till toppen' : 'Go home (top)' },
        { key: 'g s', desc: swedishMode ? 'Visa resultattavla' : 'Go to scoreboard' },
        { key: 'c', desc: swedishMode ? 'Skapa spellistor' : 'Create playlists' },
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

      // Apply focus trap for accessibility
      trapFocus(panel);

      // Focus the close button for accessibility
      panel.querySelector('button')?.focus();
    }

    document.addEventListener('keydown', (e) => {
      // Don't trigger shortcuts when typing in inputs
      const isInput = e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA';

      // Escape always works (also clears pending key)
      if (e.key === 'Escape') {
        pendingKey = null;
        clearTimeout(pendingKeyTimeout);
        handleEscape();
        return;
      }

      // Skip other shortcuts if in input (except Ctrl combos)
      if (isInput && !e.ctrlKey && !e.metaKey) return;

      // Handle two-key sequences (vim-style g+h, g+s, etc.)
      if (pendingKey && TWO_KEY_SHORTCUTS[pendingKey]) {
        const secondAction = TWO_KEY_SHORTCUTS[pendingKey][e.key];
        pendingKey = null;
        clearTimeout(pendingKeyTimeout);
        if (secondAction) {
          e.preventDefault();
          secondAction.action();
          return;
        }
      }

      // Check if this key starts a two-key sequence
      if (TWO_KEY_SHORTCUTS[e.key] && !e.ctrlKey && !e.metaKey) {
        pendingKey = e.key;
        clearTimeout(pendingKeyTimeout);
        pendingKeyTimeout = setTimeout(() => { pendingKey = null; }, 1000);
        return;
      }

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
      recentPlaylists: [],
      listening: [] // Users currently listening to music
    };
    let scoreboardData = null;
    let sidebarPollInterval = null;
    let nowPlayingPollInterval = null;

    // Load listening data (users currently playing music)
    async function loadListeningData() {
      try {
        const response = await fetch('/api/listening');
        if (!response.ok) return;
        const data = await response.json();
        sidebarData.listening = data.listeners || [];
        renderNowListening(); // Render the Now Listening sidebar section
        updateListeningIndicators(); // Also update indicators on user items
      } catch (err) {
        // Silent fail - listening is optional
      }
    }

    // Update user list items to show listening indicators
    function updateListeningIndicators() {
      // Create a map of spotifyId -> listening data for fast lookup
      const listeningMap = new Map();
      for (const listener of sidebarData.listening) {
        listeningMap.set(listener.spotifyId, listener);
      }

      // Update all user list items
      document.querySelectorAll('.user-list-item[data-spotify-id]').forEach(item => {
        const spotifyId = item.getAttribute('data-spotify-id');
        const existingTooltip = item.querySelector('.now-playing-tooltip');

        if (listeningMap.has(spotifyId)) {
          const data = listeningMap.get(spotifyId);
          item.classList.add('is-listening');

          // Create or update tooltip
          if (existingTooltip) {
            existingTooltip.querySelector('.now-playing-track').textContent = data.track.name;
            existingTooltip.querySelector('.now-playing-artists').textContent = data.track.artists;
            const img = existingTooltip.querySelector('.now-playing-album-art');
            if (data.track.albumArt) {
              img.src = data.track.albumArt;
              img.style.display = '';
            } else {
              img.style.display = 'none';
            }
          } else {
            // Create tooltip
            const tooltip = document.createElement('div');
            tooltip.className = 'now-playing-tooltip';
            tooltip.innerHTML = \`
              <img class="now-playing-album-art" src="\${data.track.albumArt || ''}" alt="" \${data.track.albumArt ? '' : 'style="display:none"'}>
              <div class="now-playing-info">
                <div class="now-playing-label">\${swedishMode ? 'Spelar nu' : 'Now Playing'}</div>
                <div class="now-playing-track">\${escapeHtml(data.track.name)}</div>
                <div class="now-playing-artists">\${escapeHtml(data.track.artists)}</div>
              </div>
            \`;
            item.appendChild(tooltip);
          }
        } else {
          item.classList.remove('is-listening');
          if (existingTooltip) {
            existingTooltip.remove();
          }
        }
      });
    }

    // Poll the current user's now playing status (to broadcast to others)
    async function pollNowPlaying() {
      try {
        await fetch('/api/now-playing');
        // Response doesn't matter - the endpoint updates KV as a side effect
      } catch {
        // Silent fail
      }
    }

    // Start polling now playing status for authenticated users
    function startNowPlayingPoll() {
      if (nowPlayingPollInterval) return;
      // Poll every 30 seconds to keep listening status fresh
      pollNowPlaying(); // Initial poll
      nowPlayingPollInterval = setInterval(pollNowPlaying, 30000);
    }

    function stopNowPlayingPoll() {
      if (nowPlayingPollInterval) {
        clearInterval(nowPlayingPollInterval);
        nowPlayingPollInterval = null;
      }
    }

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

    // Render pioneers list in sidebar - separates owners from regular pioneers
    function renderPioneers() {
      const container = document.getElementById('pioneers-list');
      if (!container) return;

      if (sidebarData.pioneers.length === 0) {
        container.innerHTML = '<div class="sidebar-loading">' + (swedishMode ? 'Inga pionjärer än' : 'No pioneers yet') + '</div>';
        return;
      }

      // Separate owners from regular pioneers
      const owners = sidebarData.pioneers.filter(u => isOwner(u.spotifyName));
      const regularPioneers = sidebarData.pioneers.filter(u => !isOwner(u.spotifyName));

      let html = '';

      // Owners section with Swedish crowns
      if (owners.length > 0) {
        html += '<div class="owners-section">';
        html += '<div class="owners-header">👑👑👑 ' + (swedishMode ? 'Ägare' : 'Owners') + '</div>';
        html += owners.map((user, i) => {
          const delay = i * 50;
          const specialClass = getSpecialUserClass(user.spotifyName);
          const specialTag = getSpecialUserTag(user.spotifyName);
          return \`
            <div class="user-list-item animate-in owner-item \${specialClass}" style="animation-delay: \${delay}ms" data-spotify-id="\${user.spotifyId || ''}" title="\${swedishMode ? 'Gick med' : 'Joined'} \${formatTimeAgo(new Date(user.registeredAt))}">
              \${user.spotifyAvatar
                ? \`<img class="user-avatar" src="\${user.spotifyAvatar}" alt="" onerror="this.outerHTML='<div class=user-avatar-placeholder>👤</div>'">\`
                : '<div class="user-avatar-placeholder">👤</div>'}
              <span class="user-name">\${escapeHtml(user.spotifyName)}\${specialTag}</span>
            </div>
          \`;
        }).join('');
        html += '</div>';
      }

      // Regular pioneers with gold/silver/bronze medals
      if (regularPioneers.length > 0) {
        html += regularPioneers.map((user, i) => {
          const posClass = i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : '';
          // Use medal emojis for top 3
          const regalia = i === 0 ? '<span class="pioneer-badge gold">🥇</span>' :
                          i === 1 ? '<span class="pioneer-badge silver">🥈</span>' :
                          i === 2 ? '<span class="pioneer-badge bronze">🥉</span>' :
                          i < 10 ? '<span class="regalia">⭐</span>' : '';
          const delay = (owners.length + i) * 50;

          const specialClass = getSpecialUserClass(user.spotifyName);
          const specialTag = getSpecialUserTag(user.spotifyName);
          return \`
            <div class="user-list-item animate-in \${specialClass}" style="animation-delay: \${delay}ms" data-spotify-id="\${user.spotifyId || ''}" title="\${swedishMode ? 'Gick med' : 'Joined'} \${formatTimeAgo(new Date(user.registeredAt))}">
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

      container.innerHTML = html;
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
            <span class="regalia relative-time" data-timestamp="\${user.registeredAt}">\${formatTimeAgo(new Date(user.registeredAt))}</span>
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
                <span class="relative-time" data-timestamp="\${playlist.createdAt}">\${formatTimeAgo(new Date(playlist.createdAt))}</span>
              </div>
            </div>
          </a>
        \`;
      }).join('');
    }

    // Render now listening list in sidebar - shows who's currently playing music
    function renderNowListening() {
      const container = document.getElementById('now-listening-list');
      if (!container) return;

      if (!sidebarData.listening || sidebarData.listening.length === 0) {
        container.innerHTML = '<div class="sidebar-loading">' + (swedishMode ? 'Ingen lyssnar just nu' : 'No one listening right now') + '</div>';
        return;
      }

      container.innerHTML = sidebarData.listening.slice(0, 10).map((listener, i) => {
        const delay = i * 50; // Stagger animation
        const specialClass = getSpecialUserClass(listener.spotifyName);
        const track = listener.track || {};
        return `
          <div class="listening-list-item animate-in ${specialClass}" style="animation-delay: ${delay}ms" title="${escapeHtml(track.name || '')} by ${escapeHtml(track.artists || '')}">
            <div class="listening-user">
              ${listener.spotifyAvatar
                ? `<img class="user-avatar" src="${listener.spotifyAvatar}" alt="" onerror="this.outerHTML='<div class=user-avatar-placeholder>👤</div>'">`
                : '<div class="user-avatar-placeholder">👤</div>'}
              <span class="user-name">${escapeHtml(listener.spotifyName)}</span>
            </div>
            <div class="listening-track">
              ${track.albumArt
                ? `<img class="track-album-art" src="${track.albumArt}" alt="">`
                : '<div class="track-album-placeholder">🎵</div>'}
              <div class="track-info">
                <div class="track-name">${escapeHtml(track.name || 'Unknown Track')}</div>
                <div class="track-artists">${escapeHtml(track.artists || 'Unknown Artist')}</div>
              </div>
              <div class="listening-equalizer" aria-hidden="true">
                <span></span><span></span><span></span>
              </div>
            </div>
          </div>
        `;
      }).join('');
    }

    // Escape HTML for safe display
    function escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text || '';
      return div.innerHTML;
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
      modal.setAttribute('data-testid', 'scoreboard-modal');
      modal.setAttribute('role', 'dialog');
      modal.setAttribute('aria-modal', 'true');
      modal.onclick = (e) => {
        if (e.target === modal) closeScoreboard();
      };

      modal.innerHTML = \`
        <div class="scoreboard-panel">
          <div class="scoreboard-header">
            <h2>📊 \${swedishMode ? 'Resultattavla' : 'Scoreboard'}</h2>
            <button class="btn btn-ghost" onclick="closeScoreboard()" aria-label="Close scoreboard">✕</button>
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
            \${swedishMode ? 'Uppdaterad' : 'Updated'} <span class="relative-time" data-timestamp="\${scoreboardData.updatedAt}">\${formatTimeAgo(new Date(scoreboardData.updatedAt))}</span>
            <span style="opacity:0.5;font-size:0.7rem;margin-left:0.5rem">ℹ️</span>
          </div>
        </div>
      \`;

      document.body.appendChild(modal);

      // Apply focus trap for accessibility
      trapFocus(modal.querySelector('.scoreboard-panel'));

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
            const top3Class = entry.rank <= 3 ? 'top-3' : '';
            const medalEmoji = entry.rank === 1 ? '🥇' : entry.rank === 2 ? '🥈' : entry.rank === 3 ? '🥉' : '';
            return \`
              <div class="scoreboard-entry \${top3Class}">
                <span class="rank \${rankClass}">\${medalEmoji || '#' + entry.rank}</span>
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
    let listeningPollInterval = null;

    function initSidebar() {
      // Load initial data
      loadLeaderboard();
      loadRecentPlaylists();
      loadListeningData(); // Load who's currently listening

      // Poll for recent playlists every 3 minutes (was 30s - reduced to save KV usage)
      function startPolling() {
        if (sidebarPollInterval) clearInterval(sidebarPollInterval);
        sidebarPollInterval = setInterval(() => {
          loadRecentPlaylists();
        }, 180000); // 3 minutes

        // Poll for listening data every 30 seconds (more real-time)
        if (listeningPollInterval) clearInterval(listeningPollInterval);
        listeningPollInterval = setInterval(() => {
          loadListeningData();
        }, 30000); // 30 seconds
      }

      startPolling();

      // Pause polling when tab is hidden to reduce KV reads
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
          if (sidebarPollInterval) {
            clearInterval(sidebarPollInterval);
            sidebarPollInterval = null;
          }
          if (listeningPollInterval) {
            clearInterval(listeningPollInterval);
            listeningPollInterval = null;
          }
        } else {
          // Tab became visible - refresh immediately then resume polling
          loadRecentPlaylists();
          loadListeningData();
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

    // =========================================
    // CSP FIX: Global Event Delegation
    // Handles onclick attributes blocked by CSP
    // =========================================
    document.addEventListener('click', (e) => {
      const target = e.target.closest('[onclick]');
      if (!target) return;

      const onclickAttr = target.getAttribute('onclick');
      if (!onclickAttr) return;

      // Prevent default for buttons/links
      e.preventDefault();

      // Parse and execute the onclick handler safely
      // Extract function name and arguments
      const match = onclickAttr.match(/^(\w+)\s*\(([^)]*)\)$/);
      if (match) {
        const fnName = match[1];
        const argsStr = match[2];

        // Get the function from window
        const fn = window[fnName];
        if (typeof fn === 'function') {
          // Parse arguments (handle strings, booleans, numbers)
          let args = [];
          if (argsStr.trim()) {
            try {
              // Safe argument parsing
              args = argsStr.split(',').map(arg => {
                arg = arg.trim();
                // Handle string literals
                if ((arg.startsWith("'") && arg.endsWith("'")) ||
                    (arg.startsWith('"') && arg.endsWith('"'))) {
                  return arg.slice(1, -1);
                }
                // Handle booleans
                if (arg === 'true') return true;
                if (arg === 'false') return false;
                // Handle numbers
                if (!isNaN(arg) && arg !== '') return Number(arg);
                return arg;
              });
            } catch { args = []; }
          }
          fn.apply(null, args);
        }
      } else {
        // Handle simple expressions like: this.closest('.modal').remove()
        // or: window.location.reload()
        try {
          // For simple window methods
          if (onclickAttr.includes('window.location.reload')) {
            window.location.reload();
          } else if (onclickAttr.includes('location.reload')) {
            location.reload(true);
          } else if (onclickAttr.includes('location.href')) {
            const hrefMatch = onclickAttr.match(/location\.href\s*=\s*['"]([^'"]+)['"]/);
            if (hrefMatch) location.href = hrefMatch[1];
          } else if (onclickAttr.includes('.closest(') && onclickAttr.includes('.remove()')) {
            // Handle: this.closest('.selector').remove()
            const selectorMatch = onclickAttr.match(/\.closest\s*\(\s*['"]([^'"]+)['"]\s*\)/);
            if (selectorMatch) {
              const closest = target.closest(selectorMatch[1]);
              if (closest) closest.remove();
            }
          } else if (onclickAttr.includes('event.preventDefault()')) {
            // Already prevented, now execute the rest
            const fnMatch = onclickAttr.match(/;\s*(\w+)\s*\(([^)]*)\)/);
            if (fnMatch) {
              const fn = window[fnMatch[1]];
              if (typeof fn === 'function') {
                const arg = fnMatch[2].replace(/'/g, '').trim();
                fn(arg);
              }
            }
          }
        } catch (err) {
          console.warn('[CSP Handler] Failed to execute:', onclickAttr, err);
        }
      }
    });

    // Start deployment monitor
    startDeployMonitor();

    // Initialize sidebar
    initSidebar();

    // Check for What's New modal (after short delay to not block initial load)
    setTimeout(checkWhatsNew, 2000);

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
          '<button class="playlist-modal-close" onclick="closePlaylistModal()" aria-label="Close">&times;</button>' +
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
      // Initialize donation button with random theme
      initDonationButton();
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

    // NOTE: checkKVUsage() is defined earlier in this file (line ~1120)
    // It handles both KV status indicator (owner only) and rate limit banner (all users)

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
        '<button class="close-btn" onclick="dismissRateLimitBanner()" aria-label="Dismiss banner">&times;</button>';

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

    // PERF-006 FIX: Track health check interval for visibility API
    let healthCheckInterval = null;

    // Check health on load and periodically
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(checkHealth, 3000); // Initial check after 3s
      // PERF-006 FIX: Reduced from 60s to 5 minutes
      healthCheckInterval = setInterval(checkHealth, 300000); // Then every 5 min (was 1 min)
    });

    // PERF-006 FIX: Master visibility handler to stop ALL polling when tab is hidden
    // This saves significant API calls when user switches tabs
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        // Stop all polling when tab is hidden
        stopDeployMonitor();
        stopNowPlayingMonitor();
        if (healthCheckInterval) {
          clearInterval(healthCheckInterval);
          healthCheckInterval = null;
        }
      } else {
        // Resume polling when tab becomes visible
        startDeployMonitor();
        if (window.isAuthenticated) {
          startNowPlayingMonitor();
        }
        checkHealth();
        healthCheckInterval = setInterval(checkHealth, 300000);
      }
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
        '  <button class="share-close" onclick="this.closest(\'.share-modal-overlay\').remove()" aria-label="Close">&times;</button>',
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

      // Apply focus trap for accessibility
      trapFocus(modal.querySelector('.share-modal'));

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
    // Static Element Event Listeners
    // CSP blocks inline onclick handlers, so we attach listeners here
    // ====================================
    document.addEventListener('DOMContentLoaded', () => {
      // Deploy widget - show deploy details modal
      const deployWidget = document.getElementById('deploy-widget');
      if (deployWidget) {
        deployWidget.addEventListener('click', () => showDeployDetails());
      }

      // KV status indicator - show KV status modal
      const kvIndicator = document.getElementById('kv-status-indicator');
      if (kvIndicator) {
        kvIndicator.addEventListener('click', () => showKVStatusModal());
      }

      // Scoreboard button
      const scoreboardBtn = document.getElementById('scoreboard-btn');
      if (scoreboardBtn) {
        scoreboardBtn.addEventListener('click', () => showScoreboard());
      }

      // Sidebar toggle
      const sidebarToggle = document.getElementById('sidebar-toggle');
      if (sidebarToggle) {
        sidebarToggle.addEventListener('click', () => toggleSidebar());
      }

      // Heidi badge - toggle Swedish mode
      const heidiBadge = document.getElementById('heidi-badge');
      if (heidiBadge) {
        heidiBadge.addEventListener('click', () => toggleSwedishMode());
      }
    });

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

    function showGenreWrapped() {
      // Get current genre data from the app state
      const genres = window.currentGenres || [];
      if (genres.length === 0) {
        alert(swedishMode ? 'Analysera dina låtar först!' : 'Analyze your tracks first!');
        return;
      }

      const existing = document.querySelector('.wrapped-overlay');
      if (existing) existing.remove();

      // Calculate stats - use actual track count, not genre assignment sum
      const totalTracks = genreData?.totalTracks || window.totalTracks || genres.length;
      const topGenres = genres.slice(0, 5);
      const topFamily = getGenreFamily(topGenres[0]?.name || '');
      const diversityScore = calculateDiversityScore(genres);
      const personality = GENRE_PERSONALITIES[topFamily] || GENRE_PERSONALITIES.other;
      const lang = swedishMode ? 'sv' : 'en';
      const gradient = swedishMode ? GENRE_GRADIENTS.swedish : (GENRE_GRADIENTS[topFamily] || GENRE_GRADIENTS.other);
      const reading = getRandomReading(topFamily, lang);

      // Get unique artists count from actual data or estimate
      const uniqueArtists = genreData?.totalArtists || Math.round(totalTracks * 0.6);

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
        '  <button class="wrapped-close" onclick="this.closest(\'.wrapped-overlay\').remove()" aria-label="Close">&times;</button>',
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

      // Apply focus trap for accessibility
      trapFocus(modal.querySelector('.wrapped-container'));

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
          // Fallback: show friendly toast with screenshot hint and highlight card
          const card = document.getElementById('wrapped-card');
          if (card) {
            card.style.outline = '3px solid white';
            card.style.outlineOffset = '4px';
            setTimeout(() => {
              if (card.style) {
                card.style.outline = '';
                card.style.outlineOffset = '';
              }
            }, 3000);
          }
          showToast(swedishMode
            ? '📸 Ta en skärmbild av kortet ovan!'
            : '📸 Take a screenshot of the card above!', 4000);
        }
      } catch (err) {
        console.error('Download error:', err);
        showToast(swedishMode ? '📸 Ta en skärmbild istället!' : '📸 Take a screenshot instead!', 3000);
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
          <button class="modal-close" onclick="this.closest('.request-access-overlay').remove()" aria-label="Close">&times;</button>
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

      // Apply focus trap for accessibility
      trapFocus(modal.querySelector('.request-access-modal'));

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
