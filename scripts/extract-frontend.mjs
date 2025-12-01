#!/usr/bin/env node
/**
 * Extract embedded HTML, CSS, and JS from src/index.ts
 * Uses line-based extraction to handle template literals properly
 */

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');

const indexPath = join(rootDir, 'src/index.ts');
const lines = readFileSync(indexPath, 'utf-8').split('\n');

// Based on analysis of the file:
// CSS: lines 316-1750 (inside <style> tag)
// Body HTML: lines 1754-1815 (between </head><body> and <script>)
// JavaScript: lines 1818-3164 (inside <script> tag)

// Find exact line numbers by searching for markers
let styleStart = -1, styleEnd = -1;
let bodyStart = -1, bodyEnd = -1;
let scriptStart = -1, scriptEnd = -1;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if (line.includes('<style>') && styleStart === -1) {
    styleStart = i + 1; // Start after <style>
  }
  if (line.includes('</style>') && styleEnd === -1) {
    styleEnd = i; // End before </style>
  }
  if (line.includes('<body>') && bodyStart === -1) {
    bodyStart = i + 1; // Start after <body>
  }
  if (line.includes('<script>') && bodyEnd === -1 && bodyStart !== -1) {
    bodyEnd = i; // End before <script>
    scriptStart = i + 1; // Start after <script>
  }
  if (line.includes('</script>') && scriptEnd === -1 && scriptStart !== -1) {
    scriptEnd = i; // End before </script>
  }
}

console.log('Found markers:');
console.log(`  CSS: lines ${styleStart + 1} - ${styleEnd + 1}`);
console.log(`  Body: lines ${bodyStart + 1} - ${bodyEnd + 1}`);
console.log(`  JS: lines ${scriptStart + 1} - ${scriptEnd + 1}`);

if (styleStart === -1 || styleEnd === -1) {
  console.error('Could not find CSS boundaries');
  process.exit(1);
}
if (bodyStart === -1 || bodyEnd === -1) {
  console.error('Could not find body HTML boundaries');
  process.exit(1);
}
if (scriptStart === -1 || scriptEnd === -1) {
  console.error('Could not find JS boundaries');
  process.exit(1);
}

// Extract content
const css = lines.slice(styleStart, styleEnd).join('\n');
const bodyHtml = lines.slice(bodyStart, bodyEnd).join('\n');
const js = lines.slice(scriptStart, scriptEnd).join('\n');

// Create frontend directory
const frontendDir = join(rootDir, 'src/frontend');
mkdirSync(frontendDir, { recursive: true });

// Write CSS
writeFileSync(join(frontendDir, 'styles.css'), css);
console.log(`\nCreated src/frontend/styles.css (${css.split('\n').length} lines)`);

// Write JS
writeFileSync(join(frontendDir, 'app.js'), js);
console.log(`Created src/frontend/app.js (${js.split('\n').length} lines)`);

// Write HTML body
writeFileSync(join(frontendDir, 'body.html'), bodyHtml);
console.log(`Created src/frontend/body.html (${bodyHtml.split('\n').length} lines)`);

console.log('\nExtraction complete!');
