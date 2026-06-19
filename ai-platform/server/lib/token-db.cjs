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

function saveDb(db) {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

// ─── Accounts ─────────────────────────────────────────────────────────────
function getAccount(id) {
    const db = loadDb();
    return db.accounts.find((a) => a.id === id) || null;
}

function insertAccount(account) {
    const db = loadDb();
    db.accounts.push(account);
    saveDb(db);
    return account;
}

function updateAccount(id, updates) {
    const db = loadDb();
    const idx = db.accounts.findIndex((a) => a.id === id);
    if (idx === -1) return null;
    db.accounts[idx] = { ...db.accounts[idx], ...updates, updated_at: new Date().toISOString() };
    saveDb(db);
    return db.accounts[idx];
}

// ─── Access Tokens ────────────────────────────────────────────────────────
function getAccessToken(jti) {
    const db = loadDb();
    return db.access_tokens.find((t) => t.jti === jti) || null;
}

function insertAccessToken(token) {
    const db = loadDb();
    db.access_tokens.push(token);
    saveDb(db);
    return token;
}

function revokeAccessToken(jti, reason) {
    const db = loadDb();
    const idx = db.access_tokens.findIndex((t) => t.jti === jti);
    if (idx === -1) return null;
    db.access_tokens[idx].revoked_at = new Date().toISOString();
    db.access_tokens[idx].revoked_reason = reason;
    saveDb(db);
    return db.access_tokens[idx];
}

// ─── Session Tokens ─────────────────────────────────────────────────────
function getSessionToken(id) {
    const db = loadDb();
    return db.session_tokens.find((t) => t.id === id) || null;
}

function insertSessionToken(token) {
    const db = loadDb();
    db.session_tokens.push(token);
    saveDb(db);
    return token;
}

function revokeSessionToken(id, reason) {
    const db = loadDb();
    const idx = db.session_tokens.findIndex((t) => t.id === id);
    if (idx === -1) return null;
    db.session_tokens[idx].revoked_at = new Date().toISOString();
    db.session_tokens[idx].revoked_reason = reason;
    saveDb(db);
    return db.session_tokens[idx];
}

// ─── Refresh Tokens ─────────────────────────────────────────────────────
function getRefreshTokenByHash(tokenHash) {
    const db = loadDb();
    return db.refresh_tokens.find((t) => t.token_hash === tokenHash) || null;
}

function insertRefreshToken(token) {
    const db = loadDb();
    db.refresh_tokens.push(token);
    saveDb(db);
    return token;
}

function updateRefreshToken(id, updates) {
    const db = loadDb();
    const idx = db.refresh_tokens.findIndex((t) => t.id === id);
    if (idx === -1) return null;
    db.refresh_tokens[idx] = { ...db.refresh_tokens[idx], ...updates };
    saveDb(db);
    return db.refresh_tokens[idx];
}

function revokeRefreshTokenBySession(sessionTokenId, reason) {
    const db = loadDb();
    const idx = db.refresh_tokens.findIndex((t) => t.session_token_id === sessionTokenId && !t.revoked_at);
    if (idx === -1) return null;
    db.refresh_tokens[idx].revoked_at = new Date().toISOString();
    db.refresh_tokens[idx].revoked_reason = reason;
    saveDb(db);
    return db.refresh_tokens[idx];
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
    const db = loadDb();
    db.device_keys.push(deviceKey);
    saveDb(db);
    return deviceKey;
}

function updateDeviceKey(id, updates) {
    const db = loadDb();
    const idx = db.device_keys.findIndex((d) => d.id === id);
    if (idx === -1) return null;
    db.device_keys[idx] = { ...db.device_keys[idx], ...updates };
    saveDb(db);
    return db.device_keys[idx];
}

// ─── Recovery Factors ───────────────────────────────────────────────────
function getRecoveryFactors(accountId) {
    const db = loadDb();
    return db.recovery_factors.filter((f) => f.account_id === accountId);
}

function insertRecoveryFactor(factor) {
    const db = loadDb();
    db.recovery_factors.push(factor);
    saveDb(db);
    return factor;
}

// ─── Audit Log ────────────────────────────────────────────────────────────
function insertAuditLog(entry) {
    const db = loadDb();
    db.audit_log.push(entry);
    saveDb(db);
    return entry;
}

// ─── License Tokens (SimpleBeacon product tokens) ────────────────────────
function getLicenseToken(token) {
    const db = loadDb();
    return db.license_tokens.find((t) => t.token === token) || null;
}

function insertLicenseToken(entry) {
    const db = loadDb();
    db.license_tokens.push(entry);
    saveDb(db);
    return entry;
}

function updateLicenseToken(token, updates) {
    const db = loadDb();
    const idx = db.license_tokens.findIndex((t) => t.token === token);
    if (idx === -1) return null;
    db.license_tokens[idx] = { ...db.license_tokens[idx], ...updates, updated_at: new Date().toISOString() };
    saveDb(db);
    return db.license_tokens[idx];
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
