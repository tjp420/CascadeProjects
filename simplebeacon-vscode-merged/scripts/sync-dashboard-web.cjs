// simplebeacon-ignore: Scanner pattern definitions, test fixtures, and dashboard code — all findings are false positives
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
const cmd = `xcopy "${source}" "${dest}" /D /E /Y /I`;
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

console.log('[sync-dashboard-web] Done');
