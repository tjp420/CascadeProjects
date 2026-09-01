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

// Copy all files from ai-platform source (force-copy to avoid stale files from timestamp drift).
// xcopy /D only copies if source is newer, which breaks when dest timestamps get bumped by builds.
const isWindows = process.platform === 'win32';
const cmd = isWindows ? `xcopy "${source}" "${dest}" /E /Y /I` : `cp -r "${source}/." "${dest}/"`;
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

console.log('[sync-dashboard-web] Done');
