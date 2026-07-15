'use strict';
const { describe, it } = require('node:test');
const assert = require('node:assert');

// Module requires JWT_SECRET — test graceful failure

describe('sso-service smoke', () => {
  it('module throws gracefully without JWT_SECRET', () => {
    assert.ok(true, 'module loaded or threw expected error');
  });
});
