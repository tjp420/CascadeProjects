'use strict';

/**
 * Tests for dynamic GA4 Measurement ID injection
 *
 * Verifies:
 * 1. wrangler.jsonc has GA_MEASUREMENT_ID var
 * 2. worker.js uses HTMLRewriter to inject meta tag
 * 3. All three HTML pages read GA_ID from meta tag (not hardcoded)
 * 4. No hardcoded GA IDs in any HTML file
 * 5. Worker sanitizes the GA ID (strips non-alphanumeric chars)
 *
 * Run: node --test scripts/test-ga-injection.cjs
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
// 1. Wrangler Configuration
// ═══════════════════════════════════════════════

describe('wrangler.jsonc GA configuration', () => {

    test('wrangler.jsonc has GA_MEASUREMENT_ID var', () => {
        const wrangler = readFile('worker-deploy/wrangler.jsonc');
        assert.match(wrangler, /GA_MEASUREMENT_ID/);
    });

    test('GA_MEASUREMENT_ID defaults to empty string', () => {
        const wrangler = readFile('worker-deploy/wrangler.jsonc');
        // Should be empty string — no hardcoded ID in config
        assert.match(wrangler, /GA_MEASUREMENT_ID.*:\s*""/);
    });

    test('GA_MEASUREMENT_ID is in vars section', () => {
        const wrangler = readFile('worker-deploy/wrangler.jsonc');
        // Verify it's within the vars block
        const varsMatch = wrangler.match(/"vars"\s*:\s*\{([^}]*)\}/s);
        assert.ok(varsMatch, 'vars section must exist');
        assert.match(varsMatch[1], /GA_MEASUREMENT_ID/);
    });
});

// ═══════════════════════════════════════════════
// 2. Worker HTMLRewriter Injection
// ═══════════════════════════════════════════════

describe('worker.js HTMLRewriter injection', () => {

    test('worker.js reads GA_MEASUREMENT_ID from env', () => {
        const worker = readFile('worker-deploy/src/worker.js');
        assert.match(worker, /env\.GA_MEASUREMENT_ID/);
    });

    test('worker.js uses HTMLRewriter', () => {
        const worker = readFile('worker-deploy/src/worker.js');
        assert.match(worker, /HTMLRewriter/);
    });

    test('worker.js injects meta tag into head', () => {
        const worker = readFile('worker-deploy/src/worker.js');
        assert.match(worker, /meta\s+name="ga-id"/);
        assert.match(worker, /\.on\('head'/);
    });

    test('worker.js sanitizes GA ID (strips non-alphanumeric)', () => {
        const worker = readFile('worker-deploy/src/worker.js');
        // Should have a regex that strips dangerous chars from the GA ID
        assert.match(worker, /replace\([^)]*a-zA-Z0-9[^)]*\)/);
    });

    test('worker.js only injects for HTML responses', () => {
        const worker = readFile('worker-deploy/src/worker.js');
        // Should check Content-Type or file extension
        assert.match(worker, /text\/html/i);
    });

    test('worker.js skips injection when GA_ID is empty', () => {
        const worker = readFile('worker-deploy/src/worker.js');
        // The condition should check gaId is truthy before rewriting
        assert.match(worker, /if\s*\(gaId\s*&&\s*isHtml\)/);
    });

    test('worker.js passes node syntax check', () => {
        const { execSync } = require('child_process');
        const filePath = path.join(REPO_ROOT, 'worker-deploy/src/worker.js');
        execSync(`node -c "${filePath}"`, { stdio: 'pipe' });
    });
});

// ═══════════════════════════════════════════════
// 3. HTML Pages Read GA_ID from Meta Tag
// ═══════════════════════════════════════════════

describe('HTML pages read GA_ID from meta tag', () => {

    test('homepage reads GA_ID from meta tag', () => {
        const html = readFile('coming-soon/public/index.html');
        assert.match(html, /meta\[name='ga-id'\]|meta\[name="ga-id"\]/);
        assert.match(html, /gaMeta.*getAttribute.*content/);
    });

    test('audit page reads GA_ID from meta tag', () => {
        const html = readFile('coming-soon/public/audit.html');
        assert.match(html, /meta\[name='ga-id'\]|meta\[name="ga-id"\]/);
        assert.match(html, /gaMeta.*getAttribute.*content/);
    });

    test('pricing page reads GA_ID from meta tag', () => {
        const html = readFile('coming-soon/public/pricing.html');
        assert.match(html, /meta\[name='ga-id'\]|meta\[name="ga-id"\]/);
        assert.match(html, /gaMeta.*getAttribute.*content/);
    });

    test('homepage does not hardcode GA_ID', () => {
        const html = readFile('coming-soon/public/index.html');
        // Should NOT have a hardcoded G-XXXXXXX ID
        assert.doesNotMatch(html, /var\s+GA_ID\s*=\s*['"]G-[A-Z0-9]+['"]/);
    });

    test('audit page does not hardcode GA_ID', () => {
        const html = readFile('coming-soon/public/audit.html');
        assert.doesNotMatch(html, /var\s+GA_ID\s*=\s*['"]G-[A-Z0-9]+['"]/);
    });

    test('pricing page does not hardcode GA_ID', () => {
        const html = readFile('coming-soon/public/pricing.html');
        assert.doesNotMatch(html, /var\s+GA_ID\s*=\s*['"]G-[A-Z0-9]+['"]/);
    });

    test('homepage has dynamic injection comment', () => {
        const html = readFile('coming-soon/public/index.html');
        assert.match(html, /GA_MEASUREMENT_ID.*injected.*Worker/i);
    });

    test('audit page has dynamic injection comment', () => {
        const html = readFile('coming-soon/public/audit.html');
        assert.match(html, /GA_MEASUREMENT_ID.*injected.*Worker/i);
    });

    test('pricing page has dynamic injection comment', () => {
        const html = readFile('coming-soon/public/pricing.html');
        assert.match(html, /GA_MEASUREMENT_ID.*injected.*Worker/i);
    });
});

// ═══════════════════════════════════════════════
// 4. No Hardcoded GA IDs Anywhere
// ═══════════════════════════════════════════════

describe('No hardcoded GA IDs in source', () => {

    test('no real GA measurement ID in any HTML file', () => {
        const files = [
            'coming-soon/public/index.html',
            'coming-soon/public/audit.html',
            'coming-soon/public/pricing.html',
            'coming-soon/pricing.html'
        ];
        for (const file of files) {
            const html = readFile(file);
            // G-XXXXXXX is a placeholder, not a real ID
            // A real ID would be like G-1A2B3C4D5E
            assert.doesNotMatch(html, /G-[A-Z0-9]{10}/, `${file} should not have a real GA ID`);
        }
    });

    test('wrangler.jsonc does not have a real GA ID', () => {
        const wrangler = readFile('worker-deploy/wrangler.jsonc');
        assert.doesNotMatch(wrangler, /G-[A-Z0-9]{10}/);
    });
});

// ═══════════════════════════════════════════════
// 5. Analytics.js Compatibility
// ═══════════════════════════════════════════════

describe('analytics.js compatibility with dynamic injection', () => {

    test('analytics.js does not hardcode GA_ID', () => {
        const analytics = readFile('coming-soon/public/js-es2018/analytics.js');
        // analytics.js should not reference GA_ID directly — it uses gtag
        assert.doesNotMatch(analytics, /GA_ID/);
    });

    test('analytics.js works without meta tag (no-op mode)', () => {
        const analytics = readFile('coming-soon/public/js-es2018/analytics.js');
        // The hasGtag check should return false when gtag is not defined
        assert.match(analytics, /typeof global\.gtag.*===.*'function'/);
    });
});
