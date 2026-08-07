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

  it('allows chatbot provider discovery and messaging without auth gate', () => {
    assert.strictEqual(mod.isPublicApiRoute('chatbot/providers', 'GET'), true);
    assert.strictEqual(mod.isPublicApiRoute('chatbot/message', 'POST'), true);
    assert.strictEqual(mod.isPublicApiRoute('chatbot/disclosure', 'GET'), true);
  });

  it('allows webauthn challenge and authenticate without auth gate', () => {
    assert.strictEqual(mod.isPublicApiRoute('webauthn/challenge', 'POST'), true);
    assert.strictEqual(mod.isPublicApiRoute('webauthn/authenticate', 'POST'), true);
    assert.strictEqual(mod.isPublicApiRoute('webauthn/register', 'POST'), false);
    assert.strictEqual(mod.isPublicApiRoute('webauthn/credentials', 'GET'), false);
  });

  it('allows read-only dashboard stub endpoints without auth', () => {
    assert.strictEqual(mod.isPublicApiRoute('dashboard-home', 'GET'), true);
    assert.strictEqual(mod.isPublicApiRoute('dev-tools/tools', 'GET'), true);
    assert.strictEqual(mod.isPublicApiRoute('dev-tools/workflows', 'GET'), true);
    assert.strictEqual(mod.isPublicApiRoute('security/overview', 'GET'), true);
    assert.strictEqual(mod.isPublicApiRoute('quality/overview', 'GET'), true);
    assert.strictEqual(mod.isPublicApiRoute('coverage-reports/overview', 'GET'), true);
    assert.strictEqual(mod.isPublicApiRoute('help', 'GET'), true);
    assert.strictEqual(mod.isPublicApiRoute('analytics/overview', 'GET'), true);
    assert.strictEqual(mod.isPublicApiRoute('merger-tool/reduction-scan', 'GET'), false);
    assert.strictEqual(mod.isPublicApiRoute('security/npm-audit', 'GET'), false);
  });

  it('allows chatbot prompt fetch without auth but gates mutations', () => {
    assert.strictEqual(mod.isPublicApiRoute('prompts/get', 'GET'), true);
    assert.strictEqual(mod.isPublicApiRoute('prompts/set', 'POST'), false);
    assert.strictEqual(mod.isPublicApiRoute('prompts/delete', 'DELETE'), false);
  });

  it('allows SSO domain resolution and presets without auth (pre-login)', () => {
    assert.strictEqual(mod.isPublicApiRoute('sso/resolve', 'GET'), true);
    assert.strictEqual(mod.isPublicApiRoute('sso/presets', 'GET'), true);
    // SSO login callbacks should also be public (IdP redirects)
    assert.strictEqual(mod.isPublicApiRoute('sso/oidc/login', 'GET'), true);
    assert.strictEqual(mod.isPublicApiRoute('sso/oidc/callback', 'GET'), true);
    assert.strictEqual(mod.isPublicApiRoute('sso/saml/login', 'GET'), true);
    assert.strictEqual(mod.isPublicApiRoute('sso/saml/acs', 'POST'), true);
  });
});
