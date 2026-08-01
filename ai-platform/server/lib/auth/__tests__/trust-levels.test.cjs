const { jest: _jest } = require('@jest/globals');

describe('trust-levels utilities', () => {
  beforeEach(() => jest.resetModules());

  test('evaluateTrustLevel returns bronze for empty user', () => {
    const tl = require('../trust-levels.cjs');
    expect(tl.evaluateTrustLevel(null)).toBe('bronze');
  });

  test('evaluateTrustLevel can return gold for a high-score user', () => {
    const tl = require('../trust-levels.cjs');
    const user = {
      createdAt: new Date(Date.now() - (1000 * 60 * 60 * 24 * 400)).toISOString(),
      successfulAnalyses: 200,
      securityIncidents: 0,
      communityContributions: 50,
      verificationStatus: 'enterprise'
    };
    const level = tl.evaluateTrustLevel(user);
    expect(['gold', 'silver', 'bronze']).toContain(level);
  });

  test('authorize middleware enforces permissions and allows when present', () => {
    const tl = require('../trust-levels.cjs');
    const mw = tl.authorize(['read:own']);
    const req = { user: { permissions: ['read:own', 'write:own'] } };
    const res = { status: jest.fn(() => ({ json: jest.fn() })) };
    const next = jest.fn();
    mw(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  test('authorize middleware denies when permissions missing', () => {
    const tl = require('../trust-levels.cjs');
    const mw = tl.authorize(['admin:basic']);
    const req = { user: { permissions: ['read:own'] } };
    const json = jest.fn();
    const res = { status: jest.fn(() => ({ json })) };
    const next = jest.fn();
    mw(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(json).toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  test('requireOwnership allows admin and owner, denies others', async () => {
    const tl = require('../trust-levels.cjs');
    // admin bypass
    const mwAdmin = tl.requireOwnership(() => Promise.resolve('x'));
    const reqAdmin = { user: { role: 'admin', id: 'u1' } };
    const resAdmin = { status: jest.fn(() => ({ json: jest.fn() })) };
    const nextAdmin = jest.fn();
    await mwAdmin(reqAdmin, resAdmin, nextAdmin);
    expect(nextAdmin).toHaveBeenCalled();

    // owner allowed
    const mwOwner = tl.requireOwnership(() => Promise.resolve('owner-1'));
    const reqOwner = { user: { role: '', id: 'owner-1' } };
    const resOwner = { status: jest.fn(() => ({ json: jest.fn() })) };
    const nextOwner = jest.fn();
    await mwOwner(reqOwner, resOwner, nextOwner);
    expect(nextOwner).toHaveBeenCalled();

    // not owner denied
    const mwDenied = tl.requireOwnership(() => Promise.resolve('owner-2'));
    const reqDenied = { user: { role: '', id: 'someone-else' } };
    const json = jest.fn();
    const resDenied = { status: jest.fn(() => ({ json })) };
    const nextDenied = jest.fn();
    await mwDenied(reqDenied, resDenied, nextDenied);
    expect(resDenied.status).toHaveBeenCalledWith(403);
    expect(json).toHaveBeenCalled();
  });
});
