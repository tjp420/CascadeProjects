// simplebeacon-ignore git-sensitive-file — auth/token implementation file, not a leaked secret
/**
 * Anonymous guest tokens — issued on first visit, claimed on account signup.
 * The same JWT string becomes the user's personal license token after claim.
 */
'use strict';

const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { getDb } = require('./db.cjs');
const {
    hashToken,
    createTokenChain,
    activateToken,
    getTokenNode
} = require('./token-chain-store.cjs');

const GUEST_TTL_MINUTES = 14 * 24 * 60; // 14 days
const GUEST_EMAIL_DOMAIN = '@guest.simplebeacon.ai';
const GUEST_AGENT_SCANS_PER_DAY = 20;

function isGuestPlaceholderEmail(email) {
    return String(email || '').trim().toLowerCase().endsWith(GUEST_EMAIL_DOMAIN);
}

(function initGuestTokensTable() {
    try {
        const db = getDb();
        db.exec(`
            CREATE TABLE IF NOT EXISTS guest_tokens (
                guest_id TEXT PRIMARY KEY,
                token TEXT NOT NULL,
                token_hash TEXT NOT NULL UNIQUE,
                user_id INTEGER REFERENCES users(id),
                user_email TEXT,
                claimed_at TEXT,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                expires_at TEXT NOT NULL,
                revoked INTEGER NOT NULL DEFAULT 0,
                agent_scan_count INTEGER NOT NULL DEFAULT 0,
                agent_scan_day TEXT
            );
            CREATE INDEX IF NOT EXISTS idx_guest_tokens_hash ON guest_tokens(token_hash);
            CREATE INDEX IF NOT EXISTS idx_guest_tokens_user ON guest_tokens(user_email);
        `);
        try {
            db.exec('ALTER TABLE guest_tokens ADD COLUMN agent_scan_count INTEGER NOT NULL DEFAULT 0');
        } catch (_) { /* column exists */ }
        try {
            db.exec('ALTER TABLE guest_tokens ADD COLUMN agent_scan_day TEXT');
        } catch (_) { /* column exists */ }
    } catch (err) {
        const c = globalThis.console;
        c.error('[GuestToken] Failed to init guest_tokens table:', err.message);
    }
})();

function verifyLicenseToken(token, secret) {
    if (!token || typeof token !== 'string') return null;
    try {
        return jwt.verify(token, secret, { clockTolerance: 60 });
    } catch {
        return null;
    }
}

function guestPlaceholderEmail(guestId) {
    const safe = String(guestId || 'anon')
        .replace(/[^a-zA-Z0-9_-]/g, '')
        .slice(0, 48) || 'anon';
    return `guest+${safe}${GUEST_EMAIL_DOMAIN}`;
}

function generateGuestJwt(guestId, secret) {
    const email = guestPlaceholderEmail(guestId);
    const payload = {
        email,
        guestId: String(guestId),
        tier: 'guest',
        features: ['gate'],
        upgradeable: true,
        clientName: 'Guest',
        projectName: 'Browser-Sandbox',
        jti: crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex')
    };
    return jwt.sign(payload, secret, { expiresIn: GUEST_TTL_MINUTES * 60 });
}

function getGuestTokenByGuestId(guestId) {
    const db = getDb();
    return db.prepare('SELECT * FROM guest_tokens WHERE guest_id = ? AND revoked = 0').get(String(guestId));
}

function getGuestTokenByHash(tokenHash) {
    const db = getDb();
    return db.prepare('SELECT * FROM guest_tokens WHERE token_hash = ? AND revoked = 0').get(tokenHash);
}

function utcDayKey() {
    return new Date().toISOString().slice(0, 10);
}

/**
 * Rate-limit guest agent snippet scans (20/day per device).
 * @returns {{ allowed: boolean, remaining: number, reason?: string }}
 */
function checkGuestAgentScanLimit(guestId) {
    const guest = getGuestTokenByGuestId(guestId);
    if (!guest) {
        return { allowed: false, remaining: 0, reason: 'Guest token not found' };
    }
    const day = utcDayKey();
    const count = guest.agent_scan_count || 0;
    const scanDay = guest.agent_scan_day || '';
    if (scanDay !== day) {
        return { allowed: true, remaining: GUEST_AGENT_SCANS_PER_DAY - 1 };
    }
    if (count >= GUEST_AGENT_SCANS_PER_DAY) {
        return {
            allowed: false,
            remaining: 0,
            reason: `Free tier allows ${GUEST_AGENT_SCANS_PER_DAY} agent snippet scans per day. Upgrade for unlimited scans.`
        };
    }
    return { allowed: true, remaining: GUEST_AGENT_SCANS_PER_DAY - count - 1 };
}

