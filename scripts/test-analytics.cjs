'use strict';

/**
 * Tests for SimpleBeacon Analytics Dispatcher (analytics.js)
 *
 * Verifies:
 * 1. Event tracking dispatch (track, trackCta, trackSplitChoice, trackBeginCheckout)
 * 2. No-op fallback when GA is not loaded
 * 3. Event queue persistence and flush
 * 4. Schema validation (event names, params, categories)
 * 5. HTML wiring (CTA buttons, split-choice, checkout)
 *
 * Run: node --test scripts/test-analytics.cjs
 */

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.join(__dirname, '..');

function readFile(relPath) {
    return fs.readFileSync(path.join(REPO_ROOT, relPath), 'utf8');
}

// ── Analytics.js source loading ──

/**
 * Load analytics.js in a sandboxed global context for testing.
 * Returns the global object with SbAnalytics attached.
 */
function loadAnalyticsSandbox(opts) {
    opts = opts || {};
    const sandbox = {
        location: { hostname: opts.hostname || 'localhost', pathname: '/test' },
        localStorage: opts.localStorage || createMockStorage(),
        setInterval: () => 0,
        clearInterval: () => {},
        console: { debug: () => {} },
        document: opts.document || null
    };
    if (opts.gtag) sandbox.gtag = opts.gtag;
    if (opts.dataLayer) sandbox.dataLayer = opts.dataLayer;

    const src = readFile('coming-soon/public/js-es2018/analytics.js');
    // Execute in sandbox context
    const fn = new Function('window', src + '; return window;');
    const result = fn(sandbox);
    return sandbox;
}

function createMockStorage() {
    const store = {};
    return {
        getItem: (key) => store[key] || null,
        setItem: (key, val) => { store[key] = String(val); },
        removeItem: (key) => { delete store[key]; }
    };
}

// ═══════════════════════════════════════════════
// 1. Analytics.js Source Validation
// ═══════════════════════════════════════════════

describe('analytics.js source validation', () => {

    test('analytics.js file exists', () => {
        const src = readFile('coming-soon/public/js-es2018/analytics.js');
        assert.ok(src.length > 1000, 'analytics.js should be substantial');
    });

    test('exports SbAnalytics global', () => {
        const src = readFile('coming-soon/public/js-es2018/analytics.js');
        assert.match(src, /global\.SbAnalytics\s*=/);
    });

    test('exposes track function', () => {
        const src = readFile('coming-soon/public/js-es2018/analytics.js');
        assert.match(src, /track:\s*track/);
    });

    test('exposes trackCta function', () => {
        const src = readFile('coming-soon/public/js-es2018/analytics.js');
        assert.match(src, /trackCta:\s*trackCta/);
    });

    test('exposes trackSplitChoice function', () => {
        const src = readFile('coming-soon/public/js-es2018/analytics.js');
        assert.match(src, /trackSplitChoice:\s*trackSplitChoice/);
    });

    test('exposes trackBeginCheckout function', () => {
        const src = readFile('coming-soon/public/js-es2018/analytics.js');
        assert.match(src, /trackBeginCheckout:\s*trackBeginCheckout/);
    });

    test('exposes trackExtensionInstall function', () => {
        const src = readFile('coming-soon/public/js-es2018/analytics.js');
        assert.match(src, /trackExtensionInstall:\s*trackExtensionInstall/);
    });

    test('exposes flushQueue function', () => {
        const src = readFile('coming-soon/public/js-es2018/analytics.js');
        assert.match(src, /flushQueue:\s*flushQueue/);
    });

    test('has no-op fallback when gtag is missing', () => {
        const src = readFile('coming-soon/public/js-es2018/analytics.js');
        assert.match(src, /hasGtag/);
        assert.match(src, /persistEvent/);
    });

    test('has queue persistence for retry', () => {
        const src = readFile('coming-soon/public/js-es2018/analytics.js');
        assert.match(src, /MAX_QUEUE/);
        assert.match(src, /QUEUE_KEY/);
    });

    test('passes node syntax check', () => {
        const { execSync } = require('child_process');
        const filePath = path.join(REPO_ROOT, 'coming-soon/public/js-es2018/analytics.js');
        // node -c checks syntax without running
        execSync(`node -c "${filePath}"`, { stdio: 'pipe' });
    });
});

// ═══════════════════════════════════════════════
// 2. Event Dispatch (with gtag mock)
// ═══════════════════════════════════════════════

