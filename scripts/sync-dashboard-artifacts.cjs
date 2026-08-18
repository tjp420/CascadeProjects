#!/usr/bin/env node
'use strict';

/**
 * Build the React dashboard and promote artifacts into coming-soon/public/dashboard (+ /app mirror).
 * Writes deploy-manifest.json with SHA256 hashes for CI verification.
 *
 * Usage:
 *   node scripts/sync-dashboard-artifacts.cjs
 *   SKIP_DASHBOARD_BUILD=1 node scripts/sync-dashboard-artifacts.cjs   # promote existing assets/ only
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const DASHBOARD_PKG = path.join(REPO_ROOT, 'ai-platform', 'web', 'simplebeacon-dashboard');
const BUILD_ASSETS = path.join(DASHBOARD_PKG, 'assets');
const PUBLIC_DASH = path.join(REPO_ROOT, 'coming-soon', 'public', 'dashboard');
const PUBLIC_APP = path.join(REPO_ROOT, 'coming-soon', 'public', 'app');
const AUDIT_JS_ES2018 = path.join(REPO_ROOT, 'coming-soon', 'public', 'js-es2018');

const PROMOTED = [
  'main.js',
  'main.css',
  'scan-worker.js',
  'scan-wasm-bridge.js',
  'simplebeaconignore.browser.js',
];

function sha256File(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function copyFile(src, dest) {
  ensureDir(path.dirname(dest));
  try {
    fs.copyFileSync(src, dest);
  } catch (err) {
    if (err && (err.code === 'UNKNOWN' || err.code === 'EBUSY' || err.code === 'EPERM')) {
      fs.writeFileSync(dest, fs.readFileSync(src));
    } else {
      throw err;
    }
  }
}

function getGitSha() {
  try {
    return execSync('git rev-parse HEAD', { cwd: REPO_ROOT, encoding: 'utf8' }).trim();
  } catch {
    return 'unknown';
  }
}

function runDashboardBuild() {
  if (process.env.SKIP_DASHBOARD_BUILD === '1') {
    console.log('[sync-dashboard] SKIP_DASHBOARD_BUILD=1 — using existing Vite output');
    return;
  }
  console.log('[sync-dashboard] npm run build →', DASHBOARD_PKG);
  execSync('npm run build', { cwd: DASHBOARD_PKG, stdio: 'inherit' });
}

function copyBuildAssetsTree() {
  if (!fs.existsSync(BUILD_ASSETS)) {
    throw new Error(`Missing Vite output: ${BUILD_ASSETS} (run npm run build in dashboard package)`);
  }
  const destRoot = path.join(PUBLIC_DASH, 'assets');
  ensureDir(destRoot);
  for (const name of fs.readdirSync(BUILD_ASSETS)) {
    const src = path.join(BUILD_ASSETS, name);
    if (!fs.statSync(src).isFile()) continue;
    copyFile(src, path.join(destRoot, name));
  }
}

function promoteCoreArtifacts() {
  const dashAssetsJs = path.join(PUBLIC_DASH, 'assets', 'js');
  ensureDir(dashAssetsJs);
  for (const name of PROMOTED) {
    const src = path.join(BUILD_ASSETS, name);
    if (!fs.existsSync(src)) {
      throw new Error(`Missing promoted artifact: ${src}`);
    }
    copyFile(src, path.join(PUBLIC_DASH, 'assets', name));
  }
  // Mirror every JS bundle next to legacy /assets/js/main.js entrypoints so
  // relative dynamic imports (./TelemetryView-[hash].js) resolve correctly.
  for (const name of fs.readdirSync(BUILD_ASSETS)) {
    if (!name.endsWith('.js') || name.endsWith('.map')) continue;
    copyFile(path.join(BUILD_ASSETS, name), path.join(dashAssetsJs, name));
  }
  copyFile(
    path.join(BUILD_ASSETS, 'scan-worker.js'),
    path.join(PUBLIC_DASH, 'js-es2018', 'workers', 'scan-worker.js')
  );
  ensureDir(AUDIT_JS_ES2018);
  copyFile(
    path.join(BUILD_ASSETS, 'scan-worker.js'),
    path.join(AUDIT_JS_ES2018, 'scan-worker.js')
  );
}

function mirrorToApp() {
  const pairs = [
    ['assets', 'assets'],
    ['deploy-manifest.json', 'deploy-manifest.json'],
  ];
  for (const [relSrc, relDest] of pairs) {
    const src = path.join(PUBLIC_DASH, relSrc);
    const dest = path.join(PUBLIC_APP, relDest);
    if (!fs.existsSync(src)) continue;
    const stat = fs.statSync(src);
    if (stat.isDirectory()) {
      copyDirRecursive(src, dest);
    } else {
      copyFile(src, dest);
    }
  }
}

function copyDirRecursive(srcDir, destDir) {
  ensureDir(destDir);
  for (const name of fs.readdirSync(srcDir)) {
    const src = path.join(srcDir, name);
    const dest = path.join(destDir, name);
    if (fs.statSync(src).isDirectory()) {
      copyDirRecursive(src, dest);
    } else {
      copyFile(src, dest);
    }
  }
}

function patchIndexEntry(indexPath, cacheVersion) {
  if (!fs.existsSync(indexPath)) return;
  let html = fs.readFileSync(indexPath, 'utf8');
  // Canonical entry lives beside Vite chunks: /dashboard/assets/main.js
  html = html.replace(
    /src="\/dashboard\/assets\/js\/main\.js(?:\?[^"']*)?"/g,
    `src="/dashboard/assets/main.js?v=${cacheVersion}"`
  );
  html = html.replace(
    /src="\/dashboard\/assets\/main\.js(?:\?[^"']*)?"/g,
    `src="/dashboard/assets/main.js?v=${cacheVersion}"`
  );
  html = html.replace(
    /src="\/app\/assets\/js\/main\.js(?:\?[^"']*)?"/g,
    `src="/app/assets/main.js?v=${cacheVersion}"`
  );
  html = html.replace(
    /src="\/app\/assets\/main\.js(?:\?[^"']*)?"/g,
    `src="/app/assets/main.js?v=${cacheVersion}"`
  );
  fs.writeFileSync(indexPath, html, 'utf8');
}

function syncHeadersTemplate() {
  const headerBlock = `/assets/*
  Cache-Control: public, max-age=31536000, immutable

/main.js
  Cache-Control: no-store, no-cache, must-revalidate

/js/main.js
  Cache-Control: no-store, no-cache, must-revalidate

/index.html
  Cache-Control: no-store, no-cache, must-revalidate
`;
  fs.writeFileSync(path.join(PUBLIC_DASH, 'assets', '_headers'), headerBlock, 'utf8');
  fs.writeFileSync(path.join(PUBLIC_APP, 'assets', '_headers'), headerBlock, 'utf8');
}

function writeManifest(cacheVersion) {
  const artifacts = {};
  for (const name of PROMOTED) {
    const src = path.join(BUILD_ASSETS, name);
    artifacts[name] = sha256File(src);
  }
  const manifest = {
    builtAt: new Date().toISOString(),
    gitSha: getGitSha(),
    cacheVersion,
    dashboardPackage: 'ai-platform/web/simplebeacon-dashboard',
    artifacts,
  };
  const manifestPath = path.join(PUBLIC_DASH, 'deploy-manifest.json');
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  copyFile(manifestPath, path.join(PUBLIC_APP, 'deploy-manifest.json'));
  return manifest;
}

function main() {
  runDashboardBuild();
  ensureDir(PUBLIC_DASH);
  ensureDir(PUBLIC_APP);
  copyBuildAssetsTree();
  promoteCoreArtifacts();
  syncHeadersTemplate();
  const cacheVersion = process.env.DASHBOARD_CACHE_VERSION || `sb-${Date.now()}`;
  const manifest = writeManifest(cacheVersion);
  patchIndexEntry(path.join(PUBLIC_DASH, 'index.html'), cacheVersion);
  patchIndexEntry(path.join(PUBLIC_DASH, '__entry'), cacheVersion);
  mirrorToApp();
  patchIndexEntry(path.join(PUBLIC_APP, 'index.html'), cacheVersion);
  patchIndexEntry(path.join(PUBLIC_APP, '__entry'), cacheVersion);
  console.log('[sync-dashboard] Promoted artifacts to coming-soon/public/dashboard (+ /app)');
  console.log('[sync-dashboard] gitSha:', manifest.gitSha);
  console.log('[sync-dashboard] cacheVersion:', manifest.cacheVersion);
  for (const [name, hash] of Object.entries(manifest.artifacts)) {
    console.log(`  ${name}: sha256:${hash.slice(0, 16)}…`);
  }
}

if (require.main === module) {
  try {
    main();
  } catch (err) {
    console.error('[sync-dashboard] FAILED:', err.message || err);
    process.exit(1);
  }
}

module.exports = { main, sha256File, PROMOTED };
