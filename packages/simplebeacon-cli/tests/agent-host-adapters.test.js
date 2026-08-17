const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
    parseHostsOption,
    installHostMcp,
    installHostInstructions,
    installAgentHosts,
    buildMcpServerEntry,
    SECTION_MARKER
} = require('../src/lib/agent-host-adapters');

test('parseHostsOption resolves all and subsets', () => {
    assert.deepEqual(parseHostsOption('all'), ['cursor', 'windsurf', 'continue', 'claude', 'cline', 'copilot', 'aider', 'roo', 'opencode', 'zed', 'universal']);
    assert.deepEqual(parseHostsOption('auto'), ['cursor', 'windsurf', 'continue', 'claude', 'cline', 'copilot', 'aider', 'roo', 'opencode', 'zed', 'universal']);
    assert.deepEqual(parseHostsOption('cursor,continue,copilot'), ['cursor', 'continue', 'copilot']);
});

test('buildMcpServerEntry returns command and env', () => {
    const entry = buildMcpServerEntry(process.cwd());
    assert.ok(entry.command);
    assert.ok(Array.isArray(entry.args));
    assert.equal(entry.env.SIMPLEBEACON_OFFLINE, '1');
});

test('installHostMcp writes cursor and windsurf configs', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-adapt-'));
    const cursor = installHostMcp('cursor', tmp, { force: true });
    const windsurf = installHostMcp('windsurf', tmp, { force: true });
    assert.equal(cursor.created || cursor.merged, true);
    assert.equal(windsurf.created || windsurf.merged, true);
    assert.ok(fs.existsSync(path.join(tmp, '.cursor', 'mcp.json')));
    assert.ok(fs.existsSync(path.join(tmp, '.windsurf', 'mcp.json')));
});

test('installHostMcp merges continue config without clobbering', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-cont-'));
    fs.mkdirSync(path.join(tmp, '.continue'), { recursive: true });
    fs.writeFileSync(
        path.join(tmp, '.continue', 'config.json'),
        JSON.stringify({ models: [{ title: 'test' }] }, null, 2),
        'utf8'
    );
    const result = installHostMcp('continue', tmp, { force: false });
    assert.equal(result.merged, true);
    const cfg = JSON.parse(fs.readFileSync(path.join(tmp, '.continue', 'config.json'), 'utf8'));
    assert.ok(cfg.experimental?.modelContextProtocolServers?.some((s) => s.name === 'simplebeacon'));
    assert.ok(cfg.models);
});

test('installHostInstructions appends AGENTS.md section merge-safe', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-agents-'));
    fs.writeFileSync(path.join(tmp, 'AGENTS.md'), '# My project\n\nExisting notes.\n', 'utf8');
    const first = installHostInstructions('universal', tmp, { force: false });
    assert.equal(first.merged, true);
    assert.ok(fs.readFileSync(path.join(tmp, 'AGENTS.md'), 'utf8').includes(SECTION_MARKER));
    const second = installHostInstructions('universal', tmp, { force: false });
    assert.equal(second.skipped, true);
    assert.equal(second.unchanged, true);
});

test('installAgentHosts with hosts subset only writes selected hosts', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-sub-'));
    const results = installAgentHosts(tmp, { hosts: 'cursor,universal', force: true });
    assert.equal(results.length, 2);
    assert.ok(fs.existsSync(path.join(tmp, '.cursor', 'mcp.json')));
    assert.ok(fs.existsSync(path.join(tmp, 'AGENTS.md')));
    assert.ok(!fs.existsSync(path.join(tmp, '.windsurf', 'mcp.json')));
});

test('installAgentHosts writes cursor mdc rule with supercharge workflow', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-mdc-'));
    installAgentHosts(tmp, { hosts: 'cursor', force: true, supercharge: true });
    const rulePath = path.join(tmp, '.cursor', 'rules', 'simplebeacon-ai-workflow.mdc');
    assert.ok(fs.existsSync(rulePath));
    const content = fs.readFileSync(rulePath, 'utf8');
    assert.match(content, /supercharge_agent/);
    assert.match(content, /^---/m);
});
