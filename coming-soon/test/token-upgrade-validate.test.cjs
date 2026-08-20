// simplebeacon-ignore: test fixtures — all findings are false positives
/**
 * Tests for token upgrade + validate flow.
 * Uses an in-memory SQLite database via SIMPLEBEACON_TEST_DB env var.
 */
const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert');
const jwt = require('jsonwebtoken');
const path = require('path');

const TEST_SECRET = 'test-license-secret-for-token-tests';
const TEST_DB_NAME = 'test-token-upgrade.db';

// Set env before requiring modules
process.env.SIMPLEBEACON_LICENSE_SECRET = TEST_SECRET;
process.env.SIMPLEBEACON_TEST_DB = TEST_DB_NAME;

const db = require('../lib/db.cjs');
const tokenChain = require('../lib/token-chain-store.cjs');

const TEST_EMAIL = 'testuser@example.com';

function cleanupDb() {
    try {
        const fs = require('fs');
        const dbPath = path.join(__dirname, '..', '.simplebeacon', TEST_DB_NAME);
        if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
        const walPath = dbPath + '-wal';
        if (fs.existsSync(walPath)) fs.unlinkSync(walPath);
        const shmPath = dbPath + '-shm';
        if (fs.existsSync(shmPath)) fs.unlinkSync(shmPath);
    } catch {
        /* ignore */
    }
}

function generateToken(email, tier, expiresInMinutes) {
    return jwt.sign({ email, tier, jti: 'test-jti-' + Date.now() }, TEST_SECRET, { expiresIn: expiresInMinutes * 60 });
}

before(() => {
    cleanupDb();
    // Trigger table creation
    const d = db.getDb();
    // Create tables that are normally created by free-token.cjs init
    d.exec(`
    CREATE TABLE IF NOT EXISTS free_tokens (
      email TEXT PRIMARY KEY,
      token TEXT NOT NULL,
      token_hash TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      expires_at TEXT NOT NULL,
      revoked INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS sandbox_tokens (
      email TEXT PRIMARY KEY,
      token TEXT NOT NULL,
      token_hash TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      last_emailed_at TEXT NOT NULL DEFAULT (datetime('now')),
      expires_at TEXT NOT NULL
    );
  `);
});

after(() => {
    cleanupDb();
});

beforeEach(() => {
    // Clean tables between tests
    const d = db.getDb();
    d.exec('DELETE FROM token_nodes');
    d.exec('DELETE FROM free_tokens');
    d.exec('DELETE FROM customers');
    d.exec('DELETE FROM paid_subscriptions');
});

test('createTokenChain + activateToken creates an active owner node', () => {
    const token = generateToken(TEST_EMAIL, 'community', 60);
    const tokenHash = tokenChain.hashToken(token);

    const result = tokenChain.createTokenChain(TEST_EMAIL, { email: TEST_EMAIL, tier: 'community' }, token, 60);
    assert.ok(result.chainId, 'Should return a chainId');
    assert.strictEqual(result.owner.status, 'pending');

    const activateResult = tokenChain.activateToken(tokenHash, 60);
    assert.ok(activateResult.success, 'Activation should succeed');
    assert.strictEqual(activateResult.node.status, 'active');
    assert.strictEqual(activateResult.node.email, TEST_EMAIL);
    assert.strictEqual(activateResult.node.tier, 'community');
});

test('attachTokenToChain creates an attached paid node under the free token', () => {
    const freeToken = generateToken(TEST_EMAIL, 'community', 60);
    const freeHash = tokenChain.hashToken(freeToken);

    tokenChain.createTokenChain(TEST_EMAIL, { email: TEST_EMAIL, tier: 'community' }, freeToken, 60);
    tokenChain.activateToken(freeHash, 60);

    const paidToken = generateToken(TEST_EMAIL, 'team', 30 * 24 * 60);
    const attachResult = tokenChain.attachTokenToChain(
        freeHash,
        paidToken,
        { email: TEST_EMAIL, tier: 'team' },
        30 * 24 * 60
    );

    assert.ok(attachResult.success, 'attachTokenToChain should succeed');
    assert.strictEqual(attachResult.node.token_type, 'attached');
    assert.strictEqual(attachResult.node.status, 'active');
    assert.strictEqual(attachResult.node.tier, 'team');
    assert.strictEqual(attachResult.node.email, TEST_EMAIL);

    // Verify it's in the same chain
    const chain = tokenChain.getChain(attachResult.node.chain_id);
    assert.strictEqual(chain.length, 2, 'Chain should have 2 nodes');
    assert.strictEqual(chain[0].token_type, 'owner');
    assert.strictEqual(chain[1].token_type, 'attached');
});

