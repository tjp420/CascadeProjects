// simplebeacon-ignore test-coverage
/**
 * Token DB Helpers — In-memory adapter for token registry tables.
 * Replace with real PostgreSQL / SQLite adapter in production.
 *
 * @license MIT
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DB_PATH = path.join(__dirname, '../db/token-registry.json');

function loadDb() {
    if (!fs.existsSync(DB_PATH)) {
        return {
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
        };
    }
    return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
}

let _writeQueue = Promise.resolve();

function saveDb(db) {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    const tmpPath = DB_PATH + '.tmp';
    fs.writeFileSync(tmpPath, JSON.stringify(db, null, 2));
    fs.renameSync(tmpPath, DB_PATH);
}

function withDbQueued(mutator) {
    const task = _writeQueue.then(() => {
        const db = loadDb();
        const result = mutator(db);
        saveDb(db);
        return result;
    }).catch(() => {
        const db = loadDb();
        const result = mutator(db);
        saveDb(db);
        return result;
    });
    _writeQueue = task;
    return task;
}

// ─── Accounts ─────────────────────────────────────────────────────────────
function getAccount(id) {
    const db = loadDb();
    return db.accounts.find((a) => a.id === id) || null;
}

function insertAccount(account) {
    return withDbQueued((db) => {
        db.accounts.push(account);
        return account;
    });
}

function updateAccount(id, updates) {
    return withDbQueued((db) => {
        const idx = db.accounts.findIndex((a) => a.id === id);
        if (idx === -1) return null;
        db.accounts[idx] = { ...db.accounts[idx], ...updates, updated_at: new Date().toISOString() };
        return db.accounts[idx];
    });
}

// ─── Access Tokens ────────────────────────────────────────────────────────
function getAccessToken(jti) {
    const db = loadDb();
    return db.access_tokens.find((t) => t.jti === jti) || null;
}

function insertAccessToken(token) {
    return withDbQueued((db) => {
        db.access_tokens.push(token);
        return token;
    });
}

function revokeAccessToken(jti, reason) {
    return withDbQueued((db) => {
        const idx = db.access_tokens.findIndex((t) => t.jti === jti);
        if (idx === -1) return null;
        db.access_tokens[idx].revoked_at = new Date().toISOString();
        db.access_tokens[idx].revoked_reason = reason;
        return db.access_tokens[idx];
    });
}

// ─── Session Tokens ─────────────────────────────────────────────────────
function getSessionToken(id) {
    const db = loadDb();
    return db.session_tokens.find((t) => t.id === id) || null;
}

function insertSessionToken(token) {
    return withDbQueued((db) => {
        db.session_tokens.push(token);
        return token;
    });
}

function revokeSessionToken(id, reason) {
    return withDbQueued((db) => {
        const idx = db.session_tokens.findIndex((t) => t.id === id);
        if (idx === -1) return null;
        db.session_tokens[idx].revoked_at = new Date().toISOString();
        db.session_tokens[idx].revoked_reason = reason;
        return db.session_tokens[idx];
    });
}

function getSessionTokenByHash(tokenHash) {
    const db = loadDb();
    return db.session_tokens.find((t) => t.token_hash === tokenHash) || null;
}

function findSessionTokensByAccount(accountId) {
    const db = loadDb();
    return db.session_tokens.filter((t) => t.account_id === accountId);
}

function findSessionTokensByTenant(tenantId) {
    const db = loadDb();
    return db.session_tokens.filter((t) => t.tenant_id === tenantId);
}

function expireSessionToken(id) {
    return withDbQueued((db) => {
        const idx = db.session_tokens.findIndex((t) => t.id === id);
        if (idx === -1) return null;
        db.session_tokens[idx].expires_at = new Date().toISOString();
        return db.session_tokens[idx];
    });
}

function rotateSessionToken(id, newTokenHash, newExpiresAt) {
    return withDbQueued((db) => {
        const idx = db.session_tokens.findIndex((t) => t.id === id);
        if (idx === -1) return null;
        db.session_tokens[idx].token_hash = newTokenHash;
        db.session_tokens[idx].token_sequence = (db.session_tokens[idx].token_sequence || 0) + 1;
        db.session_tokens[idx].expires_at = newExpiresAt;
        db.session_tokens[idx].rotated_at = new Date().toISOString();
        db.session_tokens[idx].revoked_at = undefined;
        db.session_tokens[idx].revoked_reason = undefined;
        return db.session_tokens[idx];
    });
}

/**
 * Synchronize a session token from a cluster gossip frame using monotonic
 * (epoch, tokenSequence) ordering. This is the core primitive for
 * distributed session-token replication.
 *
 * Conflict rules:
 *   - If token does not exist locally: insert.
 *   - If token exists and inbound (epoch, tokenSequence) is lexicographically
 *     higher: overwrite, but preserve revoked_at if the inbound frame is itself
 *     a revocation (i.e. a previously revoked record cannot be re-issued unless
 *     the inbound issue has a higher sequence and does not carry revoked_at).
 *   - If token exists and local sequence is >= inbound: ignore (out-of-order).
 */
