'use strict';

/**
 * Tests for POST /api/audit/key/purge endpoint.
 * Uses supertest to mount audit-routes on a real Express app with
 * mock authentication middleware that injects test users.
 *
 * Verifies:
 *   1. Admin can force-purge stale keys and gets purged=1
 *   2. Non-admin users get 403 insufficient_permissions
 *   3. Grace window is respected when force is not specified
 *   4. Response includes status metadata
 */

const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const express = require('express');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

// Set up temp paths before requiring modules
const _tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-key-purge-route-'));
const _tempKeyStorePath = path.join(_tempDir, 'key-rotation-state.json');
const _tempLogPath = path.join(_tempDir, 'audit-log.json');
const _tempPolicyPath = path.join(_tempDir, 'pii-policies.json');
process.env.KEY_ROTATION_STORE_PATH = _tempKeyStorePath;
process.env.AUDIT_LOG_PATH = _tempLogPath;
process.env.PII_POLICY_PATH = _tempPolicyPath;
process.env.AUDIT_LOG_SCRUB_PII = 'false';
fs.writeFileSync(_tempLogPath, JSON.stringify({ entries: {} }), 'utf8');
fs.writeFileSync(_tempPolicyPath, JSON.stringify({ policies: [] }), 'utf8');

// Mock authenticate middleware from auth.cjs so we can inject test users.
// auth.cjs uses Object.freeze() so we must use jest.mock() to replace it.
jest.mock('../../middleware/auth.cjs', () => ({
  authenticate: function mockAuthenticate(req, res, next) {
    if (req.user) return next();
    return res.status(401).json({
      success: false,
      error: 'authentication_required',
      message: 'Authentication required',
    });
  },
}));

// Mock users for testing
const ADMIN_USER = {
  id: 'admin@org-test.com',
  email: 'admin@org-test.com',
  role: 'admin',
  permissions: ['admin:all'],
};

const REGULAR_USER = {
  id: 'user@org-test.com',
  email: 'user@org-test.com',
  role: 'developer',
};

// Build the test app with mock auth
function createTestApp(user) {
  const app = express();
  app.use(express.json());

  // Mock authentication middleware — injects the test user
  app.use((req, res, next) => {
    if (user) {
      req.user = user;
    }
    next();
  });

  // Mount audit routes
  const auditRoutes = require('../../routes/audit-routes.cjs');
  app.use('/api/audit', auditRoutes);

  return app;
}

describe('POST /api/audit/key/purge', () => {
  let adminApp;
  let regularApp;
  let keyRotationStore;

  before(() => {
    keyRotationStore = require('../../lib/key-rotation-store.cjs');
    keyRotationStore.initKeyRing(crypto.randomBytes(32).toString('hex'));
  });

  beforeEach(() => {
    // Reset key ring and set up a previous key with short grace window
    keyRotationStore._reset();
    keyRotationStore.initKeyRing(crypto.randomBytes(32).toString('hex'));
    keyRotationStore.rotateKey(crypto.randomBytes(32).toString('hex'), 1000);

    // Clear audit-routes cache so it picks up fresh key-rotation-store
    const cacheKeys = Object.keys(require.cache || {});
    for (const k of cacheKeys) {
      if (k.endsWith('/server/routes/audit-routes.cjs')) {
        delete require.cache[k];
      }
    }

    adminApp = createTestApp(ADMIN_USER);
    regularApp = createTestApp(REGULAR_USER);
  });

  after(() => {
    try {
      delete process.env.KEY_ROTATION_STORE_PATH;
      delete process.env.AUDIT_LOG_PATH;
      delete process.env.PII_POLICY_PATH;
      delete process.env.AUDIT_LOG_SCRUB_PII;
      if (_tempDir && fs.existsSync(_tempDir)) {
        fs.rmSync(_tempDir, { recursive: true, force: true });
      }
    } catch (e) {
      // ignore cleanup errors
    }
  });

  it('allows an admin to force-purge stale keys and returns purged=1', async () => {
    const res = await request(adminApp).post('/api/audit/key/purge').send({ force: true });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.purged, 1);
    assert.strictEqual(res.body.hadPrevious, true);
  });

  it('returns purged=0 when no previous key exists to purge', async () => {
    // First purge to clear the previous key
    await request(adminApp).post('/api/audit/key/purge').send({ force: true });

    // Second purge should return purged=0
    const res = await request(adminApp).post('/api/audit/key/purge').send({ force: true });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.purged, 0);
    assert.strictEqual(res.body.hadPrevious, false);
  });

  it('denies access to non-admin users (403)', async () => {
    const res = await request(regularApp).post('/api/audit/key/purge').send({ force: true });

    assert.strictEqual(res.status, 403);
    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error, 'insufficient_permissions');
  });

  it('respects grace window when force is not specified', async () => {
    // Grace window is 1000ms, so purge without force should fail (purged=0)
    const res = await request(adminApp).post('/api/audit/key/purge').send({});

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.purged, 0);
    assert.strictEqual(res.body.hadPrevious, true);
    assert.strictEqual(res.body.graceExpired, false);
  });

  it('includes status object in response', async () => {
    const res = await request(adminApp).post('/api/audit/key/purge').send({ force: true });

    assert.strictEqual(res.status, 200);
    assert.ok(res.body.status, 'response should include status object');
    assert.strictEqual(res.body.status.hasPrevious, false);
    assert.ok(res.body.status.activeFingerprint, 'status should have activeFingerprint');
  });
});