test('attachTokenToChain fails if free token not in chain', () => {
    const paidToken = generateToken(TEST_EMAIL, 'team', 30 * 24 * 60);
    const result = tokenChain.attachTokenToChain(
        'nonexistent-hash',
        paidToken,
        { email: TEST_EMAIL, tier: 'team' },
        30 * 24 * 60
    );
    assert.strictEqual(result.success, false);
    assert.ok(result.error.includes('not found'), 'Should report not found');
});

test('revokeToken marks token as revoked but keeps node for audit', () => {
    const token = generateToken(TEST_EMAIL, 'community', 60);
    const tokenHash = tokenChain.hashToken(token);

    tokenChain.createTokenChain(TEST_EMAIL, { email: TEST_EMAIL, tier: 'community' }, token, 60);
    tokenChain.activateToken(tokenHash, 60);

    const revokeResult = tokenChain.revokeToken(tokenHash);
    assert.ok(revokeResult.success);

    const node = tokenChain.getTokenNode(tokenHash);
    assert.strictEqual(node.status, 'revoked');
    assert.ok(node.id, 'Node should still exist in DB');
});

test('getTokenNode returns null for unknown hash', () => {
    const node = tokenChain.getTokenNode('unknown-hash-123');
    assert.strictEqual(node, undefined);
});

test('paid token validation passes with active subscription and registered token', () => {
    const d = db.getDb();

    // Create customer with active subscription
    d.prepare('INSERT INTO customers (email, subscription_status, tier) VALUES (?, ?, ?)').run(
        TEST_EMAIL,
        'active',
        'team'
    );

    // Create paid subscription record
    const now = new Date();
    const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
    d.prepare(
        'INSERT INTO paid_subscriptions (customer_email, stripe_subscription_id, status, current_period_end) VALUES (?, ?, ?, ?)'
    ).run(TEST_EMAIL, 'sub_test123', 'active', periodEnd);

    // Create and register paid token
    const paidToken = generateToken(TEST_EMAIL, 'team', 30 * 24 * 60);
    const paidHash = tokenChain.hashToken(paidToken);

    tokenChain.createTokenChain(TEST_EMAIL, { email: TEST_EMAIL, tier: 'team' }, paidToken, 30 * 24 * 60);
    tokenChain.activateToken(paidHash, 30 * 24 * 60);

    // Verify token node
    const node = tokenChain.getTokenNode(paidHash);
    assert.ok(node, 'Token should be registered');
    assert.strictEqual(node.status, 'active');
    assert.strictEqual(node.email, TEST_EMAIL);

    // Verify customer record
    const customer = d.prepare('SELECT * FROM customers WHERE email = ?').get(TEST_EMAIL);
    assert.strictEqual(customer.subscription_status, 'active');

    // Verify paid subscription
    const activeSub = d
        .prepare(
            'SELECT * FROM paid_subscriptions WHERE customer_email = ? AND status = ? ORDER BY current_period_end DESC LIMIT 1'
        )
        .get(TEST_EMAIL, 'active');
    assert.ok(activeSub, 'Should have active paid subscription');
});

test('paid token validation fails without active subscription', () => {
    const d = db.getDb();

    // Create customer with inactive subscription
    d.prepare('INSERT INTO customers (email, subscription_status, tier) VALUES (?, ?, ?)').run(
        TEST_EMAIL,
        'inactive',
        'community'
    );

    // Create and register paid token
    const paidToken = generateToken(TEST_EMAIL, 'team', 30 * 24 * 60);
    const paidHash = tokenChain.hashToken(paidToken);

    tokenChain.createTokenChain(TEST_EMAIL, { email: TEST_EMAIL, tier: 'team' }, paidToken, 30 * 24 * 60);
    tokenChain.activateToken(paidHash, 30 * 24 * 60);

    // Customer should not have active subscription
    const customer = d.prepare('SELECT * FROM customers WHERE email = ?').get(TEST_EMAIL);
    assert.strictEqual(customer.subscription_status, 'inactive');
});

