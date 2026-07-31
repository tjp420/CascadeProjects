'use strict';
const { describe, it } = require('node:test');
const assert = require('node:assert');

const mod = require('../safe-merge-guard.cjs');

describe('safe-merge-guard smoke', () => {
  it('module loads without throwing', () => {
    assert.ok(mod);
  });
  it('exports at least one function', () => {
    assert.ok(Object.keys(mod).length > 0);
  });
});
