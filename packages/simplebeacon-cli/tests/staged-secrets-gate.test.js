// simplebeacon-ignore: Security findings are false positives — scanner definitions, test fixtures, dashboard code, and build scripts
const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');
const {
    runStagedSecretsGate,
    isBlockingSecretFinding,
    scanTextContent
} = require('../src/lib/credential-pattern-scanner');

function withTempGitRepo(fn) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-secrets-gate-'));
    execSync('git init', { cwd: dir, stdio: 'ignore' });
    execSync('git config user.email "test@example.com"', { cwd: dir, stdio: 'ignore' });
    execSync('git config user.name "Test User"', { cwd: dir, stdio: 'ignore' });
    try {
        fn(dir);
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
}

describe('isBlockingSecretFinding', () => {
    it('blocks critical pattern ids', () => {
        assert.strictEqual(isBlockingSecretFinding({ severityBand: 'critical', pattern: 'github-pat' }), true);
    });

    it('blocks long generic api key assignments', () => {
        const findings = scanTextContent('config.js', "const apiKey = 'abcdefghijklmnopqrstuvwxyz';");
        const hit = findings.find((f) => f.pattern === 'generic-api-key');
        assert.ok(hit);
        assert.strictEqual(isBlockingSecretFinding(hit), true);
    });

    it('allows short placeholder generic keys', () => {
        const findings = scanTextContent('config.js', "const apiKey = 'placeholder';");
        assert.strictEqual(findings.length, 0);
    });
});

describe('runStagedSecretsGate', () => {
    it('passes when nothing is staged', () => {
        withTempGitRepo((dir) => {
            fs.writeFileSync(path.join(dir, 'README.md'), 'hello');
            execSync('git add README.md', { cwd: dir, stdio: 'ignore' });
            execSync('git commit -m "init"', { cwd: dir, stdio: 'ignore' });
            const result = runStagedSecretsGate(dir);
            assert.strictEqual(result.pass, true);
            assert.strictEqual(result.blockingCount, 0);
        });
    });

    it('blocks staged GitHub PAT', () => {
        withTempGitRepo((dir) => {
            fs.writeFileSync(path.join(dir, 'leak.js'), "const token = 'ghp_abcdefghijklmnopqrstuvwxyz12';\n");
            execSync('git add leak.js', { cwd: dir, stdio: 'ignore' });
            const result = runStagedSecretsGate(dir);
            assert.strictEqual(result.pass, false);
            assert.ok(result.blockingCount >= 1);
            assert.match(result.findings[0].filePath, /leak\.js$/);
        });
    });

    it('allows staged placeholder values', () => {
        withTempGitRepo((dir) => {
            fs.writeFileSync(path.join(dir, 'config.js'), "const apiKey = 'your-api-key-here';\n");
            execSync('git add config.js', { cwd: dir, stdio: 'ignore' });
            const result = runStagedSecretsGate(dir);
            assert.strictEqual(result.pass, true);
            assert.strictEqual(result.blockingCount, 0);
        });
    });

    it('does not block unstaged secrets in working tree', () => {
        withTempGitRepo((dir) => {
            const filePath = path.join(dir, 'safe.js');
            fs.writeFileSync(filePath, "const ok = true;\n");
            execSync('git add safe.js', { cwd: dir, stdio: 'ignore' });
            fs.writeFileSync(filePath, "const token = 'ghp_abcdefghijklmnopqrstuvwxyz12';\n");
            const result = runStagedSecretsGate(dir);
            assert.strictEqual(result.pass, true);
        });
    });

    it('respects suppression comments on staged content', () => {
        withTempGitRepo((dir) => {
            fs.writeFileSync(
                path.join(dir, 'ignored.js'),
                "const token = 'ghp_abcdefghijklmnopqrstuvwxyz12'; // simplebeacon-ignore credentials\n"
            );
            execSync('git add ignored.js', { cwd: dir, stdio: 'ignore' });
            const result = runStagedSecretsGate(dir);
            assert.strictEqual(result.pass, true);
        });
    });

    it('blocks staged PEM private key blocks', () => {
        withTempGitRepo((dir) => {
            fs.writeFileSync(
                path.join(dir, 'secrets.txt'),
                '-----BEGIN RSA PRIVATE KEY-----\nMIIEpAIBAAKCAQEA...\n'
            );
            execSync('git add secrets.txt', { cwd: dir, stdio: 'ignore' });
            const result = runStagedSecretsGate(dir);
            assert.strictEqual(result.pass, false);
            assert.ok(result.findings.some((f) => f.pattern === 'private-key-block'));
        });
    });
});
