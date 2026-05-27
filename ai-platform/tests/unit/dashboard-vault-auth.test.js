const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  getVaultSessionToken,
  isVaultAuthenticated,
  isProtectedDashboardPath,
  setVaultSessionCookie
} = require('../../server/lib/dashboard-vault-auth');

describe('dashboard-vault-auth', () => {
  it('getVaultSessionToken is stable for the same secret', () => {
    const a = getVaultSessionToken('test-secret');
    const b = getVaultSessionToken('test-secret');
    assert.equal(a, b);
    assert.match(a, /^[a-f0-9]{64}$/);
  });

  it('isVaultAuthenticated bypasses when internal dashboard is off', () => {
    assert.equal(isVaultAuthenticated({}, { internalDashboard: false }), true);
  });

  it('isVaultAuthenticated accepts query password in internal mode', () => {
    assert.equal(
      isVaultAuthenticated(
        { query: { password: 'vault-pass' }, headers: {} },
        { internalDashboard: true, vaultPassword: 'vault-pass' }
      ),
      true
    );
  });

  it('isVaultAuthenticated accepts vault session cookie', () => {
    const token = getVaultSessionToken('vault-pass');
    assert.equal(
      isVaultAuthenticated(
        { headers: { cookie: `sb_vault=${token}` } },
        { internalDashboard: true, vaultPassword: 'vault-pass' }
      ),
      true
    );
  });

  it('isVaultAuthenticated rejects missing auth in internal mode', () => {
    assert.equal(
      isVaultAuthenticated({ headers: {} }, { internalDashboard: true, vaultPassword: 'vault-pass' }),
      false
    );
  });

  it('isProtectedDashboardPath matches dashboard entry points', () => {
    assert.equal(isProtectedDashboardPath('/app'), true);
    assert.equal(isProtectedDashboardPath('/simplebeacon-dashboard/js/app.js'), true);
    assert.equal(isProtectedDashboardPath('/services/foo.js'), true);
    assert.equal(isProtectedDashboardPath('/sample-report.html'), false);
    assert.equal(isProtectedDashboardPath('/'), false);
  });

  it('setVaultSessionCookie sets sb_vault cookie', () => {
    const headers = {};
    setVaultSessionCookie({ setHeader: (name, value) => { headers[name] = value; } }, 'vault-pass');
    assert.match(headers['Set-Cookie'], /^sb_vault=[a-f0-9]{64}; Path=\/; HttpOnly; SameSite=Lax; Max-Age=86400$/);
  });
});
