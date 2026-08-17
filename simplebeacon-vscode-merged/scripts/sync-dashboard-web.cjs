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

// Copy all files from source (no /D — dest must not win when mtime is newer but content is stale).
const cmd = `xcopy "${source}" "${dest}" /E /Y /I`;
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
      content = content.replace(
        importLine,
        `${importLine}\nimport { apiBaseUrl } from '../utils/url.js';`
      );
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
  try {
    fs.copyFileSync(srcIndex, destIndex);
    console.log('[sync-dashboard-web] Force-copied index.html from source');
  } catch (err) {
    console.warn(`[sync-dashboard-web] Skipped index.html force-copy (${err.code || err.message}) — using xcopy result`);
  }
}

function safeCopyFile(src, dst) {
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  try {
    fs.copyFileSync(src, dst);
  } catch (err) {
    if (err && (err.code === 'UNKNOWN' || err.code === 'EBUSY' || err.code === 'EPERM')) {
      fs.writeFileSync(dst, fs.readFileSync(src));
    } else {
      throw err;
    }
  }
}

// Force-copy files that must stay in sync (xcopy /D may skip when dest mtime is newer)
for (const rel of [
  'js-es2018/utils/dashboard-export.browser.js',
  'js/utils/dashboard-export.browser.js',
  'js-es2018/utils.js',
  'js/utils.js',
  'js-es2018/services/analyzeService.js',
  'js-es2018/services/scanService.js',
  'js-es2018/lib/analyzePathSuggestions.js',
  'js-es2018/lib/analyzePathSources.js',
  'js-es2018/views/AnalyzeView.js',
  'js-es2018/views/AnalyzePathSection.js',
  'js-es2018/views/DashboardView.js',
  'js-es2018/utils-lib/har-exporter.js',
  'js/lib/analyzePathSuggestions.js',
  'js/services/analyzeService.js',
  'js/services/scanService.js'
]) {
  const src = path.join(source, rel);
  const dst = path.join(dest, rel);
  if (fs.existsSync(src)) {
    safeCopyFile(src, dst);
    console.log(`[sync-dashboard-web] Force-copied ${rel}`);
  }
}

// Patch index.html: rewrite Vite dev script src to production build path for extension serving
if (fs.existsSync(destIndex)) {
  let html = fs.readFileSync(destIndex, 'utf8');
  // Replace /src/main.tsx with ./dist/assets/main.js (production build)
  if (html.includes('/src/main.tsx')) {
    html = html.replace(/<script type="module" src="\/src\/main\.tsx"><\/script>/, '<script type="module" src="./dist/assets/main.js"></script>');
    console.log('[sync-dashboard-web] Patched index.html: /src/main.tsx -> ./dist/assets/main.js');
  }
  // Rewrite absolute /assets/ paths to /dashboard/assets/ for extension serving
  if (html.includes('"/assets/') || html.includes("'/assets/") || html.includes('=/assets/')) {
    html = html.replace(/(["'(=]\s*)\/assets\//g, '$1/dashboard/assets/');
    console.log('[sync-dashboard-web] Patched index.html: /assets/ -> /dashboard/assets/');
  }
  fs.writeFileSync(destIndex, html, 'utf8');
}

console.log('[sync-dashboard-web] Done');
