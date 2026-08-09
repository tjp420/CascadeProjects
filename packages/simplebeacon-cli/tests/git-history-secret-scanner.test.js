// simplebeacon-ignore: Test file for scanner rules — all findings are expected test fixtures
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { scanGitHistorySecrets, parseGitLogOutput, isAllowlisted, secretPreview } = require('../src/rules/git-history-secret-scanner');

test('isAllowlisted detects known false positives', () => {
    assert.ok(isAllowlisted('AKIAIOSFODNN7EXAMPLE'));
    assert.ok(isAllowlisted('your-api-key-here'));
    assert.ok(isAllowlisted('placeholder'));
    assert.ok(!isAllowlisted('AKIAIOSFODNN7REALKEY'));
});

test('secretPreview masks long secrets', () => {
    assert.equal(secretPreview('AKIAIOSFODNN7REALKEY123'), 'AKIAIOSFODNN...Y123');
    assert.equal(secretPreview('short'), 'short');
});

test('parseGitLogOutput detects AWS key in committed content', () => {
    const fakeOutput = [
        '__COMMIT__abc123def4567890abcdef1234567890abcdef12|2024-03-15T10:00:00+00:00',
        'diff --git a/server/config.js b/server/config.js',
        'index 111..222 100644',
        '--- a/server/config.js',
        '+++ b/server/config.js',
        '+const AWS_KEY = "AKIAIOSFODNN7REALKEY";',
        '',
    ].join('\n');

    const result = parseGitLogOutput(fakeOutput, '/tmp/test', 1000);
    assert.equal(result.scanned, 1);
    assert.ok(result.findings > 0, 'should detect AWS key');
    const finding = result.issues[0];
    assert.equal(finding.type, 'git-history-secret');
    assert.equal(finding.rule, 'git-history-secret');
    assert.equal(finding.filePath, 'server/config.js');
    assert.equal(finding.metadata.commitHash, 'abc123def4567890abcdef1234567890abcdef12');
    assert.ok(finding.metadata.secretPreview.includes('AKIA'));
});

test('parseGitLogOutput skips allowlisted secrets', () => {
    const fakeOutput = [
        '__COMMIT__abc123|2024-03-15T10:00:00+00:00',
        'diff --git a/test.js b/test.js',
        '+++ b/test.js',
        '+const key = "AKIAIOSFODNN7EXAMPLE"; // example key',
        '',
    ].join('\n');

    const result = parseGitLogOutput(fakeOutput, '/tmp/test', 1000);
    assert.equal(result.findings, 0, 'should skip allowlisted example key');
});

test('parseGitLogOutput deduplicates same secret in same commit', () => {
    const fakeOutput = [
        '__COMMIT__abc123|2024-03-15T10:00:00+00:00',
        'diff --git a/a.js b/a.js',
        '+++ b/a.js',
        '+const AWS_KEY = "AKIAHSQYUVCBGMXHOE45";',
        'diff --git a/b.js b/b.js',
        '+++ b/b.js',
        '+const OTHER = "AKIAHSQYUVCBGMXHOE45";',
        '',
    ].join('\n');

    const result = parseGitLogOutput(fakeOutput, '/tmp/test', 1000);
    // Both lines have the same secret in the same commit — should dedupe
    const awsFindings = result.issues.filter((i) => i.metadata.patternId === 'aws-access-key');
    assert.equal(awsFindings.length, 1, 'should deduplicate same secret in same commit');
});

test('scanGitHistorySecrets detects secret in real git repo', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-gitsec-'));
    try {
        // Init git repo
        execFileSync('git', ['init'], { cwd: dir, windowsHide: true, stdio: 'pipe' });
        execFileSync('git', ['config', 'user.email', 'test@test.com'], { cwd: dir, windowsHide: true, stdio: 'pipe' });
        execFileSync('git', ['config', 'user.name', 'Test'], { cwd: dir, windowsHide: true, stdio: 'pipe' });

        // Commit a file with a secret
        fs.writeFileSync(path.join(dir, 'config.js'), 'const AWS_KEY = "AKIAHSQYUVCBGMXHOE45";\n');
        execFileSync('git', ['add', '.'], { cwd: dir, windowsHide: true, stdio: 'pipe' });
        execFileSync('git', ['commit', '-m', 'add config'], { cwd: dir, windowsHide: true, stdio: 'pipe' });

        // Remove the secret and commit again
        fs.writeFileSync(path.join(dir, 'config.js'), 'const AWS_KEY = process.env.AWS_KEY;\n');
        execFileSync('git', ['add', '.'], { cwd: dir, windowsHide: true, stdio: 'pipe' });
        execFileSync('git', ['commit', '-m', 'remove secret'], { cwd: dir, windowsHide: true, stdio: 'pipe' });

        // Scan git history
        const result = await scanGitHistorySecrets(dir);
        assert.ok(result.summary.gitRepo, 'should detect git repo');
        assert.ok(result.summary.commitsScanned > 0, 'should scan commits');
        assert.ok(result.findings > 0, 'should find the secret in history');
        const finding = result.issues.find((i) => i.type === 'git-history-secret');
        assert.ok(finding, 'should have a git-history-secret finding');
        assert.equal(finding.filePath, 'config.js');
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
});

test('scanGitHistorySecrets returns empty for non-git directory', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-gitsec-nogit-'));
    const result = await scanGitHistorySecrets(dir);
    assert.equal(result.summary.gitRepo, false);
    assert.equal(result.findings, 0);
    fs.rmSync(dir, { recursive: true, force: true });
});
