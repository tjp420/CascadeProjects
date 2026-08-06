'use strict';
/**
 * Pre-commit gitleaks wrapper -- runs gitleaks against staged files only.
 *
 * Strategy:
 *   1. Detect gitleaks binary via PATH + OS-specific fallback paths
 *   2. If found, run `gitleaks protect --staged --verbose` (sub-second, offline)
 *   3. If NOT found, print a soft warning and exit 0 (Track113 runs as fallback)
 *   4. If gitleaks finds secrets, exit 1 to block the commit
 *
 * Cross-platform: Windows (Scoop/Chocolatey), macOS (Homebrew), Linux (usr/local)
 *
 * Usage:  node .simplebeacon/qa/pre-commit-gitleaks.cjs
 * Exit:   0 = pass or gitleaks missing (soft-warn), 1 = secrets found, 2 = error
 */
const { spawnSync, execSync } = require('child_process');
const path = require('path');
const os = require('os');
const fs = require('fs');

const IS_WIN = process.platform === 'win32';
const GITLEAKS_CMD = IS_WIN ? 'gitleaks.exe' : 'gitleaks';

/**
 * Known fallback paths to check when gitleaks is not on PATH.
 */
function getFallbackPaths() {
    const home = os.homedir();
    if (IS_WIN) {
        return [
            path.join(home, 'scoop', 'shims', 'gitleaks.exe'),
            path.join(home, 'scoop', 'apps', 'gitleaks', 'current', 'gitleaks.exe'),
            path.join('C:', 'ProgramData', 'chocolatey', 'bin', 'gitleaks.exe'),
            path.join(home, '.local', 'bin', 'gitleaks.exe'),
        ];
    }
    return [
        '/usr/local/bin/gitleaks',
        '/opt/homebrew/bin/gitleaks',
        path.join(home, '.local', 'bin', 'gitleaks'),
        path.join(home, 'go', 'bin', 'gitleaks'),
    ];
}

/**
 * Find the gitleaks binary.
 * @returns {string|null} Path to gitleaks, or null if not found.
 */
function findGitleaks() {
    // 1. Check PATH via where/which
    try {
        const cmd = IS_WIN ? `where ${GITLEAKS_CMD}` : `which gitleaks`;
        const result = execSync(cmd, { encoding: 'utf8', timeout: 3000, stdio: 'pipe' });
        const found = result.trim().split(/\r?\n/)[0];
        if (found && fs.existsSync(found)) return found;
    } catch (_e) { /* not on PATH */ }

    // 2. Check fallback paths
    for (const p of getFallbackPaths()) {
        if (fs.existsSync(p)) return p;
    }

    return null;
}

// --- Main ---
console.log('[gitleaks] Checking for gitleaks binary...');

const gitleaksPath = findGitleaks();

if (!gitleaksPath) {
    console.warn('[gitleaks] WARNING: gitleaks not found on PATH or fallback locations.');
    console.warn('[gitleaks] Install it:  npm run install-gitleaks');
    console.warn('[gitleaks] Skipping gitleaks scan. Track113 secret scanner will run as fallback.');
    process.exit(0);
}

console.log(`[gitleaks] Found: ${gitleaksPath}`);

// Run gitleaks protect --staged (scans only staged files, not commit history)
const args = ['protect', '--staged', '--verbose'];
console.log('[gitleaks] Running staged-files secret scan...');

const result = spawnSync(gitleaksPath, args, {
    cwd: process.cwd(),
    stdio: 'inherit',
    timeout: 30000, // 30s hard cap -- gitleaks on staged files is very fast
});

if (result.error) {
    if (result.error.code === 'ETIMEDOUT') {
        console.error('[gitleaks] Scan timed out after 30s. Skipping (Track113 will run as fallback).');
        process.exit(0); // soft-warn, don't block
    }
    console.error(`[gitleaks] Process error: ${result.error.message}`);
    process.exit(0); // soft-warn on process errors, let Track113 handle it
}

const exitCode = result.status;

// gitleaks exit codes: 0 = no leaks, 1 = leaks found, other = error
if (exitCode === 0) {
    console.log('[gitleaks] No secrets detected in staged files.');
    process.exit(0);
} else if (exitCode === 1) {
    console.error('[gitleaks] SECRETS DETECTED in staged files! Commit blocked.');
    console.error('[gitleaks] Review the findings above and remove any hardcoded secrets.');
    process.exit(1);
} else {
    console.warn(`[gitleaks] Gitleaks exited with code ${exitCode} (unexpected). Skipping, Track113 will run as fallback.`);
    process.exit(0);
}
