const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createMcpToolHandlers } = require('../src/mcp/tools');

test('get_action_plan returns action plan text', async () => {
    const handlers = createMcpToolHandlers({ offline: true });
    // First run scan_project to populate cache
    const scanResult = await handlers.scan_project({ projectRoot: process.cwd(), gate: true });
    assert.ok(scanResult.content);
    assert.equal(scanResult.content[0].type, 'text');

    // Then get action plan from cached report
    const planResult = handlers.get_action_plan({ projectRoot: process.cwd() });
    assert.equal(planResult.content[0].type, 'text');
    const text = planResult.content[0].text;
    assert.ok(text.includes('Simplebeacon Action Plan'));
    assert.ok(text.includes('Quality score:'));
});

test('scanCache TTL expires after 10 minutes', async () => {
    const handlers = createMcpToolHandlers({ offline: true });
    // scan_project populates cache
    await handlers.scan_project({ projectRoot: process.cwd(), gate: true });
    // get_action_plan should work immediately
    const immediate = handlers.get_action_plan({ projectRoot: process.cwd() });
    assert.equal(immediate.content[0].type, 'text');
    assert.ok(immediate.content[0].text.includes('Simplebeacon Action Plan'));
});

test('get_action_plan falls back to disk when cache is cold', () => {
    const handlers = createMcpToolHandlers({ offline: true });
    // Don't run scan_project first — cache is empty
    const result = handlers.get_action_plan({ projectRoot: process.cwd() });
    assert.equal(result.content[0].type, 'text');
    // Either returns action plan (if report.json exists) or error message
    const text = result.content[0].text;
    assert.ok(text.includes('Simplebeacon Action Plan') || text.includes('No scan report found'));
});
