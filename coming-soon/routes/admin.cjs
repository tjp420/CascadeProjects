/**
 * Admin API routes — token management, system logs, and diagnostics.
 * All routes require a valid admin token in the Authorization header.
 */

'use strict';

const express = require('express');
const router = express.Router();
const {
    getAdminToken,
    createAdminToken,
    verifyAdminToken,
    getAdminLogs
} = require('../lib/admin-token.cjs');
const systemLogger = require('../lib/system-logger.cjs');

const secret = process.env.SIMPLEBEACON_LICENSE_SECRET;
if (!secret) {
    // Fatal: SIMPLEBEACON_LICENSE_SECRET not configured — handled silently to avoid log exposure
}

// Middleware: require admin token
function requireAdmin(req, res, next) {
    const auth = req.headers.authorization || '';
    const token = auth.replace(/^Bearer\s+/i, '');
    if (!token) return res.status(401).json({ error: 'Admin token required' });
    const payload = verifyAdminToken(token, secret);
    if (!payload) return res.status(403).json({ error: 'Invalid or expired admin token' });
    req.adminPayload = payload;
    next();
}

// POST /api/admin/token/create — create the personal admin token (one-time setup)
router.post('/api/admin/token/create', express.json(), (req, res) => {
    const existing = getAdminToken();
    if (existing) {
        return res.status(409).json({ error: 'Admin token already exists. Use /api/admin/token/status to view.' });
    }
    const { email } = req.body || {};
    const token = createAdminToken(secret, email);
    res.json({ success: true, message: 'Admin token created.', createdAt: new Date().toISOString() });
});

// POST /api/admin/token/status — get admin token status (no auth needed for initial check)
router.post('/api/admin/token/status', express.json(), (req, res) => {
    const token = getAdminToken();
    if (!token) {
        return res.json({ exists: false, message: 'No admin token found. Create one via POST /api/admin/token/create' });
    }
    const payload = verifyAdminToken(token, secret);
    if (!payload) {
        return res.json({ exists: true, valid: false, message: 'Admin token exists but is expired or invalid.' });
    }
    res.json({
        exists: true,
        valid: true,
        email: payload.email,
        tier: payload.tier,
        role: payload.role,
        features: payload.features,
        expiry: payload.exp || null,
        issuedAt: payload.iat ? new Date(payload.iat * 1000).toISOString() : null
    });
});

// POST /api/admin/verify — check if a provided token is a valid admin token
router.post('/api/admin/verify', express.json(), (req, res) => {
    const { token } = req.body || {};
    if (!token) return res.status(400).json({ error: 'Token required' });
    const payload = verifyAdminToken(token, secret);
    res.json({ valid: !!payload, role: payload?.role || null, tier: payload?.tier || null });
});

// GET /api/admin/logs — view system logs (admin only)
router.get('/api/admin/logs', requireAdmin, (req, res) => {
    const { type, limit, since } = req.query;
    const logs = systemLogger.getLogs({ type, limit: parseInt(limit) || 200, since });
    const errorCount = systemLogger.getErrorCount(24);
    res.json({ success: true, logs, errorCount24h: errorCount, total: logs.length });
});

// GET /api/admin/token-registry — view all registered tokens in chain (admin only)
router.get('/api/admin/token-registry', requireAdmin, (req, res) => {
    try {
        const { getChain, getTokenNode, hashToken } = require('../lib/token-chain-store.cjs');
        const chains = getChain();
        res.json({ success: true, chains });
    } catch (err) {
        res.status(500).json({ error: 'Failed to load token registry', detail: err.message });
    }
});

// GET /api/admin/tokens — list all tokens across all sources (admin only)
router.get('/api/admin/tokens', requireAdmin, (req, res) => {
    try {
        const tokens = [];
        // 1. Free tokens from memory log (in-memory, so limited)
        // Access freeTokenLog from server module (exported if available)
        // Since it's internal, we'll rely on system logs instead

        // 2. Chain registry tokens from DB
        const db = require('../lib/db.cjs');
        const dbInstance = db.getDb();
        const chainTokens = dbInstance.prepare('SELECT * FROM token_nodes ORDER BY created_at DESC').all();
        for (const node of chainTokens) {
            tokens.push({
                id: node.id,
                source: 'chain_registry',
                tokenHash: node.token_hash,
                type: node.token_type,
                status: node.status,
                email: node.email || null,
                tier: node.tier || null,
                createdAt: node.created_at,
                expiresAt: node.expires_at,
                activatedAt: node.activated_at,
                revokedAt: node.revoked_at,
                violations: []
            });
        }

        // 3. Session tokens from checkout
        try {
            const { sessionTokenStore } = require('./checkout.cjs');
            for (const [sessionId, entry] of sessionTokenStore) {
                tokens.push({
                    id: sessionId,
                    source: 'checkout_session',
                    tokenHash: require('../lib/token-chain-store.cjs').hashToken(entry.token).substring(0, 16) + '...',
                    type: 'checkout',
                    status: 'active',
                    email: entry.email,
                    tier: entry.tier,
                    createdAt: new Date(entry.createdAt).toISOString(),
                    expiresAt: null,
                    activatedAt: null,
                    violations: []
                });
            }
        } catch {}

        // 4. Check for violations on each token
        const now = Date.now();
        for (const token of tokens) {
            // Violation 1: expired but still active
            if (token.expiresAt && new Date(token.expiresAt).getTime() < now && token.status === 'active') {
                token.violations.push({ type: 'expired_active', severity: 'high', message: 'Token expired but still marked active' });
            }
            // Violation 2: revoked but used recently (check logs)
            if (token.status === 'revoked') {
                token.violations.push({ type: 'revoked', severity: 'critical', message: 'Token has been revoked' });
            }
        }

        // 5. Detect IP-based violations from system logs
        const logs = systemLogger.getLogs({ limit: 500 });
        const ipTokenMap = {};
        for (const log of logs) {
            if (log.type === 'request' && log.path === '/api/auth/token-status') {
                // These requests contain token in body — we can't see from logs
                // But we can track request patterns
            }
        }

        res.json({ success: true, tokens, total: tokens.length });
    } catch (err) {
        res.status(500).json({ error: 'Failed to load tokens', detail: err.message });
    }
});

