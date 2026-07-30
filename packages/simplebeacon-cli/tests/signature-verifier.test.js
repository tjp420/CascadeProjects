const { describe, it } = require('node:test');
const assert = require('node:assert');
const crypto = require('crypto');

const {
    canonicalizePolicy,
    TrustStore,
    verifyPolicySignature
} = require('../src/policy/signature-verifier');

function buildSignedPolicy(privateKeyPem, fingerprint, overrides = {}) {
    const payload = {
        policy_id: 'pol_ent_core_001',
        version: '1.4.0',
        updated_at: '2026-07-29T15:30:00Z',
        runtime_controls: {
            allow_git_bypass: false,
            max_file_size_mb: 10,
            quarantine_directory: '.simplebeacon/quarantine/'
        },
        precedence_rules: {
            override_level: 'organization',
            allow_repo_overrides: true,
            allow_user_ignores: false
        },
        rule_definitions: [
            {
                id: 'rule_sec_020',
                name: 'Unconfigured Insecure Fallbacks',
                severity: 'CRITICAL',
                action: 'BLOCK_DEPLOYMENT',
                pattern_type: 'regex',
                expression: '(simplebeacon-dev-insecure|fallback-secret-placeholder)',
                remediation: 'Use process.env only.'
            }
        ],
        ...overrides
    };

    const canonical = JSON.stringify(canonicalizeObject(payload));
    const signature = crypto.sign('sha256', Buffer.from(canonical, 'utf8'), {
        key: privateKeyPem,
        padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
        saltLength: crypto.constants.RSA_PSS_SALTLENGTH_DIGEST
    }).toString('base64');

    return {
        ...payload,
        integrity_signatures: {
            algorithm: 'RSASSA-PSS',
            public_key_fingerprint: fingerprint,
            signature
        }
    };
}

function canonicalizeObject(obj) {
    if (obj === null || typeof obj !== 'object') {
        return obj;
    }
    if (Array.isArray(obj)) {
        return obj.map(canonicalizeObject);
    }
    const out = {};
    for (const key of Object.keys(obj).sort()) {
        out[key] = canonicalizeObject(obj[key]);
    }
    return out;
}

describe('signature-verifier', () => {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
    const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' }).toString();
    const privateKeyPem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
    const fingerprint = 'sha256:test-fingerprint';
    const trustStore = new TrustStore({ [fingerprint]: publicKeyPem });

    it('returns EX_CONFIG (78) for malformed JSON input', () => {
        const result = verifyPolicySignature('{not-json', trustStore);
        assert.strictEqual(result.isValid, false);
        assert.strictEqual(result.exitCode, 78);
        assert.strictEqual(result.fingerprint, 'UNKNOWN');
    });

    it('returns EX_CONFIG (78) for missing integrity block', () => {
        const raw = JSON.stringify({ policy_id: 'x', version: '1.0.0', rule_definitions: [] });
        const result = verifyPolicySignature(raw, trustStore);
        assert.strictEqual(result.isValid, false);
        assert.strictEqual(result.exitCode, 78);
    });

    it('returns EX_OSERR (71) for invalid base64 signature payload', () => {
        const raw = JSON.stringify({
            policy_id: 'x',
            version: '1.0.0',
            rule_definitions: [],
            integrity_signatures: {
                algorithm: 'RSASSA-PSS',
                public_key_fingerprint: fingerprint,
                signature: '%%%%not-base64%%%%'
            }
        });
        const result = verifyPolicySignature(raw, trustStore);
        assert.strictEqual(result.isValid, false);
        assert.strictEqual(result.exitCode, 71);
    });

    it('returns EX_CONFIG (78) for unknown/untrusted fingerprint', () => {
        const policy = buildSignedPolicy(privateKeyPem, 'sha256:unknown-fingerprint');
        const raw = JSON.stringify(policy);
        const result = verifyPolicySignature(raw, trustStore);
        assert.strictEqual(result.isValid, false);
        assert.strictEqual(result.exitCode, 78);
    });

    it('returns EX_OSERR (71) when payload is tampered post-signature', () => {
        const policy = buildSignedPolicy(privateKeyPem, fingerprint);
        policy.rule_definitions[0].action = 'WARN';
        const raw = JSON.stringify(policy);
        const result = verifyPolicySignature(raw, trustStore);
        assert.strictEqual(result.isValid, false);
        assert.strictEqual(result.exitCode, 71);
    });

    it('returns success (0) for valid signed policy', () => {
        const policy = buildSignedPolicy(privateKeyPem, fingerprint);
        const raw = JSON.stringify(policy);
        const result = verifyPolicySignature(raw, trustStore);
        assert.strictEqual(result.isValid, true);
        assert.strictEqual(result.exitCode, 0);
        assert.strictEqual(result.fingerprint, fingerprint);
    });

    it('canonicalizePolicy strips integrity_signatures before hashing', () => {
        const policy = buildSignedPolicy(privateKeyPem, fingerprint);
        const canonical = canonicalizePolicy(JSON.stringify(policy));
        const parsed = JSON.parse(canonical);
        assert.strictEqual(Object.prototype.hasOwnProperty.call(parsed, 'integrity_signatures'), false);
    });
});
