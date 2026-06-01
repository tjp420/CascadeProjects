const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
    createScanProgressWriter,
    readScanProgress,
    resolveScanProgressPath
} = require('../src/lib/scan-progress');

test('resolveScanProgressPath defaults to .simplebeacon/scan-progress.json', () => {
    const dir = path.join(os.tmpdir(), 'sb-progress');
    assert.equal(
        resolveScanProgressPath(dir, {}),
        path.join(dir, '.simplebeacon', 'scan-progress.json')
    );
});

test('createScanProgressWriter writes and clears progress file', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-progress-'));
    const progressPath = path.join(dir, '.simplebeacon', 'scan-progress.json');
    const writer = createScanProgressWriter(progressPath, { phase: 'gate', projectRoot: dir });
    writer.update({
        label: 'Analyzing files',
        currentFile: 'src/index.js',
        processed: 3,
        total: 10
    });

    await new Promise((resolve) => setTimeout(resolve, 200));

    const data = readScanProgress(progressPath);
    assert.equal(data.active, true);
    assert.equal(data.phase, 'gate');
    assert.equal(data.currentFile, 'src/index.js');
    assert.equal(data.processed, 3);
    assert.equal(data.total, 10);

    writer.clear();
    assert.equal(readScanProgress(progressPath).active, false);

    fs.rmSync(dir, { recursive: true, force: true });
});
