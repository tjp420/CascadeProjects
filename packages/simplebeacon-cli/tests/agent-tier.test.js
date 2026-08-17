/** @jest-environment node */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
    resolveAgentTier,
    getAgentCapabilities,
    assertCapability,
    applyFreeSnippetLimits,
    checkFreeSnippetRateLimit,
    resetSnippetRateLimitsForTests,
    PAID_ONLY_TOOLS
} = require('../src/lib/agent-tier-capabilities');
const { ENGINE_VERSION, blockingCountFromFindings, attachGateMetadata } = require('../src/lib/gate-parity');
const { createMcpToolHandlers } = require('../src/mcp/tools');

test('free tier blocks paid-only MCP tools', () => {
    delete process.env.SIMPLEBEACON_LICENSE_TOKEN;
    for (const tool of PAID_ONLY_TOOLS) {
        const check = assertCapability(tool, resolveAgentTier());
        assert.equal(check.allowed, false, tool);
        assert.equal(check.upsell.blocked, true);
    }
});

test('applyFreeSnippetLimits redacts pattern ids', () => {
    const result = applyFreeSnippetLimits({
        findings: [
            { severity: 'high', type: 'Credential', pattern: 'AKIA', description: 'secret', recommendedAction: 'remove' },
            { severity: 'medium', type: 'Slop', pattern: 'SB-FICTION-001', description: 'fake' }
        ],
        findingCount: 2,
        blockingCount: 1
    });
    assert.equal(result.findings.length, 2);
    assert.equal(result.findings[0].pattern, undefined);
    assert.equal(result.redacted, true);
    assert.match(result.upsell, /Upgrade/);
});

test('free snippet rate limit enforces daily cap', () => {
    resetSnippetRateLimitsForTests();
    for (let i = 0; i < 20; i++) {
        const r = checkFreeSnippetRateLimit('test-device');
        assert.equal(r.allowed, true);
    }
    const blocked = checkFreeSnippetRateLimit('test-device');
    assert.equal(blocked.allowed, false);
});

test('gate parity attachGateMetadata includes engineVersion', () => {
    const out = attachGateMetadata({ findings: [{ severity: 'high' }] }, { blockingCount: 1 });
    assert.equal(out.engineVersion, ENGINE_VERSION);
    assert.equal(out.blockingCount, 1);
});

test('blockingCountFromFindings counts high and critical only', () => {
    assert.equal(blockingCountFromFindings([
        { severity: 'high' },
        { severity: 'low' },
        { severity: 'critical' }
    ]), 2);
});

test('MCP exposes twenty-six tools including agent loop', () => {
    const { createMcpStdioServer } = require('../src/mcp/stdio-server');
    const server = createMcpStdioServer({ offline: true });
    const list = server.toolListResult();
    assert.equal(list.tools.length, 26);
    assert.ok(list.tools.some((t) => t.name === 'propose_fix'));
    assert.ok(list.tools.some((t) => t.name === 'agent_status'));
    assert.ok(list.tools.some((t) => t.name === 'get_context_pack'));
    assert.ok(list.tools.some((t) => t.name === 'handoff_check'));
});

test('free scan_file returns blocked upsell', () => {
    delete process.env.SIMPLEBEACON_LICENSE_TOKEN;
    const handlers = createMcpToolHandlers({ offline: true });
    const out = handlers.scan_file({ filePath: 'test.js' });
    const parsed = JSON.parse(out.content[0].text);
    assert.equal(parsed.blocked, true);
});
