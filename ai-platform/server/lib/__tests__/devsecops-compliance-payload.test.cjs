'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');

const mod = require('../devsecops-compliance-payload.cjs');

describe('devsecops-compliance-payload smoke', () => {
  it('exports expected functions', () => {
    assert.strictEqual(typeof mod.buildDevSecOpsCompliancePayload, 'function');
    assert.strictEqual(typeof mod.buildComplianceHtml, 'function');
    assert.strictEqual(typeof mod.optimizationComplianceLabel, 'function');
  });

  it('optimizationComplianceLabel maps scores correctly', () => {
    assert.strictEqual(mod.optimizationComplianceLabel({ repositoryHealthScore: 90 }), 'good');
    assert.strictEqual(mod.optimizationComplianceLabel({ repositoryHealthScore: 75 }), 'partial');
    assert.strictEqual(mod.optimizationComplianceLabel({ repositoryHealthScore: 50 }), 'needs_attention');
    assert.strictEqual(mod.optimizationComplianceLabel(null), 'unknown');
  });

  it('buildDevSecOpsCompliancePayload returns typed payload', () => {
    const payload = mod.buildDevSecOpsCompliancePayload({});
    assert.ok(typeof payload === 'object');
    assert.strictEqual(payload.type, 'simplebeacon-devsecops-compliance');
    assert.ok('generatedAt' in payload);
    assert.ok('trust' in payload);
    assert.ok('repositoryHealth' in payload);
  });

  it('buildComplianceHtml returns HTML string', () => {
    const payload = mod.buildDevSecOpsCompliancePayload({});
    const html = mod.buildComplianceHtml(payload);
    assert.strictEqual(typeof html, 'string');
    assert.ok(html.includes('<!DOCTYPE html>'));
  });
});
