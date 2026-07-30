const test = require('node:test');
const assert = require('node:assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { orchestratePolicyPipeline } = require('../src/policy/PolicyOrchestrator');
const { TrustStore, canonicalizePolicy } = require('../src/policy/signature-verifier');

const FIXTURE_DIR = path.join(__dirname, 'fixtures', 'policies');
const TELEMETRY_PATH = path.join(FIXTURE_DIR, 'key-telemetry.json');

function sortKeysObject(value) {
    if (value === null || typeof value !== 'object') {
        return value;
    }
    if (Array.isArray(value)) {
        return value.map(sortKeysObject);
    }
    const out = {};
    for (const key of Object.keys(value).sort()) {
        out[key] = sortKeysObject(value[key]);
    }
    return out;
}

function signPolicy(policy, privateKeyPem) {
    const canonical = canonicalizePolicy(JSON.stringify(policy));
    return crypto.sign('sha256', Buffer.from(canonical, 'utf8'), {
        key: privateKeyPem,
        padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
        saltLength: crypto.constants.RSA_PSS_SALTLENGTH_DIGEST
    }).toString('base64');
}

function writeFixtures() {
    fs.mkdirSync(FIXTURE_DIR, { recursive: true });

    const trustedKeys = crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
    });

    const rogueKeys = crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
    });

    const trustedFingerprint = 'sha256:' + crypto.createHash('sha256').update(trustedKeys.publicKey).digest('hex');
    const rogueFingerprint = 'sha256:' + crypto.createHash('sha256').update(rogueKeys.publicKey).digest('hex');

    const orgBasePolicy = {
        policy_id: 'org_global_standard',
        version: '1.0.0',
        updated_at: '2026-07-29T12:00:00Z',
        runtime_controls: {
            allow_git_bypass: false,
            max_file_size_mb: 10,
            quarantine_directory: '.simplebeacon/q/'
        },
        precedence_rules: {
            override_level: 'organization',
            allow_repo_overrides: true,
            allow_user_ignores: false
        },
        rule_definitions: [
            {
                id: 'RULE_SEC_01',
                name: 'Insecure Fallbacks',
                severity: 'CRITICAL',
                action: 'BLOCK_DEPLOYMENT',
                pattern_type: 'regex',
                expression: 'simplebeacon-dev-insecure',
                remediation: 'Fix variables'
            }
        ]
    };

    const repoOverridePolicy = {
        policy_id: 'repo_local_additions',
        version: '1.0.0',
        updated_at: '2026-07-29T12:05:00Z',
        runtime_controls: {
            allow_git_bypass: false,
            max_file_size_mb: 15,
            quarantine_directory: '.simplebeacon/q/'
        },
        precedence_rules: {
            override_level: 'repository',
            allow_repo_overrides: true,
            allow_user_ignores: false
        },
        rule_definitions: [
            {
                id: 'RULE_AI_02',
                name: 'Markdown Fences',
                severity: 'LOW',
                action: 'WARN',
                pattern_type: 'heuristic',
                expression: '```',
                remediation: 'Strip markdown fences'
            }
        ]
    };

    const canonicalOrg = sortKeysObject(JSON.parse(JSON.stringify(orgBasePolicy)));
    orgBasePolicy.integrity_signatures = {
        algorithm: 'RSASSA-PSS',
        public_key_fingerprint: trustedFingerprint,
        signature: signPolicy(canonicalOrg, trustedKeys.privateKey)
    };
    fs.writeFileSync(path.join(FIXTURE_DIR, 'org-valid.json'), JSON.stringify(orgBasePolicy, null, 2));

    const canonicalRepo = sortKeysObject(JSON.parse(JSON.stringify(repoOverridePolicy)));
    repoOverridePolicy.integrity_signatures = {
        algorithm: 'RSASSA-PSS',
        public_key_fingerprint: trustedFingerprint,
        signature: signPolicy(canonicalRepo, trustedKeys.privateKey)
    };
    fs.writeFileSync(path.join(FIXTURE_DIR, 'repo-valid.json'), JSON.stringify(repoOverridePolicy, null, 2));

    const tamperedPolicy = JSON.parse(JSON.stringify(orgBasePolicy));
    tamperedPolicy.rule_definitions[0].action = 'IGNORE';
    fs.writeFileSync(path.join(FIXTURE_DIR, 'org-tampered.json'), JSON.stringify(tamperedPolicy, null, 2));

    const roguePolicy = JSON.parse(JSON.stringify(orgBasePolicy));
    const canonicalRogue = sortKeysObject(JSON.parse(JSON.stringify(orgBasePolicy)));
    roguePolicy.integrity_signatures = {
        algorithm: 'RSASSA-PSS',
        public_key_fingerprint: rogueFingerprint,
        signature: signPolicy(canonicalRogue, rogueKeys.privateKey)
    };
    fs.writeFileSync(path.join(FIXTURE_DIR, 'org-untrusted-fingerprint.json'), JSON.stringify(roguePolicy, null, 2));

    const corruptedSigPolicy = JSON.parse(JSON.stringify(orgBasePolicy));
    corruptedSigPolicy.integrity_signatures.signature = 'ThisIsNotAValidBase64SignatureString!!!';
    fs.writeFileSync(path.join(FIXTURE_DIR, 'org-corrupted-format.json'), JSON.stringify(corruptedSigPolicy, null, 2));

    const telemetry = {
        trusted_fingerprint: trustedFingerprint,
        trusted_public_key: trustedKeys.publicKey,
        rogue_fingerprint: rogueFingerprint,
        rogue_public_key: rogueKeys.publicKey
    };
    fs.writeFileSync(TELEMETRY_PATH, JSON.stringify(telemetry, null, 2));

    return telemetry;
}

