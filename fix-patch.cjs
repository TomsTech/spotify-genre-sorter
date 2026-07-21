const fs = require('fs');

// We need to revert all aria labels added to buttons that are NOT icon-only,
// and we need to fix the unused variable in createSelectedPlaylists.

let content = fs.readFileSync('src/frontend/app.js', 'utf8');

// 1. Revert aria labels on text buttons
const replacements = [
  {
    search: '<button class="btn btn-primary error-retry-btn" onclick="window.location.reload()" aria-label="${swedishMode ? \'Försök igen\' : \'Try Again\'}">',
    replace: '<button class="btn btn-primary error-retry-btn" onclick="window.location.reload()">'
  },
  {
    search: '<button class="btn btn-ghost error-dismiss-btn" onclick="this.closest(\'.error-boundary-overlay\').remove()" aria-label="${swedishMode ? \'Avfärda felmeddelande\' : \'Dismiss error\'}">',
    replace: '<button class="btn btn-ghost error-dismiss-btn" onclick="this.closest(\'.error-boundary-overlay\').remove()">'
  },
  {
    search: '<button class="btn btn-ghost" id="prompt-cancel" aria-label="\' + (swedishMode ? \'Avbryt\' : \'Cancel\') + \'">\' + (swedishMode ? \'Avbryt\' : \'Cancel\') + \'</button>',
    replace: '<button class="btn btn-ghost" id="prompt-cancel">\' + (swedishMode ? \'Avbryt\' : \'Cancel\') + \'</button>'
  },
  {
    search: '<button class="btn btn-primary" id="prompt-confirm" aria-label="\' + (swedishMode ? \'Bekräfta\' : \'Confirm\') + \'">\' + (swedishMode ? \'OK\' : \'OK\') + \'</button>',
    replace: '<button class="btn btn-primary" id="prompt-confirm">\' + (swedishMode ? \'OK\' : \'OK\') + \'</button>'
  },
  {
    search: '<button class="btn btn-ghost btn-sm" onclick="cancelMerge()" aria-label="\' + (swedishMode ? \'Avbryt sammanslagning\' : \'Cancel merge\') + \'">\' + (swedishMode ? \'Avbryt\' : \'Cancel\') + \'</button>',
    replace: '<button class="btn btn-ghost btn-sm" onclick="cancelMerge()">\' + (swedishMode ? \'Avbryt\' : \'Cancel\') + \'</button>'
  },
  {
    search: '<button class="btn btn-primary btn-sm" onclick="showMergeModal()" aria-label="\' + (swedishMode ? \'Slå ihop valda genrer\' : \'Merge selected genres\') + \'">\' + (swedishMode ? \'📦 Slå ihop\' : \'📦 Merge\') + \'</button>',
    replace: '<button class="btn btn-primary btn-sm" onclick="showMergeModal()">\' + (swedishMode ? \'📦 Slå ihop\' : \'📦 Merge\') + \'</button>'
  },
  {
    search: '<button class="btn btn-ghost" onclick="this.closest(\\\'.modal-overlay\\\').remove()" aria-label="\' + (swedishMode ? \'Stäng fönster\' : \'Close modal\') + \'">\' + (swedishMode ? \'Avbryt\' : \'Cancel\') + \'</button>',
    replace: '<button class="btn btn-ghost" onclick="this.closest(\\\'.modal-overlay\\\').remove()">\' + (swedishMode ? \'Avbryt\' : \'Cancel\') + \'</button>'
  },
  {
    search: '<button class="btn btn-primary" onclick="createMergedPlaylist()" aria-label="\' + (swedishMode ? \'Skapa ny spellista med valda genrer\' : \'Create new playlist with selected genres\') + \'">\' + (swedishMode ? \'🎵 Skapa spellista\' : \'🎵 Create Playlist\') + \'</button>',
    replace: '<button class="btn btn-primary" onclick="createMergedPlaylist()">\' + (swedishMode ? \'🎵 Skapa spellista\' : \'🎵 Create Playlist\') + \'</button>'
  },
  {
    search: '<button class="admin-tab active" data-tab="stats" aria-label="Statistics tab">📊 Stats</button>',
    replace: '<button class="admin-tab active" data-tab="stats">📊 Stats</button>'
  },
  {
    search: '<button class="admin-tab" data-tab="kv" aria-label="KV Monitor tab">🗄️ KV Monitor</button>',
    replace: '<button class="admin-tab" data-tab="kv">🗄️ KV Monitor</button>'
  },
  {
    search: '<button class="admin-tab" data-tab="cache" aria-label="Cache tab">💾 Cache</button>',
    replace: '<button class="admin-tab" data-tab="cache">💾 Cache</button>'
  },
  {
    search: '<button class="admin-tab" data-tab="health" aria-label="Health tab">🏥 Health</button>',
    replace: '<button class="admin-tab" data-tab="health">🏥 Health</button>'
  },
  {
    search: '<button class="admin-tab" data-tab="errors" aria-label="Errors tab">🐛 Errors</button>',
    replace: '<button class="admin-tab" data-tab="errors">🐛 Errors</button>'
  },
  {
    search: '<button class="admin-tab" data-tab="perf" aria-label="Performance tab">⚡ Performance</button>',
    replace: '<button class="admin-tab" data-tab="perf">⚡ Performance</button>'
  },
  {
    search: '<button class="admin-tab" data-tab="users" aria-label="Users tab">👥 Users</button>',
    replace: '<button class="admin-tab" data-tab="users">👥 Users</button>'
  },
  {
    search: '<button class="btn btn-ghost btn-sm" onclick="document.querySelector(\'[data-tab=kv]\').click()" aria-label="Back to KV Monitor">',
    replace: '<button class="btn btn-ghost btn-sm" onclick="document.querySelector(\'[data-tab=kv]\').click()">'
  }
];

