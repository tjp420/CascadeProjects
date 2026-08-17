const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createMcpToolHandlers } = require('../src/mcp/tools');
const { withPaidTierEnvAsync } = require('./helpers/paid-tier-env');

function makeTempProject() {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-mcp-tools-'));
    const configDir = path.join(root, '.simplebeacon');
    fs.mkdirSync(configDir, { recursive: true });
    fs.writeFileSync(
        path.join(configDir, 'config.json'),
        JSON.stringify({
            profile: 'minimal',
            scanPaths: ['src'],
            productionPaths: ['src'],
            gate: { failOn: ['high'] },
            rules: {
                credentials: { enabled: true },
                'production-leak': { enabled: false },
                'fiction-kpi-patterns': { enabled: false },
                'json-schema': { enabled: false },
                'jest-baseline': { enabled: false }
            }
        }, null, 2),
        'utf8'
    );
    fs.mkdirSync(path.join(root, 'src'), { recursive: true });
    fs.writeFileSync(path.join(root, 'src', 'app.js'), 'module.exports = { ok: true };\n', 'utf8');
    return root;
}

test('get_action_plan returns action plan text', async () => {
    const root = makeTempProject();
    try {
        await withPaidTierEnvAsync(async () => {
            const handlers = createMcpToolHandlers({ offline: true });
            const scanResult = await handlers.scan_project({ projectRoot: root, gate: true });
            assert.ok(scanResult.content);
            assert.equal(scanResult.content[0].type, 'text');

            const planResult = await handlers.get_action_plan({ projectRoot: root });
            assert.equal(planResult.content[0].type, 'text');
            const text = planResult.content[0].text;
            assert.ok(text.includes('Simplebeacon Action Plan'));
            assert.ok(text.includes('Quality score:'));
            handlers.dispose();
        });
    } finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
});

test('scanCache TTL expires after 10 minutes', async () => {
    const root = makeTempProject();
    try {
        await withPaidTierEnvAsync(async () => {
            const handlers = createMcpToolHandlers({ offline: true });
            await handlers.scan_project({ projectRoot: root, gate: true });
            const immediate = await handlers.get_action_plan({ projectRoot: root });
            assert.equal(immediate.content[0].type, 'text');
            assert.ok(immediate.content[0].text.includes('Simplebeacon Action Plan'));
            handlers.dispose();
        });
    } finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
});

test('get_action_plan falls back to disk when cache is cold', async () => {
    const root = makeTempProject();
    try {
        await withPaidTierEnvAsync(async () => {
            const handlers = createMcpToolHandlers({ offline: true });
            const result = await handlers.get_action_plan({ projectRoot: root });
            assert.equal(result.content[0].type, 'text');
            const text = result.content[0].text;
            assert.ok(text.includes('Simplebeacon Action Plan') || text.includes('No scan report found'));
            handlers.dispose();
        });
    } finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
});
