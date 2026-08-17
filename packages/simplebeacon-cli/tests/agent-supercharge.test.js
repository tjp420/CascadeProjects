/**
 * Agent Supercharge — one-call briefing for coding agent plugins
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
    buildAgentSupercharge,
    formatSuperchargeMarkdown,
    writeAgentSupercharge,
    detectInstalledHosts
} = require('../src/lib/agent-supercharge');
const { createMcpToolHandlers } = require('../src/mcp/tools');
const { installAgentHosts } = require('../src/lib/agent-host-adapters');

test('buildAgentSupercharge returns mission and playbook', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-sc-'));
    fs.writeFileSync(path.join(tmp, 'package.json'), JSON.stringify({ name: 't' }), 'utf8');
    const bundle = buildAgentSupercharge(tmp, { paid: true });
    assert.equal(bundle.kind, 'agent-supercharge');
    assert.ok(bundle.mission.headline);
    assert.ok(bundle.playbook.sessionStart.length >= 3);
    assert.ok(bundle.toolRouter.length >= 5);
    assert.ok(bundle.agentPrompt.includes('SimpleBeacon'));
});

test('writeAgentSupercharge writes markdown artifact', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-scw-'));
    const { path: outPath, bundle } = writeAgentSupercharge(tmp, { paid: true });
    assert.ok(fs.existsSync(outPath));
    const md = fs.readFileSync(outPath, 'utf8');
    assert.match(md, /Agent Supercharge/);
    assert.match(md, /Session playbook/);
    assert.ok(bundle.mcpTools.startHere === 'supercharge_agent');
});

test('detectInstalledHosts finds cursor after install', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-dh-'));
    installAgentHosts(tmp, { hosts: 'cursor', force: true, supercharge: true });
    const status = detectInstalledHosts(tmp);
    assert.ok(status.detected.includes('cursor'));
});

test('MCP exposes supercharge_agent and install_agent_plugin', () => {
    const { createMcpStdioServer } = require('../src/mcp/stdio-server');
    const server = createMcpStdioServer({ offline: true });
    const list = server.toolListResult();
    assert.ok(list.tools.some((t) => t.name === 'supercharge_agent'));
    assert.ok(list.tools.some((t) => t.name === 'install_agent_plugin'));
    assert.ok(list.tools.length >= 22);
});

test('supercharge_agent handler returns structured JSON', () => {
    delete process.env.SIMPLEBEACON_LICENSE_TOKEN;
    const handlers = createMcpToolHandlers({ offline: true });
    const out = handlers.supercharge_agent({ projectRoot: process.cwd(), task: 'hygiene' });
    const parsed = JSON.parse(out.content[0].text);
    assert.equal(parsed.kind, 'agent-supercharge');
    assert.ok(parsed.hostStatus);
    assert.equal(parsed.agentExperience, '2/10');
});

test('buildAgentSupercharge exposes PDA modes and scan defaults', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-pda-'));
    fs.writeFileSync(path.join(tmp, 'package.json'), JSON.stringify({ name: 'mono', workspaces: ['packages/*'] }), 'utf8');
    const bundle = buildAgentSupercharge(tmp, { task: 'handoff' });
    assert.ok(Array.isArray(bundle.pdaModes));
    assert.equal(bundle.pdaModes.length, 3);
    assert.ok(bundle.pdaModes.some((m) => m.id === 'handoff'));
    assert.ok(bundle.pdaModes.some((m) => m.id === 'security'));
    assert.ok(bundle.pdaModes.some((m) => m.id === 'gamedev'));
    assert.equal(bundle.pdaMode, 'handoff');
    assert.ok(bundle.pdaScanDefaults);
    assert.equal(bundle.pdaScanDefaults.gate, true);
    assert.equal(bundle.pdaScanDefaults.fullDirectoryScan, false);
    assert.equal(bundle.pdaScanDefaults.monorepo, true);
});

test('supercharge_agent with security task selects PDA mode', () => {
    const handlers = createMcpToolHandlers({ offline: true });
    const out = handlers.supercharge_agent({ projectRoot: process.cwd(), task: 'security' });
    const parsed = JSON.parse(out.content[0].text);
    assert.equal(parsed.pdaMode, 'security');
    assert.equal(parsed.taskProfile.id, 'security');
});

test('install_agent_plugin wires copilot instructions', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-cp-'));
    const handlers = createMcpToolHandlers({ offline: true });
    const out = handlers.install_agent_plugin({ projectRoot: tmp, hosts: 'copilot,universal', force: true });
    const parsed = JSON.parse(out.content[0].text);
    assert.equal(parsed.ok, true);
    assert.ok(fs.existsSync(path.join(tmp, '.github', 'copilot-instructions.md')));
    assert.ok(fs.existsSync(path.join(tmp, 'AGENTS.md')));
});

test('formatSuperchargeMarkdown includes git section when present', () => {
    const md = formatSuperchargeMarkdown({
        agentPrompt: 'test',
        mission: { headline: 'Fix 1 blocker', nextAction: 'scan', gatePass: false, blockingCount: 1 },
        agentExperience: '11/10',
        generatedAt: new Date().toISOString(),
        git: { branch: 'main', dirty: true, modified: 2, staged: 0, untracked: 0, recentFiles: ['a.js'] },
        hostStatus: { detected: ['cursor'], installed: ['cursor'], missing: [] },
        playbook: { sessionStart: ['step 1'] },
        toolRouter: [{ when: 'start', tool: 'supercharge_agent' }]
    });
    assert.match(md, /Git snapshot/);
    assert.match(md, /main/);
});
