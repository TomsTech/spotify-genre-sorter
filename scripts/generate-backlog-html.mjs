#!/usr/bin/env node
/**
 * Generate a styled HTML dashboard from BACKLOG.md
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backlogPath = path.join(__dirname, '..', 'BACKLOG.md');
const outputPath = path.join(__dirname, '..', 'docs', 'backlog-dashboard.html');

const content = fs.readFileSync(backlogPath, 'utf-8');

// Parse tasks - handle emoji status markers (handle CRLF)
const lines = content.split(/\r?\n/);
const tasks = [];

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  // Match: ### 53. Task Title
  const headerMatch = line.match(/^### (\d+[a-z]?)\. (.+)$/);
  if (headerMatch) {
    const [, id, title] = headerMatch;
    // Next line should be priority/effort/status
    const nextLine = lines[i + 1] || '';
    const metaMatch = nextLine.match(/\*\*Priority:\*\* (P\d) \| \*\*Effort:\*\* (\w+) \| \*\*Status:\*\* (.+)/);
    if (metaMatch) {
      const [, priority, effort, statusText] = metaMatch;
      const isDone = statusText.includes('DONE');
      const isPending = statusText.includes('PENDING');
      const isProgress = statusText.includes('PROGRESS');

      tasks.push({
        id,
        title: title.trim(),
        priority,
        effort,
        status: isDone ? 'done' : isPending ? 'pending' : isProgress ? 'progress' : 'unknown',
        statusText: statusText.trim()
      });
    }
  }
}

// Parse phases
const phaseRegex = /## (Phase \d+: .+?)(?:\n|$)/g;
const phases = [];
let phaseMatch;
while ((phaseMatch = phaseRegex.exec(content)) !== null) {
  phases.push(phaseMatch[1]);
}

// Count by priority
const stats = {
  done: tasks.filter(t => t.status === 'done').length,
  pending: tasks.filter(t => t.status === 'pending').length,
  progress: tasks.filter(t => t.status === 'progress').length,
  p0: tasks.filter(t => t.priority === 'P0' && t.status !== 'done').length,
  p1: tasks.filter(t => t.priority === 'P1' && t.status !== 'done').length,
  p2: tasks.filter(t => t.priority === 'P2' && t.status !== 'done').length,
  p3: tasks.filter(t => t.priority === 'P3' && t.status !== 'done').length,
  p4: tasks.filter(t => t.priority === 'P4' && t.status !== 'done').length,
};

// Effort mapping
const effortHours = { XS: 0.5, S: 2, M: 6, L: 16, XL: 40 };
const totalEffort = tasks
  .filter(t => t.status !== 'done')
  .reduce((sum, t) => sum + (effortHours[t.effort] || 0), 0);

// Generate HTML
const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Genre Genie - Full Backlog Dashboard</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <style>
        * { font-family: 'Inter', sans-serif; }
        .gradient-bg { background: linear-gradient(135deg, #0f0f1a 0%, #1a1a2e 50%, #0f3460 100%); }
        .card {
            background: rgba(255, 255, 255, 0.03);
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255, 255, 255, 0.1);
            transition: all 0.2s ease;
        }
        .card:hover { border-color: rgba(255, 255, 255, 0.2); background: rgba(255, 255, 255, 0.05); }
        .task-done { opacity: 0.5; }
        .task-done:hover { opacity: 0.8; }
        .priority-p0 { border-left: 3px solid #ef4444; }
        .priority-p1 { border-left: 3px solid #f97316; }
        .priority-p2 { border-left: 3px solid #eab308; }
        .priority-p3 { border-left: 3px solid #22c55e; }
        .priority-p4 { border-left: 3px solid #6b7280; }
        .filter-btn.active { background: rgba(59, 130, 246, 0.3); border-color: rgba(59, 130, 246, 0.5); }
        .search-highlight { background: rgba(234, 179, 8, 0.3); }
    </style>
</head>
<body class="gradient-bg min-h-screen text-gray-100">
    <header class="sticky top-0 z-50 backdrop-blur-lg bg-black/30 border-b border-white/10">
        <div class="max-w-7xl mx-auto px-6 py-4">
            <div class="flex items-center justify-between flex-wrap gap-4">
                <div>
                    <h1 class="text-2xl font-bold bg-gradient-to-r from-green-400 to-emerald-400 bg-clip-text text-transparent">
                        🧞 Genre Genie Backlog
                    </h1>
                    <p class="text-sm text-gray-400">${tasks.length} items • ${stats.done} done • ${stats.pending} pending</p>
                </div>
                <div class="flex items-center gap-4">
                    <input type="text" id="search" placeholder="Search tasks..."
                        class="bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-sm w-64 focus:outline-none focus:border-blue-500">
                </div>
            </div>
        </div>
    </header>

    <main class="max-w-7xl mx-auto px-6 py-8">
        <!-- Stats -->
        <div class="grid grid-cols-2 md:grid-cols-6 gap-4 mb-8">
            <div class="card rounded-xl p-4 text-center">
                <p class="text-3xl font-bold text-green-400">${stats.done}</p>
                <p class="text-xs text-gray-400">Done</p>
            </div>
            <div class="card rounded-xl p-4 text-center">
                <p class="text-3xl font-bold text-yellow-400">${stats.pending}</p>
                <p class="text-xs text-gray-400">Pending</p>
            </div>
            <div class="card rounded-xl p-4 text-center">
                <p class="text-3xl font-bold text-red-400">${stats.p0 + stats.p1}</p>
                <p class="text-xs text-gray-400">High Priority</p>
            </div>
            <div class="card rounded-xl p-4 text-center">
                <p class="text-3xl font-bold text-blue-400">~${Math.round(totalEffort)}h</p>
                <p class="text-xs text-gray-400">Est. Remaining</p>
            </div>
            <div class="card rounded-xl p-4 text-center">
                <p class="text-3xl font-bold text-purple-400">${Math.round(stats.done / tasks.length * 100)}%</p>
                <p class="text-xs text-gray-400">Complete</p>
            </div>
            <div class="card rounded-xl p-4 text-center">
                <p class="text-3xl font-bold text-gray-400">${phases.length}</p>
                <p class="text-xs text-gray-400">Phases</p>
            </div>
        </div>

        <!-- Filters -->
        <div class="flex flex-wrap gap-2 mb-6">
            <button class="filter-btn active card px-3 py-1 rounded-lg text-sm" data-filter="all">All</button>
            <button class="filter-btn card px-3 py-1 rounded-lg text-sm" data-filter="pending">Pending</button>
            <button class="filter-btn card px-3 py-1 rounded-lg text-sm" data-filter="done">Done</button>
            <span class="text-gray-600 mx-2">|</span>
            <button class="filter-btn card px-3 py-1 rounded-lg text-sm text-red-400" data-filter="P0">P0</button>
            <button class="filter-btn card px-3 py-1 rounded-lg text-sm text-orange-400" data-filter="P1">P1</button>
            <button class="filter-btn card px-3 py-1 rounded-lg text-sm text-yellow-400" data-filter="P2">P2</button>
            <button class="filter-btn card px-3 py-1 rounded-lg text-sm text-green-400" data-filter="P3">P3</button>
            <button class="filter-btn card px-3 py-1 rounded-lg text-sm text-gray-400" data-filter="P4">P4</button>
        </div>

        <!-- Task List -->
        <div id="task-list" class="space-y-2">
            ${tasks.map(t => `
            <div class="task-item card rounded-lg p-4 priority-${t.priority.toLowerCase()} ${t.status === 'done' ? 'task-done' : ''}"
                 data-status="${t.status}" data-priority="${t.priority}" data-title="${t.title.toLowerCase()}">
                <div class="flex items-center justify-between">
                    <div class="flex items-center gap-3">
                        <span class="text-gray-500 text-sm w-12">#${t.id}</span>
                        <span class="text-white font-medium">${escapeHtml(t.title)}</span>
                    </div>
                    <div class="flex items-center gap-2">
                        <span class="text-xs px-2 py-0.5 rounded ${getPriorityClass(t.priority)}">${t.priority}</span>
                        <span class="text-xs px-2 py-0.5 rounded bg-white/10 text-gray-400">${t.effort}</span>
                        <span class="text-xs px-2 py-0.5 rounded ${getStatusClass(t.status)}">${t.status === 'done' ? '✓ Done' : t.status === 'pending' ? '⏳ Pending' : '🔄 Progress'}</span>
                    </div>
                </div>
            </div>
            `).join('')}
        </div>
    </main>

    <footer class="text-center text-gray-500 text-sm py-8 border-t border-white/10">
        <p>Genre Genie Backlog Dashboard • Generated ${new Date().toISOString().split('T')[0]}</p>
        <p class="text-xs mt-1">spotify.houstons.tech</p>
    </footer>

    <script>
        // Filter functionality
        const filterBtns = document.querySelectorAll('.filter-btn');
        const taskItems = document.querySelectorAll('.task-item');
        const searchInput = document.getElementById('search');

        let currentFilter = 'all';
        let searchTerm = '';

        function applyFilters() {
            taskItems.forEach(item => {
                const status = item.dataset.status;
                const priority = item.dataset.priority;
                const title = item.dataset.title;

                let show = true;

                // Status/Priority filter
                if (currentFilter === 'pending') show = status === 'pending';
                else if (currentFilter === 'done') show = status === 'done';
                else if (currentFilter.startsWith('P')) show = priority === currentFilter;

                // Search filter
                if (show && searchTerm) {
                    show = title.includes(searchTerm.toLowerCase());
                }

                item.style.display = show ? 'block' : 'none';
            });
        }

        filterBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                filterBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                currentFilter = btn.dataset.filter;
                applyFilters();
            });
        });

        searchInput.addEventListener('input', (e) => {
            searchTerm = e.target.value;
            applyFilters();
        });
    </script>
</body>
</html>`;

function escapeHtml(text) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function getPriorityClass(p) {
  const classes = {
    P0: 'bg-red-500/20 text-red-400',
    P1: 'bg-orange-500/20 text-orange-400',
    P2: 'bg-yellow-500/20 text-yellow-400',
    P3: 'bg-green-500/20 text-green-400',
    P4: 'bg-gray-500/20 text-gray-400',
  };
  return classes[p] || classes.P4;
}

function getStatusClass(s) {
  if (s === 'done') return 'bg-green-500/20 text-green-400';
  if (s === 'pending') return 'bg-yellow-500/20 text-yellow-400';
  return 'bg-blue-500/20 text-blue-400';
}

fs.writeFileSync(outputPath, html);
console.log(`✅ Generated ${outputPath}`);
console.log(`   ${tasks.length} tasks parsed (${stats.done} done, ${stats.pending} pending)`);
console.log(`   Estimated remaining effort: ~${Math.round(totalEffort)} hours`);
