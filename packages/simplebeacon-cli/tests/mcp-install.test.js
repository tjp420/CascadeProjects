const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { buildCursorMcpJson, installCursorMcpConfig } = require('../src/mcp/install-cursor-config');

test('buildCursorMcpJson defaults to npx local bin', () => {
    const json = buildCursorMcpJson();
    assert.equal(json.mcpServers.simplebeacon.command, 'npx');
    assert.deepEqual(json.mcpServers.simplebeacon.args, ['simplebeacon-mcp', '--offline']);
});

test('buildCursorMcpJson npx-github uses -p simplebeacon for zero-install', () => {
    const json = buildCursorMcpJson({ mode: 'npx-github' });
    assert.equal(json.mcpServers.simplebeacon.command, 'npx');
    assert.deepEqual(json.mcpServers.simplebeacon.args, [
        '--yes', '-p', 'simplebeacon', 'simplebeacon-mcp', '--offline'
    ]);
});

test('installCursorMcpConfig writes .cursor/mcp.json', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-mcp-init-'));
    const result = installCursorMcpConfig(tmp);
    assert.equal(result.created, true);
    assert.ok(fs.existsSync(result.configPath));
    const parsed = JSON.parse(fs.readFileSync(result.configPath, 'utf8'));
    assert.ok(parsed.mcpServers.simplebeacon);
});

test('installCursorMcpConfig merges simplebeacon without dropping other servers', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-mcp-merge-'));
    const configPath = path.join(tmp, '.cursor', 'mcp.json');
    fs.mkdirSync(path.dirname(configPath), { recursive: true });
    fs.writeFileSync(configPath, JSON.stringify({ mcpServers: { other: { command: 'echo' } } }));
    const result = installCursorMcpConfig(tmp);
    assert.equal(result.merged, true);
    const parsed = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    assert.equal(parsed.mcpServers.other.command, 'echo');
    assert.ok(parsed.mcpServers.simplebeacon);
});

test('detectMcpMode returns monorepo when CLI bin exists', () => {
    const { detectMcpMode } = require('../src/mcp/install-cursor-config');
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-mcp-mode-'));
    const bin = path.join(tmp, 'packages', 'simplebeacon-cli', 'bin', 'simplebeacon-mcp.js');
    fs.mkdirSync(path.dirname(bin), { recursive: true });
    fs.writeFileSync(bin, '// mcp\n');
    assert.equal(detectMcpMode(tmp), 'monorepo');
});
