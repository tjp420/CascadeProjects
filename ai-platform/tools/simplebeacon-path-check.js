#!/usr/bin/env node
/**
 * Verify analyze API path allowlists for the current workspace layout.
 * Exit 0 when CascadeProjects + ai-platform are allowed and system paths are blocked.
 *
 * Usage:
 *   node tools/simplebeacon-path-check.js
 *   node tools/simplebeacon-path-check.js --with-api
 */

const fs = require('fs');
const path = require('path');
const {
    resolveDefaultAllowedRoots,
    assertSafeProjectPath,
    isPathWithinRoots
} = require('../server/lib/path-safety');

const platformRoot = path.join(__dirname, '..');
const monorepoRoot = path.resolve(platformRoot, '..');
const withApi = process.argv.includes('--with-api');

function check(label, fn) {
    try {
        fn();
        console.log(`OK  ${label}`);
        return true;
    } catch (error) {
        console.error(`FAIL ${label}: ${error.message}`);
        return false;
    }
}

function main() {
    const roots = resolveDefaultAllowedRoots(platformRoot, { monorepoRoot });
    console.log('Allowed analysis roots:');
    for (const root of roots) {
        console.log(`  - ${root}`);
    }
    console.log('');

    let passed = 0;
    let total = 0;

    const run = (label, fn) => {
        total += 1;
        if (check(label, fn)) passed += 1;
    };

    run('monorepo root allowed', () => {
        assertSafeProjectPath(monorepoRoot, roots);
    });

    run('ai-platform root allowed', () => {
        assertSafeProjectPath(platformRoot, roots);
    });

    run('Windows system path blocked', () => {
        const windowsRoot = process.platform === 'win32' ? 'C:\\Windows' : '/etc';
        if (isPathWithinRoots(windowsRoot, roots)) {
            throw new Error(`${windowsRoot} must not be within allowed roots`);
        }
        try {
            assertSafeProjectPath(windowsRoot, roots);
            throw new Error('assertSafeProjectPath should have rejected system path');
        } catch (error) {
            if (!/outside allowed analysis roots/i.test(error.message)) {
                throw error;
            }
        }
    });

    run('nested path under E:\\Ai when drive exists', () => {
        if (process.platform !== 'win32' || !fs.existsSync('E:\\Ai')) {
            console.log('SKIP nested path under E:\\Ai (drive not present)');
            return;
        }
        const nested = 'E:\\Ai\\Games\\Doom\\TEst\\results\\23.R3DR00M Unified Advanced Lighting';
        if (!fs.existsSync(nested)) {
            console.log('SKIP nested Doom path (folder not present)');
            return;
        }
        assertSafeProjectPath(nested, roots);
    });

    run('parent traversal blocked', () => {
        const traversal = path.join(platformRoot, '..', '..', 'outside-simplebeacon-root');
        try {
            assertSafeProjectPath(traversal, roots);
            throw new Error('traversal path should be rejected');
        } catch (error) {
            if (!/outside allowed analysis roots/i.test(error.message)) {
                throw error;
            }
        }
    });

    console.log('');
    console.log(`Path check: ${passed}/${total} passed`);
    if (passed !== total) {
        process.exit(1);
    }

    if (withApi) {
        return require('./simplebeacon-analyze-path-smoke.js').main();
    }
}

main();
