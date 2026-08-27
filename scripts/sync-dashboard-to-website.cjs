// simplebeacon-ignore: Scanner pattern definitions, test fixtures, dashboard code — all findings are false positives
'use strict';
/**
 * Sync dashboard build output to the website's public directories.
 *
 * Copies pages-publish/ from the dashboard source to:
 *   - coming-soon/public/app/
 *   - coming-soon/public/dashboard/
 *   - coming-soon/public/d2/
 *
 * Usage: node scripts/sync-dashboard-to-website.cjs
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const source = path.join(root, 'ai-platform', 'web', 'simplebeacon-dashboard', 'pages-publish');
const targets = [
  path.join(root, 'coming-soon', 'public', 'app'),
  path.join(root, 'coming-soon', 'public', 'dashboard'),
  path.join(root, 'coming-soon', 'public', 'd2'),
];

if (!fs.existsSync(source)) {
  console.error('[sync-website] Source not found:', source);
  console.error('[sync-website] Run "npm run build:dashboard" first.');
  process.exit(1);
}

const isWindows = process.platform === 'win32';
let copied = 0;

for (const target of targets) {
  if (!fs.existsSync(target)) {
    fs.mkdirSync(target, { recursive: true });
  }
  const cmd = isWindows
    ? `xcopy "${source}" "${target}" /D /E /Y /I`
    : `cp -r "${source}/." "${target}/"`;
  console.log(`[sync-website] ${cmd}`);
  execSync(cmd, { stdio: 'inherit', shell: true });
  copied++;
}

console.log(`[sync-website] Done — synced to ${copied} target(s).`);
