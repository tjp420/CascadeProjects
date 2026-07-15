const { describe, it } = require('node:test');
const assert = require('node:assert');
const mod = require('./public-api-routes.cjs');

describe('public-api-routes', () => {
  it('exports without throwing', () => {
    assert.ok(mod, 'module should export something');
  });

  it('allows free token routes without auth', () => {
    assert.strictEqual(mod.isPublicApiRoute('free-token', 'POST'), true);
    assert.strictEqual(mod.isPublicApiRoute('tokens/sandbox', 'POST'), true);
    assert.strictEqual(mod.isPublicApiRoute('simplebeacon/billing/resend-token', 'POST'), true);
  });
});
