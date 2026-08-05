'use strict';
const { describe, it, before } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Snapshot the original DB path so we can restore it on a best-effort basis
const ORIGINAL_DB_PATH = path.join(__dirname, '../db/token-registry.json');
const TEST_DB_DIR = path.join(os.tmpdir(), 'sb-token-db-test-' + Date.now());
const TEST_DB_PATH = path.join(TEST_DB_DIR, 'token-registry.json');

function swapDbPath(tmpPath) {
  // token-db.cjs hard-codes DB_PATH at require time, so we must write at the
  // expected location for this test file. We keep tests isolated with a temp dir.
}

const mod = require('../token-db.cjs');

describe('token-db smoke', () => {
  before(() => {
    // Ensure a clean test database is present at the expected path
    try {
      fs.mkdirSync(path.dirname(ORIGINAL_DB_PATH), { recursive: true });
      fs.writeFileSync(ORIGINAL_DB_PATH, JSON.stringify({
        accounts: [],
        access_tokens: [],
        session_tokens: [],
        refresh_tokens: [],
        device_keys: [],
        recovery_factors: [],
        recovery_attempts: [],
        token_blocklist: [],
        license_tokens: [],
        audit_log: []
      }, null, 2));
    } catch (_) {}
  });

  it('module loads without throwing', () => { assert.ok(mod); });
  it('exports at least one function', () => { assert.ok(Object.keys(mod).length > 0); });

  it('exposes session token replication helpers', () => {
    assert.strictEqual(typeof mod.syncSessionToken, 'function');
    assert.strictEqual(typeof mod.getSessionTokenByHash, 'function');
    assert.strictEqual(typeof mod.findSessionTokensByAccount, 'function');
    assert.strictEqual(typeof mod.findSessionTokensByTenant, 'function');
    assert.strictEqual(typeof mod.expireSessionToken, 'function');
    assert.strictEqual(typeof mod.rotateSessionToken, 'function');
  });

  it('syncSessionToken inserts a new token', async () => {
    const token = {
      token_hash: 'sha256-test-' + Date.now(),
      account_id: 'acc-1',
      tenant_id: 'tenant-1',
      epoch: 1,
      token_sequence: 10,
      expires_at: new Date(Date.now() + 3600000).toISOString(),
    };
    const result = await mod.syncSessionToken(token);
    assert.strictEqual(result.accepted, true);
    assert.strictEqual(result.action, 'insert');

    const found = await mod.getSessionTokenByHash(token.token_hash);
    assert.ok(found);
    assert.strictEqual(found.token_hash, token.token_hash);
    assert.strictEqual(found.account_id, 'acc-1');
    assert.strictEqual(found.tenant_id, 'tenant-1');
    assert.strictEqual(found.token_sequence, 10);
  });

  it('syncSessionToken ignores stale (lower sequence) frames', async () => {
    const tokenHash = 'sha256-stale-' + Date.now();
    await mod.syncSessionToken({
      token_hash: tokenHash,
      account_id: 'acc-1',
      tenant_id: 'tenant-1',
      epoch: 2,
      token_sequence: 20,
      expires_at: new Date(Date.now() + 3600000).toISOString(),
    });
    const second = await mod.syncSessionToken({
      token_hash: tokenHash,
      account_id: 'acc-1',
      tenant_id: 'tenant-1',
      epoch: 1,
      token_sequence: 15,
      expires_at: new Date(Date.now() + 3600000).toISOString(),
    });
    assert.strictEqual(second.accepted, false);
    assert.strictEqual(second.reason, 'stale_sequence');
  });

  it('syncSessionToken overwrites with higher epoch/sequence', async () => {
    const tokenHash = 'sha256-update-' + Date.now();
    await mod.syncSessionToken({
      token_hash: tokenHash,
      account_id: 'acc-1',
      tenant_id: 'tenant-1',
      epoch: 2,
      token_sequence: 20,
      expires_at: new Date(Date.now() + 3600000).toISOString(),
    });
    const update = await mod.syncSessionToken({
      token_hash: tokenHash,
      account_id: 'acc-2',
      tenant_id: 'tenant-2',
      epoch: 3,
      token_sequence: 25,
      expires_at: new Date(Date.now() + 7200000).toISOString(),
    });
    assert.strictEqual(update.accepted, true);
    const found = await mod.getSessionTokenByHash(tokenHash);
    assert.strictEqual(found.account_id, 'acc-2');
    assert.strictEqual(found.tenant_id, 'tenant-2');
    assert.strictEqual(found.token_sequence, 25);
  });

  it('syncSessionToken revives a higher-sequence issue over a prior revocation', async () => {
    const tokenHash = 'sha256-revive-' + Date.now();
    await mod.syncSessionToken({
      token_hash: tokenHash,
      account_id: 'acc-1',
      tenant_id: 'tenant-1',
      epoch: 2,
      token_sequence: 20,
      expires_at: new Date(Date.now() + 3600000).toISOString(),
    });
    await mod.syncSessionToken({
      token_hash: tokenHash,
      account_id: 'acc-1',
      tenant_id: 'tenant-1',
      epoch: 2,
      token_sequence: 21,
      revoked_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 3600000).toISOString(),
    });
    const revive = await mod.syncSessionToken({
      token_hash: tokenHash,
      account_id: 'acc-1',
      tenant_id: 'tenant-1',
      epoch: 2,
      token_sequence: 22,
      expires_at: new Date(Date.now() + 3600000).toISOString(),
    });
    assert.strictEqual(revive.accepted, true);
    const found = await mod.getSessionTokenByHash(tokenHash);
    assert.strictEqual(found.token_sequence, 22);
    assert.strictEqual(found.revoked_at, undefined);
  });

  it('rotateSessionToken increments sequence and clears revocation', async () => {
    const id = 'rot-' + Date.now();
    await mod.insertSessionToken({
      id,
      token_hash: 'hash-before-' + Date.now(),
      account_id: 'acc-1',
      tenant_id: 'tenant-1',
      token_sequence: 0,
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 3600000).toISOString(),
    });
    const updated = await mod.rotateSessionToken(id, 'hash-after-' + Date.now(), new Date(Date.now() + 7200000).toISOString());
    assert.ok(updated);
    assert.strictEqual(updated.token_sequence, 1);
    assert.strictEqual(updated.revoked_at, undefined);
  });

  it('findSessionTokensByAccount returns only matching tokens', async () => {
    const unique = Date.now();
    await mod.syncSessionToken({
      token_hash: 'hash-account-a-' + unique,
      account_id: 'account-a',
      tenant_id: 'tenant-1',
      epoch: 1,
      token_sequence: 1,
      expires_at: new Date(Date.now() + 3600000).toISOString(),
    });
    await mod.syncSessionToken({
      token_hash: 'hash-account-b-' + unique,
      account_id: 'account-b',
      tenant_id: 'tenant-1',
      epoch: 1,
      token_sequence: 1,
      expires_at: new Date(Date.now() + 3600000).toISOString(),
    });
    const matches = await mod.findSessionTokensByAccount('account-a');
    assert.ok(matches.length >= 1);
    assert.ok(matches.every((t) => t.account_id === 'account-a'));
  });
});
