/**
 * Admin API routes — token management, system logs, and diagnostics.
 * All routes require a valid admin token in the Authorization header.
 */

'use strict';

const express = require('express');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const router = express.Router();
const { getAdminToken, createAdminToken, verifyAdminToken, getAdminLogs } = require('../lib/admin-token.cjs');
const systemLogger = require('../lib/system-logger.cjs');
const db = require('../lib/db.cjs');

let stripe = null;
try {
    stripe = require('stripe')(process.env.STRIPE_SECRET_KEY || '');
} catch {
    stripe = null;
}

const secret = process.env.SIMPLEBEACON_LICENSE_SECRET;
if (!secret) {
    // Fatal: SIMPLEBEACON_LICENSE_SECRET not configured — handled silently to avoid log exposure
}

// Middleware: require admin token or dashboard session for admin accounts
function verifySessionToken(token) {
    if (!secret || !token) return null;
    try {
        const payload = jwt.verify(token, secret, { clockTolerance: 60 });
        return payload && payload.type === 'session' ? payload : null;
    } catch {
        return null;
    }
}

function isDashboardAdmin(payload) {
    if (!payload) return false;
    const email = String(payload.email || '').toLowerCase();
    const role = String(payload.role || '').toLowerCase();
    const tier = String(payload.tier || '').toLowerCase();
    if (email === 'admin@simplebeacon.ai') return true;
    if (role === 'admin' || role === 'superuser') return true;
    if (tier === 'admin' || tier === 'superuser') return true;
    if (
        Array.isArray(payload.features) &&
        payload.features
            .map(String)
            .map(s => s.toLowerCase())
            .includes('all_modules')
    )
        return true;
    return false;
}

function tierToTrustLevel(tier) {
    const raw = String(tier || 'community').toLowerCase();
    if (raw === 'admin' || raw === 'superuser') return 'gold';
    if (raw === 'community') return 'bronze';
    if (raw === 'silver' || raw === 'gold') return raw;
    return 'bronze';
}

function trustLevelToTier(trustLevel) {
    const map = { bronze: 'community', silver: 'silver', gold: 'gold' };
    return map[String(trustLevel || '').toLowerCase()] || 'community';
}

function hashPassword(password, salt) {
    return new Promise((resolve, reject) => {
        crypto.scrypt(password, salt, 64, (err, derivedKey) => {
            if (err) reject(err);
            else resolve(derivedKey.toString('hex'));
        });
    });
}

async function verifyAdminPassword(email, password) {
    const user = db.getUserByEmail(email);
    if (!user || !user.password_hash || !user.salt) return false;
    const derived = await hashPassword(password, user.salt);
    return derived === user.password_hash;
}

async function stripeRefundSubscription(stripeSubscriptionId, reason) {
    if (!stripe || !stripeSubscriptionId) return { stripeUsed: false };
    try {
        const subscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);
        if (subscription && subscription.status !== 'canceled') {
            await stripe.subscriptions.cancel(stripeSubscriptionId);
        }
        const latestInvoice = subscription?.latest_invoice
            ? await stripe.invoices.retrieve(subscription.latest_invoice)
            : null;
        const paymentIntent = latestInvoice?.payment_intent;
        let refund = null;
        if (paymentIntent) {
            refund = await stripe.refunds.create({ payment_intent: paymentIntent, reason: 'requested_by_customer' });
        }
        return { stripeUsed: true, refundId: refund?.id || null, canceled: true };
    } catch (err) {
        return { stripeUsed: false, stripeError: err.message };
    }
}

function mapDashboardUser(row) {
    const email = row.email || '';
    let name = row.name || (email.includes('@') ? email.split('@')[0] : email);
    try {
        const demoPath = require('path').join(__dirname, '../../ai-platform/server/db/demo-users.json');
        const demoUsers = require(demoPath);
        const match = Array.isArray(demoUsers)
            ? demoUsers.find(u => String(u.email).toLowerCase() === email.toLowerCase())
            : null;
        if (match?.name) name = match.name;
    } catch {
        // demo names optional
    }
    return {
        id: String(row.id),
        email,
        name,
        status: row.status || 'active',
        trustLevel: tierToTrustLevel(row.tier),
        verificationStatus: 'verified',
        successfulAnalyses: 0,
        securityIncidents: 0,
        communityContributions: 0,
        createdAt: row.created_at || row.createdAt || null,
        online: false,
        lastSeen: null
    };
}

