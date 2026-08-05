const { jest: _jest } = require('@jest/globals');

const path = require('path');

describe('token-service core behaviors', () => {
  let tokenService;
  beforeEach(() => {
    jest.resetModules();
    tokenService = require('../token-service.cjs');
  });

  test('generateToken throws on invalid input', () => {
    expect(() => tokenService.generateToken(null)).toThrow(TypeError);
  });

  test('generateToken produces a verifiable token and verifyToken decodes it', async () => {
    const user = { id: 'u123', email: 'u@x.com', name: 'U', trustLevel: 'gold' };
    const token = tokenService.generateToken(user);
    expect(typeof token).toBe('string');

    const decoded = await tokenService.verifyToken(token);
    expect(decoded.sub).toBe('u123');
    expect(decoded.email).toBe('u@x.com');
  });

  test('first-use expiry behavior and invalidateToken', () => {
    const jti = 'test-jti-1';
    const now = Date.now();
    const origNow = Date.now;
    try {
      // record first use
      const t1 = tokenService.recordTokenFirstUse(jti);
      expect(typeof t1).toBe('number');

      // advance time beyond lifetime
      const future = t1 + tokenService.TOKEN_LIFETIME_MS + 1000;
      Date.now = () => future;
      expect(tokenService.isTokenExpiredByFirstUse(jti)).toBe(true);

      // invalidate should remove tracking
      tokenService.invalidateToken(jti);
      expect(tokenService.isTokenExpiredByFirstUse(jti)).toBe(false);
    } finally {
      Date.now = origNow;
    }
  });
});
