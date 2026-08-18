#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DIST_ASSETS = path.join(ROOT, 'assets');

const FILES_TO_COPY = [
  {
    src: path.join(ROOT, 'js-es2018', 'workers', 'scan-worker.js'),
    dest: path.join(DIST_ASSETS, 'scan-worker.js')
  },
  {
    src: path.join(ROOT, 'js-es2018', 'workers', 'scan-wasm-bridge.js'),
    dest: path.join(DIST_ASSETS, 'scan-wasm-bridge.js')
  },
  {
    src: path.join(ROOT, 'js-es2018', 'utils-lib', 'simplebeaconignore.browser.js'),
    dest: path.join(DIST_ASSETS, 'simplebeaconignore.browser.js')
  }
];

function copyFileSafe(src, dest) {
  if (!fs.existsSync(src)) {
    throw new Error(`Missing source file: ${src}`);
  }
  fs.copyFileSync(src, dest);
}

function rewriteWorkerImports(scanWorkerPath) {
  if (!fs.existsSync(scanWorkerPath)) {
    throw new Error(`Missing built worker file: ${scanWorkerPath}`);
  }

  const original = fs.readFileSync(scanWorkerPath, 'utf8');

  const rewritten = original
    .replace(
      /(['"])\.\.\/\.\.\/js-es2018\/workers\/scan-wasm-bridge\.js(?:\?[^'\"]*)?\1/g,
      "$1./scan-wasm-bridge.js$1"
    )
    .replace(
      /(['"])\.\.\/\.\.\/js-es2018\/utils-lib\/simplebeaconignore\.browser\.js(?:\?[^'\"]*)?\1/g,
      "$1./simplebeaconignore.browser.js$1"
    );

  if (original !== rewritten) {
    fs.writeFileSync(scanWorkerPath, rewritten, 'utf8');
  }
}

function main() {
  if (!fs.existsSync(DIST_ASSETS)) {
    throw new Error(`Missing dist assets directory: ${DIST_ASSETS}`);
  }

  for (const entry of FILES_TO_COPY) {
    copyFileSafe(entry.src, entry.dest);
  }

  rewriteWorkerImports(path.join(DIST_ASSETS, 'scan-worker.js'));

  // Copy hashed main entry to unhashed main.js for legacy index.html compatibility.
  let entryMatch = null;
  let entryPath = null;
  const jsDir = path.join(DIST_ASSETS, 'js');
  if (fs.existsSync(jsDir)) {
    entryMatch = fs.readdirSync(jsDir).find(
      f => /^main-[a-zA-Z0-9_-]+\.js$/.test(f) && !f.endsWith('.map')
    );
    if (entryMatch) entryPath = path.join(jsDir, entryMatch);
  }
  if (!entryMatch) {
    entryMatch = fs.readdirSync(DIST_ASSETS).find(
      f => /^main-[a-zA-Z0-9_-]+\.js$/.test(f) && !f.endsWith('.map')
    );
    if (entryMatch) entryPath = path.join(DIST_ASSETS, entryMatch);
  }
  if (entryMatch && entryPath) {
    const jsMainPath = path.join(jsDir, 'main.js');
    fs.copyFileSync(entryPath, jsMainPath);
    console.log(`[prepare-worker-assets] Copied ${entryMatch} → js/main.js`);
    // Legacy entry HTML loads /dashboard/assets/main.js (not js/main.js)
    fs.copyFileSync(entryPath, path.join(DIST_ASSETS, 'main.js'));
    console.log(`[prepare-worker-assets] Copied ${entryMatch} → main.js`);

    const chunkDirs = [DIST_ASSETS, jsDir].filter(d => fs.existsSync(d));
    for (const dir of chunkDirs) {
      const chunkFiles = fs.readdirSync(dir).filter(
        f => /\.js$/.test(f) && !f.endsWith('.map') && f !== entryMatch && f !== 'main.js'
      );
      for (const chunkFile of chunkFiles) {
        const chunkPath = path.join(dir, chunkFile);
        const original = fs.readFileSync(chunkPath, 'utf8');
        const rewritten = original.replace(
          new RegExp(`from"\\./${entryMatch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`, 'g'),
          'from"./main.js"'
        );
        if (original !== rewritten) {
          fs.writeFileSync(chunkPath, rewritten, 'utf8');
          console.log(`[prepare-worker-assets] Rewrote main import in ${chunkFile}`);
        }
      }
    }
  } else {
    console.warn('[prepare-worker-assets] No hashed main entry found — skipping unhashed copy');
  }

  // Copy hashed main CSS to unhashed main.css for index.html compatibility.
  let cssMatch = null;
  const cssAssetDir = path.join(DIST_ASSETS, 'assets');
  if (fs.existsSync(cssAssetDir)) {
    cssMatch = fs.readdirSync(cssAssetDir).find(f => /^main-[a-zA-Z0-9_-]+\.css$/.test(f));
  }
  if (!cssMatch) {
    cssMatch = fs.readdirSync(DIST_ASSETS).find(f => /^main-[a-zA-Z0-9_-]+\.css$/.test(f));
  }
  if (cssMatch) {
    const cssDirs = [
      path.join(DIST_ASSETS, 'assets', cssMatch),
      path.join(DIST_ASSETS, cssMatch)
    ].filter(p => fs.existsSync(p));
    if (cssDirs.length) {
      fs.copyFileSync(cssDirs[0], path.join(DIST_ASSETS, 'main.css'));
      console.log(`[prepare-worker-assets] Copied ${cssMatch} → main.css`);
    }
  } else {
    console.warn('[prepare-worker-assets] No hashed main CSS found — skipping unhashed copy');
  }

  if (!fs.existsSync(path.join(jsDir, 'main.js'))) {
    console.warn('[prepare-worker-assets] js/main.js missing — index.html should load js/main-[hash].js directly');
  } else {
    const mainJsContent = fs.readFileSync(path.join(jsDir, 'main.js'), 'utf8');
    const chunkRefs = [...mainJsContent.matchAll(/["']([a-zA-Z0-9_-]+-[a-zA-Z0-9_-]+\.js)["']/g)].map(m => m[1]);
    const missingChunks = chunkRefs.filter(ref => {
      return !fs.existsSync(path.join(DIST_ASSETS, ref)) &&
        !fs.existsSync(path.join(DIST_ASSETS, 'js', ref));
    });
    if (missingChunks.length > 0) {
      console.error(`[prepare-worker-assets] FATAL: main.js references missing chunks: ${missingChunks.join(', ')}`);
      console.error('[prepare-worker-assets] Run "npm run build" again to regenerate all assets.');
      process.exit(1);
    }
    console.log(`[prepare-worker-assets] Verified ${chunkRefs.length} chunk references in main.js — all exist on disk`);
  }

  console.log('[prepare-worker-assets] Copied worker dependencies into assets');
  console.log('[prepare-worker-assets] Rewrote assets/scan-worker.js imports to local asset paths');
}

if (require.main === module) {
  main();
}
