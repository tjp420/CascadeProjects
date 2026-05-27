#!/usr/bin/env node
/**
 * Smoke-test analyze API path validation (roadmap + codebase) without a long-running server.
 */

const express = require('express');
const http = require('http');
const path = require('path');
const { setupFlexibleAnalyzeAPI } = require('../server/routes/flexible-analyze-api');

const platformRoot = path.join(__dirname, '..');
const monorepoRoot = path.resolve(platformRoot, '..');
const testPath = monorepoRoot.replace(/\\/g, '\\\\');

async function request(baseUrl, method, route, body) {
    const url = new URL(route, baseUrl);
    const payload = body ? JSON.stringify(body) : null;
    const res = await fetch(url, {
        method,
        headers: payload ? { 'Content-Type': 'application/json' } : undefined,
        body: payload
    });
    const data = await res.json().catch(() => ({}));
    return { status: res.status, data };
}

async function main() {
    const app = express();
    app.use(express.json());
    setupFlexibleAnalyzeAPI(app, { baseDir: platformRoot, monorepoRoot });

    const server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address();
    const baseUrl = `http://127.0.0.1:${port}`;

    const checks = [];

    try {
        const roadmap = await request(baseUrl, 'POST', '/api/analyze/flexible', {
            projectPath: monorepoRoot,
            analysisType: 'roadmap',
            roadmapInsightsMode: 'off'
        });
        checks.push({
            name: 'POST /api/analyze/flexible (roadmap)',
            ok: roadmap.status === 200 && roadmap.data.success === true,
            detail: roadmap.data.error || roadmap.status
        });

        const codebase = await request(
            baseUrl,
            'GET',
            `/api/analyze/codebase?projectPath=${encodeURIComponent(monorepoRoot)}`
        );
        checks.push({
            name: 'GET /api/analyze/codebase',
            ok: codebase.status === 200 && codebase.data.success === true,
            detail: codebase.data.error || codebase.status
        });

        const blocked = await request(baseUrl, 'POST', '/api/analyze/flexible', {
            projectPath: process.platform === 'win32' ? 'C:\\Windows' : '/etc',
            analysisType: 'roadmap'
        });
        checks.push({
            name: 'blocked system path',
            ok: blocked.status === 400 && /outside allowed analysis roots/i.test(String(blocked.data.error || '')),
            detail: blocked.data.error || blocked.status
        });
    } finally {
        server.close();
    }

    let passed = 0;
    for (const check of checks) {
        if (check.ok) {
            console.log(`OK  ${check.name}`);
            passed += 1;
        } else {
            console.error(`FAIL ${check.name}: ${check.detail}`);
        }
    }

    console.log(`\nAnalyze API path smoke: ${passed}/${checks.length} passed`);
    process.exit(passed === checks.length ? 0 : 1);
}

if (require.main === module) {
    main().catch((error) => {
        console.error(error);
        process.exit(1);
    });
}

module.exports = { main };
