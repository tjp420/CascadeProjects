'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');

const mod = require('../central-data-config.cjs');

describe('central-data-config smoke', () => {
  it('module loads without throwing', () => {
    assert.ok(mod);
  });

  it('exports expected functions', () => {
    assert.ok(Object.keys(mod).length > 0, 'module should export at least one function');
  });
});
