/**
 * Simple SQLite database for subscriptions and email queue.
 * Uses Node.js built-in node:sqlite (available in Node 22+).
 */

const { DatabaseSync } = require('node:sqlite');
const path = require('path');

const DB_PATH = process.env.SIMPLEBEACON_TEST_DB
    ? path.join(__dirname, '..', '.simplebeacon', process.env.SIMPLEBEACON_TEST_DB)
    : path.join(__dirname, '..', '.simplebeacon', 'app.db');

let db = null;

function getDb() {
    if (!db) {
        try {
            const fs = require('fs');
            fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
            db = new DatabaseSync(DB_PATH);
            db.exec('PRAGMA journal_mode = WAL');
            db.exec('PRAGMA foreign_keys = ON');
        } catch (err) {
            throw err;
        }
        db.exec(`
            CREATE TABLE IF NOT EXISTS subscriptions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT NOT NULL UNIQUE,
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
            );
            CREATE TABLE IF NOT EXISTS email_queue (
                id TEXT PRIMARY KEY,
                recipient TEXT NOT NULL,
                subject TEXT NOT NULL,
                body_text TEXT,
                body_html TEXT,
                status TEXT NOT NULL DEFAULT 'pending',
                provider TEXT,
                provider_message_id TEXT,
                attempts INTEGER NOT NULL DEFAULT 0,
                last_error TEXT,
                queued_at TEXT NOT NULL DEFAULT (datetime('now')),
                sent_at TEXT,
                delivered_at TEXT,
                bounced_at TEXT,
                opened_at TEXT
            );
            CREATE TABLE IF NOT EXISTS customers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT NOT NULL UNIQUE,
                stripe_customer_id TEXT,
                subscription_status TEXT DEFAULT 'inactive',
                tier TEXT DEFAULT 'community',
                api_key TEXT UNIQUE,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now'))
            );
            CREATE TABLE IF NOT EXISTS paid_subscriptions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                customer_email TEXT NOT NULL,
                stripe_subscription_id TEXT UNIQUE,
                stripe_price_id TEXT,
                status TEXT DEFAULT 'active',
                current_period_start TEXT,
                current_period_end TEXT,
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
            );
            CREATE INDEX IF NOT EXISTS idx_subscriptions_email ON subscriptions(email);
            CREATE INDEX IF NOT EXISTS idx_queue_status ON email_queue(status);
            CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);
            CREATE INDEX IF NOT EXISTS idx_customers_api_key ON customers(api_key);
            CREATE INDEX IF NOT EXISTS idx_paid_subscriptions_email ON paid_subscriptions(customer_email);
            CREATE TABLE IF NOT EXISTS refunds (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                customer_email TEXT NOT NULL,
                stripe_subscription_id TEXT,
                amount TEXT,
                reason TEXT,
                status TEXT DEFAULT 'pending',
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
            );
            CREATE INDEX IF NOT EXISTS idx_refunds_email ON refunds(customer_email);
            CREATE TABLE IF NOT EXISTS token_nodes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                chain_id TEXT NOT NULL,
                parent_id INTEGER REFERENCES token_nodes(id),
                token_hash TEXT UNIQUE,
                token_type TEXT NOT NULL DEFAULT 'attached',
                status TEXT NOT NULL DEFAULT 'pending',
                email TEXT,
                tier TEXT,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                activated_at TEXT,
                clock_started_at TEXT,
                expires_at TEXT,
                features TEXT
            );
            CREATE INDEX IF NOT EXISTS idx_token_nodes_chain ON token_nodes(chain_id);
            CREATE INDEX IF NOT EXISTS idx_token_nodes_hash ON token_nodes(token_hash);
            CREATE INDEX IF NOT EXISTS idx_token_nodes_status ON token_nodes(status);
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL,
                salt TEXT NOT NULL,
                tier TEXT DEFAULT 'community',
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now'))
            );
            CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
        `);
    }
    // Schema migrations for existing databases
    try {
        db.exec(`ALTER TABLE email_queue ADD COLUMN provider TEXT;`);
    } catch (err) { /* column may already exist */ }
    try {
        db.exec(`ALTER TABLE email_queue ADD COLUMN provider_message_id TEXT;`);
    } catch (err) { /* column may already exist */ }
    try {
        db.exec(`ALTER TABLE email_queue ADD COLUMN attempts INTEGER DEFAULT 0;`);
    } catch (err) { /* column may already exist */ }
    try {
        db.exec(`ALTER TABLE email_queue ADD COLUMN last_error TEXT;`);
    } catch (err) { /* column may already exist */ }
    try {
        db.exec(`ALTER TABLE email_queue ADD COLUMN delivered_at TEXT;`);
    } catch (err) { /* column may already exist */ }
    try {
        db.exec(`ALTER TABLE email_queue ADD COLUMN bounced_at TEXT;`);
    } catch (err) { /* column may already exist */ }
    try {
        db.exec(`ALTER TABLE email_queue ADD COLUMN opened_at TEXT;`);
    } catch (err) { /* column may already exist */ }
    try {
        db.exec(`CREATE INDEX IF NOT EXISTS idx_email_queue_status_attempts ON email_queue(status, attempts);`);
    } catch (err) { /* index may already exist */ }
    return db;
}