/**
 * Record one guest agent snippet scan against daily quota.
 */
function recordGuestAgentScan(guestId) {
    const guest = getGuestTokenByGuestId(guestId);
    if (!guest) return { success: false, error: 'Guest token not found' };
    const check = checkGuestAgentScanLimit(guestId);
    if (!check.allowed) return { success: false, ...check };
    const day = utcDayKey();
    const db = getDb();
    if ((guest.agent_scan_day || '') !== day) {
        db.prepare('UPDATE guest_tokens SET agent_scan_count = 1, agent_scan_day = ? WHERE guest_id = ?')
            .run(day, String(guestId));
    } else {
        db.prepare('UPDATE guest_tokens SET agent_scan_count = agent_scan_count + 1 WHERE guest_id = ?')
            .run(String(guestId));
    }
    return { success: true, remaining: check.remaining };
}

function saveGuestTokenRecord(guestId, token, tokenHash, expiresAt) {
    const db = getDb();
    db.prepare(`
        INSERT OR REPLACE INTO guest_tokens (guest_id, token, token_hash, user_id, user_email, claimed_at, created_at, expires_at, revoked)
        VALUES (?, ?, ?, NULL, NULL, NULL, datetime('now'), ?, 0)
    `).run(String(guestId), token, tokenHash, expiresAt);
}

function ensureCustomer(email, tier) {
    const db = getDb();
    const normalized = email.trim().toLowerCase();
    let customer = db.prepare('SELECT * FROM customers WHERE email = ?').get(normalized);
    if (customer) return customer;
    db.prepare(
        'INSERT INTO customers (email, tier, subscription_status) VALUES (?, ?, ?)'
    ).run(normalized, tier || 'community', 'inactive');
    return db.prepare('SELECT * FROM customers WHERE email = ?').get(normalized);
}

/**
 * Issue or return an existing guest token for a browser/device id.
 */
function issueGuestToken(guestId, secret) {
    if (!guestId || typeof guestId !== 'string' || guestId.length < 8) {
        return { success: false, error: 'Valid guestId required (min 8 chars)' };
    }
    if (!secret) {
        return { success: false, error: 'Server misconfigured' };
    }

    const now = Date.now();
    const existing = getGuestTokenByGuestId(guestId);
    if (existing && new Date(existing.expires_at) > new Date()) {
        const payload = verifyLicenseToken(existing.token, secret);
        if (payload) {
            return {
                success: true,
                token: existing.token,
                cached: true,
                claimed: !!existing.user_email,
                userEmail: existing.user_email || null,
                tier: payload.tier || 'guest',
                expiresAt: existing.expires_at
            };
        }
    }

    const token = generateGuestJwt(guestId, secret);
    const tokenHash = hashToken(token);
    const expiresAt = new Date(now + GUEST_TTL_MINUTES * 60 * 1000).toISOString();
    const placeholderEmail = guestPlaceholderEmail(guestId);

    saveGuestTokenRecord(guestId, token, tokenHash, expiresAt);

    try {
        createTokenChain(
            placeholderEmail,
            { email: placeholderEmail, tier: 'guest', features: ['gate'], upgradeable: true },
            token,
            GUEST_TTL_MINUTES
        );
        activateToken(tokenHash, GUEST_TTL_MINUTES);
    } catch (chainErr) {
        const c = globalThis.console;
        c.error('[GuestToken] Chain registration failed:', chainErr.message);
    }

    return {
        success: true,
        token,
        cached: false,
        claimed: false,
        userEmail: null,
        tier: 'guest',
        expiresAt
    };
}

/**
 * Link a guest token to a registered user — same JWT, updated registry email.
 */
function claimGuestTokenForUser(token, userEmail, userId) {
    const secret = process.env.SIMPLEBEACON_LICENSE_SECRET;
    if (!secret) return { success: false, error: 'Server misconfigured' };
    if (!token || typeof token !== 'string') return { success: false, error: 'Token required' };
    if (!userEmail || !userEmail.includes('@')) return { success: false, error: 'Valid email required' };
    if (!userId) return { success: false, error: 'User id required' };

    const payload = verifyLicenseToken(token, secret);
    if (!payload) return { success: false, error: 'Invalid or expired token' };

    const tokenHash = hashToken(token);
    const guest = getGuestTokenByHash(tokenHash);
    if (!guest) {
        return { success: false, error: 'Not a guest token issued by SimpleBeacon' };
    }

    const normalizedEmail = userEmail.trim().toLowerCase();

    if (guest.user_id) {
        if (guest.user_email === normalizedEmail) {
            return { success: true, alreadyClaimed: true, token, email: normalizedEmail };
        }
        return { success: false, error: 'This token is already linked to another account' };
    }

    const db = getDb();
    db.prepare(`
        UPDATE guest_tokens
        SET user_id = ?, user_email = ?, claimed_at = datetime('now')
        WHERE token_hash = ?
    `).run(Number(userId), normalizedEmail, tokenHash);

    db.prepare('UPDATE token_nodes SET email = ?, tier = ? WHERE token_hash = ?').run(
        normalizedEmail,
        'community',
        tokenHash
    );

    ensureCustomer(normalizedEmail, 'community');

    return {
        success: true,
        token,
        email: normalizedEmail,
        tier: 'community',
        message: 'Guest token linked to your account'
    };
}

