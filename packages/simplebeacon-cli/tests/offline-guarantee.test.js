'use strict';

/**
 * Offline Guarantee Regression Suite
 *
 * Verifies that when --offline / SIMPLEBEACON_OFFLINE is active:
 *   1. The offline guard blocks all non-local outbound HTTP/HTTPS/fetch/net/dns calls
 *   2. Localhost (127.0.0.1, ::1, localhost) connections are allowed
 *   3. runScan() with offline:true enforces the zero-custody boundary
 *   4. report-enhance.js refuses to call OpenAI in offline mode
 *   5. github-comment.js refuses to call GitHub API in offline mode
 *   6. A full scan with offline:true produces zero network violations
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

const { createOfflineGuard, isLocalhost } = require('../src/lib/offline-guard');
const { runScan } = require('../src/scan');

// ── Unit tests for the offline guard module ──────────────────────────────

test('offline guard blocks non-local https.request', () => {
    const guard = createOfflineGuard({ offline: true });
    try {
        assert.throws(
            () => { const https = require('https'); https.request('https://api.openai.com/v1/chat'); },
            /Offline guard blocked https\.request/
        );
    } finally {
        guard.dispose();
    }
});

test('offline guard blocks non-local http.request', () => {
    const guard = createOfflineGuard({ offline: true });
    try {
        assert.throws(
            () => { const http = require('http'); http.request('http://example.com/api'); },
            /Offline guard blocked http\.request/
        );
    } finally {
        guard.dispose();
    }
});

test('offline guard blocks non-local fetch', async () => {
    const guard = createOfflineGuard({ offline: true });
    try {
        await assert.rejects(
            () => globalThis.fetch('https://registry.npmjs.org/simplebeacon'),
            /Offline guard blocked fetch/
        );
    } finally {
        guard.dispose();
    }
});

test('offline guard blocks net.connect to non-local host', () => {
    const guard = createOfflineGuard({ offline: true });
    try {
        const net = require('net');
        assert.throws(
            () => { net.connect({ host: 'remote.example.com', port: 443 }); },
            /Offline guard blocked net\.connect/
        );
    } finally {
        guard.dispose();
    }
});

test('offline guard blocks dns.lookup for non-local host', () => {
    const guard = createOfflineGuard({ offline: true });
    try {
        const dns = require('dns');
        assert.throws(
            () => { dns.lookup('example.com'); },
            /Offline guard blocked dns\.lookup/
        );
    } finally {
        guard.dispose();
    }
});

test('offline guard allows localhost http.request', () => {
    const guard = createOfflineGuard({ offline: true });
    try {
        // Should NOT throw — localhost is allowed
        const http = require('http');
        // We can't actually connect (nothing is listening), but the guard
        // should let the call through without throwing
        const req = http.request('http://localhost:11434/api/generate');
        req.on('error', () => {}); // suppress socket hang up
        req.destroy(); // immediately cancel — we just want to verify no throw
    } finally {
        guard.dispose();
    }
});

test('offline guard allows 127.0.0.1 fetch', async () => {
    const guard = createOfflineGuard({ offline: true });
    try {
        // Should NOT throw — 127.0.0.1 is allowed
        // The fetch will fail (nothing listening), but the guard won't block it
        try {
            await globalThis.fetch('http://127.0.0.1:1/test');
        } catch (err) {
            // Connection refused is fine — we just verify it's not the guard blocking
            assert.doesNotMatch(err.message, /Offline guard/);
        }
    } finally {
        guard.dispose();
    }
});

test('offline guard records but does not block when offline=false', () => {
    const guard = createOfflineGuard({ offline: false });
    try {
        const http = require('http');
        // Should NOT throw — offline is false, so network is allowed
        const req = http.request('http://example.com/api');
        req.on('error', () => {}); // suppress socket hang up from async DNS
        req.destroy();
        // One logical http.request call may cascade through dns.lookup and
        // net.connect — verify at least the http.request violation was recorded
        assert.ok(guard.violations.length >= 1, 'should record at least 1 violation');
        assert.ok(
            guard.violations.some(v => v.kind === 'http.request'),
            'should record an http.request violation'
        );
    } finally {
        guard.dispose();
    }
});

test('assertNoViolations throws on non-local violations', () => {
    const guard = createOfflineGuard({ offline: false });
    try {
        const https = require('https');
        const req = https.request('https://api.openai.com/v1/chat');
        req.on('error', () => {}); // suppress socket hang up
        req.destroy();
        assert.throws(
            () => guard.assertNoViolations(),
            /Offline guarantee violated/
        );
    } finally {
        guard.dispose();
    }
});

test('assertNoViolations passes with only localhost violations', () => {
    const guard = createOfflineGuard({ offline: false });
    try {
        const http = require('http');
        const req = http.request('http://localhost:3000/test');
        req.on('error', () => {}); // suppress socket hang up
        req.destroy();
        assert.doesNotThrow(() => guard.assertNoViolations());
    } finally {
        guard.dispose();
    }
});

test('isLocalhost correctly identifies loopback hosts', () => {
    assert.equal(isLocalhost('127.0.0.1'), true);
    assert.equal(isLocalhost('::1'), true);
    assert.equal(isLocalhost('localhost'), true);
    assert.equal(isLocalhost('0.0.0.0'), true);
    assert.equal(isLocalhost('myapp.localhost'), true);
    assert.equal(isLocalhost('api.openai.com'), false);
    assert.equal(isLocalhost('example.com'), false);
    assert.equal(isLocalhost(''), false);
    assert.equal(isLocalhost(null), false);
});

test('guard dispose restores original modules', () => {
    const https = require('https');
    const originalRequest = https.request;

    const guard = createOfflineGuard({ offline: true });
    assert.notEqual(https.request, originalRequest);
    guard.dispose();

    assert.equal(https.request, originalRequest);
});

// ── Integration test: runScan with offline enforces zero network ─────────

test('runScan with offline:true completes without network violations', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-offline-'));
    const configDir = path.join(root, '.simplebeacon');
    fs.mkdirSync(configDir, { recursive: true });
    fs.writeFileSync(path.join(configDir, 'config.json'), JSON.stringify({
        profile: 'standard',
        scanPaths: ['src'],
        productionPaths: ['src'],
        gate: { failOn: ['high'] }
    }, null, 2));
    fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: 'offline-test', version: '1.0.0' }));
    fs.mkdirSync(path.join(root, 'src'), { recursive: true });
    fs.writeFileSync(path.join(root, 'src', 'app.js'),
        'const apiKey = "sk-abcdefghijklmnopqrstuvwxyz1234567890";\nmodule.exports = { apiKey };\n'
    );

    try {
        // This should complete without throwing — the scan itself doesn't make
        // outbound network calls when offline is true
        const report = await runScan(root, { offline: true, gate: false, fullDirectoryScan: true });
        assert.ok(report, 'runScan should return a report');
        assert.ok(Array.isArray(report.rawIssues), 'report should have rawIssues array');
    } finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
});

// ── Integration test: report-enhance blocks in offline mode ──────────────

test('report-enhance callOpenAIChatCompletion blocks in offline mode', () => {
    const { callOpenAIChatCompletion } = require('../src/reporters/report-enhance');
    assert.throws(
        () => callOpenAIChatCompletion('test prompt', { offline: true, apiKey: 'sk-test' }),
        /OpenAI enhancement blocked in offline mode/
    );
});

test('report-enhance callOpenAIChatCompletion blocks via env var', () => {
    const oldValue = process.env.SIMPLEBEACON_OFFLINE;
    process.env.SIMPLEBEACON_OFFLINE = '1';
    try {
        const { callOpenAIChatCompletion } = require('../src/reporters/report-enhance');
        assert.throws(
            () => callOpenAIChatCompletion('test prompt', { apiKey: 'sk-test' }),
            /OpenAI enhancement blocked in offline mode/
        );
    } finally {
        if (oldValue === undefined) delete process.env.SIMPLEBEACON_OFFLINE;
        else process.env.SIMPLEBEACON_OFFLINE = oldValue;
    }
});

// ── Integration test: github-comment blocks in offline mode ──────────────

test('github-comment postGithubComment blocks in offline mode', async () => {
    const { postGithubComment } = require('../src/reporters/github-comment');
    await assert.rejects(
        () => postGithubComment('/tmp/fake-report.json', { offline: true, token: 'fake', repo: 'test/repo', issueNumber: '1' }),
        /GitHub comment posting blocked in offline mode/
    );
});

// ── Integration test: env-based activation ───────────────────────────────

test('activateOfflineGuard activates when SIMPLEBEACON_OFFLINE=1', () => {
    const { activateOfflineGuard, deactivateOfflineGuard, getActiveGuard } = require('../src/lib/offline-guard');
    const oldValue = process.env.SIMPLEBEACON_OFFLINE;
    process.env.SIMPLEBEACON_OFFLINE = '1';
    try {
        const guard = activateOfflineGuard();
        assert.ok(guard, 'guard should be activated');
        assert.equal(guard.offline, true);
        assert.ok(getActiveGuard(), 'getActiveGuard should return the guard');
    } finally {
        deactivateOfflineGuard();
        if (oldValue === undefined) delete process.env.SIMPLEBEACON_OFFLINE;
        else process.env.SIMPLEBEACON_OFFLINE = oldValue;
    }
});

test('activateOfflineGuard returns null when env not set', () => {
    const { activateOfflineGuard, deactivateOfflineGuard } = require('../src/lib/offline-guard');
    const oldValue = process.env.SIMPLEBEACON_OFFLINE;
    delete process.env.SIMPLEBEACON_OFFLINE;
    try {
        const guard = activateOfflineGuard();
        assert.equal(guard, null);
    } finally {
        if (oldValue !== undefined) process.env.SIMPLEBEACON_OFFLINE = oldValue;
        deactivateOfflineGuard();
    }
});
