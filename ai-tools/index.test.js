/**
 * Tests for ai-tools/index.js
 * Run with: node --test index.test.js
 */

const assert = require('assert');
const { describe, it, before } = require('node:test');
const fs = require('fs');
const path = require('path');

let originalCwd;

function makeTmpFile(name) {
  return path.join(originalCwd, name);
}

function cleanup(files) {
  for (const f of files) {
    try { fs.unlinkSync(f); } catch { /* ignore */ }
  }
}

function cleanupDir(dir) {
  try {
    const entries = fs.readdirSync(dir);
    for (const e of entries) fs.unlinkSync(path.join(dir, e));
    fs.rmdirSync(dir);
  } catch { /* ignore */ }
}

describe('ai-tools safety utilities', () => {
  before(() => {
    originalCwd = process.cwd();
  });

  describe('resolveSafePath', () => {
    it('resolves a path inside the project root', () => {
      const { resolveSafePath } = require('./index.js');
      const result = resolveSafePath('index.js');
      assert.strictEqual(result, path.resolve(originalCwd, 'index.js'));
    });

    it('rejects directory traversal outside project root', () => {
      const { resolveSafePath } = require('./index.js');
      assert.throws(() => {
        resolveSafePath('../../outside-project.txt');
      }, /Path escapes project root/);
    });

    it('rejects absolute paths outside project root', () => {
      const { resolveSafePath } = require('./index.js');
      if (process.platform === 'win32') {
        assert.throws(() => {
          resolveSafePath('C:\\Windows\\system32\\notepad.exe');
        }, /Path escapes project root/);
      } else {
        assert.throws(() => {
          resolveSafePath('/etc/passwd');
        }, /Path escapes project root/);
      }
    });

    it('allows the project root itself', () => {
      const { resolveSafePath } = require('./index.js');
      const result = resolveSafePath('.');
      assert.ok(result);
    });

    it('respects custom projectRoot option', () => {
      const { resolveSafePath } = require('./index.js');
      const subDir = path.join(originalCwd, 'tmp-sub-' + Date.now());
      fs.mkdirSync(subDir, { recursive: true });
      try {
        const result = resolveSafePath('file.js', { projectRoot: subDir });
        assert.strictEqual(result, path.join(subDir, 'file.js'));
      } finally {
        fs.rmdirSync(subDir);
      }
    });
  });

  describe('isBinaryFile', () => {
    it('returns false for text files', () => {
      const { isBinaryFile } = require('./index.js');
      assert.strictEqual(isBinaryFile(path.join(originalCwd, 'index.js')), false);
    });

    it('returns true for files with null bytes', () => {
      const { isBinaryFile } = require('./index.js');
      const binFile = makeTmpFile('tmp-binary-' + Date.now() + '.bin');
      fs.writeFileSync(binFile, Buffer.from([0x48, 0x00, 0x49]));
      try {
        assert.strictEqual(isBinaryFile(binFile), true);
      } finally {
        fs.unlinkSync(binFile);
      }
    });
  });

  describe('verifyFileSyntax', () => {
    it('passes for valid JavaScript', () => {
      const { verifyFileSyntax } = require('./index.js');
      const result = verifyFileSyntax('index.js');
      assert.strictEqual(result.ok, true);
      assert.ok(result.message.includes('Syntax check passed'));
    });

    it('fails for a file with syntax errors and includes stderr', () => {
      const { verifyFileSyntax } = require('./index.js');
      const badFile = makeTmpFile('tmp-bad-syntax-' + Date.now() + '.js');
      fs.writeFileSync(badFile, 'function broken( { return 1; }');
      try {
        const result = verifyFileSyntax(badFile);
        assert.strictEqual(result.ok, false);
        assert.ok(result.error.includes('Syntax compilation failed'));
      } finally {
        fs.unlinkSync(badFile);
      }
    });

    it('throws for non-existent file', () => {
      const { verifyFileSyntax } = require('./index.js');
      assert.throws(() => {
        verifyFileSyntax('does-not-exist-' + Date.now() + '.js');
      }, /Target path does not exist/);
    });
  });

  describe('verifyFileSyntaxAsync', () => {
    it('passes for valid JavaScript async', async () => {
      const { verifyFileSyntaxAsync } = require('./index.js');
      const result = await verifyFileSyntaxAsync('index.js');
      assert.strictEqual(result.ok, true);
      assert.ok(result.message.includes('Syntax check passed'));
    });

    it('fails for a file with syntax errors async', async () => {
      const { verifyFileSyntaxAsync } = require('./index.js');
      const badFile = makeTmpFile('tmp-bad-syntax-async-' + Date.now() + '.js');
      fs.writeFileSync(badFile, 'function broken( { return 1; }');
      try {
        const result = await verifyFileSyntaxAsync(badFile);
        assert.strictEqual(result.ok, false);
        assert.ok(result.error.includes('Syntax compilation failed'));
      } finally {
        fs.unlinkSync(badFile);
      }
    });
  });

  describe('computeDiff', () => {
    it('shows unchanged when target is missing', () => {
      const { computeDiff } = require('./index.js');
      const tmp = makeTmpFile('tmp-diff-' + Date.now() + '.js');
      fs.writeFileSync(tmp, 'const x = 1;');
      try {
        const result = computeDiff(tmp, 'not-found', 'replacement');
        assert.strictEqual(result.changed, false);
        assert.strictEqual(result.occurrences, 0);
      } finally {
        fs.unlinkSync(tmp);
      }
    });

    it('computes diff with single occurrence', () => {
      const { computeDiff } = require('./index.js');
      const tmp = makeTmpFile('tmp-diff2-' + Date.now() + '.js');
      fs.writeFileSync(tmp, 'const x = 1;\nconst y = 2;');
      try {
        const result = computeDiff(tmp, 'const y = 2', 'const y = 3');
        assert.strictEqual(result.changed, true);
        assert.strictEqual(result.occurrences, 1);
        assert.ok(result.after.includes('const y = 3'));
      } finally {
        fs.unlinkSync(tmp);
      }
    });

    it('respects replaceCount option', () => {
      const { computeDiff } = require('./index.js');
      const tmp = makeTmpFile('tmp-diff3-' + Date.now() + '.js');
      fs.writeFileSync(tmp, 'aaa aaa aaa');
      try {
        const result = computeDiff(tmp, 'aaa', 'bbb', { replaceCount: 2 });
        assert.strictEqual(result.occurrences, 2);
        assert.strictEqual(result.after, 'bbb bbb aaa');
      } finally {
        fs.unlinkSync(tmp);
      }
    });

    it('rejects binary files', () => {
      const { computeDiff } = require('./index.js');
      const tmp = makeTmpFile('tmp-diff-bin-' + Date.now() + '.bin');
      fs.writeFileSync(tmp, Buffer.from([0x48, 0x00, 0x49]));
      try {
        assert.throws(() => {
          computeDiff(tmp, 'a', 'b');
        }, /binary file/);
      } finally {
        fs.unlinkSync(tmp);
      }
    });
  });

  describe('previewFix', () => {
    it('returns preview info without writing', () => {
      const { previewFix } = require('./index.js');
      const tmp = makeTmpFile('tmp-preview-' + Date.now() + '.js');
      fs.writeFileSync(tmp, 'const x = 1;');
      try {
        const result = previewFix(tmp, 'const x = 1', 'const x = 2');
        assert.strictEqual(result.ok, true);
        assert.ok(result.message.includes('Preview ready'));
        assert.ok(result.diff);
        assert.strictEqual(fs.readFileSync(tmp, 'utf8'), 'const x = 1;');
      } finally {
        fs.unlinkSync(tmp);
      }
    });

    it('fails gracefully when target text is not found', () => {
      const { previewFix } = require('./index.js');
      const tmp = makeTmpFile('tmp-preview2-' + Date.now() + '.js');
      fs.writeFileSync(tmp, 'const x = 1;');
      try {
        const result = previewFix(tmp, 'not-found', 'replacement');
        assert.strictEqual(result.ok, false);
        assert.ok(result.error.includes('not found'));
      } finally {
        fs.unlinkSync(tmp);
      }
    });
  });

  describe('proposeInlineFix', () => {
    it('applies a valid replacement and verifies syntax', () => {
      const { proposeInlineFix } = require('./index.js');
      const tmpFile = makeTmpFile('tmp-fix-test-' + Date.now() + '.js');
      fs.writeFileSync(tmpFile, 'const x = 1;\nconst y = 2;');
      try {
        const result = proposeInlineFix(tmpFile, 'const y = 2', 'const y = 3');
        assert.strictEqual(result.ok, true);
        assert.ok(result.message.includes('Inline patch applied'));
        const content = fs.readFileSync(tmpFile, 'utf8');
        assert.ok(content.includes('const y = 3'));
      } finally {
        fs.unlinkSync(tmpFile);
      }
    });

    it('rolls back on syntax error', () => {
      const { proposeInlineFix } = require('./index.js');
      const tmpFile = makeTmpFile('tmp-rollback-test-' + Date.now() + '.js');
      fs.writeFileSync(tmpFile, 'const x = 1;');
      try {
        const result = proposeInlineFix(tmpFile, 'const x = 1', 'const x = broken syntax {');
        assert.strictEqual(result.ok, false);
        assert.ok(result.error.includes('Patch rolled back'));
        const content = fs.readFileSync(tmpFile, 'utf8');
        assert.strictEqual(content, 'const x = 1;');
      } finally {
        fs.unlinkSync(tmpFile);
      }
    });

    it('fails gracefully when target text is not found', () => {
      const { proposeInlineFix } = require('./index.js');
      const tmpFile = makeTmpFile('tmp-missing-target-' + Date.now() + '.js');
      fs.writeFileSync(tmpFile, 'const x = 1;');
      try {
        const result = proposeInlineFix(tmpFile, 'this text does not exist', 'replacement');
        assert.strictEqual(result.ok, false);
        assert.ok(result.error.includes('Target string to replace was not found'));
      } finally {
        fs.unlinkSync(tmpFile);
      }
    });

    it('throws for non-existent file (ghost file)', () => {
      const { proposeInlineFix } = require('./index.js');
      assert.throws(() => {
        proposeInlineFix('does-not-exist-' + Date.now() + '.js', 'a', 'b');
      }, /Ghost file detected/);
    });

    it('respects replaceCount option', () => {
      const { proposeInlineFix } = require('./index.js');
      const tmpFile = makeTmpFile('tmp-replace-count-' + Date.now() + '.js');
      fs.writeFileSync(tmpFile, 'aaa\naaa\naaa');
      try {
        const result = proposeInlineFix(tmpFile, 'aaa', 'bbb', { replaceCount: 2 });
        assert.strictEqual(result.ok, true);
        const content = fs.readFileSync(tmpFile, 'utf8');
        assert.strictEqual(content, 'bbb\nbbb\naaa');
      } finally {
        fs.unlinkSync(tmpFile);
      }
    });

    it('rejects binary files', () => {
      const { proposeInlineFix } = require('./index.js');
      const tmpFile = makeTmpFile('tmp-fix-bin-' + Date.now() + '.bin');
      fs.writeFileSync(tmpFile, Buffer.from([0x48, 0x00, 0x49]));
      try {
        assert.throws(() => {
          proposeInlineFix(tmpFile, 'a', 'b');
        }, /binary file/);
      } finally {
        fs.unlinkSync(tmpFile);
      }
    });
  });

  describe('proposeInlineFixAsync', () => {
    it('applies a valid replacement async', async () => {
      const { proposeInlineFixAsync } = require('./index.js');
      const tmpFile = makeTmpFile('tmp-fix-async-' + Date.now() + '.js');
      fs.writeFileSync(tmpFile, 'const x = 1;');
      try {
        const result = await proposeInlineFixAsync(tmpFile, 'const x = 1', 'const x = 2');
        assert.strictEqual(result.ok, true);
        assert.ok(result.message.includes('Inline patch applied'));
        const content = fs.readFileSync(tmpFile, 'utf8');
        assert.ok(content.includes('const x = 2'));
      } finally {
        fs.unlinkSync(tmpFile);
      }
    });

    it('rolls back on syntax error async', async () => {
      const { proposeInlineFixAsync } = require('./index.js');
      const tmpFile = makeTmpFile('tmp-rollback-async-' + Date.now() + '.js');
      fs.writeFileSync(tmpFile, 'const x = 1;');
      try {
        const result = await proposeInlineFixAsync(tmpFile, 'const x = 1', 'const x = broken {');
        assert.strictEqual(result.ok, false);
        assert.ok(result.error.includes('Patch rolled back'));
        const content = fs.readFileSync(tmpFile, 'utf8');
        assert.strictEqual(content, 'const x = 1;');
      } finally {
        fs.unlinkSync(tmpFile);
      }
    });
  });

  describe('proposeBatchFix', () => {
    it('applies multiple replacements atomically', () => {
      const { proposeBatchFix } = require('./index.js');
      const tmpFile = makeTmpFile('tmp-batch-' + Date.now() + '.js');
      fs.writeFileSync(tmpFile, 'const a = 1;\nconst b = 2;\nconst c = 3;');
      try {
        const result = proposeBatchFix(tmpFile, [
          { target: 'const a = 1', replacement: 'const a = 10' },
          { target: 'const b = 2', replacement: 'const b = 20' }
        ]);
        assert.strictEqual(result.ok, true);
        assert.strictEqual(result.applied, 2);
        const content = fs.readFileSync(tmpFile, 'utf8');
        assert.ok(content.includes('const a = 10'));
        assert.ok(content.includes('const b = 20'));
      } finally {
        fs.unlinkSync(tmpFile);
      }
    });

    it('rolls back on syntax error', () => {
      const { proposeBatchFix } = require('./index.js');
      const tmpFile = makeTmpFile('tmp-batch-rollback-' + Date.now() + '.js');
      fs.writeFileSync(tmpFile, 'const a = 1;');
      try {
        const result = proposeBatchFix(tmpFile, [
          { target: 'const a = 1', replacement: 'const a = broken {' }
        ]);
        assert.strictEqual(result.ok, false);
        assert.ok(result.error.includes('Batch patch rolled back'));
        const content = fs.readFileSync(tmpFile, 'utf8');
        assert.strictEqual(content, 'const a = 1;');
      } finally {
        fs.unlinkSync(tmpFile);
      }
    });

    it('fails when a target is not found', () => {
      const { proposeBatchFix } = require('./index.js');
      const tmpFile = makeTmpFile('tmp-batch-missing-' + Date.now() + '.js');
      fs.writeFileSync(tmpFile, 'const a = 1;');
      try {
        const result = proposeBatchFix(tmpFile, [
          { target: 'not-found', replacement: 'replaced' }
        ]);
        assert.strictEqual(result.ok, false);
        assert.ok(result.error.includes('not found'));
      } finally {
        fs.unlinkSync(tmpFile);
      }
    });

    it('rejects empty replacement array', () => {
      const { proposeBatchFix } = require('./index.js');
      const tmpFile = makeTmpFile('tmp-batch-empty-' + Date.now() + '.js');
      fs.writeFileSync(tmpFile, 'const a = 1;');
      try {
        const result = proposeBatchFix(tmpFile, []);
        assert.strictEqual(result.ok, false);
      } finally {
        fs.unlinkSync(tmpFile);
      }
    });
  });

  describe('backup / restore', () => {
    it('creates a backup', () => {
      const { createBackup } = require('./index.js');
      const tmpFile = makeTmpFile('tmp-backup-' + Date.now() + '.js');
      fs.writeFileSync(tmpFile, 'original');
      try {
        const result = createBackup(tmpFile);
        assert.ok(fs.existsSync(result.backupPath));
        assert.ok(result.timestamp);
      } finally {
        cleanup([tmpFile]);
        cleanupDir(path.join(originalCwd, '.ai-tools-backups'));
      }
    });

    it('lists backups newest first', () => {
      const { createBackup, listBackups } = require('./index.js');
      const tmpFile = makeTmpFile('tmp-backup-list-' + Date.now() + '.js');
      fs.writeFileSync(tmpFile, 'v1');
      try {
        createBackup(tmpFile);
        fs.writeFileSync(tmpFile, 'v2');
        createBackup(tmpFile);
        const backups = listBackups(tmpFile);
        assert.strictEqual(backups.length, 2);
        const content1 = fs.readFileSync(backups[0].backupPath, 'utf8');
        const content2 = fs.readFileSync(backups[1].backupPath, 'utf8');
        assert.strictEqual(content1, 'v2');
        assert.strictEqual(content2, 'v1');
      } finally {
        cleanup([tmpFile]);
        cleanupDir(path.join(originalCwd, '.ai-tools-backups'));
      }
    });

    it('restores from backup', () => {
      const { createBackup, restoreBackup } = require('./index.js');
      const tmpFile = makeTmpFile('tmp-restore-' + Date.now() + '.js');
      fs.writeFileSync(tmpFile, 'original');
      try {
        createBackup(tmpFile);
        fs.writeFileSync(tmpFile, 'modified');
        const result = restoreBackup(tmpFile);
        assert.strictEqual(result.ok, true);
        assert.strictEqual(fs.readFileSync(tmpFile, 'utf8'), 'original');
      } finally {
        cleanup([tmpFile]);
        cleanupDir(path.join(originalCwd, '.ai-tools-backups'));
      }
    });

    it('returns error when no backup exists', () => {
      const { restoreBackup } = require('./index.js');
      const tmpFile = makeTmpFile('tmp-no-backup-' + Date.now() + '.js');
      fs.writeFileSync(tmpFile, 'content');
      try {
        const result = restoreBackup(tmpFile);
        assert.strictEqual(result.ok, false);
        assert.ok(result.error.includes('No backups found'));
      } finally {
        cleanup([tmpFile]);
      }
    });
  });

  describe('module exports', () => {
    it('exports are frozen', () => {
      const mod = require('./index.js');
      assert.strictEqual(Object.isFrozen(mod), true);
    });

    it('has all expected exports', () => {
      const mod = require('./index.js');
      assert.strictEqual(typeof mod.resolveSafePath, 'function');
      assert.strictEqual(typeof mod.verifyFileSyntax, 'function');
      assert.strictEqual(typeof mod.verifyFileSyntaxAsync, 'function');
      assert.strictEqual(typeof mod.proposeInlineFix, 'function');
      assert.strictEqual(typeof mod.proposeInlineFixAsync, 'function');
      assert.strictEqual(typeof mod.proposeBatchFix, 'function');
      assert.strictEqual(typeof mod.previewFix, 'function');
      assert.strictEqual(typeof mod.computeDiff, 'function');
      assert.strictEqual(typeof mod.createBackup, 'function');
      assert.strictEqual(typeof mod.restoreBackup, 'function');
      assert.strictEqual(typeof mod.listBackups, 'function');
      assert.strictEqual(typeof mod.isBinaryFile, 'function');
    });
  });
});