function syncSessionToken(token) {
    return withDbQueued((db) => {
        if (!token || !token.token_hash) {
            throw new Error('token-db.syncSessionToken: token_hash is required');
        }

        const existing = db.session_tokens.find((t) => t.token_hash === token.token_hash);
        if (!existing) {
            db.session_tokens.push({
                id: token.id || crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
                ...token,
                token_sequence: token.token_sequence || 0,
                created_at: token.created_at || new Date().toISOString(),
            });
            return { accepted: true, action: 'insert' };
        }

        const localSeq = existing.token_sequence || 0;
        const localEpoch = existing.epoch || 0;
        const inboundSeq = token.token_sequence || 0;
        const inboundEpoch = token.epoch || 0;

        const newer = inboundEpoch > localEpoch ||
            (inboundEpoch === localEpoch && inboundSeq > localSeq);

        if (!newer) {
            return { accepted: false, action: 'ignored', reason: 'stale_sequence' };
        }

        // A revocation frame can mark the token revoked; an issue frame with a
        // higher sequence can overwrite an earlier revocation (re-issue).
        const wasRevoked = !!existing.revoked_at;
        const isRevocation = !!token.revoked_at;

        if (wasRevoked && !isRevocation) {
            // Higher-sequence issue revives the token (e.g. refresh).
            existing.revoked_at = undefined;
            existing.revoked_reason = undefined;
        }

        Object.assign(existing, token, {
            id: existing.id,
            token_hash: token.token_hash,
            token_sequence: inboundSeq,
            epoch: inboundEpoch,
            updated_at: new Date().toISOString(),
        });

        return { accepted: true, action: isRevocation ? 'revoke' : 'update' };
    });
}

// ─── Refresh Tokens ─────────────────────────────────────────────────────
function getRefreshTokenByHash(tokenHash) {
    const db = loadDb();
    return db.refresh_tokens.find((t) => t.token_hash === tokenHash) || null;
}

function insertRefreshToken(token) {
    return withDbQueued((db) => {
        db.refresh_tokens.push(token);
        return token;
    });
}

function updateRefreshToken(id, updates) {
    return withDbQueued((db) => {
        const idx = db.refresh_tokens.findIndex((t) => t.id === id);
        if (idx === -1) return null;
        db.refresh_tokens[idx] = { ...db.refresh_tokens[idx], ...updates };
        return db.refresh_tokens[idx];
    });
}

function revokeRefreshTokenBySession(sessionTokenId, reason) {
    return withDbQueued((db) => {
        const idx = db.refresh_tokens.findIndex((t) => t.session_token_id === sessionTokenId && !t.revoked_at);
        if (idx === -1) return null;
        db.refresh_tokens[idx].revoked_at = new Date().toISOString();
        db.refresh_tokens[idx].revoked_reason = reason;
        return db.refresh_tokens[idx];
    });
}

// ─── Device Keys ────────────────────────────────────────────────────────
function getDeviceKey(id) {
    const db = loadDb();
    return db.device_keys.find((d) => d.id === id) || null;
}

function getDeviceKeys(accountId) {
    const db = loadDb();
    return db.device_keys.filter((d) => d.account_id === accountId);
}

function insertDeviceKey(deviceKey) {
    return withDbQueued((db) => {
        db.device_keys.push(deviceKey);
        return deviceKey;
    });
}

function updateDeviceKey(id, updates) {
    return withDbQueued((db) => {
        const idx = db.device_keys.findIndex((d) => d.id === id);
        if (idx === -1) return null;
        db.device_keys[idx] = { ...db.device_keys[idx], ...updates };
        return db.device_keys[idx];
    });
}

// ─── Recovery Factors ───────────────────────────────────────────────────
function getRecoveryFactors(accountId) {
    const db = loadDb();
    return db.recovery_factors.filter((f) => f.account_id === accountId);
}

function insertRecoveryFactor(factor) {
    return withDbQueued((db) => {
        db.recovery_factors.push(factor);
        return factor;
    });
}

// ─── Audit Log ────────────────────────────────────────────────────────────
function insertAuditLog(entry) {
    return withDbQueued((db) => {
        db.audit_log.push(entry);
        return entry;
    });
}

// ─── License Tokens (SimpleBeacon product tokens) ────────────────────────
function getLicenseToken(token) {
    const db = loadDb();
    return db.license_tokens.find((t) => t.token === token) || null;
}

function getLicenseTokensByEmail(email) {
    const normalized = String(email || '').trim().toLowerCase();
    if (!normalized) return [];
    const db = loadDb();
    return db.license_tokens.filter((t) => String(t.email || '').trim().toLowerCase() === normalized);
}

function getAllLicenseTokens() {
    const db = loadDb();
    return db.license_tokens || [];
}

function insertLicenseToken(entry) {
    return withDbQueued((db) => {
        db.license_tokens.push(entry);
        return entry;
    });
}

function updateLicenseToken(token, updates) {
    return withDbQueued((db) => {
        const idx = db.license_tokens.findIndex((t) => t.token === token);
        if (idx === -1) return null;
        db.license_tokens[idx] = { ...db.license_tokens[idx], ...updates, updated_at: new Date().toISOString() };
        return db.license_tokens[idx];
    });
}

module.exports = {
    // Accounts
    getAccount,
    insertAccount,
    updateAccount,
    // Access Tokens
    getAccessToken,
    insertAccessToken,
    revokeAccessToken,
    // Session Tokens
    getSessionToken,
    getSessionTokenByHash,
    findSessionTokensByAccount,
    findSessionTokensByTenant,
    insertSessionToken,
    expireSessionToken,
    rotateSessionToken,
    revokeSessionToken,
    syncSessionToken,
    // Refresh Tokens
    getRefreshTokenByHash,
    insertRefreshToken,
    updateRefreshToken,
    revokeRefreshTokenBySession,
    // Device Keys
    getDeviceKey,
    getDeviceKeys,
    insertDeviceKey,
    updateDeviceKey,
    // Recovery Factors
    getRecoveryFactors,
    insertRecoveryFactor,
    // License Tokens
    getLicenseToken,
    getLicenseTokensByEmail,
    getAllLicenseTokens,
    insertLicenseToken,
    updateLicenseToken,
    // Audit
    insertAuditLog
};
