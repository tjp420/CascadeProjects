const auth = require('../middleware/auth.cjs');

describe('auth middleware facade', () => {
  test('exports expected authentication functions', () => {
    expect(typeof auth.generateToken).toBe('function');
    expect(typeof auth.verifyToken).toBe('function');
    expect(typeof auth.authenticate).toBe('function');
    expect(typeof auth.optionalAuthenticate).toBe('function');
  });

  test('exports trust level helpers', () => {
    expect(typeof auth.authorize).toBe('function');
    expect(typeof auth.requireTrustLevel).toBe('function');
    expect(typeof auth.evaluateTrustLevel).toBe('function');
    expect(auth.trustLevels).toBeDefined();
  });
});