/**
 * Resolve the account email for token-status (guest placeholder → claimed email).
 */
function resolveTokenAccountEmail(token, payload) {
    const tokenHash = hashToken(token);
    const guest = getGuestTokenByHash(tokenHash);
    if (guest && guest.user_email) {
        return guest.user_email.trim().toLowerCase();
    }
    const node = getTokenNode(tokenHash);
    if (node && node.email && !isGuestPlaceholderEmail(node.email)) {
        return node.email.trim().toLowerCase();
    }
    const jwtEmail = (payload && payload.email) ? String(payload.email).trim().toLowerCase() : '';
    if (jwtEmail && !isGuestPlaceholderEmail(jwtEmail)) {
        return jwtEmail;
    }
    return jwtEmail || null;
}

function isGuestTokenRegistered(token) {
    const guest = getGuestTokenByHash(hashToken(token));
    return !!(guest && guest.user_email);
}

/**
 * Upgrade a guest token to a paid license after subscription is active.
 * Keeps lineage via previousToken + attachTokenToChain.
 */
function upgradeGuestToken(guestToken, customerEmail, paidTier, secret, ttlMinutes) {
    const { attachTokenToChain, revokeToken, createTokenChain, activateToken } = require('./token-chain-store.cjs');
    const jwt = require('jsonwebtoken');

    if (!guestToken || !customerEmail || !secret) {
        return { success: false, error: 'Missing required upgrade parameters' };
    }

    const payload = verifyLicenseToken(guestToken, secret);
    if (!payload) {
        return { success: false, error: 'Invalid or expired guest token' };
    }

    const guestHash = hashToken(guestToken);
    const guest = getGuestTokenByHash(guestHash);
    const isEdgeGuest = (payload.tier === 'guest' || payload.guestId) && !guest;
    if (guest && guest.revoked) {
        return { success: false, error: 'Guest token is not valid or has been revoked' };
    }
    if (!guest && !isEdgeGuest) {
        return { success: false, error: 'Guest token is not valid or has been revoked' };
    }

    const normalizedEmail = customerEmail.trim().toLowerCase();
    const paidToken = jwt.sign({
        email: normalizedEmail,
        tier: paidTier,
        projectName: 'Upgraded',
        clientName: normalizedEmail,
        features: [],
        previousToken: guestToken,
        upgradedFrom: 'guest',
        guestId: payload.guestId || guest.guest_id || undefined,
        jti: crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex')
    }, secret, { expiresIn: (ttlMinutes || 30 * 24 * 60) * 60 });

    const paidHash = hashToken(paidToken);
    const attachResult = attachTokenToChain(guestHash, paidToken, { email: normalizedEmail, tier: paidTier }, ttlMinutes || 30 * 24 * 60);
    if (!attachResult.success) {
        createTokenChain(normalizedEmail, { email: normalizedEmail, tier: paidTier, previousToken: guestToken }, paidToken, ttlMinutes || 30 * 24 * 60);
        activateToken(paidHash, ttlMinutes || 30 * 24 * 60);
    } else if (guest) {
        revokeToken(guestHash);
    }

    if (guest) {
        const db = getDb();
        db.prepare('UPDATE guest_tokens SET revoked = 1 WHERE token_hash = ?').run(guestHash);
    }

    ensureCustomer(normalizedEmail, paidTier);

    return {
        success: true,
        token: paidToken,
        tier: paidTier,
        previousToken: guestToken,
        message: 'Guest token upgraded to paid license'
    };
}

module.exports = {
    GUEST_TTL_MINUTES,
    GUEST_EMAIL_DOMAIN,
    GUEST_AGENT_SCANS_PER_DAY,
    isGuestPlaceholderEmail,
    verifyLicenseToken,
    issueGuestToken,
    claimGuestTokenForUser,
    resolveTokenAccountEmail,
    isGuestTokenRegistered,
    getGuestTokenByHash,
    getGuestTokenByGuestId,
    upgradeGuestToken,
    checkGuestAgentScanLimit,
    recordGuestAgentScan
};
