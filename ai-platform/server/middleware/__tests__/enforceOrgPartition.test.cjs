describe('enforceOrgPartition middleware', () => {
  beforeEach(() => jest.resetModules());

  test('returns 401 if no user', () => {
    const mod = require('../authorize.cjs');
    const mw = mod.enforceOrgPartition();
    const req = {};
    const sent = {};
    const res = { status: (s) => ({ json: (b) => (sent.body = b) }) };
    const next = jest.fn();
    mw(req, res, next);
    expect(sent.body).toHaveProperty('error', 'authentication_required');
  });

  test('allows when clientOrgId matches callerOrgId', () => {
    const mod = require('../authorize.cjs');
    const mw = mod.enforceOrgPartition();
    const req = { user: { id: 'org1' }, body: { orgId: 'org1' }, method: 'GET', path: '/' };
    const res = {};
    const next = jest.fn();
    mw(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  test('denies cross-org when enforcement enabled and no admin', () => {
    jest.doMock('../../lib/rbac-store.cjs', () => ({ resolveUserRole: () => ({ role: 'user', permissions: [] }), hasPermission: () => false }));
    const mod = require('../authorize.cjs');
    const mw = mod.enforceOrgPartition();
    const req = { user: { id: 'orgA' }, body: { orgId: 'orgB' }, method: 'POST', path: '/x', ip: '127.0.0.1' };
    const sent = {};
    const res = { status: (s) => ({ json: (b) => (sent.body = b) }) };
    const next = jest.fn();
    mw(req, res, next);
    expect(sent.body).toHaveProperty('error', 'org_partition_violation');
  });
});
