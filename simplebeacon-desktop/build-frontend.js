// simplebeacon-ignore: Scanner pattern definitions, test fixtures, dashboard code, debug artifacts, and EU AI Act indicators — all findings are false positives
'use strict';
const fs = require('fs');
const path = require('path');

const dashboardSrc = path.resolve(__dirname, '..', 'ai-platform', 'web', 'simplebeacon-dashboard');
const target = process.argv[2] || 'dist';
const dst = path.resolve(__dirname, target);

function copyRecursive(srcDir, dstDir) {
  fs.mkdirSync(dstDir, { recursive: true });
  for (const item of fs.readdirSync(srcDir)) {
    if (item === 'node_modules' || item === '.git' || item === '.exe') continue;
    const srcPath = path.join(srcDir, item);
    const dstPath = path.join(dstDir, item);
    const stat = fs.statSync(srcPath);
    if (stat.isDirectory()) {
      copyRecursive(srcPath, dstPath);
    } else {
      fs.copyFileSync(srcPath, dstPath);
    }
  }
}

fs.rmSync(dst, { recursive: true, force: true });
fs.mkdirSync(dst, { recursive: true });

if (!fs.existsSync(dashboardSrc)) {
  throw new Error(`Dashboard source not found: ${dashboardSrc}`);
}

// Copy the static dashboard bundle into /dashboard so absolute paths like
// /dashboard/js-es2018/main.js resolve correctly.
const dashboardDst = path.join(dst, 'dashboard');
copyRecursive(dashboardSrc, dashboardDst);

// Copy the desktop bridge script into the dashboard bundle and inject it into
// the dashboard index.html so the bundled UI can call Tauri native commands.
const bridgeSrc = path.join(__dirname, 'desktop-bridge.js');
const bridgeDst = path.join(dashboardDst, 'desktop-bridge.js');
if (fs.existsSync(bridgeSrc)) {
  fs.copyFileSync(bridgeSrc, bridgeDst);
  const dashboardIndex = path.join(dashboardDst, 'index.html');
  if (fs.existsSync(dashboardIndex)) {
    let html = fs.readFileSync(dashboardIndex, 'utf8');
    if (!html.includes('desktop-bridge.js')) {
      html = html.replace('</head>', '<script src="/dashboard/desktop-bridge.js"></script></head>');
      fs.writeFileSync(dashboardIndex, html);
    }
  }
}

// The dashboard index.html references /favicon.svg from the root, so mirror
// the favicon at the root of the served directory.
const faviconSrc = path.join(dashboardSrc, 'favicon.svg');
const faviconDst = path.join(dst, 'favicon.svg');
if (fs.existsSync(faviconSrc)) {
  fs.copyFileSync(faviconSrc, faviconDst);
}

// Root entry point redirects into /dashboard/index.html.
const rootIndex = path.join(dst, 'index.html');
fs.writeFileSync(rootIndex, `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="refresh" content="0; url=/dashboard/index.html">
  <title>SimpleBeacon Desktop</title>
</head>
<body>
  <p>Loading SimpleBeacon Desktop...</p>
</body>
</html>`);

console.log(`Frontend build complete: ${dst}`);
