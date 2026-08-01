const { jest: _jest } = require('@jest/globals');

describe('vault-operator helpers', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  test('applyVaultOperatorUser sets req.user with env email', () => {
    process.env.SIMPLEBEACON_BYPASS_EMAIL = 'op@example.com';
    jest.isolateModules(() => {
      const vo = require('../vault-operator.cjs');
      const req = {};
      vo.applyVaultOperatorUser(req);
      expect(req.user).toBeDefined();
      expect(req.user.email).toBe('op@example.com');
      expect(req.user.vaultSession).toBe(true);
    });
    delete process.env.SIMPLEBEACON_BYPASS_EMAIL;
  });

  test('vaultOperatorSessionActive returns true for dev bypass', () => {
    process.env.NODE_ENV = 'development';
    process.env.SIMPLEBEACON_DEV_BYPASS_AUTH = 'true';
    jest.isolateModules(() => {
      const vo = require('../vault-operator.cjs');
      const active = vo.vaultOperatorSessionActive({});
      expect(active).toBe(true);
    });
    delete process.env.SIMPLEBEACON_DEV_BYPASS_AUTH;
    delete process.env.NODE_ENV;
  });

  test('vaultOperatorSessionActive defers to isVaultAuthenticated when password present', () => {
    process.env.DASHBOARD_VAULT_PASSWORD = 'pw';
    jest.doMock('../../dashboard-vault-auth.cjs', () => ({
      isVaultAuthenticated: () => true
    }));
    jest.isolateModules(() => {
      const vo = require('../vault-operator.cjs');
      const active = vo.vaultOperatorSessionActive({});
      expect(active).toBe(true);
    });
    delete process.env.DASHBOARD_VAULT_PASSWORD;
  });
});
