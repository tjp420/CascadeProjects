const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { createRealtimeWatcher, isScanable, SCANABLE_EXTENSIONS } = require('../src/mcp/realtime-watcher');

function makeTempDir() {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'sb-watcher-test-'));
}

function wait(ms) {
    return new Promise((r) => setTimeout(r, ms));
}

test('isScanable filters by extension and skip dirs', () => {
    assert.ok(isScanable('/project/src/index.js'));
    assert.ok(isScanable('/project/src/app.tsx'));
    assert.ok(isScanable('/project/src/api/handler.py'));
    assert.ok(!isScanable('/project/README.md'));
    assert.ok(!isScanable('/project/node_modules/foo.js'));
    assert.ok(!isScanable('/project/.git/config'));
    assert.ok(!isScanable('/project/dist/bundle.js'));
    assert.ok(!isScanable('/project/image.png'));
});

test('createRealtimeWatcher requires projectRoot', () => {
    assert.throws(() => createRealtimeWatcher({}), /projectRoot is required/);
});

test('createRealtimeWatcher requires scanFile function', () => {
    assert.throws(() => createRealtimeWatcher({ projectRoot: '/tmp' }), /scanFile function is required/);
});

test('watcher detects new file with findings and calls onFindings', async () => {
    const dir = makeTempDir();
    const findingsReceived = [];
    const scanCalls = [];

    const watcher = createRealtimeWatcher({
        projectRoot: dir,
        debounceMs: 100,
        scanFile: (absolutePath) => {
            scanCalls.push(absolutePath);
            // Simulate a finding
            return {
                findings: [{ severity: 'high', type: 'test-finding', description: 'test issue', line: 1 }],
                blockingCount: 1
            };
        },
        onFindings: (relativePath, findings, summary) => {
            findingsReceived.push({ relativePath, findings, summary });
        }
    });

    watcher.start();
    await wait(300); // let chokidar initialize

    // Create a new JS file
    const testFile = path.join(dir, 'test-file.js');
    fs.writeFileSync(testFile, 'const x = 1;\n');

    await wait(500); // wait for debounce + scan

    assert.ok(scanCalls.length > 0, 'scanFile should have been called');
    assert.ok(findingsReceived.length > 0, 'onFindings should have been called');
    assert.equal(findingsReceived[0].relativePath, 'test-file.js');
    assert.equal(findingsReceived[0].summary.blockingCount, 1);

    watcher.stop();
    fs.rmSync(dir, { recursive: true, force: true });
});

test('watcher detects file changes', async () => {
    const dir = makeTempDir();
    const findingsReceived = [];

    // Pre-create a file
    const testFile = path.join(dir, 'existing.js');
    fs.writeFileSync(testFile, 'const x = 1;\n');

    const watcher = createRealtimeWatcher({
        projectRoot: dir,
        debounceMs: 100,
        scanFile: () => ({
            findings: [{ severity: 'medium', type: 'change-finding', description: 'changed', line: 2 }],
            blockingCount: 0
        }),
        onFindings: (relativePath, findings, summary) => {
            findingsReceived.push({ relativePath, summary });
        }
    });

    watcher.start();
    await wait(300); // let chokidar initialize

    // Modify the file
    fs.writeFileSync(testFile, 'const y = 2;\n');

    await wait(500); // wait for debounce + scan

    assert.ok(findingsReceived.length > 0, 'onFindings should fire on file change');
    assert.equal(findingsReceived[0].relativePath, 'existing.js');

    watcher.stop();
    fs.rmSync(dir, { recursive: true, force: true });
});

test('watcher skips non-scanable files', async () => {
    const dir = makeTempDir();
    const scanCalls = [];

    const watcher = createRealtimeWatcher({
        projectRoot: dir,
        debounceMs: 100,
        scanFile: (p) => { scanCalls.push(p); return { findings: [], blockingCount: 0 }; },
        onFindings: () => {}
    });

    watcher.start();
    await wait(300);

    // Create a .png file — should be skipped
    fs.writeFileSync(path.join(dir, 'image.png'), Buffer.from([0x89, 0x50, 0x4E, 0x47]));

    await wait(400);

    assert.equal(scanCalls.length, 0, 'should not scan .png files');

    watcher.stop();
    fs.rmSync(dir, { recursive: true, force: true });
});

test('watcher stop prevents further scans', async () => {
    const dir = makeTempDir();
    const scanCalls = [];

    const watcher = createRealtimeWatcher({
        projectRoot: dir,
        debounceMs: 100,
        scanFile: (p) => { scanCalls.push(p); return { findings: [], blockingCount: 0 }; },
        onFindings: () => {}
    });

    watcher.start();
    await wait(300);
    watcher.stop();
    await wait(100);

    // Create a file after stop
    fs.writeFileSync(path.join(dir, 'after-stop.js'), 'const x = 1;\n');
    await wait(400);

    assert.equal(scanCalls.length, 0, 'should not scan after stop');

    fs.rmSync(dir, { recursive: true, force: true });
});

test('watcher getStats returns useful info', async () => {
    const dir = makeTempDir();
    const watcher = createRealtimeWatcher({
        projectRoot: dir,
        debounceMs: 100,
        scanFile: () => ({ findings: [], blockingCount: 0 }),
        onFindings: () => {}
    });

    assert.equal(watcher.isActive(), false);
    const beforeStats = watcher.getStats();
    assert.equal(beforeStats.active, false);

    watcher.start();
    assert.equal(watcher.isActive(), true);

    const afterStats = watcher.getStats();
    assert.equal(afterStats.active, true);
    assert.ok(afterStats.startedAt, 'startedAt should be set');

    watcher.stop();
    assert.equal(watcher.isActive(), false);

    fs.rmSync(dir, { recursive: true, force: true });
});

test('SCANABLE_EXTENSIONS includes common languages', () => {
    assert.ok(SCANABLE_EXTENSIONS.has('.js'));
    assert.ok(SCANABLE_EXTENSIONS.has('.ts'));
    assert.ok(SCANABLE_EXTENSIONS.has('.py'));
    assert.ok(SCANABLE_EXTENSIONS.has('.go'));
    assert.ok(SCANABLE_EXTENSIONS.has('.rs'));
    assert.ok(SCANABLE_EXTENSIONS.has('.lua'));
});
