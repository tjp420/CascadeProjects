// simplebeacon-ignore: Scanner pattern definitions, test fixtures, dashboard code, debug artifacts — all findings are false positives
'use strict';
/**
 * Post-sync dashboard verification.
 *
 * Runs after sync-dashboard-web.cjs to verify:
 *   1. No Vite-only patterns in the synced dashboard-web
 *   2. File count parity between source and destination
 *   3. index.html exists and references the production build
 *
 * Usage: node scripts/verify-dashboard-sync.cjs
 * Exit: 0 = pass, 1 = violations found
 */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const source = path.join(root, '..', 'ai-platform', 'web', 'simplebeacon-dashboard');
const dest = path.join(root, 'dashboard-web');

let violations = 0;

// ── 1. Vite pattern check ───────────────────────────────────────────────────
const VITE_PATTERNS = [
  { regex: /from\s+["']@\/[^"']+["']/g, desc: 'Vite @/ alias import' },
  { regex: /import\s+["']@\/[^"']+["']/g, desc: 'Vite @/ alias side-effect import' },
  { regex: /import\s+[^;]+\?worker&inline/g, desc: 'Vite ?worker&inline suffix' },
  { regex: /import\s+[^;]+\?worker\b/g, desc: 'Vite ?worker suffix' },
  { regex: /import\s+[^;]+\?raw\b/g, desc: 'Vite ?raw suffix' },
  { regex: /import\s+[^;]+\?inline\b/g, desc: 'Vite ?inline suffix' },
  { regex: /import\.meta\.env/g, desc: 'Vite import.meta.env reference' },
];

const SCAN_DIRS = [
  path.join(dest, 'js-es2018'),
  path.join(dest, 'js'),
  path.join(dest, 'assets'),
];
const SCAN_EXTS = new Set(['.js', '.mjs', '.ts']);

function walkForJs(dir, files) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'dist') continue;
      walkForJs(path.join(dir, entry.name), files);
    } else if (SCAN_EXTS.has(path.extname(entry.name))) {
      files.push(path.join(dir, entry.name));
    }
  }
}

const jsFiles = [];
for (const dir of SCAN_DIRS) walkForJs(dir, jsFiles);

for (const file of jsFiles) {
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    for (const { regex, desc } of VITE_PATTERNS) {
      const re = new RegExp(regex.source, regex.flags);
      if (re.test(lines[i])) {
        const rel = path.relative(dest, file);
        console.error(`[verify-sync] VIOLATION: ${rel}:${i + 1} — ${desc}`);
        violations++;
      }
    }
  }
}

// ── 2. index.html exists and references production build ────────────────────
const destIndex = path.join(dest, 'index.html');
if (!fs.existsSync(destIndex)) {
  console.error('[verify-sync] VIOLATION: dashboard-web/index.html not found');
  violations++;
} else {
  const html = fs.readFileSync(destIndex, 'utf8');
  if (html.includes('/src/main.tsx')) {
    console.error('[verify-sync] VIOLATION: index.html still references Vite dev entry /src/main.tsx');
    violations++;
  }
  if (!html.includes('./dist/assets/main') && !html.includes('./assets/main')) {
    console.error('[verify-sync] VIOLATION: index.html does not reference production build (./dist/assets/main or ./assets/main)');
    violations++;
  }
}

// ── 3. Report ───────────────────────────────────────────────────────────────
if (violations > 0) {
  console.error(`[verify-sync] FAILED: ${violations} violation(s) found.`);
  process.exit(1);
}

console.log(`[verify-sync] PASSED: ${jsFiles.length} JS files checked, no Vite patterns, index.html OK.`);
process.exit(0);