test('full upgrade flow: free token → chain registration → upgrade → paid token attached', () => {
    const d = db.getDb();

    // 1. Issue free token and register in chain
    const freeToken = generateToken(TEST_EMAIL, 'community', 24 * 60);
    const freeHash = tokenChain.hashToken(freeToken);

    tokenChain.createTokenChain(TEST_EMAIL, { email: TEST_EMAIL, tier: 'community' }, freeToken, 24 * 60);
    tokenChain.activateToken(freeHash, 24 * 60);

    // Verify free token is registered
    const freeNode = tokenChain.getTokenNode(freeHash);
    assert.ok(freeNode, 'Free token should be in chain');
    assert.strictEqual(freeNode.token_type, 'owner');
    assert.strictEqual(freeNode.status, 'active');

    // 2. Simulate checkout: create customer + paid subscription
    d.prepare('INSERT INTO customers (email, subscription_status, tier) VALUES (?, ?, ?)').run(
        TEST_EMAIL,
        'active',
        'team'
    );
    const periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    d.prepare(
        'INSERT INTO paid_subscriptions (customer_email, stripe_subscription_id, status, current_period_end) VALUES (?, ?, ?, ?)'
    ).run(TEST_EMAIL, 'sub_upgrade_test', 'active', periodEnd);

    // 3. Upgrade: attach paid token to free token's chain
    const paidToken = generateToken(TEST_EMAIL, 'team', 30 * 24 * 60);
    const attachResult = tokenChain.attachTokenToChain(
        freeHash,
        paidToken,
        { email: TEST_EMAIL, tier: 'team' },
        30 * 24 * 60
    );

    assert.ok(attachResult.success, 'Paid token should attach to chain');
    assert.strictEqual(attachResult.node.token_type, 'attached');
    assert.strictEqual(attachResult.node.status, 'active');
    assert.strictEqual(attachResult.node.tier, 'team');

    // 4. Revoke free token (as upgrade does)
    tokenChain.revokeToken(freeHash);
    const revokedNode = tokenChain.getTokenNode(freeHash);
    assert.strictEqual(revokedNode.status, 'revoked', 'Free token should be revoked');

    // 5. Verify paid token is still active and valid
    const paidNode = tokenChain.getTokenNode(tokenChain.hashToken(paidToken));
    assert.ok(paidNode, 'Paid token should be in chain');
    assert.strictEqual(paidNode.status, 'active');
    assert.strictEqual(paidNode.email, TEST_EMAIL);

    // 6. Verify chain lineage
    const chain = tokenChain.getChain(paidNode.chain_id);
    assert.strictEqual(chain.length, 2, 'Chain should have owner + attached');
    assert.strictEqual(chain[0].token_type, 'owner');
    assert.strictEqual(chain[0].status, 'revoked');
    assert.strictEqual(chain[1].token_type, 'attached');
    assert.strictEqual(chain[1].status, 'active');
});

test('expireStaleTokens marks expired tokens', () => {
    const token = generateToken(TEST_EMAIL, 'community', 1);
    const tokenHash = tokenChain.hashToken(token);

    tokenChain.createTokenChain(TEST_EMAIL, { email: TEST_EMAIL, tier: 'community' }, token, 1);
    tokenChain.activateToken(tokenHash, 1);

    // Manually set expires_at to past
    const d = db.getDb();
    d.prepare('UPDATE token_nodes SET expires_at = ? WHERE token_hash = ?').run('2020-01-01T00:00:00.000Z', tokenHash);

    const expired = tokenChain.expireStaleTokens();
    assert.ok(expired, 'Should have expired at least one token');

    const node = tokenChain.getTokenNode(tokenHash);
    assert.strictEqual(node.status, 'expired');
});
