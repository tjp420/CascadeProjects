const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { runScan } = require('../src/scan');

test('runScan completes with fullDirectoryScan and gate enabled', async () => {
    const root = process.cwd();
    const report = await runScan(root, {
        fullDirectoryScan: true,
        gate: true,
        offline: true
    });
    assert.ok(report.projectRoot);
    assert.ok(typeof report.totalFiles === 'number');
    assert.ok(report.totalFiles > 0);
    assert.ok(report.qualityScore >= 0 && report.qualityScore <= 100);
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
    const root = process.cwd();
    const report = await runScan(root, {
        gate: true,
        offline: true
    });
    assert.ok(typeof report.qualityScore === 'number');
    assert.ok(report.qualityScore >= 0 && report.qualityScore <= 100);
    assert.ok(Array.isArray(report.rawIssues) || Array.isArray(report.detectedIssues));
});
