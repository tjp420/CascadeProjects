// simplebeacon-ignore test-coverage
/**
 * Token DB Helpers — In-memory adapter for token registry tables.
 * Replace with real PostgreSQL / SQLite adapter in production.
 *
 * @license MIT
 */

const fs = require('fs');
const path = require('path');

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
    insertSessionToken,
    revokeSessionToken,
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
    insertLicenseToken,
    updateLicenseToken,
    // Audit
    insertAuditLog
};
