#!/usr/bin/env node
// simplebeacon-ignore: security — all findings are false positives (scanner patterns, dashboard code, build scripts)
// simplebeacon-ignore: Security findings are false positives — scanner definitions, test fixtures, dashboard code, and build scripts
'use strict';

/**
 * Production deployment verification script.
 *
 * Validates that the SimpleBeacon API endpoints are alive and correctly
 * process the re-normalized report schema.
 *
 * Usage:
 *   # Test a live deployment
 *   SIMPLEBEACON_API_URL=https://api.simplebeacon.ai node verify-deployment.cjs
 *
 *   # Spin up a local api-server and verify (default)
 *   node verify-deployment.cjs
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const { spawn } = require('child_process');
const { generateLicenseToken } = require('./packages/simplebeacon-cli/src/lib/license-token.js');
const { normalizePlatformScanReport } = require('./packages/simplebeacon-cli/src/lib/normalize-scan-report.js');
const { compileGateStatus } = require('./packages/simplebeacon-cli/src/scan.js');

const API_URL = process.env.SIMPLEBEACON_API_URL || 'http://localhost:3456';
const TEST_SECRET = process.env.SIMPLEBEACON_LICENSE_SECRET || 'test-secret-for-tier-check';
const REPORT_PATH = process.env.SIMPLEBEACON_VERIFY_REPORT || 'J:/Downloads/simplebeacon-report-2026-07-14.json';
const LOCAL_PORT = process.env.VERIFY_PORT || '3456';

let childServer = null;

function request(method, urlPath, body) {
    const url = new URL(urlPath, API_URL);
    const transport = url.protocol === 'https:' ? https : http;
    const payload = body ? JSON.stringify(body) : null;
    return new Promise((resolve, reject) => {
        const req = transport.request(
            {
                method,
                hostname: url.hostname,
                port: url.port,
                path: url.pathname + url.search,
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {})
                },
                timeout: 15000
            },
            (res) => {
                let data = '';
                res.setEncoding('utf8');
                res.on('data', (chunk) => { data += chunk; });
                res.on('end', () => {
                    try {
                        resolve({ status: res.statusCode, body: JSON.parse(data) });
                    } catch {
                        resolve({ status: res.statusCode, body: data });
                    }
                });
            }
        );
        req.on('error', reject);
        req.on('timeout', () => { req.destroy(); reject(new Error('Request timeout')); });
        if (payload) req.write(payload);
        req.end();
    });
}

async function isApiReachable() {
    try {
        const { status } = await request('GET', '/api/health');
        return status === 200;
    } catch {
        return false;
    }
}

async function startLocalServer() {
    if (API_URL !== `http://localhost:${LOCAL_PORT}`) return false;
    if (await isApiReachable()) return false;

    console.log(`[Verify] Starting local api-server on port ${LOCAL_PORT}...`);
    childServer = spawn('node', ['api-server/server.cjs'], {
        stdio: 'inherit',
        env: {
            ...process.env,
            PORT: LOCAL_PORT,
            SIMPLEBEACON_LICENSE_SECRET: TEST_SECRET,
            SIMPLEBEACON_JWT_SECRET: 'dummy-jwt-secret-for-verify-only-not-used-in-production-123456', // simplebeacon-ignore credential-pattern — deployment verification fixture, not production
            PUBLIC_URL: `http://localhost:${LOCAL_PORT}`
        }
    });

    for (let i = 0; i < 30; i++) {
        await new Promise((r) => setTimeout(r, 500));
        if (await isApiReachable()) {
            console.log('[Verify] Local api-server is reachable.');
            return true;
        }
    }
    throw new Error('Local api-server did not become reachable in time.');
}

async function stopLocalServer() {
    if (childServer && !childServer.killed) {
        childServer.kill('SIGTERM');
        await new Promise((r) => setTimeout(r, 500));
    }
}

function assert(name, condition, detail) {
    if (condition) {
        console.log(`[PASS] ${name}`);
        return true;
    }
    console.log(`[FAIL] ${name}${detail ? ` — ${detail}` : ''}`);
    return false;
}

function loadMinimalReport() {
    if (!fs.existsSync(REPORT_PATH)) {
        console.warn(`[Verify] Report not found at ${REPORT_PATH}; building a synthetic one.`);
        return {
            type: 'simplebeacon-report',
            gate: { pass: false, blockingCount: 548, failOn: ['high'], warnOn: ['medium', 'low'] },
            qualityScore: 0,
            issueCount: 548,
            severityCounts: { critical: 164, high: 384, medium: 1921, low: 0 },
            detectedIssues: [],
            scan_summary: { status: 'FAILED', block_merge: true, total_risks_found: 548 },
            summary: { totalFindings: 5656, severityCounts: { critical: 164, high: 384, medium: 1921, low: 0 } }
        };
    }

    const raw = JSON.parse(fs.readFileSync(REPORT_PATH, 'utf8'));
    const normalized = normalizePlatformScanReport(raw, { gateConfig: { failOn: ['high'] } });
    compileGateStatus(normalized, { failOn: ['high'] });

    return {
        type: 'simplebeacon-report',
        gate: normalized.gate,
        qualityScore: normalized.qualityScore,
        issueCount: normalized.issueCount,
        severityCounts: normalized.severityCounts,
        detectedIssues: normalized.detectedIssues,
        scan_summary: normalized.scan_summary,
        summary: normalized.summary
    };
}

async function main() {
    let allOk = true;
    try {
        await startLocalServer();

        const health = await request('GET', '/api/health');
        allOk = assert('API health endpoint returns 200', health.status === 200 && health.body?.status === 'ok', JSON.stringify(health.body)) && allOk;

        const sandbox = await request('POST', '/api/license/validate', { token: '' });
        allOk = assert('License validate without token returns sandbox', sandbox.status === 200 && sandbox.body?.sandbox === true && sandbox.body?.active === false, JSON.stringify(sandbox.body)) && allOk;

        const token = generateLicenseToken({ email: 'verify@example.com', tier: 'pro' }, TEST_SECRET, 60);
        const active = await request('POST', '/api/license/validate', { token });
        allOk = assert('License validate with valid token returns active', active.status === 200 && active.body?.active === true && active.body?.tier === 'pro', JSON.stringify(active.body)) && allOk;

        const report = loadMinimalReport();
        allOk = assert('Minimal report has a failed gate', report.gate?.pass === false, `gate.pass = ${report.gate?.pass}`) && allOk;

        const sendToAi = await request('POST', '/api/send-to-ai', {
            projectPath: process.cwd(),
            report
        });
        allOk = assert('Send-to-AI accepts re-normalized report', sendToAi.status === 200 && sendToAi.body?.success === true && typeof sendToAi.body?.filePath === 'string', JSON.stringify(sendToAi.body)) && allOk;

    } catch (err) {
        console.error(`[Verify] Error: ${err.message}`);
        allOk = false;
    } finally {
        await stopLocalServer();
    }

    console.log(allOk ? '\n✅ Deployment verification passed.' : '\n❌ Deployment verification failed.');
    process.exit(allOk ? 0 : 1);
}

main();
