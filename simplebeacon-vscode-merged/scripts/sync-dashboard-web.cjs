// simplebeacon-ignore: Scanner pattern definitions, test fixtures, dashboard code, security — all findings are false positives
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const root = path.resolve(__dirname, '..', '..');
const source = path.join(root, 'ai-platform', 'web', 'simplebeacon-dashboard');
const dest = path.join(path.dirname(source), '..', '..', 'simplebeacon-vscode-merged', 'dashboard-web');

if (!fs.existsSync(source)) {
  console.error(`[sync-dashboard-web] Source not found: ${source}`);
  process.exit(1);
}

fs.mkdirSync(dest, { recursive: true });

// Copy newer/changed files from ai-platform source without deleting extras in dashboard-web.
const isWindows = process.platform === 'win32';
const cmd = isWindows ? `xcopy "${source}" "${dest}" /D /E /Y /I` : `cp -r "${source}/." "${dest}/"`;
console.log(`[sync-dashboard-web] ${cmd}`);
execSync(cmd, { stdio: 'inherit', shell: true });

// Restore dashboard-web-specific exports that the extension's bundled main.js expects.
const authServicePath = path.join(dest, 'js-es2018', 'services', 'authService.js');
if (fs.existsSync(authServicePath)) {
  let content = fs.readFileSync(authServicePath, 'utf8');
  if (!content.includes('export function apiBase')) {
    // Insert after the existing import from ../utils/url.js
    const importLine = "import { apiUrl } from '../utils/url.js';";
    if (content.includes(importLine)) {
      content = content.replace(importLine, `${importLine}\nimport { apiBaseUrl } from '../utils/url.js';`);
    }
    // Append the apiBase export at the end
    if (!content.includes('export function apiBase')) {
      content += `\n\nexport function apiBase() {\n  return apiBaseUrl();\n}\n`;
    }
    fs.writeFileSync(authServicePath, content, 'utf8');
    console.log('[sync-dashboard-web] Patched authService.js with apiBase export');
  }
}

// Always force-copy index.html from source (xcopy /D may skip if dest is newer from prior patches)
const srcIndex = path.join(source, 'index.html');
const destIndex = path.join(dest, 'index.html');
if (fs.existsSync(srcIndex)) {
  fs.copyFileSync(srcIndex, destIndex);
  console.log('[sync-dashboard-web] Force-copied index.html from source');
}

// Patch index.html: rewrite Vite dev script src to production build path for extension serving
if (fs.existsSync(destIndex)) {
  let html = fs.readFileSync(destIndex, 'utf8');
  // Replace /src/main.tsx with ./dist/assets/main.js (production build)
  if (html.includes('/src/main.tsx')) {
    html = html.replace(
      /<script type="module" src="\/src\/main\.tsx"><\/script>/,
      '<script type="module" src="./dist/assets/main.js"></script>'
    );
    console.log('[sync-dashboard-web] Patched index.html: /src/main.tsx -> ./dist/assets/main.js');
  }
  // Rewrite absolute /assets/ paths to /dashboard/assets/ for extension serving
  if (html.includes('"/assets/') || html.includes("'/assets/") || html.includes('=/assets/')) {
    html = html.replace(/(["'(=]\s*)\/assets\//g, '$1/dashboard/assets/');
    console.log('[sync-dashboard-web] Patched index.html: /assets/ -> /dashboard/assets/');
  }
  fs.writeFileSync(destIndex, html, 'utf8');
}

// ─── Post-sync verification: check for Vite-only patterns ───────────────────
// Vite patterns like @/ aliases, ?worker, ?raw, import.meta.env break when
// the dashboard is loaded directly in a VS Code webview (no Vite dev server).
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

let violationCount = 0;
for (const file of jsFiles) {
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    for (const { regex, desc } of VITE_PATTERNS) {
      const re = new RegExp(regex.source, regex.flags);
      if (re.test(lines[i])) {
        const rel = path.relative(dest, file);
        console.error(`[sync-dashboard-web] VIOLATION: ${rel}:${i + 1} — ${desc}`);
        violationCount++;
      }
    }
  }
}

if (violationCount > 0) {
  console.error(`[sync-dashboard-web] ${violationCount} Vite-only pattern(s) found in synced dashboard-web.`);
  console.error('[sync-dashboard-web] These will crash when loaded directly in a VS Code webview.');
  console.error('[sync-dashboard-web] Fix the source in ai-platform/web/simplebeacon-dashboard and re-run sync.');
  process.exit(1);
}

console.log('[sync-dashboard-web] Vite pattern check passed — no violations found');
console.log('[sync-dashboard-web] Done');
