'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');

const mod = require('../data-cleanup-scan.cjs');

describe('data-cleanup-scan smoke', () => {
  it('exports expected constants and functions', () => {
    assert.ok(Array.isArray(mod.ALL_DATA_CLEANUP_SCANNER_IDS));
    assert.strictEqual(typeof mod.runDataCleanupScan, 'function');
    assert.strictEqual(typeof mod.registerDataCleanupAnalyzeRoute, 'function');
    assert.strictEqual(typeof mod.resolveDataCleanupScannerConfig, 'function');
    assert.strictEqual(typeof mod.buildScanCacheKey, 'function');
    assert.strictEqual(typeof mod.clearDataCleanupScanCache, 'function');
  });

  it('scanner IDs are non-empty strings', () => {
    for (const id of mod.ALL_DATA_CLEANUP_SCANNER_IDS) {
      assert.strictEqual(typeof id, 'string');
      assert.ok(id.length > 0);
    }
  });

  it('resolveDataCleanupScannerConfig returns config for valid scanner', () => {
    const config = mod.resolveDataCleanupScannerConfig('file-reduction');
    assert.ok(typeof config === 'object');
  });
});