let changedCount = 0;
for (const {search, replace} of replacements) {
  if (content.includes(search)) {
    content = content.replace(search, replace);
    changedCount++;
  }
}

// Fix createSelectedPlaylists unused originalText error and state restoration:
const fixCreateSearch = `      const btn = document.getElementById('create-btn');
      btn.disabled = true;
      const originalText = btn.innerHTML;
      btn.innerHTML = '<span class="spinner" style="width: 16px; height: 16px; display: inline-block; vertical-align: middle; margin-right: 8px;"></span>' + (swedishMode ? 'Skapar...' : 'Creating...');`;

const fixCreateReplace = `      const btn = document.getElementById('create-btn');
      const originalText = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner" style="width: 16px; height: 16px; display: inline-block; vertical-align: middle; margin-right: 8px;"></span>' + (swedishMode ? 'Skapar...' : 'Creating...');

      // Store original text globally or pass it down so it can be restored on error if needed
      btn.dataset.originalText = originalText;`;

// and restore in finally/catch or success:
const fixRestoreSearch = `        // Hide loading modal
        const modal = document.querySelector('.loading-modal-overlay');
        if (modal) modal.remove();

        btn.disabled = false;
        btn.innerHTML = originalText;

        if (result.success) {`;
const fixRestoreReplace = `        // Hide loading modal
        const modal = document.querySelector('.loading-modal-overlay');
        if (modal) modal.remove();

        btn.disabled = false;
        if (btn.dataset.originalText) {
           btn.innerHTML = btn.dataset.originalText;
        }

        if (result.success) {`;

content = content.replace(fixCreateSearch, fixCreateReplace);
content = content.replace(fixRestoreSearch, fixRestoreReplace);

// Let's also restore in the catch block:
const fixCatchSearch = `      } catch (error) {
        // Hide loading modal
        const modal = document.querySelector('.loading-modal-overlay');
        if (modal) modal.remove();`;
const fixCatchReplace = `      } catch (error) {
        // Hide loading modal
        const modal = document.querySelector('.loading-modal-overlay');
        if (modal) modal.remove();

        btn.disabled = false;
        if (btn.dataset.originalText) {
           btn.innerHTML = btn.dataset.originalText;
        }`;

content = content.replace(fixCatchSearch, fixCatchReplace);

fs.writeFileSync('src/frontend/app.js', content);
console.log(`Reverted ${changedCount} aria labels.`);