describe('Event dispatch with gtag loaded', () => {

    test('track() calls gtag with event name and params', () => {
        let capturedEvent = null;
        let capturedParams = null;
        const sandbox = loadAnalyticsSandbox({
            gtag: function(action, eventName, params) {
                capturedEvent = eventName;
                capturedParams = params;
            }
        });

        sandbox.SbAnalytics.track('test_event', {
            event_category: 'test',
            event_label: 'test_label',
            value: 42
        });

        assert.equal(capturedEvent, 'test_event');
        assert.equal(capturedParams.event_category, 'test');
        assert.equal(capturedParams.event_label, 'test_label');
        assert.equal(capturedParams.value, 42);
    });

    test('trackCta() dispatches cta_click event', () => {
        let capturedEvent = null;
        const sandbox = loadAnalyticsSandbox({
            gtag: function(action, eventName) { capturedEvent = eventName; }
        });

        sandbox.SbAnalytics.trackCta('run_free_scan', 'hero');

        assert.equal(capturedEvent, 'cta_click');
    });

    test('trackSplitChoice() dispatches split_choice_click event', () => {
        let capturedEvent = null;
        let capturedParams = null;
        const sandbox = loadAnalyticsSandbox({
            gtag: function(action, eventName, params) {
                capturedEvent = eventName;
                capturedParams = params;
            }
        });

        sandbox.SbAnalytics.trackSplitChoice('browser_triage');

        assert.equal(capturedEvent, 'split_choice_click');
        assert.equal(capturedParams.event_label, 'browser_triage');
        assert.equal(capturedParams.choice, 'browser_triage');
    });

    test('trackSplitChoice() accepts deep_scan', () => {
        let capturedParams = null;
        const sandbox = loadAnalyticsSandbox({
            gtag: function(action, eventName, params) { capturedParams = params; }
        });

        sandbox.SbAnalytics.trackSplitChoice('deep_scan');

        assert.equal(capturedParams.event_label, 'deep_scan');
        assert.equal(capturedParams.choice, 'deep_scan');
    });

    test('trackBeginCheckout() dispatches begin_checkout with tier and value', () => {
        let capturedEvent = null;
        let capturedParams = null;
        const sandbox = loadAnalyticsSandbox({
            gtag: function(action, eventName, params) {
                capturedEvent = eventName;
                capturedParams = params;
            }
        });

        sandbox.SbAnalytics.trackBeginCheckout('developer', 49);

        assert.equal(capturedEvent, 'begin_checkout');
        assert.equal(capturedParams.event_label, 'developer');
        assert.equal(capturedParams.tier, 'developer');
        assert.equal(capturedParams.value, 49);
        assert.equal(capturedParams.currency, 'USD');
    });

    test('trackBeginCheckout() defaults value to 0', () => {
        let capturedParams = null;
        const sandbox = loadAnalyticsSandbox({
            gtag: function(action, eventName, params) { capturedParams = params; }
        });

        sandbox.SbAnalytics.trackBeginCheckout('enterprise');

        assert.equal(capturedParams.value, 0);
    });

    test('trackExtensionInstall() dispatches extension_install_click', () => {
        let capturedEvent = null;
        let capturedParams = null;
        const sandbox = loadAnalyticsSandbox({
            gtag: function(action, eventName, params) {
                capturedEvent = eventName;
                capturedParams = params;
            }
        });

        sandbox.SbAnalytics.trackExtensionInstall('hero');

        assert.equal(capturedEvent, 'extension_install_click');
        assert.equal(capturedParams.event_label, 'vscode_extension');
        assert.equal(capturedParams.source, 'hero');
    });

    test('track() enriches with page path', () => {
        let capturedParams = null;
        const sandbox = loadAnalyticsSandbox({
            gtag: function(action, eventName, params) { capturedParams = params; }
        });

        sandbox.SbAnalytics.track('test_event', {});

        assert.equal(capturedParams.page, '/test');
    });

    test('track() defaults event_category to engagement', () => {
        let capturedParams = null;
        const sandbox = loadAnalyticsSandbox({
            gtag: function(action, eventName, params) { capturedParams = params; }
        });

        sandbox.SbAnalytics.track('test_event', {});

        assert.equal(capturedParams.event_category, 'engagement');
    });
});

// ═══════════════════════════════════════════════
// 3. No-op Fallback (without gtag)
// ═══════════════════════════════════════════════