function addSubscription(email) {
    const db = getDb();
    try {
        db.prepare('INSERT INTO subscriptions (email) VALUES (?)').run(email.trim().toLowerCase());
        return { success: true, message: 'Successfully subscribed.' };
    } catch (err) {
        if (err.message.includes('UNIQUE constraint failed')) {
            return { success: true, message: 'Email already registered.' };
        }
        throw err;
    }
}

function getSubscriptions() {
    const db = getDb();
    return db.prepare('SELECT email, created_at FROM subscriptions ORDER BY created_at DESC').all();
}

function queueEmail({ id, to, subject, text, html, provider, providerMessageId }) {
    const db = getDb();
    db.prepare(
        `INSERT INTO email_queue (id, recipient, subject, body_text, body_html, provider, provider_message_id, attempts, status, queued_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 0, 'pending', datetime('now'))
         ON CONFLICT(id) DO UPDATE SET
         recipient=excluded.recipient, subject=excluded.subject, body_text=excluded.body_text,
         body_html=excluded.body_html, provider=excluded.provider, provider_message_id=excluded.provider_message_id`
    ).run(id, to, subject, text || '', html || '', provider || null, providerMessageId || null);
    return { queued: true };
}

function getPendingEmails(limit = 100) {
    const db = getDb();
    return db.prepare(
        'SELECT * FROM email_queue WHERE status = ? ORDER BY queued_at ASC LIMIT ?'
    ).all('pending', limit);
}

function markEmailSent(id, provider, providerMessageId) {
    const db = getDb();
    db.prepare(
        "UPDATE email_queue SET status = 'sent', sent_at = datetime('now'), provider = ?, provider_message_id = ? WHERE id = ?"
    ).run(provider || null, providerMessageId || null, id);
}

function updateEmailStatus(id, status, lastError) {
    const db = getDb();
    db.prepare(
        "UPDATE email_queue SET status = ?, last_error = ? WHERE id = ?"
    ).run(status, lastError || null, id);
}

function getEmailByProviderMessageId(providerMessageId) {
    const db = getDb();
    return db.prepare('SELECT * FROM email_queue WHERE provider_message_id = ?').get(providerMessageId);
}

function getEmailsForRetry(limit = 100) {
    const db = getDb();
    return db.prepare(
        "SELECT * FROM email_queue WHERE status = 'pending' AND (attempts IS NULL OR attempts < 3) ORDER BY queued_at ASC LIMIT ?"
    ).all(limit);
}

function incrementEmailAttempts(id) {
    const db = getDb();
    db.prepare(
        "UPDATE email_queue SET attempts = attempts + 1 WHERE id = ?"
    ).run(id);
}

function getOrCreateCustomer(email) {
    const db = getDb();
    const existing = db.prepare('SELECT * FROM customers WHERE email = ?').get(email.trim().toLowerCase());
    if (existing) return existing;
    const crypto = require('crypto');
    const apiKey = 'sb_' + crypto.randomBytes(24).toString('hex');
    db.prepare(
        'INSERT INTO customers (email, api_key) VALUES (?, ?)'
    ).run(email.trim().toLowerCase(), apiKey);
    return db.prepare('SELECT * FROM customers WHERE email = ?').get(email.trim().toLowerCase());
}

function updateCustomerStripeId(email, stripeCustomerId) {
    const db = getDb();
    db.prepare(
        "UPDATE customers SET stripe_customer_id = ?, updated_at = datetime('now') WHERE email = ?"
    ).run(stripeCustomerId, email.trim().toLowerCase());
}

function updateCustomerSubscription(email, status, tier) {
    const db = getDb();
    db.prepare(
        "UPDATE customers SET subscription_status = ?, tier = ?, updated_at = datetime('now') WHERE email = ?"
    ).run(status, tier, email.trim().toLowerCase());
}