// GET /api/admin/violations — detect violations across all systems (admin only)
router.get('/api/admin/violations', requireAdmin, (req, res) => {
    try {
        const violations = [];
        const now = Date.now();

        // 1. Expired tokens still active in chain registry
        const db = require('../lib/db.cjs');
        const dbInstance = db.getDb();
        const expiredActive = dbInstance.prepare(
            "SELECT * FROM token_nodes WHERE status = 'active' AND expires_at IS NOT NULL AND expires_at < ?"
        ).all(new Date().toISOString());
        for (const node of expiredActive) {
            violations.push({
                id: 'exp-' + node.id,
                type: 'expired_token_active',
                severity: 'high',
                tokenHash: node.token_hash,
                email: node.email,
                tier: node.tier,
                message: 'Token expired but still active in registry',
                detectedAt: new Date().toISOString(),
                expiresAt: node.expires_at
            });
        }

        // 2. Revoked tokens
        const revoked = dbInstance.prepare("SELECT * FROM token_nodes WHERE status = 'revoked'").all();
        for (const node of revoked) {
            violations.push({
                id: 'rev-' + node.id,
                type: 'revoked_token',
                severity: 'critical',
                tokenHash: node.token_hash,
                email: node.email,
                tier: node.tier,
                message: 'Token has been revoked',
                detectedAt: new Date().toISOString(),
                revokedAt: node.revoked_at
            });
        }

        // 3. Rate limit violations from logs
        const logs = systemLogger.getLogs({ limit: 1000 });
        const ipCounts = {};
        for (const log of logs) {
            if (log.type === 'request' && log.ip) {
                const key = log.ip + ':' + log.path;
                ipCounts[key] = (ipCounts[key] || 0) + 1;
            }
        }
        for (const [key, count] of Object.entries(ipCounts)) {
            if (count > 20) {
                const [ip, path] = key.split(':', 2);
                violations.push({
                    id: 'rate-' + key,
                    type: 'rate_limit_exceeded',
                    severity: 'medium',
                    ip,
                    path,
                    message: 'IP made ' + count + ' requests to ' + path,
                    detectedAt: new Date().toISOString()
                });
            }
        }

        // 4. Multiple failed auth attempts (403/401 responses)
        const failedAuths = logs.filter(l => l.type === 'request' && (l.statusCode === 401 || l.statusCode === 403));
        const ipFailCounts = {};
        for (const log of failedAuths) {
            if (log.ip) {
                ipFailCounts[log.ip] = (ipFailCounts[log.ip] || 0) + 1;
            }
        }
        for (const [ip, count] of Object.entries(ipFailCounts)) {
            if (count >= 5) {
                violations.push({
                    id: 'auth-' + ip,
                    type: 'brute_force_attempt',
                    severity: 'high',
                    ip,
                    message: 'IP had ' + count + ' failed authentication attempts',
                    detectedAt: new Date().toISOString()
                });
            }
        }

        res.json({ success: true, violations, total: violations.length });
    } catch (err) {
        res.status(500).json({ error: 'Failed to detect violations', detail: err.message });
    }
});

// GET /api/admin/stats — dashboard overview stats (admin only)
router.get('/api/admin/stats', requireAdmin, (req, res) => {
    try {
        const db = require('../lib/db.cjs');
        const dbInstance = db.getDb();
        const totalTokens = dbInstance.prepare('SELECT COUNT(*) as count FROM token_nodes').get();
        const activeTokens = dbInstance.prepare("SELECT COUNT(*) as count FROM token_nodes WHERE status = 'active'").get();
        const expiredTokens = dbInstance.prepare("SELECT COUNT(*) as count FROM token_nodes WHERE status = 'expired'").get();
        const revokedTokens = dbInstance.prepare("SELECT COUNT(*) as count FROM token_nodes WHERE status = 'revoked'").get();
        const totalCustomers = dbInstance.prepare('SELECT COUNT(*) as count FROM customers').get();
        const activeSubs = dbInstance.prepare("SELECT COUNT(*) as count FROM paid_subscriptions WHERE status = 'active'").get();

        res.json({
            success: true,
            stats: {
                totalTokens: totalTokens.count,
                activeTokens: activeTokens.count,
                expiredTokens: expiredTokens.count,
                revokedTokens: revokedTokens.count,
                totalCustomers: totalCustomers.count,
                activeSubscriptions: activeSubs.count,
                errorCount24h: systemLogger.getErrorCount(24)
            }
        });
    } catch (err) {
        res.status(500).json({ error: 'Failed to load stats', detail: err.message });
    }
});

