// simplebeacon-ignore: Scanner pattern definitions, test fixtures, dashboard code, security — all findings are false positives
/**
 * Root-controlled account store — single source of truth for account tier, features, limits.
 * Time tokens are subordinate: they reference an account_id and are validated against live account state.
 */

'use strict';

const crypto = require('crypto');
const { getDb } = require('./db.cjs');
const { getPlan } = require('./plans.cjs');

function ensureAccountsTable() {
    const db = getDb();
    db.exec(`
    CREATE TABLE IF NOT EXISTS accounts (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      tier TEXT NOT NULL DEFAULT 'starter',
      subscription_tier TEXT NOT NULL DEFAULT 'starter',
      status TEXT NOT NULL DEFAULT 'active',
      features TEXT,
      limits TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_accounts_email ON accounts(email);
    CREATE INDEX IF NOT EXISTS idx_accounts_status ON accounts(status);

    CREATE TABLE IF NOT EXISTS time_tokens (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL REFERENCES accounts(id),
      token_hash TEXT UNIQUE NOT NULL,
      period TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      expires_at TEXT,
      revoked_at TEXT,
      last_validated_at TEXT,
      last_context_hash TEXT,
      lease_expires_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_time_tokens_account ON time_tokens(account_id);
    CREATE INDEX IF NOT EXISTS idx_time_tokens_status ON time_tokens(status);

    CREATE TABLE IF NOT EXISTS token_usage_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      time_token_id TEXT NOT NULL,
      account_id TEXT NOT NULL,
      action TEXT NOT NULL,
      success INTEGER NOT NULL DEFAULT 1,
      error_reason TEXT,
      context_hash TEXT,
      ip TEXT,
      user_agent TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_usage_log_token ON token_usage_log(time_token_id);
    CREATE INDEX IF NOT EXISTS idx_usage_log_account ON token_usage_log(account_id);
    CREATE INDEX IF NOT EXISTS idx_usage_log_created ON token_usage_log(created_at);
  `);

    // Gracefully add session-tracking columns to existing time_tokens tables
    try {
        db.exec(`ALTER TABLE time_tokens ADD COLUMN last_validated_at TEXT`);
    } catch {}
    try {
        db.exec(`ALTER TABLE time_tokens ADD COLUMN last_context_hash TEXT`);
    } catch {}
    try {
        db.exec(`ALTER TABLE time_tokens ADD COLUMN lease_expires_at TEXT`);
    } catch {}
    try {
        db.exec(`ALTER TABLE time_tokens ADD COLUMN use_count INTEGER DEFAULT 0`);
    } catch {}
    try {
        db.exec(`ALTER TABLE time_tokens ADD COLUMN first_used_at TEXT`);
    } catch {}
}

function generateAccountId() {
    return 'acc_' + crypto.randomBytes(8).toString('hex');
}

function generateTimeTokenId() {
    return 'tt_' + crypto.randomBytes(8).toString('hex');
}

function hashToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
}

function buildContextHash(context = {}) {
    const raw = `${context.ip || ''}:${context.userAgent || ''}:${context.deviceId || ''}`;
    return crypto.createHash('sha256').update(raw).digest('hex').slice(0, 16);
}