describe('No-op fallback without gtag', () => {

    test('track() returns false when gtag is missing', () => {
        const sandbox = loadAnalyticsSandbox({});
        const result = sandbox.SbAnalytics.track('test_event', {});
        assert.equal(result, false);
    });

    test('track() persists event to localStorage queue', () => {
        const storage = createMockStorage();
        const sandbox = loadAnalyticsSandbox({ localStorage: storage });

        sandbox.SbAnalytics.track('test_event', { event_label: 'queued' });

        const queue = JSON.parse(storage.getItem('sb_analytics_queue'));
        assert.ok(queue && queue.length === 1);
        assert.equal(queue[0].event.name, 'test_event');
        assert.equal(queue[0].event.params.event_label, 'queued');
    });

    test('queue is capped at MAX_QUEUE entries', () => {
        const storage = createMockStorage();
        const sandbox = loadAnalyticsSandbox({ localStorage: storage });

        // Push 60 events (MAX_QUEUE is 50)
        for (let i = 0; i < 60; i++) {
            sandbox.SbAnalytics.track('test_event_' + i, {});
        }

        const queue = JSON.parse(storage.getItem('sb_analytics_queue'));
        assert.equal(queue.length, 50, 'Queue should be capped at 50');
        // Should keep the last 50
        assert.equal(queue[0].event.name, 'test_event_10');
        assert.equal(queue[49].event.name, 'test_event_59');
    });

    test('hasGtag() returns false when gtag is not loaded', () => {
        const sandbox = loadAnalyticsSandbox({});
        assert.equal(sandbox.SbAnalytics.hasGtag(), false);
    });

    test('hasGtag() returns true when gtag is loaded', () => {
        const sandbox = loadAnalyticsSandbox({ gtag: () => {} });
        assert.equal(sandbox.SbAnalytics.hasGtag(), true);
    });
});

// ═══════════════════════════════════════════════
// 4. Queue Flush
// ═══════════════════════════════════════════════

describe('Queue flush when gtag becomes available', () => {

    test('flushQueue() sends queued events to gtag', () => {
        const storage = createMockStorage();
        // Pre-populate queue
        storage.setItem('sb_analytics_queue', JSON.stringify([
            { event: { name: 'queued_1', params: { event_label: 'a' } }, ts: Date.now() },
            { event: { name: 'queued_2', params: { event_label: 'b' } }, ts: Date.now() }
        ]));

        const dispatched = [];
        const sandbox = loadAnalyticsSandbox({
            localStorage: storage,
            gtag: function(action, eventName, params) {
                dispatched.push({ event: eventName, params });
            }
        });

        sandbox.SbAnalytics.flushQueue();

        assert.equal(dispatched.length, 2);
        assert.equal(dispatched[0].event, 'queued_1');
        assert.equal(dispatched[1].event, 'queued_2');
    });

    test('flushQueue() clears queue after dispatch', () => {
        const storage = createMockStorage();
        storage.setItem('sb_analytics_queue', JSON.stringify([
            { event: { name: 'queued_1', params: {} }, ts: Date.now() }
        ]));

        const sandbox = loadAnalyticsSandbox({
            localStorage: storage,
            gtag: () => {}
        });

        sandbox.SbAnalytics.flushQueue();

        const queue = JSON.parse(storage.getItem('sb_analytics_queue') || '[]');
        assert.equal(queue.length, 0);
    });

    test('flushQueue() is no-op when queue is empty', () => {
        const storage = createMockStorage();
        let dispatchCount = 0;
        const sandbox = loadAnalyticsSandbox({
            localStorage: storage,
            gtag: function() { dispatchCount++; }
        });

        sandbox.SbAnalytics.flushQueue();
        assert.equal(dispatchCount, 0);
    });
});

// ═══════════════════════════════════════════════
// 5. HTML Wiring — Homepage
// ═══════════════════════════════════════════════

describe('Homepage analytics wiring', () => {

    test('homepage loads analytics.js', () => {
        const html = readFile('coming-soon/public/index.html');
        assert.match(html, /\/js-es2018\/analytics\.js/);
    });

    test('homepage has GA dataLayer init', () => {
        const html = readFile('coming-soon/public/index.html');
        assert.match(html, /window\.dataLayer\s*=\s*window\.dataLayer\s*\|\|/);
        assert.match(html, /function\s+gtag/);
    });

    test('hero CTA "Run Free Local Scan" has trackCta', () => {
        const html = readFile('coming-soon/public/index.html');
        assert.match(html, /SbAnalytics.*trackCta.*run_free_scan.*hero/);
    });

    test('hero CTA "Explore CLI" has trackCta', () => {
        const html = readFile('coming-soon/public/index.html');
        assert.match(html, /SbAnalytics.*trackCta.*explore_cli_spec.*hero/);
    });

    test('VS Code extension link has trackExtensionInstall', () => {
        const html = readFile('coming-soon/public/index.html');
        assert.match(html, /SbAnalytics.*trackExtensionInstall/);
    });
});

