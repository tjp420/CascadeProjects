// simplebeacon-ignore git-sensitive-file — auth/token implementation file, not a leaked secret
/**
 * Admin Token Management — generates and stores the personal admin token.
 * The admin token is stored in a separate file (.simplebeacon/admin-token.json)
 * and never exposed through regular APIs.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');

const ADMIN_TOKEN_FILE = path.join(__dirname, '..', '.simplebeacon', 'admin-token.json');
const ADMIN_LOG_FILE = path.join(__dirname, '..', '.simplebeacon', 'admin-activity.json');

function ensureDir() {
    const dir = path.dirname(ADMIN_TOKEN_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function generateAdminToken(secret, email) {
    const payload = {
        email: email || 'admin@simplebeacon.ai',
        tier: 'admin',
        role: 'superuser',
        features: ['all_modules', 'admin_panel', 'log_viewer', 'token_management', 'system_diagnostics'],
        clientName: 'Administrator',
        projectName: 'System-Admin'
    };
    // Admin token: 1 year expiry
    return jwt.sign(payload, secret, { expiresIn: 365 * 24 * 60 * 60 });
}

function getAdminToken() {
    ensureDir();
    if (!fs.existsSync(ADMIN_TOKEN_FILE)) return null;
    try {
        const data = JSON.parse(fs.readFileSync(ADMIN_TOKEN_FILE, 'utf8'));
        return data.token || null;
    } catch {
        return null;
    }
}

function createAdminToken(secret, email) {
    ensureDir();
    const token = generateAdminToken(secret, email);
    const record = {
        token,
        createdAt: new Date().toISOString(),
        email: email || 'admin@simplebeacon.ai'
    };
    fs.writeFileSync(ADMIN_TOKEN_FILE, JSON.stringify(record, null, 2));
    // Log creation
    logAdminActivity('admin_token_created', { email: record.email });
    return token;
}

function verifyAdminToken(token, secret) {
    if (!token || typeof token !== 'string') return null;
    try {
        const payload = jwt.verify(token, secret, { clockTolerance: 60 });
        return payload.tier === 'admin' ? payload : null;
    } catch {
        return null;
    }
}

function logAdminActivity(action, details = {}) {
    ensureDir();
    const entry = {
        timestamp: new Date().toISOString(),
        action,
        details,
        source: 'admin'
    };
    let logs = [];
    try {
        if (fs.existsSync(ADMIN_LOG_FILE)) {
            logs = JSON.parse(fs.readFileSync(ADMIN_LOG_FILE, 'utf8'));
        }
    } catch {}
    logs.push(entry);
    // Keep last 500 entries
    if (logs.length > 500) logs = logs.slice(-500);
    fs.writeFileSync(ADMIN_LOG_FILE, JSON.stringify(logs, null, 2));
}

function getAdminLogs(limit = 100) {
    try {
        if (!fs.existsSync(ADMIN_LOG_FILE)) return [];
        const logs = JSON.parse(fs.readFileSync(ADMIN_LOG_FILE, 'utf8'));
        return logs.slice(-limit);
    } catch {
        return [];
    }
}

module.exports = {
    getAdminToken,
    createAdminToken,
    verifyAdminToken,
    logAdminActivity,
    getAdminLogs
};
