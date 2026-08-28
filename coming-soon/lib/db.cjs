// simplebeacon-ignore: Scanner pattern definitions, test fixtures, dashboard code, security — all findings are false positives
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
            CREATE TABLE IF NOT EXISTS email_validation_codes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT NOT NULL,
                code TEXT NOT NULL,
                token_hash TEXT NOT NULL,
                expires_at TEXT NOT NULL,
                used INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
            );
            CREATE INDEX IF NOT EXISTS idx_email_validation_codes_email ON email_validation_codes(email);
            CREATE INDEX IF NOT EXISTS idx_email_validation_codes_token_hash ON email_validation_codes(token_hash);
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT NOT NULL UNIQUE,
                name TEXT,
                password_hash TEXT NOT NULL,
                salt TEXT NOT NULL,
                tier TEXT DEFAULT 'community',
                status TEXT DEFAULT 'active',
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now'))
            );
            CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
            CREATE TABLE IF NOT EXISTS cli_reports (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                report_id TEXT UNIQUE NOT NULL,
                customer_email TEXT NOT NULL,
                scanned_path TEXT,
                title TEXT,
                score INTEGER,
                letter_grade TEXT,
                report_json TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
            );
            CREATE INDEX IF NOT EXISTS idx_cli_reports_email ON cli_reports(customer_email);
            CREATE INDEX IF NOT EXISTS idx_cli_reports_created ON cli_reports(created_at DESC);
            CREATE TABLE IF NOT EXISTS webhook_events (
                id TEXT PRIMARY KEY,
                source TEXT NOT NULL,
                event_type TEXT NOT NULL,
                payload_hash TEXT,
                received_at TEXT NOT NULL DEFAULT (datetime('now'))
            );
            CREATE INDEX IF NOT EXISTS idx_webhook_events_source_received ON webhook_events(source, received_at DESC);
            CREATE TABLE IF NOT EXISTS referrers (
                id TEXT PRIMARY KEY,
                user_email TEXT UNIQUE NOT NULL,
                partner_code TEXT UNIQUE NOT NULL,
                tier TEXT DEFAULT 'developer',
                scans_bonus INTEGER DEFAULT 0,
                cert_credit_cents INTEGER DEFAULT 0,
                created_at TEXT DEFAULT (datetime('now'))
            );
            CREATE TABLE IF NOT EXISTS referral_links (
                id TEXT PRIMARY KEY,
                referrer_id TEXT NOT NULL,
                slug TEXT UNIQUE NOT NULL,
                channel TEXT NOT NULL,
                clicks INTEGER DEFAULT 0,
                created_at TEXT DEFAULT (datetime('now')),
                FOREIGN KEY(referrer_id) REFERENCES referrers(id)
            );
            CREATE TABLE IF NOT EXISTS referral_attributions (
                id TEXT PRIMARY KEY,
                link_id TEXT NOT NULL,
                referee_email TEXT,
                referee_ip_hash TEXT NOT NULL,
                status TEXT DEFAULT 'clicked',
                cookie_expires TEXT NOT NULL,
                created_at TEXT DEFAULT (datetime('now')),
                converted_at TEXT,
                FOREIGN KEY(link_id) REFERENCES referral_links(id)
            );
            CREATE INDEX IF NOT EXISTS idx_ref_links_slug ON referral_links(slug);
            CREATE INDEX IF NOT EXISTS idx_ref_attr_ip ON referral_attributions(referee_ip_hash);
            CREATE TABLE IF NOT EXISTS referral_rewards (
                id TEXT PRIMARY KEY,
                attribution_id TEXT NOT NULL,
                referrer_id TEXT NOT NULL,
                reward_type TEXT NOT NULL DEFAULT 'cert_credit',
                reward_value INTEGER NOT NULL DEFAULT 0,
                status TEXT NOT NULL DEFAULT 'granted',
                granted_at TEXT DEFAULT (datetime('now')),
                FOREIGN KEY(attribution_id) REFERENCES referral_attributions(id),
                FOREIGN KEY(referrer_id) REFERENCES referrers(id)
            );
            CREATE INDEX IF NOT EXISTS idx_ref_rewards_referrer ON referral_rewards(referrer_id);
            CREATE INDEX IF NOT EXISTS idx_ref_rewards_attribution ON referral_rewards(attribution_id);
            CREATE TABLE IF NOT EXISTS early_access_waitlist (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT NOT NULL UNIQUE,
                company TEXT,
                team_size TEXT,
                use_case TEXT,
                status TEXT NOT NULL DEFAULT 'pending',
                invited_at TEXT,
                converted_at TEXT,
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
            );
            CREATE INDEX IF NOT EXISTS idx_early_access_email ON early_access_waitlist(email);
            CREATE INDEX IF NOT EXISTS idx_early_access_status ON early_access_waitlist(status);
        `);
    }
    // Schema migrations for existing databases
    try {
        db.exec(`ALTER TABLE email_queue ADD COLUMN provider TEXT;`);
    } catch (err) {
        /* column may already exist */
    }
    try {
        db.exec(`ALTER TABLE email_queue ADD COLUMN provider_message_id TEXT;`);
    } catch (err) {
        /* column may already exist */
    }
    try {
        db.exec(`ALTER TABLE email_queue ADD COLUMN attempts INTEGER DEFAULT 0;`);
    } catch (err) {
        /* column may already exist */
    }
    try {
        db.exec(`ALTER TABLE email_queue ADD COLUMN last_error TEXT;`);
    } catch (err) {
        /* column may already exist */
    }
    try {
        db.exec(`ALTER TABLE email_queue ADD COLUMN delivered_at TEXT;`);
    } catch (err) {
        /* column may already exist */
    }
    try {
        db.exec(`ALTER TABLE email_queue ADD COLUMN bounced_at TEXT;`);
    } catch (err) {
        /* column may already exist */
    }
    try {
        db.exec(`ALTER TABLE email_queue ADD COLUMN opened_at TEXT;`);
    } catch (err) {
        /* column may already exist */
    }
    try {
        db.exec(`CREATE INDEX IF NOT EXISTS idx_email_queue_status_attempts ON email_queue(status, attempts);`);
    } catch (err) {
        /* index may already exist */
    }
    try {
        db.exec(`ALTER TABLE users ADD COLUMN name TEXT;`);
    } catch (err) {
        /* column may already exist */
    }
    try {
        db.exec(`ALTER TABLE users ADD COLUMN status TEXT DEFAULT 'active';`);
    } catch (err) {
        /* column may already exist */
    }
    try {
        db.exec(`ALTER TABLE users ADD COLUMN username TEXT;`);
    } catch (err) {
        /* column may already exist */
    }
    try {
        db.exec(
            `CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username) WHERE username IS NOT NULL AND username != '';`
        );
    } catch (err) {
        /* index may already exist */
    }
    try {
        db.exec(`UPDATE users SET status = 'active' WHERE status IS NULL OR status = '';`);
    } catch (err) {
        /* ignore */
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
    return db
        .prepare('SELECT * FROM email_queue WHERE status = ? ORDER BY queued_at ASC LIMIT ?')
        .all('pending', limit);
}

function markEmailSent(id, provider, providerMessageId) {
    const db = getDb();
    db.prepare(
        "UPDATE email_queue SET status = 'sent', sent_at = datetime('now'), provider = ?, provider_message_id = ? WHERE id = ?"
    ).run(provider || null, providerMessageId || null, id);
}

function updateEmailStatus(id, status, lastError) {
    const db = getDb();
    db.prepare('UPDATE email_queue SET status = ?, last_error = ? WHERE id = ?').run(status, lastError || null, id);
}

function getEmailByProviderMessageId(providerMessageId) {
    const db = getDb();
    return db.prepare('SELECT * FROM email_queue WHERE provider_message_id = ?').get(providerMessageId);
}

function getEmailsForRetry(limit = 100) {
    const db = getDb();
    return db
        .prepare(
            "SELECT * FROM email_queue WHERE status = 'pending' AND (attempts IS NULL OR attempts < 3) ORDER BY queued_at ASC LIMIT ?"
        )
        .all(limit);
}

function incrementEmailAttempts(id) {
    const db = getDb();
    db.prepare('UPDATE email_queue SET attempts = attempts + 1 WHERE id = ?').run(id);
}

function getOrCreateCustomer(email) {
    const db = getDb();
    const existing = db.prepare('SELECT * FROM customers WHERE email = ?').get(email.trim().toLowerCase());
    if (existing) return existing;
    const crypto = require('crypto');
    const apiKey = 'sb_' + crypto.randomBytes(24).toString('hex');
    db.prepare('INSERT INTO customers (email, api_key) VALUES (?, ?)').run(email.trim().toLowerCase(), apiKey);
    return db.prepare('SELECT * FROM customers WHERE email = ?').get(email.trim().toLowerCase());
}

function updateCustomerStripeId(email, stripeCustomerId) {
    const db = getDb();
    db.prepare("UPDATE customers SET stripe_customer_id = ?, updated_at = datetime('now') WHERE email = ?").run(
        stripeCustomerId,
        email.trim().toLowerCase()
    );
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
    return db
        .prepare('SELECT id, email, name, status, tier, created_at, updated_at FROM users ORDER BY created_at DESC')
        .all();
}

function addRefundRecord(customerEmail, stripeSubscriptionId, amount, reason) {
    const db = getDb();
    db.prepare(
        'INSERT INTO refunds (customer_email, stripe_subscription_id, amount, reason, status) VALUES (?, ?, ?, ?, ?)'
    ).run(
        customerEmail.trim().toLowerCase(),
        stripeSubscriptionId || null,
        amount || null,
        reason || null,
        'completed'
    );
    return { success: true };
}

function getRefundsForCustomer(email) {
    const db = getDb();
    return db
        .prepare('SELECT * FROM refunds WHERE customer_email = ? ORDER BY created_at DESC')
        .all(email.trim().toLowerCase());
}

function getAllRefunds() {
    const db = getDb();
    return db.prepare('SELECT * FROM refunds ORDER BY created_at DESC').all();
}

function updatePaidSubscriptionToRefunded(stripeSubscriptionId, reason) {
    const db = getDb();
    db.prepare("UPDATE paid_subscriptions SET status = 'refunded' WHERE stripe_subscription_id = ?").run(
        stripeSubscriptionId
    );
    const sub = db
        .prepare('SELECT * FROM paid_subscriptions WHERE stripe_subscription_id = ?')
        .get(stripeSubscriptionId);
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
    db.prepare('UPDATE paid_subscriptions SET status = ? WHERE stripe_subscription_id = ?').run(
        status,
        stripeSubscriptionId
    );
}

function createUser(email, passwordHash, salt, tier, options = {}) {
    const db = getDb();
    const normalizedEmail = email.trim().toLowerCase();
    const name = options.name ? String(options.name).trim() : null;
    const username = options.username ? String(options.username).trim().toLowerCase() : null;
    const status = options.status || 'active';
    db.prepare(
        'INSERT INTO users (email, password_hash, salt, tier, name, username, status) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(normalizedEmail, passwordHash, salt, tier || 'community', name, username, status);
    return db.prepare('SELECT * FROM users WHERE email = ?').get(normalizedEmail);
}

function getUserByUsername(username) {
    const db = getDb();
    const normalized = String(username || '')
        .trim()
        .toLowerCase();
    if (!normalized) return null;
    return db.prepare('SELECT * FROM users WHERE lower(username) = ?').get(normalized);
}

function getUserByEmail(email) {
    const db = getDb();
    return db.prepare('SELECT * FROM users WHERE email = ?').get(email.trim().toLowerCase());
}

function updateUserTier(email, tier) {
    const db = getDb();
    db.prepare("UPDATE users SET tier = ?, updated_at = datetime('now') WHERE email = ?").run(
        tier,
        email.trim().toLowerCase()
    );
}

function getUserById(id) {
    const db = getDb();
    const numericId = Number(id);
    if (!Number.isFinite(numericId)) return null;
    return db.prepare('SELECT * FROM users WHERE id = ?').get(numericId);
}

function updateUserTierById(id, tier) {
    const db = getDb();
    db.prepare("UPDATE users SET tier = ?, updated_at = datetime('now') WHERE id = ?").run(tier, Number(id));
}

function deleteUserById(id) {
    const db = getDb();
    db.prepare('DELETE FROM users WHERE id = ?').run(Number(id));
}

function updateUserStatus(id, status) {
    const db = getDb();
    db.prepare("UPDATE users SET status = ?, updated_at = datetime('now') WHERE id = ?").run(status, Number(id));
}

function updateUserDetails(id, { name, email }) {
    const db = getDb();
    const existing = db
        .prepare('SELECT id FROM users WHERE email = ? AND id != ?')
        .get(email.trim().toLowerCase(), Number(id));
    if (existing) return { success: false, error: 'Email already in use by another account' };
    db.prepare("UPDATE users SET name = ?, email = ?, updated_at = datetime('now') WHERE id = ?").run(
        name || null,
        email.trim().toLowerCase(),
        Number(id)
    );
    return { success: true };
}

function saveCliReport({ reportId, email, scannedPath, title, score, letterGrade, reportJson }) {
    const db = getDb();
    db.prepare(
        'INSERT INTO cli_reports (report_id, customer_email, scanned_path, title, score, letter_grade, report_json) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(
        reportId,
        email.trim().toLowerCase(),
        scannedPath || '',
        title || '',
        score ?? null,
        letterGrade || '',
        reportJson
    );
    return { success: true };
}

function getCliReportsByEmail(email, limit = 50) {
    const db = getDb();
    return db
        .prepare(
            'SELECT report_id, customer_email, scanned_path, title, score, letter_grade, created_at FROM cli_reports WHERE customer_email = ? ORDER BY created_at DESC LIMIT ?'
        )
        .all(email.trim().toLowerCase(), limit);
}

function getCliReportById(reportId) {
    const db = getDb();
    return db.prepare('SELECT * FROM cli_reports WHERE report_id = ?').get(reportId);
}

function createValidationCode(email, code, tokenHash, expiresAt) {
    const db = getDb();
    db.prepare(
        `INSERT INTO email_validation_codes (email, code, token_hash, expires_at, used, created_at)
         VALUES (?, ?, ?, ?, 0, datetime('now'))`
    ).run(email.trim().toLowerCase(), code, tokenHash, expiresAt);
    return { success: true };
}

function getValidationCodeByEmailAndCode(email, code) {
    const db = getDb();
    return db
        .prepare('SELECT * FROM email_validation_codes WHERE email = ? AND code = ? ORDER BY created_at DESC LIMIT 1')
        .get(email.trim().toLowerCase(), code);
}

function getValidationCodeByTokenHash(tokenHash) {
    const db = getDb();
    return db
        .prepare('SELECT * FROM email_validation_codes WHERE token_hash = ? ORDER BY created_at DESC LIMIT 1')
        .get(tokenHash);
}

function markValidationCodeUsed(id) {
    const db = getDb();
    db.prepare('UPDATE email_validation_codes SET used = 1 WHERE id = ?').run(id);
}

function recordWebhookEvent(eventId, source, eventType, payloadHash) {
    if (!eventId) return false;
    const db = getDb();
    const result = db
        .prepare(
            `INSERT OR IGNORE INTO webhook_events (id, source, event_type, payload_hash)
         VALUES (?, ?, ?, ?)`
        )
        .run(String(eventId), String(source || 'unknown'), String(eventType || 'unknown'), payloadHash || null);
    return !!(result && result.changes === 1);
}

function generatePartnerCode() {
    const crypto = require('crypto');
    return crypto.randomBytes(6).toString('hex');
}

function getReferrerByEmail(email) {
    const db = getDb();
    return db.prepare('SELECT * FROM referrers WHERE user_email = ?').get(
        String(email || '')
            .trim()
            .toLowerCase()
    );
}

function getReferrerByPartnerCode(partnerCode) {
    const db = getDb();
    return db.prepare('SELECT * FROM referrers WHERE partner_code = ?').get(String(partnerCode || '').trim());
}

function getReferrerById(referrerId) {
    const db = getDb();
    return db.prepare('SELECT * FROM referrers WHERE id = ?').get(String(referrerId || ''));
}

function getOrCreateReferrer(email, tier) {
    const normalized = String(email || '')
        .trim()
        .toLowerCase();
    if (!normalized || !normalized.includes('@')) {
        throw new Error('Valid email required');
    }
    const existing = getReferrerByEmail(normalized);
    if (existing) return existing;

    const crypto = require('crypto');
    const db = getDb();
    let partnerCode = generatePartnerCode();
    for (let attempt = 0; attempt < 5; attempt++) {
        try {
            const id = crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex');
            db.prepare(
                `INSERT INTO referrers (id, user_email, partner_code, tier)
                 VALUES (?, ?, ?, ?)`
            ).run(id, normalized, partnerCode, tier || 'developer');
            return db.prepare('SELECT * FROM referrers WHERE id = ?').get(id);
        } catch (err) {
            if (err.message && err.message.includes('UNIQUE constraint failed')) {
                if (err.message.includes('user_email')) {
                    return getReferrerByEmail(normalized);
                }
                partnerCode = generatePartnerCode();
                continue;
            }
            throw err;
        }
    }
    throw new Error('Failed to create referrer');
}

function getReferralLinkBySlug(slug) {
    const db = getDb();
    return db.prepare('SELECT * FROM referral_links WHERE slug = ?').get(String(slug || '').trim());
}

function getOrCreateReferralLink(referrerId, channel) {
    const db = getDb();
    const referrer = db.prepare('SELECT * FROM referrers WHERE id = ?').get(referrerId);
    if (!referrer) throw new Error('Referrer not found');

    const existing = db
        .prepare(`SELECT * FROM referral_links WHERE referrer_id = ? AND channel = ? ORDER BY created_at ASC LIMIT 1`)
        .get(referrerId, channel || 'web');
    if (existing) return existing;

    const crypto = require('crypto');
    const id = crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex');
    try {
        db.prepare(
            `INSERT INTO referral_links (id, referrer_id, slug, channel)
             VALUES (?, ?, ?, ?)`
        ).run(id, referrerId, referrer.partner_code, channel || 'web');
    } catch (err) {
        // UNIQUE constraint on slug — another channel already created a link
        // with this partner_code as slug. Return the existing link since all
        // channels for the same referrer share the same shareable URL.
        if (err.message && err.message.includes('UNIQUE constraint failed') && err.message.includes('slug')) {
            const existingBySlug = db.prepare('SELECT * FROM referral_links WHERE slug = ?').get(referrer.partner_code);
            if (existingBySlug) return existingBySlug;
        }
        throw err;
    }
    return db.prepare('SELECT * FROM referral_links WHERE id = ?').get(id);
}

function incrementReferralLinkClicks(linkId) {
    const db = getDb();
    db.prepare('UPDATE referral_links SET clicks = clicks + 1 WHERE id = ?').run(linkId);
}

function createReferralAttribution({ linkId, refereeIpHash, refereeEmail, cookieExpires }) {
    const crypto = require('crypto');
    const db = getDb();
    const id = crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex');
    db.prepare(
        `INSERT INTO referral_attributions (id, link_id, referee_email, referee_ip_hash, status, cookie_expires)
         VALUES (?, ?, ?, ?, 'clicked', ?)`
    ).run(id, linkId, refereeEmail ? String(refereeEmail).trim().toLowerCase() : null, refereeIpHash, cookieExpires);
    return db.prepare('SELECT * FROM referral_attributions WHERE id = ?').get(id);
}

function getReferralStatsByEmail(email) {
    const empty = {
        partnerCode: null,
        clicks: 0,
        attributions: 0,
        signups: 0,
        conversions: 0,
        certCreditCents: 0,
        links: [],
        ledger: []
    };
    const referrer = getReferrerByEmail(email);
    if (!referrer) {
        return empty;
    }
    const db = getDb();
    const links = db
        .prepare('SELECT id, slug, channel, clicks FROM referral_links WHERE referrer_id = ?')
        .all(referrer.id);
    const linkIds = links.map(l => l.id);
    if (!linkIds.length) {
        return {
            ...empty,
            partnerCode: referrer.partner_code,
            certCreditCents: Number(referrer.cert_credit_cents) || 0
        };
    }
    const placeholders = linkIds.map(() => '?').join(',');
    const attrRow = db
        .prepare(
            `SELECT
            COUNT(*) AS attributions,
            SUM(CASE WHEN status IN ('signed_up', 'converted') THEN 1 ELSE 0 END) AS signups,
            SUM(CASE WHEN status = 'converted' THEN 1 ELSE 0 END) AS conversions
         FROM referral_attributions WHERE link_id IN (${placeholders})`
        )
        .get(...linkIds);
    const clicks = links.reduce((sum, l) => sum + (Number(l.clicks) || 0), 0);
    const ledgerRows = db
        .prepare(
            `SELECT
            a.id AS attribution_id,
            a.created_at,
            a.status AS attribution_status,
            a.referee_email,
            a.converted_at,
            r.id AS reward_id,
            r.reward_value,
            r.status AS reward_status,
            r.granted_at
         FROM referral_attributions a
         JOIN referral_links l ON a.link_id = l.id
         LEFT JOIN referral_rewards r ON r.attribution_id = a.id
         WHERE l.referrer_id = ?
         ORDER BY COALESCE(r.granted_at, a.created_at) DESC
         LIMIT 50`
        )
        .all(referrer.id);

    const ledger = ledgerRows.map(row => {
        const rewardCents = Number(row.reward_value) || 0;
        let status = 'pending';
        if (row.attribution_status === 'converted' && row.reward_id) {
            status = row.reward_status === 'granted' ? 'converted' : String(row.reward_status || 'converted');
        } else if (row.attribution_status === 'signed_up') {
            status = 'signed_up';
        } else if (row.attribution_status === 'clicked') {
            status = 'clicked';
        }
        const dateSource = row.granted_at || row.converted_at || row.created_at || '';
        const date = dateSource ? String(dateSource).slice(0, 10) : '';
        return {
            id: row.reward_id || row.attribution_id,
            date,
            status,
            reward: rewardCents ? rewardCents / 100 : 0,
            refereeEmail: row.referee_email || null
        };
    });

    return {
        partnerCode: referrer.partner_code,
        clicks,
        attributions: Number(attrRow?.attributions) || 0,
        signups: Number(attrRow?.signups) || 0,
        conversions: Number(attrRow?.conversions) || 0,
        certCreditCents: Number(referrer.cert_credit_cents) || 0,
        links,
        ledger
    };
}

function getReferralAttributionById(attributionId) {
    const db = getDb();
    return db
        .prepare(
            `
        SELECT a.*, l.referrer_id, l.slug
        FROM referral_attributions a
        JOIN referral_links l ON a.link_id = l.id
        WHERE a.id = ?
    `
        )
        .get(String(attributionId || ''));
}

function getLatestOpenReferralAttribution(slug, refereeEmail) {
    const db = getDb();
    const normalizedEmail = refereeEmail ? String(refereeEmail).trim().toLowerCase() : null;
    if (normalizedEmail) {
        const byEmail = db
            .prepare(
                `
            SELECT a.*, l.referrer_id, l.slug
            FROM referral_attributions a
            JOIN referral_links l ON a.link_id = l.id
            WHERE l.slug = ?
              AND a.status IN ('clicked', 'signed_up')
              AND (a.referee_email IS NULL OR a.referee_email = ?)
              AND datetime(a.cookie_expires) >= datetime('now')
            ORDER BY a.created_at DESC
            LIMIT 1
        `
            )
            .get(String(slug || ''), normalizedEmail);
        if (byEmail) return byEmail;
    }
    return db
        .prepare(
            `
        SELECT a.*, l.referrer_id, l.slug
        FROM referral_attributions a
        JOIN referral_links l ON a.link_id = l.id
        WHERE l.slug = ?
          AND a.status IN ('clicked', 'signed_up')
          AND datetime(a.cookie_expires) >= datetime('now')
        ORDER BY a.created_at DESC
        LIMIT 1
    `
        )
        .get(String(slug || ''));
}

function markReferralAttributionSignedUp(attributionId, refereeEmail) {
    const db = getDb();
    const result = db
        .prepare(
            `
        UPDATE referral_attributions
        SET status = 'signed_up', referee_email = COALESCE(?, referee_email)
        WHERE id = ? AND status = 'clicked'
    `
        )
        .run(refereeEmail ? String(refereeEmail).trim().toLowerCase() : null, String(attributionId || ''));
    return !!(result && result.changes === 1);
}

function markReferralAttributionConverted(attributionId, refereeEmail) {
    const db = getDb();
    const result = db
        .prepare(
            `
        UPDATE referral_attributions
        SET status = 'converted',
            converted_at = datetime('now'),
            referee_email = COALESCE(?, referee_email)
        WHERE id = ? AND status IN ('clicked', 'signed_up')
    `
        )
        .run(refereeEmail ? String(refereeEmail).trim().toLowerCase() : null, String(attributionId || ''));
    return !!(result && result.changes === 1);
}

function grantReferralReward({ attributionId, referrerId, rewardType, rewardValue }) {
    const crypto = require('crypto');
    const db = getDb();
    const existing = db
        .prepare('SELECT id FROM referral_rewards WHERE attribution_id = ?')
        .get(String(attributionId || ''));
    if (existing) return existing;

    const id = `rew_${crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex')}`;
    db.prepare(
        `
        INSERT INTO referral_rewards (id, attribution_id, referrer_id, reward_type, reward_value, status, granted_at)
        VALUES (?, ?, ?, ?, ?, 'granted', datetime('now'))
    `
    ).run(
        id,
        String(attributionId || ''),
        String(referrerId || ''),
        rewardType || 'cert_credit',
        Number(rewardValue) || 0
    );

    if (rewardType === 'cert_credit' || !rewardType) {
        db.prepare(
            `
            UPDATE referrers
            SET cert_credit_cents = cert_credit_cents + ?
            WHERE id = ?
        `
        ).run(Number(rewardValue) || 0, String(referrerId || ''));
    }

    return db.prepare('SELECT * FROM referral_rewards WHERE id = ?').get(id);
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
    getUserByUsername,
    getUserById,
    updateUserTier,
    updateUserTierById,
    deleteUserById,
    updateUserStatus,
    updateUserDetails,
    saveCliReport,
    getCliReportsByEmail,
    getCliReportById,
    createValidationCode,
    getValidationCodeByEmailAndCode,
    getValidationCodeByTokenHash,
    markValidationCodeUsed,
    recordWebhookEvent,
    getReferrerByEmail,
    getReferrerByPartnerCode,
    getReferrerById,
    getOrCreateReferrer,
    getReferralLinkBySlug,
    getOrCreateReferralLink,
    incrementReferralLinkClicks,
    createReferralAttribution,
    getReferralStatsByEmail,
    getReferralAttributionById,
    getLatestOpenReferralAttribution,
    markReferralAttributionSignedUp,
    markReferralAttributionConverted,
    grantReferralReward
};