// ═══════════════════════════════════════════════
// 6. HTML Wiring — Audit Page
// ═══════════════════════════════════════════════

describe('Audit page analytics wiring', () => {

    test('audit page loads analytics.js', () => {
        const html = readFile('coming-soon/public/audit.html');
        assert.match(html, /\/js-es2018\/analytics\.js/);
    });

    test('audit page has GA dataLayer init', () => {
        const html = readFile('coming-soon/public/audit.html');
        assert.match(html, /window\.dataLayer\s*=\s*window\.dataLayer\s*\|\|/);
    });

    test('Browser Triage button has trackSplitChoice', () => {
        const html = readFile('coming-soon/public/audit.html');
        assert.match(html, /SbAnalytics.*trackSplitChoice.*browser_triage/);
    });

    test('Deep Scan button has trackSplitChoice', () => {
        const html = readFile('coming-soon/public/audit.html');
        assert.match(html, /SbAnalytics.*trackSplitChoice.*deep_scan/);
    });

    test('VS Code extension banner link has trackExtensionInstall', () => {
        const html = readFile('coming-soon/public/audit.html');
        assert.match(html, /SbAnalytics.*trackExtensionInstall.*audit_banner/);
    });
});

// ═══════════════════════════════════════════════
// 7. HTML Wiring — Pricing Page
// ═══════════════════════════════════════════════

describe('Pricing page analytics wiring', () => {

    test('pricing page loads analytics.js', () => {
        const html = readFile('coming-soon/public/pricing.html');
        assert.match(html, /\/js-es2018\/analytics\.js/);
    });

    test('pricing page uses SbAnalytics.trackBeginCheckout', () => {
        const html = readFile('coming-soon/public/pricing.html');
        assert.match(html, /SbAnalytics.*trackBeginCheckout/);
    });

    test('pricing page retains gtag fallback', () => {
        const html = readFile('coming-soon/public/pricing.html');
        // The old gtag fallback should still be present as a backup
        assert.match(html, /typeof gtag.*function/);
    });
});

// ═══════════════════════════════════════════════
// 8. Event Schema Validation
// ═══════════════════════════════════════════════

describe('Event schema validation', () => {

    test('all event names use snake_case', () => {
        const src = readFile('coming-soon/public/js-es2018/analytics.js');
        // Extract event names from track calls
        const eventNames = [
            'cta_click',
            'split_choice_click',
            'begin_checkout',
            'page_view',
            'engagement_milestone',
            'extension_install_click'
        ];
        for (const name of eventNames) {
            assert.match(src, new RegExp(`'${name}'`), `Event name '${name}' should be in source`);
            // Verify snake_case (no spaces, no camelCase)
            assert.ok(!/\s/.test(name), `${name} should have no spaces`);
            assert.ok(!/[A-Z]/.test(name), `${name} should be snake_case (no uppercase)`);
        }
    });

    test('all events include event_category', () => {
        const sandbox = loadAnalyticsSandbox({
            gtag: () => {}
        });
        // All track helpers should set event_category
        let captured;
        sandbox.gtag = function(action, eventName, params) { captured = params; };

        sandbox.SbAnalytics.trackCta('test', 'test');
        assert.ok(captured.event_category, 'trackCta should set event_category');

        sandbox.SbAnalytics.trackSplitChoice('browser_triage');
        assert.ok(captured.event_category, 'trackSplitChoice should set event_category');

        sandbox.SbAnalytics.trackBeginCheckout('developer', 49);
        assert.ok(captured.event_category, 'trackBeginCheckout should set event_category');
    });

    test('ecommerce events have currency field', () => {
        const sandbox = loadAnalyticsSandbox({
            gtag: () => {}
        });
        let captured;
        sandbox.gtag = function(action, eventName, params) { captured = params; };

        sandbox.SbAnalytics.trackBeginCheckout('developer', 49);
        assert.equal(captured.currency, 'USD');
    });

    test('split_choice events include choice param', () => {
        const sandbox = loadAnalyticsSandbox({
            gtag: () => {}
        });
        let captured;
        sandbox.gtag = function(action, eventName, params) { captured = params; };

        sandbox.SbAnalytics.trackSplitChoice('browser_triage');
        assert.equal(captured.choice, 'browser_triage');
    });
});
