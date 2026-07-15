'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { generateZscriptModReport } = require('../code-understanding/zscript-mod-report.cjs');

describe('code-understanding/zscript-mod-report', () => {
  test('exports generateZscriptModReport function', () => {
    expect(typeof generateZscriptModReport).toBe('function');
  });

  test('generateZscriptModReport returns object', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zscript-mod-'));
    fs.writeFileSync(path.join(tmpDir, 'test.zs'), 'class Monster : Actor { }');
    try {
      const result = await generateZscriptModReport(tmpDir);
      expect(typeof result).toBe('object');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('generateZscriptModReport handles empty directory', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zscript-mod-empty-'));
    try {
      const result = await generateZscriptModReport(tmpDir);
      expect(typeof result).toBe('object');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
