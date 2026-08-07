'use strict';

/**
 * Tests for CLI messaging alignment with marketing framing
 *
 * Verifies that the CLI help text, scan output banner, and flag descriptions
 * use the same language as the website homepage:
 *   - "52 deterministic engines" (not "11 analyzers")
 *   - "catch AI code debt that traditional linting misses" (not "detect mock data")
 *   - "Deep Scan" terminology (not just "bypass filters")
 *   - "no upload, no LLM, no false positives" framing
 *
 * Run: node --test scripts/test-cli-messaging.cjs
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.join(__dirname, '..');

function readFile(relPath) {
    return fs.readFileSync(path.join(REPO_ROOT, relPath), 'utf8');
}

// ═══════════════════════════════════════════════
// 1. Help Text Header
// ═══════════════════════════════════════════════

describe('CLI help text header alignment', () => {

    test('help text uses "AI code debt" framing (not "detect mock data")', () => {
        const cli = readFile('packages/simplebeacon-cli/bin/simplebeacon.js');
        assert.match(cli, /catch AI code debt that traditional linting misses/);
        assert.doesNotMatch(cli, /detect mock data, fiction KPIs, and credential leaks/);
    });

    test('help text mentions "52 deterministic engines"', () => {
        const cli = readFile('packages/simplebeacon-cli/bin/simplebeacon.js');
        assert.match(cli, /52 deterministic engines/);
    });

    test('help text mentions "zero LLM dependency"', () => {
        const cli = readFile('packages/simplebeacon-cli/bin/simplebeacon.js');
        assert.match(cli, /zero LLM dependency/);
    });

    test('help text mentions "no upload required"', () => {
        const cli = readFile('packages/simplebeacon-cli/bin/simplebeacon.js');
        assert.match(cli, /no upload required/);
    });
});

// ═══════════════════════════════════════════════
// 2. --complete Flag Description
// ═══════════════════════════════════════════════

describe('--complete flag description alignment', () => {

    test('does not reference "11 analyzers"', () => {
        const cli = readFile('packages/simplebeacon-cli/bin/simplebeacon.js');
        // Should not have "11 analyzers" anywhere
        assert.doesNotMatch(cli, /11 analyzers/);
    });

    test('references "52 deterministic engines"', () => {
        const cli = readFile('packages/simplebeacon-cli/bin/simplebeacon.js');
        // The --complete flag should mention 52 deterministic engines
        const completeMatches = cli.match(/--complete[^]*?52 deterministic engines/g);
        assert.ok(completeMatches && completeMatches.length > 0,
            '--complete flag should reference "52 deterministic engines"');
    });

    test('verbose log uses "52 deterministic engines"', () => {
        const cli = readFile('packages/simplebeacon-cli/bin/simplebeacon.js');
        assert.match(cli, /--complete enabled.*52 deterministic engines/);
    });
});

// ═══════════════════════════════════════════════
// 3. --deep-scan Flag Description
// ═══════════════════════════════════════════════

describe('--deep-scan flag description alignment', () => {

    test('uses "Deep Scan" terminology', () => {
        const cli = readFile('packages/simplebeacon-cli/bin/simplebeacon.js');
        assert.match(cli, /--deep-scan\s+Deep Scan mode/);
    });
});

// ═══════════════════════════════════════════════
// 4. Text Reporter Banner
// ═══════════════════════════════════════════════

describe('text reporter banner alignment', () => {

    test('banner includes "52 deterministic engines"', () => {
        const text = readFile('packages/simplebeacon-cli/src/reporters/text.js');
        assert.match(text, /52 deterministic engines/);
    });

    test('banner includes "AI code debt" framing', () => {
        const text = readFile('packages/simplebeacon-cli/src/reporters/text.js');
        assert.match(text, /catch AI code debt traditional linting misses/);
    });

    test('banner does not use old "detect mock data" tagline', () => {
        const text = readFile('packages/simplebeacon-cli/src/reporters/text.js');
        // The text reporter should not have the old tagline as a header
        const bannerSection = text.slice(0, 2000);
        assert.doesNotMatch(bannerSection, /detect mock data, fiction KPIs/);
    });
});

// ═══════════════════════════════════════════════
// 5. Syntax Validation
// ═══════════════════════════════════════════════

describe('syntax validation', () => {

    test('bin/simplebeacon.js passes node syntax check', () => {
        const { execSync } = require('child_process');
        const filePath = path.join(REPO_ROOT, 'packages/simplebeacon-cli/bin/simplebeacon.js');
        execSync(`node -c "${filePath}"`, { stdio: 'pipe' });
    });

    test('src/reporters/text.js passes node syntax check', () => {
        const { execSync } = require('child_process');
        const filePath = path.join(REPO_ROOT, 'packages/simplebeacon-cli/src/reporters/text.js');
        execSync(`node -c "${filePath}"`, { stdio: 'pipe' });
    });
});

// ═══════════════════════════════════════════════
// 6. Cross-Page Messaging Consistency
// ═══════════════════════════════════════════════

describe('cross-page messaging consistency', () => {

    test('homepage and CLI both mention "52 deterministic engines"', () => {
        const homepage = readFile('coming-soon/public/index.html');
        const cli = readFile('packages/simplebeacon-cli/bin/simplebeacon.js');
        assert.match(homepage, /52 deterministic engines/i);
        assert.match(cli, /52 deterministic engines/i);
    });

    test('homepage and CLI both use "AI code debt" framing', () => {
        const homepage = readFile('coming-soon/public/index.html');
        const cli = readFile('packages/simplebeacon-cli/bin/simplebeacon.js');
        assert.match(homepage, /AI.code debt|code debt/i);
        assert.match(cli, /AI code debt/i);
    });

    test('audit page and CLI both use "Deep Scan" terminology', () => {
        const audit = readFile('coming-soon/public/audit.html');
        const cli = readFile('packages/simplebeacon-cli/bin/simplebeacon.js');
        assert.match(audit, /Deep Scan/i);
        assert.match(cli, /Deep Scan/i);
    });

    test('homepage and CLI both mention "traditional linting"', () => {
        const homepage = readFile('coming-soon/public/index.html');
        const cli = readFile('packages/simplebeacon-cli/bin/simplebeacon.js');
        assert.match(homepage, /traditional linting/i);
        assert.match(cli, /traditional linting/i);
    });
});
