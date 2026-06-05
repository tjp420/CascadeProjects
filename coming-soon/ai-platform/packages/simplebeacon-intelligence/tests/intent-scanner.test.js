const { test } = require('node:test');
const assert = require('node:assert/strict');
const { scanIntent, scanStructuralIntent, INTENT_RULE_IDS } = require('../src/index');

const HOLLOW_PYTHON = `
def process_user_metrics_v2(user_id):
    data = get_user(user_id)
    val = data.metrics
    output = []
    temp = val.score
    info = {"status": "success", "completion_rate": 99.4}
    return info
`;

const CREDENTIAL_STUB_JS = `
const config = {
    api_key: "abc",
    secret_token: "your_secret_here"
};
`;

test('scanIntent detects hollow Python function (SB-INTENT-001)', () => {
    const result = scanIntent(HOLLOW_PYTHON, {
        filePath: 'analytics_worker.py',
        languages: ['python']
    });
    assert.ok(result.findingCount >= 1);
    assert.ok(result.findings.some((f) => f.id === INTENT_RULE_IDS.HOLLOW_FUNCTION));
});

test('scanIntent detects credential mock stub (SB-INTENT-002)', () => {
    const result = scanIntent(CREDENTIAL_STUB_JS, {
        filePath: 'config/settings.js',
        languages: ['javascript']
    });
    assert.ok(result.findings.some((f) => f.id === INTENT_RULE_IDS.CREDENTIAL_STUB));
    assert.ok(result.blockingCount >= 1);
});

test('scanIntent skips unsupported languages', () => {
    const result = scanIntent('package main\nfunc main() {}', {
        filePath: 'main.go',
        languages: ['javascript', 'python']
    });
    assert.equal(result.skipped, true);
});

test('scanIntent returns localOnly and structural engine on sync path', () => {
    const result = scanIntent(HOLLOW_PYTHON, { filePath: 'worker.py', languages: ['python'] });
    assert.equal(result.localOnly, true);
    assert.equal(result.engine, 'structural');
    assert.equal(result.treeSitterUsed, false);
});

test('scanStructuralIntent flags try/except pass pattern', () => {
    const code = `
def flaky_handler():
    try:
        do_work()
    except Exception:
        pass
    return {"ok": True}
`;
    const findings = scanStructuralIntent(code, { filePath: 'handler.py', language: 'python' });
    assert.ok(findings.some((f) => f.id === INTENT_RULE_IDS.TRY_EXCEPT_PASS));
});

test('fingerprint matching adds SB-INTENT-003 when profile aligns', () => {
    const result = scanIntent(HOLLOW_PYTHON, {
        filePath: 'worker.py',
        languages: ['python'],
        fingerprintMatch: true
    });
    const fp = result.findings.filter((f) => f.id === INTENT_RULE_IDS.FINGERPRINT_MATCH);
    assert.ok(fp.length >= 1, 'expected at least one fingerprint match for hollow Python stub');
});
