/**
 * Gate parity contract — CLI snippet scanner and shared gate metadata agree.
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const {
    ENGINE_VERSION,
    attachGateMetadata,
    blockingCountFromFindings
} = require('../src/lib/gate-parity');
const { scanSnippetContent } = require('../src/lib/snippet-scanner');

const FIXTURE = "const key = 'AKIAIOSFODNN7EXAMPLE';\n";

test('ENGINE_VERSION matches browser worker contract tag', () => {
    assert.equal(ENGINE_VERSION, 'simplebeacon-gate-v1.3.0');
});

test('MCP scan_snippet attachGateMetadata uses shared blockingCount semantics', async () => {
    const result = await scanSnippetContent(FIXTURE, {
        filePath: 'src/secrets.js',
        projectRoot: path.join(__dirname, '../../..'),
        offline: true
    });
    const meta = attachGateMetadata(result, {
        gatePass: result.blockingCount === 0,
        blockingCount: result.blockingCount
    });
    assert.equal(meta.engineVersion, ENGINE_VERSION);
    assert.equal(meta.blockingCount, blockingCountFromFindings(result.findings));
    assert.equal(typeof meta.gatePass, 'boolean');
});

test('blockingCount only counts high and critical severities', () => {
    const count = blockingCountFromFindings([
        { severity: 'critical' },
        { severity: 'high' },
        { severity: 'medium' },
        { severity: 'low' }
    ]);
    assert.equal(count, 2);
});
