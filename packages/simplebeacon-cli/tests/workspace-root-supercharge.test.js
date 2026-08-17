const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { findWorkspaceRoot, resolveScanAndWorkspaceRoots } = require('../src/lib/workspace-root');
const { buildAgentSupercharge } = require('../src/lib/agent-supercharge');

test('findWorkspaceRoot walks up to git root', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-wsr-'));
    const nested = path.join(tmp, 'ai-platform');
    fs.mkdirSync(nested, { recursive: true });
    fs.mkdirSync(path.join(tmp, '.git'));
    fs.mkdirSync(path.join(tmp, '.cursor'), { recursive: true });
    fs.writeFileSync(path.join(tmp, '.cursor', 'mcp.json'), '{}');
    assert.equal(findWorkspaceRoot(nested), tmp);
});

test('buildAgentSupercharge detects hosts at workspace root for nested scan', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-nest-'));
    const nested = path.join(tmp, 'ai-platform');
    fs.mkdirSync(path.join(tmp, '.cursor', 'rules'), { recursive: true });
    fs.mkdirSync(nested, { recursive: true });
    fs.mkdirSync(path.join(nested, '.simplebeacon'), { recursive: true });
    fs.writeFileSync(path.join(tmp, '.cursor', 'mcp.json'), JSON.stringify({ mcpServers: { simplebeacon: { command: 'node' } } }), 'utf8');
    fs.writeFileSync(path.join(tmp, '.cursor', 'rules', 'simplebeacon-ai-workflow.mdc'), '---\ndescription: test\n---\n# SimpleBeacon\nscan_snippet', 'utf8');
    fs.writeFileSync(path.join(nested, '.simplebeacon', 'report.json'), JSON.stringify({ gate: { pass: true, blockingCount: 0 } }), 'utf8');
    const bundle = buildAgentSupercharge(nested, { paid: true });
    assert.equal(bundle.scanRoot, path.resolve(nested));
    assert.equal(bundle.workspaceRoot, path.resolve(tmp));
    assert.ok(bundle.hostStatus.detected.includes('cursor'));
});

test('supercharge CLI path writes artifact via library', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-cli-sc-'));
    fs.mkdirSync(path.join(tmp, '.simplebeacon'), { recursive: true });
    fs.writeFileSync(path.join(tmp, '.simplebeacon', 'report.json'), JSON.stringify({ gate: { pass: true, blockingCount: 0 } }), 'utf8');
    const { writeAgentSupercharge } = require('../src/lib/agent-supercharge');
    writeAgentSupercharge(tmp, { paid: true, task: 'handoff' });
    assert.ok(fs.existsSync(path.join(tmp, '.simplebeacon', 'agent-supercharge.md')));
});