function captureExit(fn) {
    const originalExit = process.exit;
    let capturedCode = null;

    process.exit = (code) => {
        capturedCode = code;
        throw new Error(`MOCK_EXIT_TRIGGERED:${code}`);
    };

    try {
        fn();
    } catch (err) {
        if (!(err instanceof Error) || !err.message.startsWith('MOCK_EXIT_TRIGGERED:')) {
            throw err;
        }
    } finally {
        process.exit = originalExit;
    }

    return capturedCode;
}

const telemetry = writeFixtures();
const testTrustStore = new TrustStore({
    [telemetry.trusted_fingerprint]: telemetry.trusted_public_key
});

test('PolicyOrchestrator merges valid org and repo policies', () => {
    const orgPath = path.join(FIXTURE_DIR, 'org-valid.json');
    const repoPath = path.join(FIXTURE_DIR, 'repo-valid.json');

    let resolvedPolicy;
    const exitCode = captureExit(() => {
        resolvedPolicy = orchestratePolicyPipeline(orgPath, repoPath, testTrustStore);
    });

    assert.strictEqual(exitCode, null);
    assert.ok(resolvedPolicy);
    assert.strictEqual(resolvedPolicy.policy_id, 'org_global_standard');
    assert.strictEqual(
        resolvedPolicy.rule_definitions.some((rule) => rule.id === 'RULE_AI_02'),
        true
    );
});

test('PolicyOrchestrator exits 78 for untrusted fingerprint', () => {
    const untrustedPath = path.join(FIXTURE_DIR, 'org-untrusted-fingerprint.json');
    const exitCode = captureExit(() => {
        orchestratePolicyPipeline(untrustedPath, null, testTrustStore);
    });
    assert.strictEqual(exitCode, 78);
});

test('PolicyOrchestrator exits 71 for tampered payload', () => {
    const tamperedPath = path.join(FIXTURE_DIR, 'org-tampered.json');
    const exitCode = captureExit(() => {
        orchestratePolicyPipeline(tamperedPath, null, testTrustStore);
    });
    assert.strictEqual(exitCode, 71);
});

test('PolicyOrchestrator exits 71 for corrupted signature format', () => {
    const corruptedPath = path.join(FIXTURE_DIR, 'org-corrupted-format.json');
    const exitCode = captureExit(() => {
        orchestratePolicyPipeline(corruptedPath, null, testTrustStore);
    });
    assert.strictEqual(exitCode, 71);
});

test('PolicyOrchestrator exits 78 for missing organization policy file', () => {
    const missingPath = path.join(FIXTURE_DIR, 'does-not-exist-at-all.json');
    const exitCode = captureExit(() => {
        orchestratePolicyPipeline(missingPath, null, testTrustStore);
    });
    assert.strictEqual(exitCode, 78);
});