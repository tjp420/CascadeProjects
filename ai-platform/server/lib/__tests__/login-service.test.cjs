'use strict';

jest.mock('../../services/user-service.cjs', () => ({
  authenticateUser: jest.fn()
}));
jest.mock('../auth/audit-service.cjs', () => ({
  auditAuth: jest.fn()
}));

const { handleLogin, handleTokenRefresh } = require('../auth/login-service.cjs');
const { authenticateUser } = require('../../services/user-service.cjs');
const { auditAuth } = require('../auth/audit-service.cjs');

function mockReqRes(body = {}, user = null) {
  const req = { body, db: null, user, headers: {} };
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis()
  };
  const next = jest.fn();
  return { req, res, next };
}

describe('login-service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('exports handleLogin and handleTokenRefresh', () => {
    expect(typeof handleLogin).toBe('function');
    expect(typeof handleTokenRefresh).toBe('function');
  });

  test('handleLogin returns 400 when email or password missing', async () => {
    const { req, res, next } = mockReqRes({});
    await handleLogin(req, res, next);
    expect(next).toHaveBeenCalled();
    const err = next.mock.calls[0][0];
    expect(err.status).toBe(400);
  });

  test('handleLogin returns 401 when authentication fails', async () => {
    authenticateUser.mockResolvedValue(null);
    const { req, res, next } = mockReqRes({ email: 'bad@example.com', password: 'wrong' });
    await handleLogin(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'Authentication failed' }));
  });

  test('handleLogin returns token on success', async () => {
    authenticateUser.mockResolvedValue({ user: { id: 'u1', email: 'test@example.com', name: 'Test' } });
    const { req, res, next } = mockReqRes({ email: 'test@example.com', password: 'pass' });
    await handleLogin(req, res, next);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      message: 'Login successful',
      token: expect.any(String),
      user: expect.objectContaining({ email: 'test@example.com' })
    }));
    expect(auditAuth).toHaveBeenCalledWith('login_success', expect.any(Object), req);
  });

  test('handleTokenRefresh returns 401 without req.user', () => {
    const { req, res, next } = mockReqRes({}, null);
    handleTokenRefresh(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  test('handleTokenRefresh returns new token with req.user', () => {
    const { req, res, next } = mockReqRes({}, { id: 'u1', email: 'test@example.com', name: 'Test' });
    handleTokenRefresh(req, res, next);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      message: 'Token refreshed successfully',
      token: expect.any(String)
    }));
  });

  test('handleTokenRefresh supports longLived option', () => {
    const { req, res, next } = mockReqRes({ longLived: true }, { id: 'u1', email: 'test@example.com', name: 'Test' });
    handleTokenRefresh(req, res, next);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ longLived: true }));
  });
});
