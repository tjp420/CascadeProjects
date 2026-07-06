'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');

const mod = require('../dashboard-home-builder.cjs');

describe('dashboard-home-builder smoke', () => {
  it('exports expected functions', () => {
    assert.strictEqual(typeof mod.buildDashboardHomeModel, 'function');
    assert.strictEqual(typeof mod.replaceJestMentions, 'function');
  });

  it('replaceJestMentions replaces jest counts', () => {
    const text = '100/200 tests passing across 5 suites';
    const result = mod.replaceJestMentions(text, '150', null);
    assert.ok(result.includes('150 tests passing'));
  });

  it('buildDashboardHomeModel returns object with expected keys', () => {
    const sample = {
      overview: { totalTests: 0, notes: 'default npm test runs with --no-coverage.' },
      comparativeAnalysis: [],
      insights: [],
      kpis: [],
      healthSummary: { highlights: [] }
    };
    const result = mod.buildDashboardHomeModel(sample);
    assert.ok(typeof result === 'object');
    assert.ok('overview' in result);
    assert.ok('comparativeAnalysis' in result);
    assert.ok('insights' in result);
    assert.ok('kpis' in result);
  });
});
