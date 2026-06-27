/**
 * Credential-pattern scanner — regression tests for suppression and allowlisting.
 */

const { describe, it } = require('node:test');
const assert = require('node:assert');
const { scanTextContent, scanCredentialPatterns } = require('../src/lib/credential-pattern-scanner.js');

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function expectNoFindings(fileName, content) {
    const findings = scanTextContent(fileName, content);
    assert.strictEqual(
        findings.length, 0,
        `Expected 0 findings for ${fileName}, got ${findings.length}: ` +
        findings.map(f => `${f.pattern} at L${f.line}`).join(', ')
    );
}

function expectFindings(fileName, content, count = 1) {
    const findings = scanTextContent(fileName, content);
    assert.ok(
        findings.length >= count,
        `Expected at least ${count} finding(s) for ${fileName}, got ${findings.length}`
    );
    return findings;
}

/* ------------------------------------------------------------------ */
/*  Allowlist suppression                                             */
/* ------------------------------------------------------------------ */

describe('Allowlist suppression', () => {
    it('ignores placeholder api keys', () => {
        const content = `const apiKey = 'placeholder-key-12345';`; // simplebeacon-ignore credentials
        expectNoFindings('config.js', content);
    });

    it('ignores dummy tokens', () => {
        const content = `const token = 'dummy-token-for-testing';`; // simplebeacon-ignore credentials
        expectNoFindings('test.js', content);
    });

    it('ignores test-secret strings', () => {
        const content = `const secret = 'test-secret-value';`;
        expectNoFindings('test.js', content);
    });

    it('ignores fake-api-key strings', () => {
        const content = `const key = 'fake-api-key-1234567890abcdef';`; // simplebeacon-ignore credentials
        expectNoFindings('config.js', content);
    });

    it('ignores sample-token strings', () => {
        const content = `const token = 'sample-token-abc123';`; // simplebeacon-ignore credentials
        expectNoFindings('config.js', content);
    });

    it('ignores mock-secret strings', () => {
        const content = `const secret = 'mock-secret-value';`;
        expectNoFindings('test.js', content);
    });

    it('ignores template-secret strings', () => {
        const content = `const secret = 'template-secret-12345';`;
        expectNoFindings('template.js', content);
    });

    it('ignores example-key strings', () => {
        const content = `const key = 'example-key-12345';`;
        expectNoFindings('config.js', content);
    });
});

/* ------------------------------------------------------------------ */
/*  Suppression comment                                               */
/* ------------------------------------------------------------------ */

describe('Suppression comment', () => {
    it('ignores credentials with // simplebeacon-ignore credentials', () => {
        const content = `const secret = 'AKIAIOSFODNN7EXAMPLE'; // simplebeacon-ignore credentials`; // simplebeacon-ignore credentials
        expectNoFindings('config.js', content);
    });

    it('still flags credentials without suppression comment', () => {
        const content = `const token = 'ghp_abcdefghijklmnopqrstuvwxyz12';`;
        expectFindings('config.js', content);
    });

    it('ignores real-looking key with suppression', () => {
        const content = `const key = 'sk-live-abcdefghijklmnopqrstuvwxyz'; // simplebeacon-ignore credentials`;
        expectNoFindings('stripe.js', content);
    });
});

/* ------------------------------------------------------------------ */
/*  Real credential detection (not suppressed)                        */
/* ------------------------------------------------------------------ */

describe('Real credential detection', () => {
    it('flags AWS access key', () => {
        const content = `const key = 'AKIAQWERTYUIOPASDFGH';`;
        expectFindings('config.js', content);
    });

    it('flags GitHub PAT', () => {
        const content = `const token = 'ghp_abcdefghijklmnopqrstuvwxyz12';`;
        expectFindings('config.js', content);
    });

    it('flags OpenAI key', () => {
        const content = `const apiKey = 'sk-abcdefghijklmnopqrstuvwxyz123456';`;
        expectFindings('config.js', content);
    });

    it('flags Stripe key', () => {
        const content = `const key = 'sk_live_abcdefghijklmnopqrstuvwxyz';`;
        expectFindings('config.js', content);
    });

    it('flags private key block', () => {
        const content = `const key = "-----BEGIN RSA PRIVATE KEY-----\nMIIEpAIBAAKCAQEA...";`;
        expectFindings('config.js', content);
    });
});

/* ------------------------------------------------------------------ */
/*  .env file exclusions                                              */
/* ------------------------------------------------------------------ */

describe('.env file exclusions', () => {
    it('skips .env.example files', async () => {
        const files = [{
            path: '/tmp/.env.example',
            relativePath: '.env.example',
            name: '.env.example',
            ext: '.example',
            size: 100
        }];
        const result = await scanCredentialPatterns(files);
        assert.strictEqual(result.scanned, 0);
    });

    it('skips .env.local.example files', async () => {
        const files = [{
            path: '/tmp/.env.local.example',
            relativePath: '.env.local.example',
            name: '.env.local.example',
            ext: '.example',
            size: 100
        }];
        const result = await scanCredentialPatterns(files);
        assert.strictEqual(result.scanned, 0);
    });

    it('skips .env.sample files', async () => {
        const files = [{
            path: '/tmp/.env.sample',
            relativePath: '.env.sample',
            name: '.env.sample',
            ext: '.sample',
            size: 100
        }];
        const result = await scanCredentialPatterns(files);
        assert.strictEqual(result.scanned, 0);
    });
});
