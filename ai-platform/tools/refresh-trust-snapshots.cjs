#!/usr/bin/env node
'use strict';

/**
 * Refresh Simplebeacon trust snapshots.
 * Runs the platform gate scan and publishes the current verification payload.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function run(command, options) {
    // simplebeacon-ignore console-log — CLI tool output
    console.log(`[trust:refresh] Running: ${command}`);
    execSync(command, { stdio: 'inherit', ...options });
}

function main() {
    const cwd = process.cwd();
    const optimizationScanPath = path.join(cwd, 'tools', 'optimization-scan.js');

    try {
        run('npm run simplebeacon', { cwd });

        if (fs.existsSync(optimizationScanPath)) {
            run('npm run optimization:scan', { cwd });
        } else {
            // simplebeacon-ignore console-log — CLI tool output
            console.log('[trust:refresh] Skipping optimization:scan — tools/optimization-scan.js not found');
        }

        run('node tools/publish-trust-verification.cjs', { cwd });
        // simplebeacon-ignore console-log — CLI tool output
        console.log('[trust:refresh] Trust snapshots refreshed');
    } catch (error) {
        // simplebeacon-ignore console-log — CLI tool error output
        console.error('[trust:refresh] Failed:', error.message);
        process.exit(1);
    }
}

main();
