'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const cr = require('../src/compliance-rules/index.js');

describe('compliance-rules/index.js', () => {
  const ruleDir = path.join(__dirname, '../src/compliance-rules');
  const ruleFiles = fs.readdirSync(ruleDir).filter((f) => f.endsWith('.js') && f !== 'index.js');

  it('getRegistry returns frozen snapshot', () => {
    const reg = cr.getRegistry();
    assert.strictEqual(Object.isFrozen(reg), true);
  });

  it('auto-discovered rules match filesystem', () => {
    const reg = cr.getRegistry();
    const regKeys = Object.keys(reg);
    assert.strictEqual(
      regKeys.length,
      ruleFiles.length,
      'registry size should match number of rule files'
    );
    for (const file of ruleFiles) {
      const id = path.basename(file, '.js');
      assert.ok(regKeys.includes(id), `registry should contain rule "${id}"`);
    }
  });

  it('all built-in rules are functions', () => {
    const reg = cr.getRegistry();
    for (const [id, fn] of Object.entries(reg)) {
      assert.strictEqual(typeof fn, 'function', `rule "${id}" should be a function`);
    }
  });

  it('evaluateRule returns skip for unknown check', () => {
    const result = cr.evaluateRule(
      { id: 'r1', check: 'does-not-exist', title: 'Test', category: 'test', severity: 'low' },
      { report: {} }
    );
    assert.strictEqual(result.status, 'skip');
    assert.ok(result.evidence.includes('Unknown check'));
    assert.strictEqual(result.id, 'r1');
    assert.strictEqual(result.title, 'Test');
  });

  it('evaluateRule delegates to registered rule', () => {
    const custom = (rule, context) => ({
      id: rule.id,
      title: rule.title,
      category: rule.category,
      severity: rule.severity,
      remediation: null,
      status: 'pass',
      evidence: 'custom-evaluated',
    });

    cr.registerRule('custom-test', custom);

    const result = cr.evaluateRule(
      { id: 'r2', check: 'custom-test', title: 'Custom', category: 'test', severity: 'low' },
      { report: {} }
    );
    assert.strictEqual(result.status, 'pass');
    assert.strictEqual(result.evidence, 'custom-evaluated');
  });

  it('getRegistry reflects new registrations', () => {
    const before = Object.keys(cr.getRegistry());
    cr.registerRule('dynamic-rule', () => ({ status: 'pass', evidence: 'dynamic' }));
    const after = Object.keys(cr.getRegistry());
    assert.ok(!before.includes('dynamic-rule'), 'should not exist before registration');
    assert.ok(after.includes('dynamic-rule'), 'should exist after registration');
  });

  it('getRegistry snapshot is not mutated by later registrations', () => {
    const snapshot = cr.getRegistry();
    cr.registerRule('another-dynamic', () => ({ status: 'pass' }));
    assert.ok(
      !Object.keys(snapshot).includes('another-dynamic'),
      'snapshot should remain unchanged'
    );
  });

  it('can evaluate a real built-in rule', () => {
    const reg = cr.getRegistry();
    if (reg['gate-pass']) {
      const result = cr.evaluateRule(
        { id: 'r3', check: 'gate-pass', title: 'Gate', category: 'quality', severity: 'high' },
        { report: { gate: { pass: true } } }
      );
      assert.strictEqual(result.status, 'pass');
      assert.ok(result.evidence.includes('Gate pass'));
    }
  });
});
