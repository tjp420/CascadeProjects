'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');

describe('database-adapter smoke', () => {
  it('module loads without throwing', () => {
    assert.doesNotThrow(() => require('../database-adapter.cjs'));
  });
});
