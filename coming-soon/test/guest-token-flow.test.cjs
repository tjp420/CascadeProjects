'use strict';

/**
 * Guest token issue → signup claim flow
 */

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

process.env.SIMPLEBEACON_TEST_DB = 'guest-token-flow-test.db';
process.env.SIMPLEBEACON_LICENSE_SECRET = process.env.SIMPLEBEACON_LICENSE_SECRET || 'test-guest-token-secret-' + Date.now();

const dbPath = path.join(__dirname, '..', '.simplebeacon', process.env.SIMPLEBEACON_TEST_DB);
try { fs.unlinkSync(dbPath); } catch { /* ignore */ }

const db = require('../lib/db.cjs');
const {
    issueGuestToken,
    recordGuestAgentScan,
    checkGuestAgentScanLimit,
    GUEST_AGENT_SCANS_PER_DAY,
    claimGuestTokenForUser,
    resolveTokenAccountEmail,
    isGuestTokenRegistered,
    verifyLicenseToken,
    upgradeGuestToken,
    getGuestTokenByHash
} = require('../lib/guest-token-service.cjs');
const { hashToken } = require('../lib/token-chain-store.cjs');

describe('guest token flow', () => {
    const secret = process.env.SIMPLEBEACON_LICENSE_SECRET;
    const guestId = 'sb-dev-test-guest-' + crypto.randomBytes(4).toString('hex');

    before(() => {
        db.getDb();
    });

    after(() => {
        try { fs.unlinkSync(dbPath); } catch { /* ignore */ }
    });

    it('issues a server-signed guest token for a device id', () => {
        const result = issueGuestToken(guestId, secret);
        assert.strictEqual(result.success, true);
        assert.ok(result.token);
        assert.ok(result.token.includes('.'));
        assert.strictEqual(result.tier, 'guest');
        assert.strictEqual(result.claimed, false);

        const payload = verifyLicenseToken(result.token, secret);
        assert.ok(payload);
        assert.strictEqual(payload.tier, 'guest');
        assert.strictEqual(payload.guestId, guestId);
    });

    it('returns the same token for the same guest id while valid', () => {
        const first = issueGuestToken(guestId, secret);
        const second = issueGuestToken(guestId, secret);
        assert.strictEqual(second.success, true);
        assert.strictEqual(second.cached, true);
        assert.strictEqual(second.token, first.token);
    });

    it('claims guest token on signup — same JWT string, new account email', () => {
        const issued = issueGuestToken(guestId, secret);
        const email = `guest-flow-${Date.now()}@example.com`;
        const salt = crypto.randomBytes(16).toString('hex');
        const passwordHash = crypto.scryptSync('password123', salt, 64).toString('hex');
        const user = db.createUser(email, passwordHash, salt, 'community');

        const claim = claimGuestTokenForUser(issued.token, email, user.id);
        assert.strictEqual(claim.success, true);
        assert.strictEqual(claim.token, issued.token);
        assert.strictEqual(claim.email, email.toLowerCase());

        const payload = verifyLicenseToken(claim.token, secret);
        const accountEmail = resolveTokenAccountEmail(claim.token, payload);
        assert.strictEqual(accountEmail, email.toLowerCase());
        assert.strictEqual(isGuestTokenRegistered(claim.token), true);

        const customer = db.getDb().prepare('SELECT * FROM customers WHERE email = ?').get(email.toLowerCase());
        assert.ok(customer);
    });

    it('rejects claiming a guest token for a different account', () => {
        const otherGuestId = guestId + '-other';
        const issued = issueGuestToken(otherGuestId, secret);
        const ownerEmail = `owner-${Date.now()}@example.com`;
        const otherEmail = `other-${Date.now()}@example.com`;
        const salt = crypto.randomBytes(16).toString('hex');
        const hash = crypto.scryptSync('password123', salt, 64).toString('hex');
        const owner = db.createUser(ownerEmail, hash, salt, 'community');
        db.createUser(otherEmail, hash, salt, 'community');

        const firstClaim = claimGuestTokenForUser(issued.token, ownerEmail, owner.id);
        assert.strictEqual(firstClaim.success, true);

        const secondClaim = claimGuestTokenForUser(issued.token, otherEmail, owner.id + 99);
        assert.strictEqual(secondClaim.success, false);
        assert.match(secondClaim.error || '', /already linked/i);
    });

    it('enforces guest agent snippet scan daily limit', () => {
        const guestId = 'sb-dev-agentscan-' + crypto.randomBytes(4).toString('hex');
        const issued = issueGuestToken(guestId, secret);
        assert.strictEqual(issued.success, true);

        for (let i = 0; i < GUEST_AGENT_SCANS_PER_DAY; i++) {
            const r = recordGuestAgentScan(guestId);
            assert.strictEqual(r.success, true, `scan ${i + 1}`);
        }
        const blocked = recordGuestAgentScan(guestId);
        assert.strictEqual(blocked.success, false);
        const check = checkGuestAgentScanLimit(guestId);
        assert.strictEqual(check.allowed, false);
    });

    it('upgrades guest token to paid tier with lineage', () => {
        const guestId = 'sb-dev-upgrade-' + crypto.randomBytes(4).toString('hex');
        const issued = issueGuestToken(guestId, secret);
        assert.strictEqual(issued.success, true);

        const paidEmail = `upgrade-${Date.now()}@example.com`;
        db.getDb().prepare(
            'INSERT INTO customers (email, tier, subscription_status) VALUES (?, ?, ?)'
        ).run(paidEmail.toLowerCase(), 'developer', 'active');

        const upgraded = upgradeGuestToken(issued.token, paidEmail, 'developer', secret, 60);
        assert.strictEqual(upgraded.success, true);
        assert.ok(upgraded.token);
        assert.notStrictEqual(upgraded.token, issued.token);

        const oldGuest = db.getDb().prepare('SELECT * FROM guest_tokens WHERE token_hash = ?').get(hashToken(issued.token));
        assert.ok(oldGuest);
        assert.strictEqual(oldGuest.revoked, 1);

        const paidPayload = verifyLicenseToken(upgraded.token, secret);
        assert.strictEqual(paidPayload.tier, 'developer');
        assert.strictEqual(paidPayload.upgradedFrom, 'guest');
    });
});
