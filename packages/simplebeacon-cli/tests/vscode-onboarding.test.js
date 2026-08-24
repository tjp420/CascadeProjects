const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { buildVscodeMcpJson, installVscodeMcpConfig } = require('../src/mcp/install-cursor-config');
const { installVscodeCopilotInstructions, installDeveloperStack } = require('../src/lib/developer-onboarding');

test('buildVscodeMcpJson defaults to npx local bin', () => {
    const json = buildVscodeMcpJson();
    assert.equal(json.mcpServers.simplebeacon.command, 'npx');
    assert.deepEqual(json.mcpServers.simplebeacon.args, ['simplebeacon-mcp', '--offline']);
});

test('buildVscodeMcpJson npx-github uses -p simplebeacon for zero-install', () => {
    const json = buildVscodeMcpJson({ mode: 'npx-github' });
    assert.equal(json.mcpServers.simplebeacon.command, 'npx');
    assert.deepEqual(json.mcpServers.simplebeacon.args, [
        '--yes', '-p', 'simplebeacon', 'simplebeacon-mcp', '--offline'
    ]);
});

test('buildVscodeMcpJson monorepo uses node + local bin', () => {
    const json = buildVscodeMcpJson({ mode: 'monorepo' });
    assert.equal(json.mcpServers.simplebeacon.command, 'node');
    assert.deepEqual(json.mcpServers.simplebeacon.args, ['packages/simplebeacon-cli/bin/simplebeacon-mcp.js', '--offline']);
});

test('installVscodeMcpConfig writes .vscode/mcp.json', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-vscode-mcp-'));
    const result = installVscodeMcpConfig(tmp);
    assert.equal(result.created, true);
    assert.ok(fs.existsSync(result.configPath));
    const parsed = JSON.parse(fs.readFileSync(result.configPath, 'utf8'));
    assert.ok(parsed.mcpServers.simplebeacon);
    assert.equal(parsed.mcpServers.simplebeacon.env.SIMPLEBEACON_OFFLINE, '1');
});

test('installVscodeMcpConfig skips existing without force', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-vscode-mcp-skip-'));
    installVscodeMcpConfig(tmp);
    const second = installVscodeMcpConfig(tmp);
    assert.equal(second.skipped, true);
});

test('installVscodeMcpConfig overwrites with force', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-vscode-mcp-force-'));
    installVscodeMcpConfig(tmp);
    const second = installVscodeMcpConfig(tmp, { force: true });
    assert.equal(second.created, true);
});

test('installVscodeCopilotInstructions writes .github/copilot-instructions.md', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-vscode-copilot-'));
    const result = installVscodeCopilotInstructions(tmp);
    assert.equal(result.created, true);
    assert.ok(fs.existsSync(result.path));
    const content = fs.readFileSync(result.path, 'utf8');
    assert.ok(content.includes('SimpleBeacon Scan Workflow'));
    assert.ok(content.includes('scan_snippet'));
});

test('installDeveloperStack with withVscode writes vscode mcp + copilot instructions', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-vscode-stack-'));
    const result = installDeveloperStack(tmp, {
        withVscode: true
    });
    assert.equal(result.vscodeMcp.created, true);
    assert.equal(result.vscodeCopilotInstructions.created, true);
    assert.ok(fs.existsSync(path.join(tmp, '.vscode', 'mcp.json')));
    assert.ok(fs.existsSync(path.join(tmp, '.github', 'copilot-instructions.md')));
    // Should not create Cursor files when only withVscode is set
    assert.equal(result.mcp, null);
    assert.equal(result.cursorRule, null);
});

test('installDeveloperStack with starter writes both cursor + vscode + ci', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-vscode-starter-'));
    const result = installDeveloperStack(tmp, {
        withMcp: true,
        withCursorRule: true,
        withVscode: true,
        withCi: true
    });
    assert.equal(result.mcp.created, true);
    assert.equal(result.cursorRule.created, true);
    assert.equal(result.vscodeMcp.created, true);
    assert.equal(result.vscodeCopilotInstructions.created, true);
    assert.equal(result.ciWorkflow.created, true);
    assert.ok(fs.existsSync(path.join(tmp, '.cursor', 'mcp.json')));
    assert.ok(fs.existsSync(path.join(tmp, '.cursor', 'rules', 'simplebeacon-scan-workflow.mdc')));
    assert.ok(fs.existsSync(path.join(tmp, '.vscode', 'mcp.json')));
    assert.ok(fs.existsSync(path.join(tmp, '.github', 'copilot-instructions.md')));
    assert.ok(fs.existsSync(path.join(tmp, '.github', 'workflows', 'simplebeacon.yml')));
});