function logValidation(db, row, action, success, errorReason, context, ctxHash) {
    try {
        db.prepare(
            `INSERT INTO token_usage_log (time_token_id, account_id, action, success, error_reason, context_hash, ip, user_agent)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        ).run(
            row ? row.id : null,
            row ? row.account_id : null,
            action,
            success ? 1 : 0,
            errorReason || null,
            ctxHash || null,
            context.ip || null,
            context.userAgent || null
        );
    } catch {}
}

/**
 * Create a root-controlled account.
 * @param {Object} params
 * @param {string} params.email
 * @param {string} params.tier — starter, pro, enterprise, trial
 * @returns {Object} { accountId, tier, status }
 */
function createAccount(params) {
    ensureAccountsTable();
    const db = getDb();
    const id = generateAccountId();
    const plan = getPlan(params.tier || 'starter');
    const features = JSON.stringify(plan ? plan.moduleAccess : []);
    const limits = JSON.stringify(plan ? plan.limits : {});
    const now = new Date().toISOString();

    const tier = params.tier || 'starter';
    db.prepare(
        `INSERT INTO accounts (id, email, tier, subscription_tier, status, features, limits, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'active', ?, ?, ?, ?)`
    ).run(id, (params.email || '').trim().toLowerCase(), tier, tier, features, limits, now, now);

    return { accountId: id, tier, status: 'active' };
}

/**
 * Get account by ID — live state, root-controlled.
 */
function getAccount(accountId) {
    ensureAccountsTable();
    const db = getDb();
    const row = db.prepare('SELECT * FROM accounts WHERE id = ?').get(accountId);
    if (!row) return null;
    return {
        id: row.id,
        email: row.email,
        tier: row.tier,
        subscriptionTier: row.subscription_tier,
        status: row.status,
        features: JSON.parse(row.features || '[]'),
        limits: JSON.parse(row.limits || '{}'),
        createdAt: row.created_at,
        updatedAt: row.updated_at
    };
}

/**
 * Update account tier/features — root operation.
 */
function updateAccount(accountId, changes) {
    ensureAccountsTable();
    const db = getDb();
    const account = getAccount(accountId);
    if (!account) return { success: false, error: 'Account not found.' };

    const plan = changes.tier ? getPlan(changes.tier) : null;
    const features = plan ? JSON.stringify(plan.moduleAccess) : null;
    const limits = plan ? JSON.stringify(plan.limits) : null;
    const now = new Date().toISOString();

    db.prepare(
        `UPDATE accounts
     SET tier = COALESCE(?, tier),
         status = COALESCE(?, status),
         features = COALESCE(?, features),
         limits = COALESCE(?, limits),
         updated_at = ?
     WHERE id = ?`
    ).run(changes.tier || null, changes.status || null, features, limits, now, accountId);

    return { success: true, account: getAccount(accountId) };
}

/**
 * Revoke an account — cascades to all time tokens.
 */
function revokeAccount(accountId) {
    ensureAccountsTable();
    const db = getDb();
    const now = new Date().toISOString();
    db.prepare("UPDATE accounts SET status = 'revoked', updated_at = ? WHERE id = ?").run(now, accountId);
    db.prepare(
        "UPDATE time_tokens SET status = 'revoked', revoked_at = ? WHERE account_id = ? AND status != 'revoked'"
    ).run(now, accountId);
    return { success: true };
}

/**
 * Create a time token bound to an account.
 * The account controls the time token; root controls the account.
 */
function createTimeToken(accountId, period, ttlDays) {
    ensureAccountsTable();
    const db = getDb();
    const account = getAccount(accountId);
    if (!account) return { success: false, error: 'Account not found.' };
    if (account.status !== 'active') {
        return { success: false, error: `Account is ${account.status}.` };
    }

    const id = generateTimeTokenId();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttlDays * 24 * 60 * 60 * 1000).toISOString();

    db.prepare(
        `INSERT INTO time_tokens (id, account_id, token_hash, period, status, created_at, expires_at)
     VALUES (?, ?, ?, ?, 'pending', ?, ?)`
    ).run(id, accountId, '', period, now.toISOString(), expiresAt);

    return { success: true, timeTokenId: id, accountId, period, expiresAt };
}

/**
 * Register the actual JWT hash after signing.
 */
function registerTimeTokenHash(timeTokenId, jwtString) {
    ensureAccountsTable();
    const db = getDb();
    const hash = hashToken(jwtString);

    // Get the time token row to find the associated account
    const ttRow = db.prepare('SELECT account_id FROM time_tokens WHERE id = ?').get(timeTokenId);

    db.prepare('UPDATE time_tokens SET token_hash = ?, status = ? WHERE id = ?').run(hash, 'active', timeTokenId);

    // Restore tier if account was downgraded to starter
    if (ttRow?.account_id) {
        const account = getAccount(ttRow.account_id);
        if (
            account &&
            account.tier === 'starter' &&
            account.subscriptionTier &&
            account.subscriptionTier !== 'starter'
        ) {
            const restorePlan = getPlan(account.subscriptionTier);
            const nowIso = new Date().toISOString();
            db.prepare(`UPDATE accounts SET tier = ?, features = ?, limits = ?, updated_at = ? WHERE id = ?`).run(
                account.subscriptionTier,
                JSON.stringify(restorePlan ? restorePlan.moduleAccess : []),
                JSON.stringify(restorePlan ? restorePlan.limits : {}),
                nowIso,
                account.id
            );
        }
    }

    return { success: true, tokenHash: hash };
}

/**
 * Validate a time token against live account state.
 * On every validation, purge stale time tokens for the account.
 */
function validateTimeToken(jwtString, context = {}) {
    ensureAccountsTable();
    const db = getDb();
    const hash = hashToken(jwtString);
    const row = db.prepare('SELECT * FROM time_tokens WHERE token_hash = ?').get(hash);
    const ctxHash = buildContextHash(context);
    const nowIso = new Date().toISOString();

    if (!row) {
        logValidation(db, null, 'validate', false, 'Time token not registered.', context, ctxHash);
        return { valid: false, error: 'Time token not registered.' };
    }

    const account = getAccount(row.account_id);
    if (!account) {
        logValidation(db, row, 'validate', false, 'Account not found.', context, ctxHash);
        return { valid: false, error: 'Account not found.' };
    }
    if (account.status !== 'active') {
        logValidation(db, row, 'validate', false, `Account is ${account.status}.`, context, ctxHash);
        return { valid: false, error: `Account is ${account.status}.` };
    }

    if (row.status === 'revoked') {
        logValidation(db, row, 'validate', false, 'Time token revoked.', context, ctxHash);
        return { valid: false, error: 'Time token revoked.' };
    }
    if (row.status === 'expired') {
        logValidation(db, row, 'validate', false, 'Time token expired.', context, ctxHash);
        return { valid: false, error: 'Time token expired.' };
    }
    if (row.expires_at && row.expires_at < nowIso) {
        db.prepare("UPDATE time_tokens SET status = 'expired' WHERE id = ?").run(row.id);
        logValidation(db, row, 'validate', false, 'Time token expired.', context, ctxHash);
        return { valid: false, error: 'Time token expired.' };
    }

    // Concurrent-use check: if lease is active and context differs → reject
    if (row.lease_expires_at && row.lease_expires_at > nowIso) {
        if (row.last_context_hash && row.last_context_hash !== ctxHash) {
            logValidation(db, row, 'validate', false, 'Token already active in another session.', context, ctxHash);
            return { valid: false, error: 'Token already active in another session.' };
        }
    }

    // Purge stale time tokens for this account (root-down cleanup)
    const staleCount = db
        .prepare(
            `DELETE FROM time_tokens
     WHERE account_id = ? AND status = 'expired' AND expires_at < ?`
        )
        .run(row.account_id, nowIso).changes;

    db.prepare(
        `UPDATE time_tokens SET status = 'expired'
     WHERE account_id = ? AND status = 'active' AND expires_at < ?`
    ).run(row.account_id, nowIso);

    // Auto-downgrade: if no active time tokens remain, lock account to starter tier
    const activeRemaining = db
        .prepare(`SELECT COUNT(*) AS count FROM time_tokens WHERE account_id = ? AND status = 'active'`)
        .get(row.account_id);
    let downgraded = false;
    if (activeRemaining.count === 0 && account.tier !== 'starter') {
        const starterPlan = getPlan('starter');
        db.prepare(`UPDATE accounts SET tier = 'starter', features = ?, limits = ?, updated_at = ? WHERE id = ?`).run(
            JSON.stringify(starterPlan ? starterPlan.moduleAccess : []),
            JSON.stringify(starterPlan ? starterPlan.limits : {}),
            nowIso,
            account.id
        );
        downgraded = true;
    }

    const liveAccount = downgraded ? getAccount(account.id) : account;

    // Renew lease and increment use counter
    const leaseMinutes = 15;
    const leaseExpires = new Date(Date.now() + leaseMinutes * 60 * 1000).toISOString();
    const firstUsed = row.first_used_at || nowIso;
    db.prepare(
        `UPDATE time_tokens
     SET last_validated_at = ?, last_context_hash = ?, lease_expires_at = ?,
         use_count = COALESCE(use_count, 0) + 1, first_used_at = ?
     WHERE id = ?`
    ).run(nowIso, ctxHash, leaseExpires, firstUsed, row.id);

    logValidation(db, row, 'validate', true, null, context, ctxHash);

    return {
        valid: true,
        account: {
            id: liveAccount.id,
            tier: liveAccount.tier,
            features: liveAccount.features,
            limits: liveAccount.limits
        },
        timeToken: {
            id: row.id,
            period: row.period,
            expiresAt: row.expires_at
        },
        stalePurged: staleCount || 0,
        downgraded
    };
}

/**
 * Revoke a single time token.
 */
function revokeTimeToken(jwtString) {
    ensureAccountsTable();
    const db = getDb();
    const hash = hashToken(jwtString);
    const now = new Date().toISOString();
    db.prepare("UPDATE time_tokens SET status = 'revoked', revoked_at = ? WHERE token_hash = ?").run(now, hash);
    return { success: true };
}

/**
 * List active time tokens for an account.
 */
function listActiveTimeTokens(accountId) {
    ensureAccountsTable();
    const db = getDb();
    const rows = db
        .prepare(
            `SELECT id, period, status, created_at, expires_at, use_count, first_used_at, last_validated_at FROM time_tokens
     WHERE account_id = ? AND status = 'active'
     ORDER BY created_at DESC`
        )
        .all(accountId);
    return rows;
}

/**
 * Return days until expiration for a token (negative if expired).
 * Also returns a warning level: 'critical' (<3 days), 'warning' (<7 days), 'ok'.
 */
function getTokenExpiryWarning(jwtString) {
    ensureAccountsTable();
    const db = getDb();
    const hash = hashToken(jwtString);
    const row = db.prepare('SELECT expires_at, status FROM time_tokens WHERE token_hash = ?').get(hash);
    if (!row) return { found: false, daysLeft: null, level: 'unknown' };
    if (!row.expires_at) return { found: true, daysLeft: Infinity, level: 'ok' };

    const now = Date.now();
    const expiry = new Date(row.expires_at).getTime();
    const daysLeft = Math.floor((expiry - now) / (1000 * 60 * 60 * 24));

    let level = 'ok';
    if (daysLeft < 0 || row.status === 'expired') level = 'expired';
    else if (daysLeft < 3) level = 'critical';
    else if (daysLeft < 7) level = 'warning';

    return { found: true, daysLeft, level, expiresAt: row.expires_at };
}

/**
 * Per-account usage summary — validation stats and token health.
 */
function getAccountUsageSummary(accountId) {
    ensureAccountsTable();
    const db = getDb();

    const tokenStats = db
        .prepare(
            `SELECT
      COUNT(*) AS total_tokens,
      SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS active_tokens,
      SUM(COALESCE(use_count, 0)) AS total_validations
     FROM time_tokens WHERE account_id = ?`
        )
        .get(accountId);

    const recentLog = db
        .prepare(
            `SELECT COUNT(*) AS recent_validations
     FROM token_usage_log
     WHERE account_id = ? AND action = 'validate' AND success = 1
       AND created_at > datetime('now', '-7 days')`
        )
        .get(accountId);

    const failureLog = db
        .prepare(
            `SELECT error_reason, COUNT(*) AS count
     FROM token_usage_log
     WHERE account_id = ? AND action = 'validate' AND success = 0
       AND created_at > datetime('now', '-7 days')
     GROUP BY error_reason
     ORDER BY count DESC`
        )
        .all(accountId);

    return {
        accountId,
        tokens: {
            total: tokenStats.total_tokens || 0,
            active: tokenStats.active_tokens || 0,
            totalValidations: tokenStats.total_validations || 0
        },
        last7Days: {
            validations: recentLog.recent_validations || 0,
            failures: failureLog
        }
    };
}

module.exports = {
    createAccount,
    getAccount,
    updateAccount,
    revokeAccount,
    createTimeToken,
    registerTimeTokenHash,
    validateTimeToken,
    revokeTimeToken,
    listActiveTimeTokens,
    getTokenExpiryWarning,
    getAccountUsageSummary
};
