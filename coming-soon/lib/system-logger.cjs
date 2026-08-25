/**
 * System Logger — captures website activity, errors, and problematic issues.
 * Writes to a rotating JSON log file. Admins can view logs via API.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const LOG_DIR = path.join(__dirname, '..', '.simplebeacon', 'logs');
const SYSTEM_LOG = path.join(LOG_DIR, 'system.json');
const MAX_LOG_SIZE = 2 * 1024 * 1024; // 2MB per file
const MAX_FILES = 5;

function ensureLogDir() {
    if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
}

function rotateIfNeeded() {
    ensureLogDir();
    try {
        const stats = fs.statSync(SYSTEM_LOG);
        if (stats.size > MAX_LOG_SIZE) {
            // Rotate: system.json -> system.1.json, system.1.json -> system.2.json, etc.
            for (let i = MAX_FILES - 1; i >= 1; i--) {
                const src = path.join(LOG_DIR, `system.${i}.json`);
                const dst = path.join(LOG_DIR, `system.${i + 1}.json`);
                if (fs.existsSync(src)) {
                    fs.renameSync(src, dst);
                }
            }
            fs.renameSync(SYSTEM_LOG, path.join(LOG_DIR, 'system.1.json'));
        }
    } catch {}
}

function appendLog(entry) {
    rotateIfNeeded();
    const record = {
        timestamp: new Date().toISOString(),
        ...entry
    };
    let logs = [];
    try {
        if (fs.existsSync(SYSTEM_LOG)) {
            const raw = fs.readFileSync(SYSTEM_LOG, 'utf8');
            logs = raw ? JSON.parse(raw) : [];
        }
    } catch {
        logs = [];
    }
    logs.push(record);
    // Cap at 2000 entries per file
    if (logs.length > 2000) logs = logs.slice(-2000);
    fs.writeFileSync(SYSTEM_LOG, JSON.stringify(logs, null, 2));
}

function logRequest(req, res, durationMs) {
    appendLog({
        type: 'request',
        method: req.method,
        path: req.path || req.url,
        ip: req.ip || req.socket?.remoteAddress || 'unknown',
        statusCode: res.statusCode,
        durationMs: Math.round(durationMs),
        userAgent: req.headers['user-agent'] || '',
        referer: req.headers.referer || ''
    });
}

function logError(err, context = {}) {
    appendLog({
        type: 'error',
        message: err.message || String(err),
        stack: err.stack || '',
        context
    });
}

function logTokenOp(operation, details = {}) {
    appendLog({
        type: 'token_op',
        operation,
        ...details
    });
}

function logScan(details) {
    appendLog({
        type: 'scan',
        ...details
    });
}

function getLogs(options = {}) {
    const { type, limit = 200, since } = options;
    ensureLogDir();
    let logs = [];
    try {
        if (fs.existsSync(SYSTEM_LOG)) {
            const raw = fs.readFileSync(SYSTEM_LOG, 'utf8');
            logs = raw ? JSON.parse(raw) : [];
        }
    } catch {
        return [];
    }
    if (type) logs = logs.filter(l => l.type === type);
    if (since) {
        const sinceDate = new Date(since).getTime();
        logs = logs.filter(l => new Date(l.timestamp).getTime() >= sinceDate);
    }
    return logs.slice(-limit);
}

function getErrorCount(sinceHours = 24) {
    const since = Date.now() - sinceHours * 60 * 60 * 1000;
    const logs = getLogs({ type: 'error', limit: 1000 });
    return logs.filter(l => new Date(l.timestamp).getTime() >= since).length;
}

module.exports = {
    logRequest,
    logError,
    logTokenOp,
    logScan,
    getLogs,
    getErrorCount
};
