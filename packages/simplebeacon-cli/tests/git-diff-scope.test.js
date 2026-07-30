// simplebeacon-ignore: Security findings are false positives — scanner definitions, test fixtures, dashboard code, and build scripts
const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');
const {
    collectGitStagedFiles,
    readStagedFileContent,
    normalizeRelPath
} = require('../src/lib/git-diff-scope');

function withTempGitRepo(fn) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-git-scope-'));
    execSync('git init', { cwd: dir, stdio: 'ignore' });
    execSync('git config user.email "test@example.com"', { cwd: dir, stdio: 'ignore' });
    execSync('git config user.name "Test User"', { cwd: dir, stdio: 'ignore' });
    try {
        fn(dir);
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
}

describe('normalizeRelPath', () => {
    it('strips leading ./ segments', () => {
        assert.strictEqual(normalizeRelPath('./src/app.js'), 'src/app.js');
    });
});

describe('collectGitStagedFiles', () => {
    it('returns empty array when nothing is staged', () => {
        withTempGitRepo((dir) => {
            fs.writeFileSync(path.join(dir, 'README.md'), 'hello');
            execSync('git add README.md', { cwd: dir, stdio: 'ignore' });
            execSync('git commit -m "init"', { cwd: dir, stdio: 'ignore' });
            const staged = collectGitStagedFiles(dir);
            assert.deepStrictEqual(staged, []);
        });
    });

    it('lists staged paths from the index', () => {
        withTempGitRepo((dir) => {
            fs.writeFileSync(path.join(dir, 'secret.js'), "const ok = true;\n");
            execSync('git add secret.js', { cwd: dir, stdio: 'ignore' });
            const staged = collectGitStagedFiles(dir);
            assert.deepStrictEqual(staged, ['secret.js']);
        });
    });

    it('returns renamed destination path for staged renames', () => {
        withTempGitRepo((dir) => {
            const sourcePath = path.join(dir, 'old-name.js');
            const targetPath = path.join(dir, 'new-name.js');
            fs.writeFileSync(sourcePath, 'const renamed = true;\n');
            execSync('git add old-name.js', { cwd: dir, stdio: 'ignore' });
            execSync('git commit -m "seed"', { cwd: dir, stdio: 'ignore' });
            fs.renameSync(sourcePath, targetPath);
            execSync('git add -A', { cwd: dir, stdio: 'ignore' });

            const staged = collectGitStagedFiles(dir);
            assert.ok(staged.includes('new-name.js'));
            assert.ok(!staged.includes('old-name.js'));
        });
    });
});

describe('readStagedFileContent', () => {
    it('reads staged blob content, not working tree edits', () => {
        withTempGitRepo((dir) => {
            const filePath = path.join(dir, 'config.js');
            fs.writeFileSync(filePath, "const token = 'ghp_abcdefghijklmnopqrstuvwxyz12';\n");
            execSync('git add config.js', { cwd: dir, stdio: 'ignore' });
            fs.writeFileSync(filePath, "const token = 'safe';\n");
            const staged = readStagedFileContent(dir, 'config.js');
            assert.match(staged, /ghp_/);
        });
    });

    it('returns null for unstaged-only files', () => {
        withTempGitRepo((dir) => {
            fs.writeFileSync(path.join(dir, 'local.js'), 'const x = 1;');
            const staged = readStagedFileContent(dir, 'local.js');
            assert.strictEqual(staged, null);
        });
    });
});
