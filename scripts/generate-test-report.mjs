#!/usr/bin/env node
/**
 * Test Report Generator for Genre Genie
 *
 * Runs vitest with JSON output and generates a beautiful HTML report.
 * Can be customised with a title/description for each release.
 *
 * Usage:
 *   node scripts/generate-test-report.mjs
 *   node scripts/generate-test-report.mjs --title "v3.5.0 Release" --description "New features and fixes"
 *   node scripts/generate-test-report.mjs --input test-results.json (use existing JSON)
 *
 * Output: test-report.html in project root
 */

import { execSync } from 'child_process';
import { writeFileSync, readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// Parse CLI arguments
const args = process.argv.slice(2);
let title = 'Genre Genie - Test Report';
let description = 'Automated test results';
let inputFile = null;
let outputFile = join(ROOT, 'test-report.html');

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--title' && args[i + 1]) {
    title = args[++i];
  } else if (args[i] === '--description' && args[i + 1]) {
    description = args[++i];
  } else if (args[i] === '--input' && args[i + 1]) {
    inputFile = args[++i];
  } else if (args[i] === '--output' && args[i + 1]) {
    outputFile = args[++i];
  } else if (args[i] === '--help') {
    console.log(`
Test Report Generator for Genre Genie

Usage:
  node scripts/generate-test-report.mjs [options]

Options:
  --title <string>       Report title (default: "Genre Genie - Test Report")
  --description <string> Report description
  --input <file>         Use existing JSON file instead of running tests
  --output <file>        Output HTML file (default: test-report.html)
  --help                 Show this help message
`);
    process.exit(0);
  }
}

// Get version from package.json
const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf-8'));
const version = pkg.version;

console.log('🧪 Genre Genie Test Report Generator\n');

// Run tests or read existing results
let testResults;
if (inputFile) {
  console.log(`📁 Reading test results from ${inputFile}...`);
  testResults = JSON.parse(readFileSync(inputFile, 'utf-8'));
} else {
  console.log('🏃 Running tests with JSON reporter...');
  try {
    const jsonOutput = execSync('npm test -- --reporter=json', {
      cwd: ROOT,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe']
    });
    testResults = JSON.parse(jsonOutput);
  } catch (error) {
    // Tests might fail but still produce JSON output
    if (error.stdout) {
      try {
        testResults = JSON.parse(error.stdout);
      } catch {
        console.error('❌ Failed to parse test output');
        process.exit(1);
      }
    } else {
      console.error('❌ Failed to run tests:', error.message);
      process.exit(1);
    }
  }
}

// Parse vitest JSON output
const { testResults: files, numPassedTests, numFailedTests, numPendingTests, numTotalTests } = testResults;

// Collect all tests from files
const allTests = [];
const testSuites = [];

if (files && Array.isArray(files)) {
  for (const file of files) {
    const suiteName = file.name.replace(/^.*[\/\\]/, ''); // Get filename only
    const suiteTests = [];

    if (file.assertionResults) {
      for (const test of file.assertionResults) {
        const testInfo = {
          name: test.title || test.fullName,
          status: test.status,
          duration: test.duration || 0,
          suite: suiteName
        };
        suiteTests.push(testInfo);
        allTests.push(testInfo);
      }
    }

    testSuites.push({
      name: suiteName,
      tests: suiteTests,
      passed: suiteTests.filter(t => t.status === 'passed').length,
      failed: suiteTests.filter(t => t.status === 'failed').length
    });
  }
}

// Calculate stats
const passed = numPassedTests || allTests.filter(t => t.status === 'passed').length;
const failed = numFailedTests || allTests.filter(t => t.status === 'failed').length;
const pending = numPendingTests || allTests.filter(t => t.status === 'pending' || t.status === 'skipped').length;
const total = numTotalTests || allTests.length;

console.log(`\n📊 Test Results: ${passed} passed, ${failed} failed, ${pending} pending (${total} total)\n`);

