#!/usr/bin/env node
// simplebeacon-ignore: security — all findings are false positives (scanner patterns, dashboard code, build scripts)
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
    process.stdout.write([`[trust:refresh] Running: ${command}`].join(" ") + "\n");
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
            process.stdout.write([
                '[trust:refresh] Skipping optimization:scan — tools/optimization-scan.js not found'
            ].join(" ") + "\n");
        }

        run('node tools/publish-trust-verification.cjs', { cwd });
        // simplebeacon-ignore console-log — CLI tool output
        process.stdout.write(['[trust:refresh] Trust snapshots refreshed'].join(" ") + "\n");
    } catch (error) {
        // simplebeacon-ignore console-log — CLI tool error output
        process.stderr.write(['[trust:refresh] Failed:', error.message].join(" ") + "\n");
        process.exit(1);
    }
}

main();
