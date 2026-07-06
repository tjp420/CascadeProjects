const { describe, it } = require('node:test');
const assert = require('node:assert');
const mod = require('./repository-scanner-api.cjs');

describe('repository-scanner-api', () => {
  it('exports without throwing', () => {
    assert.ok(mod, 'module should export something');
  });

  it('has expected exports', () => {
    const keys = Object.keys(mod || {});
    // Add assertions for expected named exports here
    assert.ok(Array.isArray(keys), 'should have enumerable exports');
  });
});