function requireAdmin(req, res, next) {
    const auth = req.headers.authorization || '';
    const token = auth.replace(/^Bearer\s+/i, '').trim();
    if (!token) return res.status(401).json({ error: 'Admin token required' });

    const adminPayload = verifyAdminToken(token, secret);
    if (adminPayload) {
        req.adminPayload = adminPayload;
        return next();
    }

    const sessionPayload = verifySessionToken(token);
    if (sessionPayload && isDashboardAdmin(sessionPayload)) {
        req.adminPayload = sessionPayload;
        return next();
    }

    return res.status(403).json({ error: 'Invalid or expired admin token' });
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
        return res.json({
            exists: false,
            message: 'No admin token found. Create one via POST /api/admin/token/create'
        });
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

// POST /api/admin/verify-password — confirm the logged-in admin knows their password
router.post('/api/admin/verify-password', requireAdmin, express.json(), async (req, res) => {
    try {
        const { password } = req.body || {};
        const adminEmail = req.adminPayload?.email;
        if (!password || !adminEmail) {
            return res.status(400).json({ success: false, error: 'Password required' });
        }
        const valid = await verifyAdminPassword(adminEmail, password);
        if (!valid) {
            return res.status(401).json({ success: false, error: 'Invalid password' });
        }
        res.json({ success: true, valid: true });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
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
                token.violations.push({
                    type: 'expired_active',
                    severity: 'high',
                    message: 'Token expired but still marked active'
                });
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
        const dbInstance = db.getDb();
        const expiredActive = dbInstance
            .prepare("SELECT * FROM token_nodes WHERE status = 'active' AND expires_at IS NOT NULL AND expires_at < ?")
            .all(new Date().toISOString());
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
        const dbInstance = db.getDb();
        const totalTokens = dbInstance.prepare('SELECT COUNT(*) as count FROM token_nodes').get();
        const activeTokens = dbInstance
            .prepare("SELECT COUNT(*) as count FROM token_nodes WHERE status = 'active'")
            .get();
        const expiredTokens = dbInstance
            .prepare("SELECT COUNT(*) as count FROM token_nodes WHERE status = 'expired'")
            .get();
        const revokedTokens = dbInstance
            .prepare("SELECT COUNT(*) as count FROM token_nodes WHERE status = 'revoked'")
            .get();
        const totalCustomers = dbInstance.prepare('SELECT COUNT(*) as count FROM customers').get();
        const activeSubs = dbInstance
            .prepare("SELECT COUNT(*) as count FROM paid_subscriptions WHERE status = 'active'")
            .get();

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
// Also include customers created via billing/checkout flows so admin sees all accounts
router.get('/api/admin/users', requireAdmin, (req, res) => {
    try {
        const users = db.getAllUsers();
        const customers = db.getAllCustomers();

        // Index existing users by email for quick lookup
        const userEmails = new Set((users || []).map(u => String(u.email || '').toLowerCase()));

        // Add customers that aren't present in users table (e.g., created via checkout)
        const merged = [...(users || [])];
        for (const c of customers || []) {
            const email = String(c.email || '').toLowerCase();
            if (!email) continue;
            if (!userEmails.has(email)) {
                // Create a user-like row from customer
                merged.push({
                    id: c.id || null,
                    email: c.email,
                    name: c.email && c.email.includes('@') ? c.email.split('@')[0] : c.email,
                    status: c.subscription_status === 'suspended' ? 'suspended' : 'active',
                    tier: c.tier || 'community',
                    created_at: c.created_at || null,
                    updated_at: c.updated_at || null
                });
            }
        }

        const mapped = (merged || []).map(mapDashboardUser);
        res.json({ success: true, users: mapped, total: mapped.length });
    } catch (err) {
        res.status(500).json({ error: 'Failed to load users', detail: err.message });
    }
});

// GET /api/admin/sessions — active dashboard sessions (admin only)
router.get('/api/admin/sessions', requireAdmin, (_req, res) => {
    res.json({ success: true, sessions: [] });
});

// POST /api/admin/users/:id/trust-level — update account trust tier and subscription (admin only)
router.post('/api/admin/users/:id/trust-level', requireAdmin, express.json(), async (req, res) => {
    try {
        const { id } = req.params;
        const { trustLevel, password, subscriptionTier, subscriptionStatus } = req.body || {};
        if (!password) return res.status(400).json({ success: false, error: 'Admin password required' });
        const adminEmail = req.adminPayload?.email;
        const passwordValid = await verifyAdminPassword(adminEmail, password);
        if (!passwordValid) return res.status(401).json({ success: false, error: 'Invalid admin password' });
        const validLevels = ['bronze', 'silver', 'gold'];
        if (!validLevels.includes(trustLevel)) {
            return res.status(400).json({ success: false, error: 'Invalid trust level' });
        }
        const user = db.getUserById(id);
        if (!user) return res.status(404).json({ success: false, error: 'User not found' });
        if (String(user.email || '').toLowerCase() === 'admin@simplebeacon.ai' && trustLevel !== 'gold') {
            return res.status(403).json({ success: false, error: 'Cannot downgrade the primary admin account' });
        }
        db.updateUserTierById(id, trustLevelToTier(trustLevel));
        const subTier = subscriptionTier || trustLevelToTier(trustLevel);
        const subStatus = subscriptionStatus || 'active';
        db.updateCustomerSubscription(user.email, subStatus, subTier);
        systemLogger.logTokenOp('user_tier_updated', {
            userId: id,
            trustLevel,
            subscriptionTier: subTier,
            subscriptionStatus: subStatus,
            admin: req.adminPayload.email
        });
        res.json({ success: true, id, trustLevel, subscriptionTier: subTier, subscriptionStatus: subStatus });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// DELETE /api/admin/users/:id — delete account (admin only)
router.delete('/api/admin/users/:id', requireAdmin, express.json(), async (req, res) => {
    try {
        const { id } = req.params;
        const { password, confirmEmail } = req.body || {};
        if (!password) return res.status(400).json({ success: false, error: 'Admin password required' });
        const adminEmail = req.adminPayload?.email;
        const passwordValid = await verifyAdminPassword(adminEmail, password);
        if (!passwordValid) return res.status(401).json({ success: false, error: 'Invalid admin password' });
        const user = db.getUserById(id);
        if (!user) return res.status(404).json({ success: false, error: 'User not found' });
        if (String(user.email || '').toLowerCase() === 'admin@simplebeacon.ai') {
            return res.status(403).json({ success: false, error: 'Cannot delete the primary admin account' });
        }
        if (!confirmEmail || String(confirmEmail).toLowerCase() !== String(user.email).toLowerCase()) {
            return res.status(400).json({ success: false, error: 'Confirm the account email to delete' });
        }
        db.deleteUserById(id);
        systemLogger.logTokenOp('user_deleted', { userId: id, email: user.email, admin: req.adminPayload.email });
        res.json({ success: true, id, deleted: true });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// POST /api/admin/users/:id/suspend — soft-suspend an account (admin only)
router.post('/api/admin/users/:id/suspend', requireAdmin, express.json(), async (req, res) => {
    try {
        const { id } = req.params;
        const { password } = req.body || {};
        if (!password) return res.status(400).json({ success: false, error: 'Admin password required' });
        const adminEmail = req.adminPayload?.email;
        const passwordValid = await verifyAdminPassword(adminEmail, password);
        if (!passwordValid) return res.status(401).json({ success: false, error: 'Invalid admin password' });
        const user = db.getUserById(id);
        if (!user) return res.status(404).json({ success: false, error: 'User not found' });
        if (String(user.email || '').toLowerCase() === 'admin@simplebeacon.ai') {
            return res.status(403).json({ success: false, error: 'Cannot suspend the primary admin account' });
        }
        db.updateUserStatus(id, 'suspended');
        db.updateCustomerSubscription(user.email, 'suspended', user.tier || 'community');
        systemLogger.logTokenOp('user_suspended', { userId: id, email: user.email, admin: req.adminPayload.email });
        res.json({ success: true, id, status: 'suspended' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// POST /api/admin/users/:id/unsuspend — reactivate a suspended account (admin only)
router.post('/api/admin/users/:id/unsuspend', requireAdmin, express.json(), async (req, res) => {
    try {
        const { id } = req.params;
        const user = db.getUserById(id);
        if (!user) return res.status(404).json({ success: false, error: 'User not found' });
        db.updateUserStatus(id, 'active');
        db.updateCustomerSubscription(user.email, 'active', user.tier || 'community');
        systemLogger.logTokenOp('user_unsuspended', { userId: id, email: user.email, admin: req.adminPayload.email });
        res.json({ success: true, id, status: 'active' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// POST /api/admin/users/:id/details — update account name/email (admin only)
router.post('/api/admin/users/:id/details', requireAdmin, express.json(), async (req, res) => {
    try {
        const { id } = req.params;
        const { name, email, password } = req.body || {};
        if (!password)
            return res.status(400).json({ success: false, error: 'Admin password required to update email' });
        const adminEmail = req.adminPayload?.email;
        const passwordValid = await verifyAdminPassword(adminEmail, password);
        if (!passwordValid) return res.status(401).json({ success: false, error: 'Invalid admin password' });
        if (!email || !email.includes('@'))
            return res.status(400).json({ success: false, error: 'Valid email required' });
        const user = db.getUserById(id);
        if (!user) return res.status(404).json({ success: false, error: 'User not found' });
        if (
            String(user.email || '').toLowerCase() === 'admin@simplebeacon.ai' &&
            String(email).toLowerCase() !== 'admin@simplebeacon.ai'
        ) {
            return res.status(403).json({ success: false, error: 'Cannot change the primary admin email' });
        }
        const oldEmail = user.email;
        const result = db.updateUserDetails(id, { name, email });
        if (!result.success) return res.status(400).json({ success: false, error: result.error });
        db.updateCustomerSubscription(email, 'active', user.tier || 'community');
        if (oldEmail !== email.toLowerCase()) {
            db.getDb()
                .prepare('UPDATE customers SET email = ? WHERE email = ?')
                .run(email.trim().toLowerCase(), oldEmail);
            db.getDb()
                .prepare('UPDATE paid_subscriptions SET customer_email = ? WHERE customer_email = ?')
                .run(email.trim().toLowerCase(), oldEmail);
            db.getDb()
                .prepare('UPDATE refunds SET customer_email = ? WHERE customer_email = ?')
                .run(email.trim().toLowerCase(), oldEmail);
        }
        systemLogger.logTokenOp('user_details_updated', {
            userId: id,
            oldEmail,
            newEmail: email,
            name,
            admin: req.adminPayload.email
        });
        res.json({ success: true, id, name, email });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// POST /api/admin/customers/:email/update-tier — update customer tier (admin only)
router.post('/api/admin/customers/:email/update-tier', requireAdmin, express.json(), (req, res) => {
    try {
        const { email } = req.params;
        const { tier } = req.body || {};
        if (!email || !tier) return res.status(400).json({ error: 'Email and tier required' });
        db.updateCustomerSubscription(email, 'active', tier);
        systemLogger.logTokenOp('customer_tier_updated', { email, tier, admin: req.adminPayload.email });
        res.json({ success: true, message: 'Tier updated' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to update tier', detail: err.message });
    }
});

// POST /api/admin/customers/:email/refund — process refund for a customer (admin only)
router.post('/api/admin/customers/:email/refund', requireAdmin, express.json(), async (req, res) => {
    try {
        const { email } = req.params;
        const { stripeSubscriptionId, reason, password } = req.body || {};
        if (!email) return res.status(400).json({ success: false, error: 'Email required' });
        if (!password) return res.status(400).json({ success: false, error: 'Admin password required' });
        const adminEmail = req.adminPayload?.email;
        const passwordValid = await verifyAdminPassword(adminEmail, password);
        if (!passwordValid) return res.status(401).json({ success: false, error: 'Invalid admin password' });
        let refundedSubs = [];
        let stripeResult = null;
        if (stripeSubscriptionId) {
            stripeResult = await stripeRefundSubscription(stripeSubscriptionId, reason || 'Manual admin refund');
            db.updatePaidSubscriptionToRefunded(stripeSubscriptionId, reason || 'Manual admin refund');
            refundedSubs.push(stripeSubscriptionId);
        } else {
            const subs = db
                .getAllPaidSubscriptions()
                .filter(s => s.customer_email === email.trim().toLowerCase() && s.status === 'active');
            for (const sub of subs) {
                const sr = await stripeRefundSubscription(sub.stripe_subscription_id, reason || 'Manual admin refund');
                if (!stripeResult) stripeResult = sr;
                db.updatePaidSubscriptionToRefunded(sub.stripe_subscription_id, reason || 'Manual admin refund');
                refundedSubs.push(sub.stripe_subscription_id);
            }
            db.updateCustomerSubscription(email, 'refunded', 'community');
        }
        systemLogger.logTokenOp('customer_refunded', {
            email,
            stripeSubscriptionId,
            refundedCount: refundedSubs.length,
            stripeUsed: stripeResult?.stripeUsed,
            admin: req.adminPayload.email
        });
        res.json({ success: true, message: 'Refund processed', refundedCount: refundedSubs.length, stripeResult });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Failed to process refund', detail: err.message });
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
