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
            db = new DatabaseSync(DB_PATH);
            db.exec('PRAGMA journal_mode = WAL');
            db.exec('PRAGMA foreign_keys = ON');
        } catch (err) {
            console.error('[DB] Failed to open database:', err.message);
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
                queued_at TEXT NOT NULL DEFAULT (datetime('now')),
                sent_at TEXT
            );
            CREATE INDEX IF NOT EXISTS idx_subscriptions_email ON subscriptions(email);
            CREATE INDEX IF NOT EXISTS idx_queue_status ON email_queue(status);
        `);
    }
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

function queueEmail({ id, to, subject, text, html }) {
    const db = getDb();
    db.prepare(
        'INSERT INTO email_queue (id, recipient, subject, body_text, body_html) VALUES (?, ?, ?, ?, ?)'
    ).run(id, to, subject, text || '', html || '');
    return { queued: true };
}

function getPendingEmails(limit = 100) {
    const db = getDb();
    return db.prepare(
        'SELECT * FROM email_queue WHERE status = ? ORDER BY queued_at ASC LIMIT ?'
    ).all('pending', limit);
}

function markEmailSent(id) {
    const db = getDb();
    db.prepare(
        "UPDATE email_queue SET status = 'sent', sent_at = datetime('now') WHERE id = ?"
    ).run(id);
}

module.exports = {
    addSubscription,
    getSubscriptions,
    queueEmail,
    getPendingEmails,
    markEmailSent
};
