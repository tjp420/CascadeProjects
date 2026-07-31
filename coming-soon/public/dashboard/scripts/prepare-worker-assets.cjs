#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DIST_ASSETS = path.join(ROOT, 'assets');

const FILES_TO_COPY = [
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
            '$1./scan-wasm-bridge.js$1'
        )
        .replace(
            /(['"])\.\.\/\.\.\/js-es2018\/utils-lib\/simplebeaconignore\.browser\.js(?:\?[^'\"]*)?\1/g,
            '$1./simplebeaconignore.browser.js$1'
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

    console.log('[prepare-worker-assets] Copied worker dependencies into assets');
    console.log('[prepare-worker-assets] Rewrote assets/scan-worker.js imports to local asset paths');
}

if (require.main === module) {
    main();
}
