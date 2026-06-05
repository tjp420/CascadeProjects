#!/usr/bin/env node
/**
 * Build script: Creates a standalone coming-soon/ folder with embedded ai-platform backend.
 * Use this ONLY when deploying to a host that requires a single self-contained folder.
 * Run: node build-standalone.cjs
 * Output: ./coming-soon-standalone/ (ready to zip and upload)
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const REPO_ROOT = path.resolve(__dirname);
const COMING_SOON = path.join(REPO_ROOT, 'coming-soon');
const OUTPUT = path.join(REPO_ROOT, 'coming-soon-standalone');

const C = {
  reset: '\x1b[0m', green: '\x1b[32m', red: '\x1b[31m',
  yellow: '\x1b[33m', blue: '\x1b[34m', cyan: '\x1b[36m',
};
function log(msg, color = C.reset) { console.log(`${color}${msg}${C.reset}`); }

function copyDir(src, dest) {
  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
  const items = fs.readdirSync(src, { withFileTypes: true });
  for (const item of items) {
    const srcPath = path.join(src, item.name);
    const destPath = path.join(dest, item.name);
    if (item.name === 'node_modules') continue;
    if (item.name.startsWith('.')) continue; // skip hidden files
    if (item.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function rewritePaths(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  content = content.replace(/require\('\.{2}\/ai-platform\//g, "require('./ai-platform/");
  content = content.replace(/path\.join\(__dirname, '\.{2}\/ai-platform'\)/g, "path.join(__dirname, './ai-platform')");
  fs.writeFileSync(filePath, content);
}

// ===== MAIN =====
log('=== SimpleBeacon Standalone Build ===', C.cyan);

// Clean output
if (fs.existsSync(OUTPUT)) {
  fs.rmSync(OUTPUT, { recursive: true });
  log('Cleaned old output', C.yellow);
}
fs.mkdirSync(OUTPUT, { recursive: true });

// 1. Copy coming-soon frontend
log('\n[1/4] Copying coming-soon/ frontend...', C.blue);
copyDir(COMING_SOON, OUTPUT);

// 2. Copy ai-platform backend into output
log('[2/4] Copying ai-platform/ backend...', C.blue);
copyDir(path.join(REPO_ROOT, 'ai-platform', 'src'), path.join(OUTPUT, 'ai-platform', 'src'));
copyDir(path.join(REPO_ROOT, 'ai-platform', 'server'), path.join(OUTPUT, 'ai-platform', 'server'));
copyDir(path.join(REPO_ROOT, 'ai-platform', 'packages'), path.join(OUTPUT, 'ai-platform', 'packages'));

// 3. Rewrite require paths in server.cjs
log('[3/4] Rewriting require paths...', C.blue);
rewritePaths(path.join(OUTPUT, 'server.cjs'));

// 4. Copy root node_modules and package.json into output
log('[4/4] Copying dependencies...', C.blue);
copyDir(path.join(REPO_ROOT, 'node_modules'), path.join(OUTPUT, 'node_modules'));
fs.copyFileSync(path.join(REPO_ROOT, 'package.json'), path.join(OUTPUT, 'package.json'));

// Verify
const serverPath = path.join(OUTPUT, 'server.cjs');
const hasLocalPaths = fs.readFileSync(serverPath, 'utf8').includes("require('./ai-platform/");
if (hasLocalPaths) {
  log('\nPASS: server.cjs uses local ./ai-platform/ paths', C.green);
} else {
  log('\nFAIL: Path rewrite may have failed', C.red);
}

log('\n=== Build Complete ===', C.cyan);
log(`Output: ${OUTPUT}`, C.green);
log('\nTo deploy:', C.blue);
log('  1. Zip the folder: coming-soon-standalone/', C.blue);
log('  2. Upload to your host', C.blue);
log('  3. Start with: node server.cjs', C.blue);
log('\nTo clean up:', C.blue);
log('  rm -rf coming-soon-standalone/', C.blue);