// Generate HTML
const timestamp = new Date().toISOString();
const html = generateHTML({
  title,
  description,
  version,
  timestamp,
  passed,
  failed,
  pending,
  total,
  testSuites,
  allTests
});

writeFileSync(outputFile, html);
console.log(`✅ Report generated: ${outputFile}\n`);

// Exit with error code if tests failed
if (failed > 0) {
  process.exit(1);
}

function generateHTML({ title, description, version, timestamp, passed, failed, pending, total, testSuites, allTests }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <style>
    :root {
      --bg: #0a0a0a;
      --surface: #141414;
      --surface-2: #1e1e1e;
      --border: #2a2a2a;
      --text: #fafafa;
      --text-muted: #888;
      --accent: #1DB954;
      --danger: #e74c3c;
      --warning: #f39c12;
      --info: #3498db;
      --swedish-blue: #006AA7;
      --swedish-yellow: #FECC00;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.6;
      padding: 2rem;
    }
    .container { max-width: 1200px; margin: 0 auto; }
    h1 {
      font-size: 2rem;
      margin-bottom: 0.5rem;
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }
    h1 .emoji { font-size: 2.5rem; }
    .subtitle { color: var(--text-muted); margin-bottom: 0.5rem; }
    .meta { color: var(--text-muted); font-size: 0.85rem; margin-bottom: 2rem; }
    .meta span { margin-right: 1.5rem; }

    .summary-cards {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 1rem;
      margin-bottom: 2rem;
    }
    .summary-card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 1.25rem;
      text-align: center;
    }
    .summary-card.success { border-color: var(--accent); }
    .summary-card.danger { border-color: var(--danger); }
    .summary-card.warning { border-color: var(--warning); }
    .summary-card.info { border-color: var(--info); }
    .summary-card .value {
      font-size: 2.5rem;
      font-weight: 700;
    }
    .summary-card.success .value { color: var(--accent); }
    .summary-card.danger .value { color: var(--danger); }
    .summary-card.warning .value { color: var(--warning); }
    .summary-card.info .value { color: var(--info); }
    .summary-card .label {
      color: var(--text-muted);
      font-size: 0.85rem;
      margin-top: 0.25rem;
    }

    .section {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 1.5rem;
      margin-bottom: 1.5rem;
    }
    .section-title {
      font-size: 1.25rem;
      margin-bottom: 1rem;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .test-suite {
      margin-bottom: 1.5rem;
    }
    .test-suite:last-child { margin-bottom: 0; }
    .suite-header {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.75rem;
      background: var(--surface-2);
      border-radius: 8px;
      margin-bottom: 0.5rem;
      cursor: pointer;
    }
    .suite-header:hover { background: #252525; }
    .suite-name { flex: 1; font-weight: 500; }
    .suite-stats {
      display: flex;
      gap: 0.75rem;
      font-size: 0.85rem;
    }
    .suite-stats .pass { color: var(--accent); }
    .suite-stats .fail { color: var(--danger); }

    .test-list {
      display: none;
      padding-left: 1.5rem;
    }
    .test-list.expanded { display: block; }
    .test-item {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.5rem 0.75rem;
      border-radius: 6px;
    }
    .test-item:hover { background: var(--surface-2); }
    .test-item .status {
      width: 20px;
      height: 20px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.7rem;
      flex-shrink: 0;
    }
    .test-item .status.pass { background: var(--accent); }
    .test-item .status.fail { background: var(--danger); }
    .test-item .status.skip { background: var(--warning); }
    .test-item .name { flex: 1; font-size: 0.9rem; }
    .test-item .duration {
      color: var(--text-muted);
      font-size: 0.8rem;
    }

    .badge {
      display: inline-block;
      padding: 0.2rem 0.6rem;
      border-radius: 50px;
      font-size: 0.75rem;
      font-weight: 600;
    }
    .badge.success { background: rgba(29, 185, 84, 0.2); color: var(--accent); }
    .badge.danger { background: rgba(231, 76, 60, 0.2); color: var(--danger); }

    .footer {
      text-align: center;
      margin-top: 3rem;
      padding-top: 2rem;
      border-top: 1px solid var(--border);
      color: var(--text-muted);
    }
    .footer a { color: var(--accent); text-decoration: none; }

    .progress-bar {
      height: 8px;
      background: var(--surface-2);
      border-radius: 4px;
      overflow: hidden;
      margin-bottom: 1rem;
    }
    .progress-bar .fill {
      height: 100%;
      background: var(--accent);
      transition: width 0.3s ease;
    }
    .progress-bar.has-failures .fill { background: linear-gradient(90deg, var(--accent) 0%, var(--danger) 100%); }

    @media (max-width: 600px) {
      body { padding: 1rem; }
      .summary-cards { grid-template-columns: repeat(2, 1fr); }
      .suite-header { flex-wrap: wrap; }
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>
      <span class="emoji">🧪</span>
      ${escapeHtml(title)}
    </h1>
    <p class="subtitle">${escapeHtml(description)}</p>
    <p class="meta">
      <span>📦 v${escapeHtml(version)}</span>
      <span>🕐 ${timestamp}</span>
    </p>

    <div class="progress-bar ${failed > 0 ? 'has-failures' : ''}">
      <div class="fill" style="width: ${total > 0 ? (passed / total * 100) : 0}%"></div>
    </div>

    <div class="summary-cards">
      <div class="summary-card ${passed > 0 ? 'success' : ''}">
        <div class="value">${passed}</div>
        <div class="label">Passed</div>
      </div>
      <div class="summary-card ${failed > 0 ? 'danger' : ''}">
        <div class="value">${failed}</div>
        <div class="label">Failed</div>
      </div>
      <div class="summary-card ${pending > 0 ? 'warning' : ''}">
        <div class="value">${pending}</div>
        <div class="label">Skipped</div>
      </div>
      <div class="summary-card info">
        <div class="value">${total}</div>
        <div class="label">Total</div>
      </div>
    </div>

    <div class="section">
      <h3 class="section-title">📋 Test Suites</h3>
      ${testSuites.map(suite => `
        <div class="test-suite">
          <div class="suite-header" onclick="this.nextElementSibling.classList.toggle('expanded')">
            <span class="suite-name">${escapeHtml(suite.name)}</span>
            <div class="suite-stats">
              <span class="pass">✓ ${suite.passed}</span>
              ${suite.failed > 0 ? `<span class="fail">✗ ${suite.failed}</span>` : ''}
            </div>
            <span class="badge ${suite.failed > 0 ? 'danger' : 'success'}">${suite.tests.length} tests</span>
          </div>
          <div class="test-list">
            ${suite.tests.map(test => `
              <div class="test-item">
                <div class="status ${test.status === 'passed' ? 'pass' : test.status === 'failed' ? 'fail' : 'skip'}">
                  ${test.status === 'passed' ? '✓' : test.status === 'failed' ? '✗' : '○'}
                </div>
                <span class="name">${escapeHtml(test.name)}</span>
                ${test.duration ? `<span class="duration">${test.duration}ms</span>` : ''}
              </div>
            `).join('')}
          </div>
        </div>
      `).join('')}
    </div>

    <div class="footer">
      <p>Genre Genie - Made with 💙💛 for Heidi</p>
      <p><a href="https://github.com/thecasual/genre-genie">View on GitHub</a></p>
    </div>
  </div>

  <script>
    // Expand failed suites by default
    document.querySelectorAll('.test-suite').forEach(suite => {
      if (suite.querySelector('.fail')) {
        suite.querySelector('.test-list').classList.add('expanded');
      }
    });
  </script>
</body>
</html>`;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
