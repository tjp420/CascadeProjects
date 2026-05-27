const express = require('express');
const path = require('path');
const os = require('os');
const fs = require('fs');
const {
    resolveDataCleanupScannerConfig,
    registerDataCleanupAnalyzeRoute,
    runDataCleanupScan,
    clearDataCleanupScanCache
} = require('../../server/lib/data-cleanup-scan');

describe('data cleanup scan API', () => {
    test('resolveDataCleanupScannerConfig scopes profiles', () => {
        const fileReduction = resolveDataCleanupScannerConfig('file-reduction');
        expect(fileReduction['build-artifacts'].enabled).toBe(true);
        expect(fileReduction['data-privacy'].enabled).toBe(false);

        const dataQuality = resolveDataCleanupScannerConfig('data-quality');
        expect(dataQuality['build-artifacts'].enabled).toBe(false);
        expect(dataQuality['data-privacy'].enabled).toBe(true);
    });

    test('registerDataCleanupAnalyzeRoute exposes GET /api/analyze/data-cleanup', async () => {
        const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'data-cleanup-api-'));
        const app = express();
        registerDataCleanupAnalyzeRoute(app, {
            baseDir: tmpRoot,
            monorepoRoot: tmpRoot
        });

        const server = await new Promise((resolve) => {
            const s = app.listen(0, () => resolve(s));
        });
        const { port } = server.address();

        try {
            const missingPath = await fetch(`http://127.0.0.1:${port}/api/analyze/data-cleanup?profile=data-quality`);
            expect(missingPath.status).toBe(400);

            const params = new URLSearchParams({
                profile: 'data-quality',
                projectPath: tmpRoot
            });
            const response = await fetch(`http://127.0.0.1:${port}/api/analyze/data-cleanup?${params}`);
            expect(response.status).toBe(200);
            const body = await response.json();
            expect(body.success).toBe(true);
            expect(body.analysisType).toBe('data-quality');
            expect(body.data?.summary).toBeTruthy();
        } finally {
            await new Promise((resolve, reject) => {
                server.close((err) => (err ? reject(err) : resolve()));
            });
            fs.rmSync(tmpRoot, { recursive: true, force: true });
        }
    });

    test('runDataCleanupScan caches repeat profile scans until refresh', async () => {
        const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'data-cleanup-cache-'));
        clearDataCleanupScanCache();
        try {
            const first = await runDataCleanupScan(tmpRoot, {
                profile: 'data-quality',
                cacheTtlMs: 60000
            });
            const second = await runDataCleanupScan(tmpRoot, {
                profile: 'data-quality',
                cacheTtlMs: 60000
            });
            expect(first.cacheHit).toBeFalsy();
            expect(second.cacheHit).toBe(true);
            expect(second.durationMs).toBe(first.durationMs);

            const refreshed = await runDataCleanupScan(tmpRoot, {
                profile: 'data-quality',
                cacheTtlMs: 60000,
                bypassCache: true
            });
            expect(refreshed.cacheHit).toBeFalsy();
        } finally {
            clearDataCleanupScanCache();
            fs.rmSync(tmpRoot, { recursive: true, force: true });
        }
    });
});
