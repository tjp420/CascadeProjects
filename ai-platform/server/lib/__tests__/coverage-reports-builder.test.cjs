'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');

const mod = require('../coverage-reports-builder.cjs');

describe('coverage-reports-builder smoke', () => {
  it('exports expected functions', () => {
    assert.strictEqual(typeof mod.buildCoverageReportsModel, 'function');
    assert.strictEqual(typeof mod.applyProjectCoverage, 'function');
    assert.ok(mod.FILE_TO_PROJECT);
  });

  it('buildCoverageReportsModel returns fallback when no coverage data', () => {
    const result = mod.buildCoverageReportsModel('/nonexistent', {});
    assert.ok(typeof result === 'object');
    assert.strictEqual(result.type, 'coverage-reports-model');
    assert.ok('overview' in result);
  });

  it('FILE_TO_PROJECT mapping exists', () => {
    assert.ok(typeof mod.FILE_TO_PROJECT === 'object');
    assert.strictEqual(mod.FILE_TO_PROJECT['web/scripts/payload-routing.js'], 'proj_routing');
  });
});
