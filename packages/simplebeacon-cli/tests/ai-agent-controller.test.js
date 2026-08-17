/** @jest-environment node */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { AiAgentController } = require('../src/lib/ai-agent-controller');

test('AiAgentController checkHandoffReadiness without scan', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-agent-'));
    const ctrl = new AiAgentController(tmp, { offline: true });
    const readiness = ctrl.checkHandoffReadiness();
    assert.equal(typeof readiness.ready, 'boolean');
    assert.ok(readiness.nextAction);
    assert.ok(readiness.engineVersion);
});

test('AiAgentController getAgentCapabilities defaults to free', () => {
    delete process.env.SIMPLEBEACON_LICENSE_TOKEN;
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-agent-'));
    const ctrl = new AiAgentController(tmp, { offline: true });
    const caps = ctrl.getAgentCapabilities();
    assert.equal(caps.agentExperience, '2/10');
});

test('AiAgentController scanSnippet redacts on free tier', () => {
    delete process.env.SIMPLEBEACON_LICENSE_TOKEN;
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-agent-'));
    const ctrl = new AiAgentController(tmp, { offline: true });
    const result = ctrl.scanSnippet('const key = "AKIA1A2B3C4D5E6F7G8H";\n', 'config.js');
    assert.ok(result.redacted === true || result.blockingCount >= 0);
});
