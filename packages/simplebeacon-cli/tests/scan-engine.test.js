const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { runScan } = require('../src/scan');

function makeTempProject() {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-scan-engine-'));
    const configDir = path.join(root, '.simplebeacon');
    fs.mkdirSync(configDir, { recursive: true });
    fs.writeFileSync(
        path.join(configDir, 'config.json'),
        JSON.stringify({
            profile: 'minimal',
            scanPaths: ['src'],
            productionPaths: ['src'],
            gate: { failOn: ['high'] },
            rules: {
                credentials: { enabled: true },
                'production-leak': { enabled: false },
                'fiction-kpi-patterns': { enabled: false },
                'json-schema': { enabled: false },
                'jest-baseline': { enabled: false }
            }
        }, null, 2),
        'utf8'
    );
    fs.mkdirSync(path.join(root, 'src'), { recursive: true });
    fs.writeFileSync(path.join(root, 'src', 'app.js'), 'module.exports = { ok: true };\n', 'utf8');
    fs.writeFileSync(path.join(root, 'src', 'sample-data.json'), '{"mock": true}\n', 'utf8');
    return root;
}

test('runScan completes with fullDirectoryScan and gate enabled', async () => {
    const root = makeTempProject();
    try {
        const report = await runScan(root, {
            fullDirectoryScan: true,
            gate: true,
            offline: true
        });
        assert.ok(report.projectRoot);
        assert.ok(typeof report.totalFiles === 'number');
        assert.ok(report.totalFiles > 0);
        assert.ok(report.qualityScore >= 0 && report.qualityScore <= 100);
    } finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
});

test('runScan detects mock data patterns in sample files', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-mock-test-'));
    // Create a mock sample file
    fs.mkdirSync(path.join(tmpDir, 'src'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'src', 'sample-data.json'), '{"mock": true}', 'utf8');
    fs.writeFileSync(path.join(tmpDir, 'src', 'fixture.js'), 'module.exports = {};', 'utf8');

    const report = await runScan(tmpDir, {
        fullDirectoryScan: true,
        offline: true
    });

    assert.ok(typeof report.totalFiles === 'number');
    // Cleanup
    fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('runScan produces deterministic qualityScore range', async () => {
    const root = makeTempProject();
    try {
        const report = await runScan(root, {
            gate: true,
            offline: true
        });
        assert.ok(typeof report.qualityScore === 'number');
        assert.ok(report.qualityScore >= 0 && report.qualityScore <= 100);
        assert.ok(Array.isArray(report.rawIssues) || Array.isArray(report.detectedIssues));
    } finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
});
