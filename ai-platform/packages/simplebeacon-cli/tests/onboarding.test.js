const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
    installCursorRule,
    installCiWorkflow,
    installDeveloperStack
} = require('../src/lib/developer-onboarding');

test('installDeveloperStack writes ci workflow', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-onboard-'));
    const result = installDeveloperStack(tmp, {
        withCi: true
    });
    assert.equal(result.ciWorkflow.created, true);
    assert.ok(fs.existsSync(path.join(tmp, '.github', 'workflows', 'simplebeacon.yml')));
});

test('installCiWorkflow skips existing file without force', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-ci-'));
    installCiWorkflow(tmp);
    const second = installCiWorkflow(tmp);
    assert.equal(second.skipped, true);
});
