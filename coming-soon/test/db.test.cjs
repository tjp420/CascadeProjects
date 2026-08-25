/**
 * Database tests using Node.js built-in test runner.
 */

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');

const TEST_DB = `test-${Date.now()}.db`;
const DB_PATH = path.join(__dirname, '..', '.simplebeacon', TEST_DB);

describe('Database', () => {
    let db;

    before(() => {
        process.env.SIMPLEBEACON_TEST_DB = TEST_DB;
        // Force re-import to recreate tables with new DB path
        delete require.cache[require.resolve('../lib/db.cjs')];
        db = require('../lib/db.cjs');
    });

    after(() => {
        delete process.env.SIMPLEBEACON_TEST_DB;
        // Best-effort cleanup — file may be locked by node:sqlite
        try {
            if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH);
        } catch {
            /* ignore lock errors */
        }
    });

    it('should add a subscription', () => {
        const result = db.addSubscription('test@example.com');
        assert.strictEqual(result.success, true);
        assert.strictEqual(result.message, 'Successfully subscribed.');
    });

    it('should prevent duplicate subscriptions', () => {
        const result = db.addSubscription('test@example.com');
        assert.strictEqual(result.success, true);
        assert.strictEqual(result.message, 'Email already registered.');
    });

    it('should retrieve subscriptions', () => {
        const subs = db.getSubscriptions();
        assert.ok(Array.isArray(subs));
        assert.ok(subs.length >= 1);
        assert.strictEqual(subs[0].email, 'test@example.com');
    });

    it('should queue an email', () => {
        const result = db.queueEmail({
            id: 'email_test_123',
            to: 'recipient@example.com',
            subject: 'Test',
            text: 'Hello',
            html: '<p>Hello</p>'
        });
        assert.strictEqual(result.queued, true);
    });

    it('should retrieve pending emails', () => {
        const emails = db.getPendingEmails();
        assert.ok(Array.isArray(emails));
        assert.ok(emails.length >= 1);
        assert.strictEqual(emails[0].recipient, 'recipient@example.com');
    });

    it('should mark an email as sent', () => {
        db.markEmailSent('email_test_123');
        const emails = db.getPendingEmails();
        const found = emails.find(e => e.id === 'email_test_123');
        assert.strictEqual(found, undefined);
    });
});
