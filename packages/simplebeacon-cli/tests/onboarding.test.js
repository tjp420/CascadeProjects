const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { installCursorMcpConfig } = require('../src/mcp/install-cursor-config');
const {
    installCiWorkflow,
    installDeveloperStack,
    installAgentStack
} = require('../src/lib/developer-onboarding');

test('buildCursorMcpJson defaults to npx local bin', () => {
    const { buildCursorMcpJson } = require('../src/mcp/install-cursor-config');
    const parsed = buildCursorMcpJson();
    assert.equal(parsed.mcpServers.simplebeacon.command, 'npx');
});

test('installDeveloperStack writes mcp, instructions, and ci workflow', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-onboard-'));
    const result = installDeveloperStack(tmp, {
        withMcp: true,
        withCursorRule: true,
        withCi: true
    });
    assert.ok(Array.isArray(result.hosts));
    const cursor = result.hosts.find((h) => h.host === 'cursor');
    assert.ok(cursor);
    assert.equal(cursor.mcp.created || cursor.mcp.merged, true);
    assert.equal(cursor.instructions.created, true);
    assert.equal(result.ciWorkflow.created, true);
    assert.ok(fs.existsSync(path.join(tmp, '.cursor', 'mcp.json')));
    assert.ok(fs.existsSync(path.join(tmp, '.cursor', 'rules', 'simplebeacon-ai-workflow.mdc')));
    assert.ok(fs.existsSync(path.join(tmp, '.github', 'workflows', 'simplebeacon.yml')));
});

test('installAgentStack starter installs all host configs', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-agent-'));
    const result = installAgentStack(tmp, { starter: true, force: true });
    assert.equal(result.hosts.length, 11);
    assert.ok(fs.existsSync(path.join(tmp, '.windsurf', 'mcp.json')));
    assert.ok(fs.existsSync(path.join(tmp, '.github', 'copilot-instructions.md')));
    assert.ok(fs.existsSync(path.join(tmp, 'AGENTS.md')));
    assert.ok(result.cursorHooks?.created || result.cursorHooks?.skipped);
});

test('installCiWorkflow skips existing file without force', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-ci-'));
    installCiWorkflow(tmp);
    const second = installCiWorkflow(tmp);
    assert.equal(second.skipped, true);
});
