const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

const { createMcpToolHandlers } = require('../src/mcp/tools');

function createTempProject() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-gate-'));
    fs.mkdirSync(path.join(dir, '.simplebeacon'), { recursive: true });
    return dir;
}

function cleanup(dir) {
    try {
        fs.rmSync(dir, { recursive: true, force: true });
    } catch {}
}

function writeReport(projectRoot, report) {
    const reportPath = path.join(projectRoot, '.simplebeacon', 'report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report), 'utf8');
}

function callVerifyBeforeWrite(projectRoot, filePath, content, options = {}) {
    const handlers = createMcpToolHandlers({ offline: true });
    const result = handlers.verify_before_write({
        filePath,
        content,
        projectRoot,
        skipGateCheck: options.skipGateCheck
    });
    // Parse the JSON content from the MCP response
    const text = result.content[0].text;
    return JSON.parse(text);
}

// ── Pre-edit gate check tests ──

test('verify_before_write allows write when gate is passing', () => {
    const dir = createTempProject();
    try {
        writeReport(dir, {
            gatePass: true,
            gate: 'pass',
            blockingCount: 0,
            issues: []
        });
        const result = callVerifyBeforeWrite(dir, 'src/new-file.js', 'const x = 1;\n');
        assert.strictEqual(result.passed, true);
        assert.strictEqual(result.recommendedAction, 'ok-to-write');
        assert.strictEqual(result.gateBlocked, false);
        assert.ok(result.gateStatus);
        assert.strictEqual(result.gateStatus.pass, true);
    } finally {
        cleanup(dir);
    }
});

test('verify_before_write blocks write to non-blocking file when gate is failing', () => {
    const dir = createTempProject();
    try {
        writeReport(dir, {
            gatePass: false,
            gate: 'blocked',
            blockingCount: 2,
            issues: [
                { severity: 'high', filePath: 'src/broken.js', message: 'Phantom API call' },
                { severity: 'critical', filePath: 'src/other.js', message: 'Swallowed exception' }
            ]
        });
        const result = callVerifyBeforeWrite(dir, 'src/new-feature.js', 'const x = 1;\n');
        assert.strictEqual(result.passed, false);
        assert.strictEqual(result.recommendedAction, 'fix-gate-first');
        assert.strictEqual(result.gateBlocked, true);
        assert.ok(result.gateStatus);
        assert.strictEqual(result.gateStatus.pass, false);
        assert.strictEqual(result.gateStatus.blockingCount, 2);
        assert.ok(result.gateBlockingFiles.includes('src/broken.js'));
        assert.ok(result.gateBlockingFiles.includes('src/other.js'));
    } finally {
        cleanup(dir);
    }
});

test('verify_before_write allows write to gate-blocking file when gate is failing', () => {
    const dir = createTempProject();
    try {
        writeReport(dir, {
            gatePass: false,
            gate: 'blocked',
            blockingCount: 1,
            issues: [
                { severity: 'high', filePath: 'src/broken.js', message: 'Phantom API call' }
            ]
        });
        // Agent is fixing the blocking file — should be allowed
        const result = callVerifyBeforeWrite(dir, 'src/broken.js', 'const fixed = true;\n');
        assert.strictEqual(result.passed, true);
        assert.strictEqual(result.recommendedAction, 'ok-to-write');
        assert.strictEqual(result.gateBlocked, false);
    } finally {
        cleanup(dir);
    }
});

test('verify_before_write allows write when skipGateCheck is true', () => {
    const dir = createTempProject();
    try {
        writeReport(dir, {
            gatePass: false,
            gate: 'blocked',
            blockingCount: 5,
            issues: [
                { severity: 'critical', filePath: 'src/other.js', message: 'Broken' }
            ]
        });
        const result = callVerifyBeforeWrite(dir, 'src/new-file.js', 'const x = 1;\n', { skipGateCheck: true });
        assert.strictEqual(result.passed, true);
        assert.strictEqual(result.recommendedAction, 'ok-to-write');
        assert.strictEqual(result.gateBlocked, false);
        assert.strictEqual(result.gateStatus, null);
    } finally {
        cleanup(dir);
    }
});

test('verify_before_write allows write when no gate report exists', () => {
    const dir = createTempProject();
    try {
        // No report.json written
        const result = callVerifyBeforeWrite(dir, 'src/new-file.js', 'const x = 1;\n');
        assert.strictEqual(result.passed, true);
        assert.strictEqual(result.recommendedAction, 'ok-to-write');
        assert.strictEqual(result.gateBlocked, false);
        assert.strictEqual(result.gateStatus, null);
    } finally {
        cleanup(dir);
    }
});

test('verify_before_write blocks with content violations even when gate is passing', () => {
    const dir = createTempProject();
    try {
        writeReport(dir, {
            gatePass: true,
            gate: 'pass',
            blockingCount: 0,
            issues: []
        });
        // Content with a swallowed exception — should be blocked by content scanners
        const badContent = 'try {\n  doSomething();\n} catch (e) {\n  return null;\n}\n';
        const result = callVerifyBeforeWrite(dir, 'src/handler.js', badContent);
        assert.strictEqual(result.passed, false);
        assert.strictEqual(result.recommendedAction, 'fix-and-retry');
        assert.strictEqual(result.gateBlocked, false);
        assert.ok(result.blockingCount > 0);
    } finally {
        cleanup(dir);
    }
});

test('verify_before_write gate-block logs failure to failure-log.json', () => {
    const dir = createTempProject();
    try {
        writeReport(dir, {
            gatePass: false,
            gate: 'blocked',
            blockingCount: 1,
            issues: [
                { severity: 'high', filePath: 'src/broken.js', message: 'Phantom API' }
            ]
        });
        callVerifyBeforeWrite(dir, 'src/new-file.js', 'const x = 1;\n');

        // Check that the gate-block was logged
        const logPath = path.join(dir, '.simplebeacon', 'failure-log.json');
        assert.ok(fs.existsSync(logPath), 'failure-log.json should exist');
        const log = JSON.parse(fs.readFileSync(logPath, 'utf8'));
        const gateBlock = log.find(e => e.errorType === 'gate_blocking_edit_refused');
        assert.ok(gateBlock, 'should have a gate_blocking_edit_refused failure entry');
        assert.strictEqual(gateBlock.category, 'gate');
        assert.strictEqual(gateBlock.source, 'simplebeacon');
        assert.strictEqual(gateBlock.severity, 'high');
    } finally {
        cleanup(dir);
    }
});

test('verify_before_write handles backslash paths in gate-blocking files', () => {
    const dir = createTempProject();
    try {
        writeReport(dir, {
            gatePass: false,
            gate: 'blocked',
            blockingCount: 1,
            issues: [
                { severity: 'high', filePath: 'src\\broken.js', message: 'Phantom API' }
            ]
        });
        // Agent is fixing the blocking file using forward slashes
        const result = callVerifyBeforeWrite(dir, 'src/broken.js', 'const fixed = true;\n');
        assert.strictEqual(result.passed, true);
        assert.strictEqual(result.gateBlocked, false);
    } finally {
        cleanup(dir);
    }
});
