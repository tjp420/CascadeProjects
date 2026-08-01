describe('server/lib/auth token-service error branches', () => {
  test('generateToken throws when missing user', () => {
    const ts = require('../token-service.cjs');
    expect(() => ts.generateToken(null)).toThrow(TypeError);
  });

  test('verifyToken throws when blacklisted (mocked)', async () => {
    jest.isolateModules(async () => {
      jest.doMock('../../token-service.cjs', () => ({ isAccessTokenBlacklisted: async () => true }));
      const authTs = require('../token-service.cjs');
      await expect(authTs.verifyToken('fake.token')).rejects.toHaveProperty('status', 401);
    });
  });

  test('first-use tracking and invalidateToken', () => {
    const ts = require('../token-service.cjs');
    const jti = 'jti-test-1';
    expect(ts.isTokenExpiredByFirstUse(jti)).toBe(false);
    const first = ts.recordTokenFirstUse(jti);
    expect(typeof first).toBe('number');
    expect(ts.isTokenExpiredByFirstUse(jti)).toBe(false);
    ts.invalidateToken(jti);
    expect(ts.isTokenExpiredByFirstUse(jti)).toBe(false);
  });
});
