const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execSync } = require('child_process');
const { GitHygieneScanner } = require('../src/analyzers/file-reduction/git-hygiene-scanner');

function makeTempGitProject(structure) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-git-'));
    execSync('git init', { cwd: root, stdio: 'ignore' });
    execSync('git config user.email "test@example.com"', { cwd: root, stdio: 'ignore' });
    execSync('git config user.name "Test User"', { cwd: root, stdio: 'ignore' });

    for (const [relPath, content] of Object.entries(structure)) {
        const fullPath = path.join(root, relPath);
        fs.mkdirSync(path.dirname(fullPath), { recursive: true });
        fs.writeFileSync(fullPath, content, 'utf8');
    }

    execSync('git add .', { cwd: root, stdio: 'ignore' });
    execSync('git commit -m "initial"', { cwd: root, stdio: 'ignore' });
    return root;
}

test('GitHygieneScanner flags sensitive tracked files', async () => {
    const root = makeTempGitProject({
        'src/app.js': 'console.log("ok");',
        '.env': 'SECRET=12345',
        'id_rsa': 'private-key-data'
    });

    const scanner = new GitHygieneScanner();
    const result = await scanner.scan(root);

    assert.ok(result.findings.some((f) => f.type === 'git-sensitive-file' && f.path === '.env'));
    assert.ok(result.findings.some((f) => f.type === 'git-sensitive-file' && f.path === 'id_rsa'));
    assert.ok(!result.findings.some((f) => f.path === 'src/app.js'));
});

test('GitHygieneScanner flags large tracked files', async () => {
    const root = makeTempGitProject({
        'src/app.js': 'console.log("ok");',
        'large.bin': 'x'.repeat(2 * 1024 * 1024)
    });

    const scanner = new GitHygieneScanner({ largeFileThreshold: 1024 * 1024 });
    const result = await scanner.scan(root);

    assert.ok(result.findings.some((f) => f.type === 'git-large-file' && f.path === 'large.bin'));
});

test('GitHygieneScanner warns when not a git repo', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-nogit-'));
    fs.writeFileSync(path.join(root, 'app.js'), 'console.log(1);');

    const scanner = new GitHygieneScanner();
    const result = await scanner.scan(root);

    assert.ok(result.findings.some((f) => f.type === 'git-hygiene-warning'));
    assert.equal(result.summary.isGitRepo, false);
});

test('GitHygieneScanner detects suspicious commit messages', async () => {
    const root = makeTempGitProject({
        'src/app.js': 'console.log("ok");'
    });

    fs.writeFileSync(path.join(root, 'new.txt'), 'hello');
    execSync('git add .', { cwd: root, stdio: 'ignore' });
    execSync('git commit -m "add token ghp_abcdefghijklmnopqrstuvwxyz1234"', { cwd: root, stdio: 'ignore' });

    const scanner = new GitHygieneScanner();
    const result = await scanner.scan(root);

    assert.ok(result.findings.some((f) => f.type === 'git-sensitive-commit'));
});
