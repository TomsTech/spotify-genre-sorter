const fs = require('fs');
const file = 'src/frontend/error-handler.js';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  /<button class="btn btn-sm btn-ghost" onclick="this\.closest\('\.error-notification'\)\.remove\(\)">\s*✕\s*<\/button>/g,
  `<button class="btn btn-sm btn-ghost" onclick="this.closest('.error-notification').remove()" aria-label="\${swedish ? 'Stäng felmeddelande' : 'Dismiss error notification'}" title="\${swedish ? 'Stäng' : 'Dismiss'}">\n      ✕\n    </button>`
);

content = content.replace(
  /<button class="btn btn-sm" onclick="this\.dispatchEvent\(new CustomEvent\('viewFailures', \{ bubbles: true \}\)\)">/g,
  `<button class="btn btn-sm" onclick="this.dispatchEvent(new CustomEvent('viewFailures', { bubbles: true }))" aria-label="\${swedish ? 'Visa misslyckade' : 'View Failures'}">`
);

fs.writeFileSync(file, content);
