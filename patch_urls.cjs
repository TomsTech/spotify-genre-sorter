const fs = require('fs');
let content = fs.readFileSync('src/frontend/app.js', 'utf8');

// The first patch already added escapeHtml() but didn't sanitize URL schemes.
// We need to write a simple URL sanitizer function, or use string manipulation.
// However, looking at the code, we can define a sanitizeUrl function.

const insertionPoint = "    function escapeHtml(text) {\n      if (text === null || text === undefined) return '';\n      return String(text)\n        .replace(/&/g, '&amp;')\n        .replace(/</g, '&lt;')\n        .replace(/>/g, '&gt;')\n        .replace(/\"/g, '&quot;')\n        .replace(/'/g, '&#039;');\n    }";

const sanitizeUrlFunction = `    function sanitizeUrl(url) {
      if (!url) return '';
      const stringUrl = String(url);
      if (stringUrl.trim().toLowerCase().startsWith('javascript:') || stringUrl.trim().toLowerCase().startsWith('data:')) {
        return 'about:blank';
      }
      return escapeHtml(stringUrl);
    }`;

if (content.includes('function escapeHtml(text)')) {
    content = content.replace(insertionPoint, insertionPoint + '\n\n' + sanitizeUrlFunction);
}

// Now replace escapeHtml with sanitizeUrl for the URLs we patched

content = content.replace(
  "(data.trackingUrl ? '<a href=\"' + escapeHtml(data.trackingUrl) + '\" class=\"btn btn-secondary\" target=\"_blank\" rel=\"noopener noreferrer\">' + trackText + '</a>' : '')",
  "(data.trackingUrl ? '<a href=\"' + sanitizeUrl(data.trackingUrl) + '\" class=\"btn btn-secondary\" target=\"_blank\" rel=\"noopener noreferrer\">' + trackText + '</a>' : '')"
);

content = content.replace(
  "href=\"${escapeHtml(changelogCache.repoUrl)}/releases\"",
  "href=\"${sanitizeUrl(changelogCache.repoUrl)}/releases\""
);

content = content.replace(
  "href=\"${escapeHtml(changelogCache?.repoUrl || 'https://github.com/TomsTech/spotify-genre-sorter')}/releases\"",
  "href=\"${sanitizeUrl(changelogCache?.repoUrl || 'https://github.com/TomsTech/spotify-genre-sorter')}/releases\""
);

fs.writeFileSync('src/frontend/app.js', content);
