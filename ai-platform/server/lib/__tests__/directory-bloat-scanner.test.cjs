'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

const mod = require('../directory-bloat-scanner.cjs');

describe('directory-bloat-scanner smoke', () => {
  it('exports scanDirectoryBloat', () => {
    assert.strictEqual(typeof mod.scanDirectoryBloat, 'function');
  });

  it('scans an empty temp directory', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bloat-test-'));
    try {
      const result = await mod.scanDirectoryBloat(tmpDir);
      assert.ok(typeof result === 'object');
      assert.ok('findings' in result);
      assert.ok('summary' in result);
      assert.ok(result.summary.directoryBloatFindings >= 0);
    } finally {
      fs.rmSync(tmpDir, { recursive: true });
    }
  });

  it('finds empty directories', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bloat-test-'));
    fs.mkdirSync(path.join(tmpDir, 'empty-sub'));
    try {
      const result = await mod.scanDirectoryBloat(tmpDir);
      assert.ok(result.findings.directoryBloat.length >= 1);
      const empty = result.findings.directoryBloat.find((f) => f.category === 'Empty directory');
      assert.ok(empty);
    } finally {
      fs.rmSync(tmpDir, { recursive: true });
    }
  });
});
