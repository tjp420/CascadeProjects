#!/usr/bin/env node
/**
 * Verify src/web/export-system.js remains a lightweight compatibility shim.
 * Cross-platform replacement for scripts/check-export-system-sync.sh
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const src = path.join(root, 'src', 'web', 'export-system.js');
const runtime = path.join(root, 'web', 'scripts', 'export-system.js');

function main() {
    if (!fs.existsSync(src) || !fs.existsSync(runtime)) {
        console.error('Missing export-system.js file(s).');
        console.error(`Expected: ${src}`);
        console.error(`         ${runtime}`);
        process.exit(1);
    }

    const content = fs.readFileSync(src, 'utf8');
    if (!content.includes('/scripts/export-system.js')) {
        console.error('src/web/export-system.js is not the expected compatibility shim.');
        console.error('Run: npm run export-system:sync --prefix ai-platform');
        process.exit(1);
    }

    console.log('export-system compatibility shim is in place.');
}

main();
