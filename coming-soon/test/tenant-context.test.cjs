'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const db = require('../lib/db.cjs');
const { extractTenantContext } = require('../src/middleware/tenantContext.js');

test('extractTenantContext prefers authPayload email over req.user.id', () => {
  const originalGetMemberRole = db.getMemberRole;
  let seenTenantId = null;
  let seenEmail = null;

  db.getMemberRole = (tenantId, email) => {
    seenTenantId = tenantId;
    seenEmail = email;
    return { role: 'owner', status: 'active' };
  };

  try {
    const req = {
      authPayload: { email: 'owner@example.com', role: 'owner' },
      user: { id: 'some-user-id', role: 'auditor' },
      headers: { 'x-tenant-id': 'tenant-123' }
    };

    let nextCalled = false;
    const res = {
      status(code) {
        throw new Error(`Unexpected response status ${code}`);
      }
    };

    extractTenantContext(req, res, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, true);
    assert.equal(seenTenantId, 'tenant-123');
    assert.equal(seenEmail, 'owner@example.com');
    assert.equal(req.authContext.role, 'owner');
  } finally {
    db.getMemberRole = originalGetMemberRole;
  }
});
