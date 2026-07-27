const fs = require('fs');
let appJs = fs.readFileSync('src/frontend/app.js', 'utf8');

appJs = appJs.replace(
  /'    <button class="customise-close" onclick="this\.closest\(\\\\'\.customise-modal\\\\'\)\.remove\(\)" aria-label="Close">&times;<\/button>',/,
  "'    <button class=\"customise-close\" onclick=\"this.closest(\\'\.customise-modal\\').remove()\" aria-label=\"Close\">&times;</button>',"
);
fs.writeFileSync('src/frontend/app.js', appJs, 'utf8');
