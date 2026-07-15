// simplebeacon-ignore: Scanner pattern definitions, test fixtures, and dashboard code — all findings are false positives
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { formatGithubComment, fixHint } = require('../src/reporters/github-comment');
const { resolveCiLicense, tryLocalValidation } = require('../src/lib/ci-license');
const { normalizeRelPath } = require('../src/lib/git-diff-scope');
const { generateLicenseToken, validateLicenseToken } = require('../src/lib/license-token');

test('formatGithubComment includes structured finding rows', () => {
    const body = formatGithubComment({
        qualityScore: 42,
        severityCounts: { critical: 0, high: 1, medium: 2, low: 0 },
        scanScope: { diffOnly: true, diffFileCount: 3, gatePolicy: { failOn: ['high'] } },
        gate: { pass: false, blockingCount: 1, failOn: ['high'] },
        rawIssues: [{
            severity: 'high',
            type: 'production-leak',
            pattern: 'production-leak',
            filePath: 'src/auth.cjs',
            line: 42,
            description: 'Production module references mock JSON path'
        }]
    }, null, { repo: 'org/repo', ref: 'feature/test' });

    assert.match(body, /AI Circuit Breaker/);
    assert.match(body, /PR diff \(3 files\)/);
    assert.match(body, /src\/auth\.cjs/);
    assert.match(body, /<details/);
    assert.match(body, /Fix:/);
});

test('fixHint returns playbook guidance for known kinds', () => {
    const hint = fixHint({ type: 'credentials', pattern: 'credentials' });
    assert.match(hint, /credential|Rotate|environment/i);
});

test('invalid license token fails closed when secret is configured', () => {
    process.env.SIMPLEBEACON_LICENSE_SECRET = 'test-secret-for-ci-license';
    process.env.SIMPLEBEACON_LICENSE_TOKEN = 'not-a-valid-token';
    const local = tryLocalValidation(process.env.SIMPLEBEACON_LICENSE_TOKEN);
    assert.equal(local.ok, false);
    delete process.env.SIMPLEBEACON_LICENSE_SECRET;
    delete process.env.SIMPLEBEACON_LICENSE_TOKEN;
});

test('generated license token validates locally', () => {
    const secret = 'unit-test-license-secret';
    const token = generateLicenseToken({ email: 'ci@test.com', tier: 'pro' }, secret, 60);
    const result = validateLicenseToken(token, secret);
    assert.equal(result.valid, true);
    assert.equal(result.claims.tier, 'pro');
});

test('normalizeRelPath converts backslashes', () => {
    assert.equal(normalizeRelPath('.\\src\\app.js'), 'src/app.js');
});

test('resolveCiLicense allows community mode without token', async () => {
    delete process.env.SIMPLEBEACON_LICENSE_TOKEN;
    delete process.env.CI;
    const license = await resolveCiLicense();
    assert.equal(license.ok, true);
    assert.equal(license.mode, 'community');
});