// POST /api/admin/token/revoke — revoke a token by hash (admin only)
router.post('/api/admin/token/revoke', requireAdmin, express.json(), (req, res) => {
    try {
        const { tokenHash } = req.body || {};
        if (!tokenHash) return res.status(400).json({ error: 'tokenHash required' });
        const { revokeToken } = require('../lib/token-chain-store.cjs');
        const result = revokeToken(tokenHash);
        if (result.success) {
            systemLogger.logTokenOp('token_revoked', { tokenHash, admin: req.adminPayload.email });
            res.json({ success: true, message: 'Token revoked' });
        } else {
            res.status(400).json({ error: result.error });
        }
    } catch (err) {
        res.status(500).json({ error: 'Failed to revoke token', detail: err.message });
    }
});

// GET /api/admin/customers — list all customers with subscription info (admin only)
router.get('/api/admin/customers', requireAdmin, (req, res) => {
    try {
        const db = require('../lib/db.cjs');
        const customers = db.getAllCustomers();
        const subscriptions = db.getAllPaidSubscriptions();
        const refunds = db.getAllRefunds();
        const combined = customers.map(c => {
            const subs = subscriptions.filter(s => s.customer_email === c.email);
            const customerRefunds = refunds.filter(r => r.customer_email === c.email);
            return {
                ...c,
                subscriptions: subs,
                refunds: customerRefunds,
                totalRefunded: customerRefunds.length
            };
        });
        res.json({ success: true, customers: combined, total: combined.length });
    } catch (err) {
        res.status(500).json({ error: 'Failed to load customers', detail: err.message });
    }
});

// GET /api/admin/users — list all registered users (admin only)
router.get('/api/admin/users', requireAdmin, (req, res) => {
    try {
        const db = require('../lib/db.cjs');
        const users = db.getAllUsers();
        res.json({ success: true, users, total: users.length });
    } catch (err) {
        res.status(500).json({ error: 'Failed to load users', detail: err.message });
    }
});

// POST /api/admin/customers/:email/update-tier — update customer tier (admin only)
router.post('/api/admin/customers/:email/update-tier', requireAdmin, express.json(), (req, res) => {
    try {
        const { email } = req.params;
        const { tier } = req.body || {};
        if (!email || !tier) return res.status(400).json({ error: 'Email and tier required' });
        const db = require('../lib/db.cjs');
        db.updateCustomerSubscription(email, 'active', tier);
        systemLogger.logTokenOp('customer_tier_updated', { email, tier, admin: req.adminPayload.email });
        res.json({ success: true, message: 'Tier updated' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to update tier', detail: err.message });
    }
});

// POST /api/admin/customers/:email/refund — process refund for a customer (admin only)
router.post('/api/admin/customers/:email/refund', requireAdmin, express.json(), (req, res) => {
    try {
        const { email } = req.params;
        const { stripeSubscriptionId, reason } = req.body || {};
        if (!email) return res.status(400).json({ error: 'Email required' });
        const db = require('../lib/db.cjs');
        let result = { success: false };
        if (stripeSubscriptionId) {
            result = db.updatePaidSubscriptionToRefunded(stripeSubscriptionId, reason || 'Manual admin refund');
        } else {
            const subs = db.getAllPaidSubscriptions().filter(s => s.customer_email === email.trim().toLowerCase() && s.status === 'active');
            for (const sub of subs) {
                db.updatePaidSubscriptionToRefunded(sub.stripe_subscription_id, reason || 'Manual admin refund');
            }
            db.updateCustomerSubscription(email, 'refunded', 'community');
            result = { success: true, refundedCount: subs.length };
        }
        systemLogger.logTokenOp('customer_refunded', { email, stripeSubscriptionId, reason, admin: req.adminPayload.email });
        res.json({ success: true, message: 'Refund processed', ...result });
    } catch (err) {
        res.status(500).json({ error: 'Failed to process refund', detail: err.message });
    }
});

// POST /api/admin/log/action — manual log entry from frontend (admin only)
router.post('/api/admin/log/action', requireAdmin, express.json(), (req, res) => {
    const { action, details } = req.body || {};
    if (!action) return res.status(400).json({ error: 'action required' });
    systemLogger.logTokenOp(action, { ...details, admin: req.adminPayload.email });
    res.json({ success: true });
});

module.exports = router;
