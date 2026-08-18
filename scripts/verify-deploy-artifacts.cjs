#!/usr/bin/env node
'use strict';

/**
 * Verify promoted dashboard artifacts match deploy-manifest.json.
 * Optionally rebuild and fail if promotion would change hashes (--strict-sync).
 *
 * Usage:
 *   node scripts/verify-deploy-artifacts.cjs
 *   node scripts/verify-deploy-artifacts.cjs --strict-sync
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { sha256File, PROMOTED, main: syncDashboard } = require('./sync-dashboard-artifacts.cjs');

const REPO_ROOT = path.resolve(__dirname, '..');
const PUBLIC_DASH = path.join(REPO_ROOT, 'coming-soon', 'public', 'dashboard');
const PUBLIC_APP = path.join(REPO_ROOT, 'coming-soon', 'public', 'app');
const MANIFEST_PATH = path.join(PUBLIC_DASH, 'deploy-manifest.json');

function fail(msg) {
  console.error(`[verify-deploy] FAIL: ${msg}`);
  process.exitCode = 1;
}

function pass(msg) {
  console.log(`[verify-deploy] PASS: ${msg}`);
}

function readManifest() {
  if (!fs.existsSync(MANIFEST_PATH)) {
    fail(`Missing ${path.relative(REPO_ROOT, MANIFEST_PATH)} — run: npm run sync:dashboard`);
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
  } catch (err) {
    fail(`Invalid manifest JSON: ${err.message}`);
    return null;
  }
}

function verifyArtifactHashes(manifest) {
  let ok = true;
  for (const name of PROMOTED) {
    const expected = manifest.artifacts && manifest.artifacts[name];
    if (!expected) {
      fail(`Manifest missing hash for ${name}`);
      ok = false;
      continue;
    }
    for (const rel of [
      path.join('assets', name),
      path.join('assets', 'js', name),
    ]) {
      const filePath = path.join(PUBLIC_DASH, rel);
      if (!fs.existsSync(filePath)) {
        fail(`Missing promoted file: coming-soon/public/dashboard/${rel.replace(/\\/g, '/')}`);
        ok = false;
        continue;
      }
      const actual = sha256File(filePath);
      if (actual !== expected) {
        fail(`${rel} hash mismatch (run npm run sync:dashboard)`);
        ok = false;
      }
    }
  }
  if (ok) pass('Dashboard artifact hashes match deploy-manifest.json');
  return ok;
}

function verifyAppMirror(manifest) {
  const appManifest = path.join(PUBLIC_APP, 'deploy-manifest.json');
  if (!fs.existsSync(appManifest)) {
    fail('Missing coming-soon/public/app/deploy-manifest.json');
    return false;
  }
  const app = JSON.parse(fs.readFileSync(appManifest, 'utf8'));
  if (app.cacheVersion !== manifest.cacheVersion) {
    fail('/app deploy-manifest cacheVersion differs from /dashboard');
    return false;
  }
  pass('/app mirror manifest matches /dashboard');
  return true;
}

function verifyIndexCacheBust(manifest) {
  const indexPath = path.join(PUBLIC_DASH, 'index.html');
  if (!fs.existsSync(indexPath)) {
    fail('Missing coming-soon/public/dashboard/index.html');
    return false;
  }
  const html = fs.readFileSync(indexPath, 'utf8');
  const v = manifest.cacheVersion || '';
  if (v && !html.includes(`main.js?v=${v}`)) {
    fail(`index.html missing cache bust main.js?v=${v}`);
    return false;
  }
  if (html.includes('/dashboard/assets/js/main.js')) {
    fail('index.html still loads /dashboard/assets/js/main.js — lazy chunks will 404 (use /dashboard/assets/main.js)');
    return false;
  }
  pass('index.html references manifest cacheVersion at /dashboard/assets/main.js');
  return true;
}

function verifyLazyChunksColocated() {
  const mainPath = path.join(PUBLIC_DASH, 'assets', 'main.js');
  if (!fs.existsSync(mainPath)) {
    fail('Missing coming-soon/public/dashboard/assets/main.js');
    return false;
  }
  const mainDir = path.dirname(mainPath);
  const content = fs.readFileSync(mainPath, 'utf8');
  const chunks = [...content.matchAll(/\.\/([A-Za-z0-9_.-]+-[A-Za-z0-9_.-]+\.js)/g)].map((m) => m[1]);
  let ok = true;
  for (const chunk of new Set(chunks)) {
    const chunkPath = path.join(mainDir, chunk);
    if (!fs.existsSync(chunkPath)) {
      fail(`main.js imports ./${chunk} but ${path.relative(REPO_ROOT, chunkPath)} is missing`);
      ok = false;
    }
  }
  if (ok) pass(`Lazy chunks colocated with main.js (${new Set(chunks).size} relative imports)`);
  return ok;
}

function runEntrySyncCheck() {
  try {
    execSync('node scripts/check-entry-sync.cjs', { cwd: REPO_ROOT, stdio: 'inherit' });
    pass('check-entry-sync.cjs');
    return true;
  } catch {
    fail('check-entry-sync.cjs');
    return false;
  }
}

function main() {
  const strictSync = process.argv.includes('--strict-sync');
  if (strictSync) {
    console.log('[verify-deploy] --strict-sync: rebuilding and comparing artifact hashes…');
    const beforeManifest = readManifest();
    if (!beforeManifest) return;
    syncDashboard();
    const afterManifest = readManifest();
    if (!afterManifest) return;
    for (const name of PROMOTED) {
      const beforeHash = beforeManifest.artifacts && beforeManifest.artifacts[name];
      const afterHash = afterManifest.artifacts && afterManifest.artifacts[name];
      if (beforeHash !== afterHash) {
        fail(`Artifact ${name} changed after rebuild — run npm run sync:dashboard and commit`);
      }
    }
    pass('Strict sync: promoted artifact hashes unchanged after rebuild');
  }

  const manifest = readManifest();
  if (!manifest) return;

  verifyArtifactHashes(manifest);
  verifyAppMirror(manifest);
  verifyIndexCacheBust(manifest);
  verifyLazyChunksColocated();
  if (process.argv.includes('--with-entry-sync')) {
    runEntrySyncCheck();
  } else {
    console.log('[verify-deploy] Skipping check-entry-sync (pass --with-entry-sync to enable)');
  }

  if (process.exitCode) {
    console.error('\n[verify-deploy] Fix: npm run sync:dashboard && commit promoted artifacts');
  } else {
    console.log('\n[verify-deploy] All checks passed.');
  }
}

if (require.main === module) {
  main();
}
