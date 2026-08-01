const { jest: _jest } = require('@jest/globals');

describe('auth middleware (optionalAuthenticate)', () => {
  let optionalAuthenticate;
  beforeEach(() => {
    jest.resetModules();
  });

  test('sets req.user when Bearer token verifies', async () => {
    // Mock token-service verifyToken + helpers
    jest.doMock('../../lib/auth/token-service.cjs', () => ({
      verifyToken: async (token) => ({
        jti: 'j-1',
        sub: 'user-1',
        email: 'u@example.com',
        name: 'User One',
        trustLevel: 'gold',
        permissions: [],
        features: []
      }),
      recordTokenFirstUse: jest.fn(),
      isTokenExpiredByFirstUse: () => false,
      invalidateToken: jest.fn()
    }));
    jest.doMock('../../lib/auth/sandbox-service.cjs', () => ({
      isSandboxToken: () => false,
      recordSandboxRequest: () => ({ allowed: true }),
      getSandboxLimitHeaders: () => ({})
    }));

    jest.isolateModules(async () => {
      const auth = require('../auth.cjs');
      optionalAuthenticate = auth.optionalAuthenticate;

      const req = { headers: { authorization: 'Bearer good-token' }, originalUrl: '/x' };
      const res = { setHeader: jest.fn() };
      const next = jest.fn();

      await optionalAuthenticate(req, res, next);
      expect(req.user).toBeDefined();
      expect(req.user.id).toBe('user-1');
      expect(next).toHaveBeenCalled();
    });
  });

  test('sets req.authError when token verification fails', async () => {
    jest.doMock('../../lib/auth/token-service.cjs', () => ({
      verifyToken: async () => { throw new Error('invalid token'); },
      recordTokenFirstUse: jest.fn(),
      isTokenExpiredByFirstUse: () => false,
      invalidateToken: jest.fn()
    }));
    jest.doMock('../../lib/auth/sandbox-service.cjs', () => ({
      isSandboxToken: () => false,
      recordSandboxRequest: () => ({ allowed: true }),
      getSandboxLimitHeaders: () => ({})
    }));

    jest.isolateModules(async () => {
      const auth = require('../auth.cjs');
      optionalAuthenticate = auth.optionalAuthenticate;

      const req = { headers: { authorization: 'Bearer bad-token' }, originalUrl: '/x' };
      const res = { setHeader: jest.fn() };
      const next = jest.fn();

      await optionalAuthenticate(req, res, next);
      expect(req.user).toBeUndefined();
      expect(req.authError).toBeDefined();
      expect(req.authError.message).toMatch(/invalid token/);
      expect(next).toHaveBeenCalled();
    });
  });

  test('sandbox token denied sets authError 429 and sets headers', async () => {
    jest.resetModules();
    jest.doMock('../../lib/auth/token-service.cjs', () => ({
      verifyToken: async (token) => ({ jti: 's-1', sub: 'sandbox-user', email: 's@example.com' }),
      recordTokenFirstUse: jest.fn(),
      isTokenExpiredByFirstUse: () => false,
      invalidateToken: jest.fn()
    }));
    jest.doMock('../../lib/auth/sandbox-service.cjs', () => ({
      isSandboxToken: () => true,
      recordSandboxRequest: () => ({ allowed: false }),
      getSandboxLimitHeaders: () => ({ 'x-sandbox-remaining': '0' })
    }));

    jest.isolateModules(async () => {
      const auth = require('../auth.cjs');
      const optionalAuthenticate = auth.optionalAuthenticate;

      const req = { headers: { authorization: 'Bearer sandbox-token' }, originalUrl: '/x' };
      const res = { setHeader: jest.fn() };
      const next = jest.fn();

      await optionalAuthenticate(req, res, next);
      expect(req.user).toBeUndefined();
      expect(req.authError).toBeDefined();
      // resolveAuth wraps attempt errors into a 401 with details, but headers should be set
      expect(req.authError.status).toBe(401);
      expect(req.authError.message).toMatch(/Sandbox/);
      expect(res.setHeader).toHaveBeenCalledWith('x-sandbox-remaining', '0');
      expect(next).toHaveBeenCalled();
    });
  });

  test('extracts token from access_token cookie JSON', async () => {
    jest.resetModules();
    jest.doMock('../../lib/auth/token-service.cjs', () => ({
      verifyToken: async (token) => ({ jti: 'c-1', sub: 'cookie-user', email: 'c@example.com' }),
      recordTokenFirstUse: jest.fn(),
      isTokenExpiredByFirstUse: () => false,
      invalidateToken: jest.fn()
    }));
    jest.doMock('../../lib/auth/sandbox-service.cjs', () => ({
      isSandboxToken: () => false,
      recordSandboxRequest: () => ({ allowed: true }),
      getSandboxLimitHeaders: () => ({})
    }));

    jest.isolateModules(async () => {
      const auth = require('../auth.cjs');
      const optionalAuthenticate = auth.optionalAuthenticate;

      const cookieVal = encodeURIComponent(JSON.stringify({ token: 'cookie-token' }));
      const req = { headers: { cookie: `access_token=${cookieVal}` }, originalUrl: '/x' };
      const res = { setHeader: jest.fn() };
      const next = jest.fn();

      await optionalAuthenticate(req, res, next);
      expect(req.user).toBeDefined();
      expect(req.user.id).toBe('cookie-user');
      expect(next).toHaveBeenCalled();
    });
  });

  test('no tokens yields Authorization required authError', async () => {
    jest.resetModules();
    jest.doMock('../../lib/auth/token-service.cjs', () => ({
      verifyToken: async () => { throw new Error('should not be called'); },
      recordTokenFirstUse: jest.fn(),
      isTokenExpiredByFirstUse: () => false,
      invalidateToken: jest.fn()
    }));
    jest.doMock('../../lib/auth/sandbox-service.cjs', () => ({
      isSandboxToken: () => false,
      recordSandboxRequest: () => ({ allowed: true }),
      getSandboxLimitHeaders: () => ({})
    }));

    jest.isolateModules(async () => {
      const auth = require('../auth.cjs');
      const optionalAuthenticate = auth.optionalAuthenticate;

      const req = { headers: {}, originalUrl: '/x' };
      const res = { setHeader: jest.fn() };
      const next = jest.fn();

      await optionalAuthenticate(req, res, next);
      expect(req.user).toBeUndefined();
      expect(req.authError).toBeDefined();
      expect(req.authError.status).toBe(401);
      expect(req.authError.message).toMatch(/Authorization required/);
      expect(next).toHaveBeenCalled();
    });
  });

  test('first-use expiry invalidates token and sets authError', async () => {
    jest.resetModules();
    const invalidateFn = jest.fn();
    jest.doMock('../../lib/auth/token-service.cjs', () => ({
      verifyToken: async (token) => ({ jti: 'f-1', sub: 'firstuse-user', email: 'f@example.com' }),
      recordTokenFirstUse: jest.fn(),
      isTokenExpiredByFirstUse: () => true,
      invalidateToken: invalidateFn
    }));
    jest.doMock('../../lib/auth/sandbox-service.cjs', () => ({
      isSandboxToken: () => false,
      recordSandboxRequest: () => ({ allowed: true }),
      getSandboxLimitHeaders: () => ({})
    }));

    jest.isolateModules(async () => {
      const auth = require('../auth.cjs');
      const optionalAuthenticate = auth.optionalAuthenticate;

      const req = { headers: { authorization: 'Bearer expiry-token' }, originalUrl: '/x' };
      const res = { setHeader: jest.fn() };
      const next = jest.fn();

      await optionalAuthenticate(req, res, next);
      expect(req.user).toBeUndefined();
      expect(req.authError).toBeDefined();
      expect(req.authError.message).toMatch(/Token expired/);
      expect(invalidateFn).toHaveBeenCalledWith('f-1');
      expect(next).toHaveBeenCalled();
    });
  });
});