function getCustomerByApiKey(apiKey) {
    const db = getDb();
    return db.prepare('SELECT * FROM customers WHERE api_key = ?').get(apiKey);
}

function getAllCustomers() {
    const db = getDb();
    return db.prepare('SELECT * FROM customers ORDER BY created_at DESC').all();
}

function getAllPaidSubscriptions() {
    const db = getDb();
    return db.prepare('SELECT * FROM paid_subscriptions ORDER BY created_at DESC').all();
}

function getAllUsers() {
    const db = getDb();
    return db.prepare('SELECT id, email, tier, created_at, updated_at FROM users ORDER BY created_at DESC').all();
}

function addRefundRecord(customerEmail, stripeSubscriptionId, amount, reason) {
    const db = getDb();
    db.prepare(
        'INSERT INTO refunds (customer_email, stripe_subscription_id, amount, reason, status) VALUES (?, ?, ?, ?, ?)'
    ).run(customerEmail.trim().toLowerCase(), stripeSubscriptionId || null, amount || null, reason || null, 'completed');
    return { success: true };
}

function getRefundsForCustomer(email) {
    const db = getDb();
    return db.prepare('SELECT * FROM refunds WHERE customer_email = ? ORDER BY created_at DESC').all(email.trim().toLowerCase());
}

function getAllRefunds() {
    const db = getDb();
    return db.prepare('SELECT * FROM refunds ORDER BY created_at DESC').all();
}

function updatePaidSubscriptionToRefunded(stripeSubscriptionId, reason) {
    const db = getDb();
    db.prepare(
        "UPDATE paid_subscriptions SET status = 'refunded' WHERE stripe_subscription_id = ?"
    ).run(stripeSubscriptionId);
    const sub = db.prepare('SELECT * FROM paid_subscriptions WHERE stripe_subscription_id = ?').get(stripeSubscriptionId);
    if (sub) {
        addRefundRecord(sub.customer_email, stripeSubscriptionId, null, reason);
        db.prepare(
            "UPDATE customers SET subscription_status = 'refunded', tier = 'community', updated_at = datetime('now') WHERE email = ?"
        ).run(sub.customer_email);
    }
    return { success: true };
}

function addPaidSubscription(customerEmail, stripeSubscriptionId, stripePriceId, status, periodStart, periodEnd) {
    const db = getDb();
    db.prepare(
        'INSERT INTO paid_subscriptions (customer_email, stripe_subscription_id, stripe_price_id, status, current_period_start, current_period_end) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(customerEmail.trim().toLowerCase(), stripeSubscriptionId, stripePriceId, status, periodStart, periodEnd);
}

function updatePaidSubscriptionStatus(stripeSubscriptionId, status) {
    const db = getDb();
    db.prepare(
        'UPDATE paid_subscriptions SET status = ? WHERE stripe_subscription_id = ?'
    ).run(status, stripeSubscriptionId);
}

function createUser(email, passwordHash, salt, tier) {
    const db = getDb();
    db.prepare(
        'INSERT INTO users (email, password_hash, salt, tier) VALUES (?, ?, ?, ?)'
    ).run(email.trim().toLowerCase(), passwordHash, salt, tier || 'community');
    return db.prepare('SELECT * FROM users WHERE email = ?').get(email.trim().toLowerCase());
}

function getUserByEmail(email) {
    const db = getDb();
    return db.prepare('SELECT * FROM users WHERE email = ?').get(email.trim().toLowerCase());
}

function updateUserTier(email, tier) {
    const db = getDb();
    db.prepare(
        "UPDATE users SET tier = ?, updated_at = datetime('now') WHERE email = ?"
    ).run(tier, email.trim().toLowerCase());
}

module.exports = {
    getDb,
    addSubscription,
    getSubscriptions,
    queueEmail,
    getPendingEmails,
    markEmailSent,
    updateEmailStatus,
    getEmailByProviderMessageId,
    getEmailsForRetry,
    incrementEmailAttempts,
    getOrCreateCustomer,
    updateCustomerStripeId,
    updateCustomerSubscription,
    getCustomerByApiKey,
    getAllCustomers,
    getAllPaidSubscriptions,
    getAllUsers,
    addRefundRecord,
    getRefundsForCustomer,
    getAllRefunds,
    updatePaidSubscriptionToRefunded,
    addPaidSubscription,
    updatePaidSubscriptionStatus,
    createUser,
    getUserByEmail,
    updateUserTier
};
