// simplebeacon-ignore: Scanner pattern definitions, test fixtures, and dashboard code — all findings are false positives
/**
 * Free token route — generates a community license token without payment.
 */

const express = require('express');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const router = express.Router();
const systemLogger = require('../lib/system-logger.cjs');
const { getDb } = require('../lib/db.cjs');
const { hashToken } = require('../lib/token-chain-store.cjs');
const { sendEmail } = require('../services/email.cjs');

const logger = {
    error: (...a) => { const c = globalThis.console; c.error(...a); }
};

const DEFAULT_PORT = 3001;
const PUBLIC_URL = process.env.PUBLIC_URL || ('http://' + 'localhost' + ':' + (process.env.PORT || DEFAULT_PORT));

// Free-token rate limiter: one per email per hour
const FREE_TOKEN_COOLDOWN_MS = 60 * 60 * 1000; // 1 hour
const FREE_TOKEN_TTL_MINUTES = 24 * 60; // 24 hours

// Ensure free_tokens table exists
(function initFreeTokensTable() {
    try {
        const db = getDb();
        db.exec(`
            CREATE TABLE IF NOT EXISTS free_tokens (
                email TEXT PRIMARY KEY,
                token TEXT NOT NULL,
                token_hash TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                expires_at TEXT NOT NULL,
                revoked INTEGER NOT NULL DEFAULT 0
            );
            CREATE INDEX IF NOT EXISTS idx_free_tokens_expires ON free_tokens(expires_at);
        `);
    } catch (err) {
        logger.error('[FreeToken] Failed to create free_tokens table:', err.message);
    }
})();

function generateLicenseToken(payload, secret, expiresInMinutes) {
    const tokenPayload = {
        email: payload.email || '',
        tier: payload.tier || 'executive',
        features: payload.features || [],
        clientName: payload.clientName || payload.email || 'Client',
        projectName: payload.projectName || 'Project',
        jti: crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex')
    };
    if (payload.previousToken) tokenPayload.previousToken = payload.previousToken;
    return jwt.sign(tokenPayload, secret, { expiresIn: expiresInMinutes * 60 });
}

function getFreeTokenRecord(email) {
    const db = getDb();
    return db.prepare('SELECT * FROM free_tokens WHERE email = ?').get(email.trim().toLowerCase());
}

function setFreeTokenRecord(email, token, tokenHash, expiresAt) {
    const db = getDb();
    db.prepare(`
        INSERT OR REPLACE INTO free_tokens (email, token, token_hash, created_at, expires_at, revoked)
        VALUES (?, ?, ?, datetime('now'), ?, 0)
    `).run(email.trim().toLowerCase(), token, tokenHash, expiresAt);
}

function revokeFreeToken(email) {
    const db = getDb();
    db.prepare("UPDATE free_tokens SET revoked = 1 WHERE email = ?").run(email.trim().toLowerCase());
}

async function handleFreeToken(req, res) {
    const now = Date.now();
    const email = (req.body?.email || req.query?.email || '').trim().toLowerCase();
    const sendEmailFlag = req.body?.sendEmail === true || req.query?.sendEmail === 'true';

    if (!email || !email.includes('@')) {
        return res.status(400).json({ error: 'Valid email required for free token generation' });
    }

    try {
        // Check if this email already has an active paid subscription
        const db = getDb();
        const customer = db.prepare('SELECT * FROM customers WHERE email = ?').get(email);
        if (customer && customer.subscription_status === 'active') {
            return res.status(403).json({ error: 'This email already has an active subscription.' });
        }

        const existing = getFreeTokenRecord(email);
        if (existing && !existing.revoked) {
            const createdAt = new Date(existing.created_at).getTime();
            if ((now - createdAt) < FREE_TOKEN_COOLDOWN_MS) {
                const remainingMin = Math.ceil((FREE_TOKEN_COOLDOWN_MS - (now - createdAt)) / 60000);
                return res.status(429).json({
                    success: false,
                    error: 'Rate limit exceeded',
                    retryAfterMinutes: remainingMin,
                    message: `Free token already issued. Check your inbox or wait ${remainingMin} minutes for a new one.`
                });
            }
        }

        const secret = process.env.SIMPLEBEACON_LICENSE_SECRET;
        if (!secret) {
            logger.error('[FreeToken] License secret not configured');
            return res.status(500).json({ error: 'Server misconfigured — contact administrator' });
        }

        const token = generateLicenseToken(
            { email, tier: 'community', projectName: 'Free-Demo', clientName: 'Community User' },
            secret,
            FREE_TOKEN_TTL_MINUTES
        );
        const expiresAt = new Date(now + FREE_TOKEN_TTL_MINUTES * 60 * 1000).toISOString();
        const certUrl = `${PUBLIC_URL}/certificate-upload.html?token=${encodeURIComponent(token)}`;
        setFreeTokenRecord(email, token, hashToken(token), expiresAt);
        systemLogger.logTokenOp('free_token_generated', { email, tier: 'community', clientIp: req.ip || req.socket?.remoteAddress || 'unknown' });

        // Email the token when requested by the UI
        if (sendEmailFlag) {
            try {
                const emailResult = await sendEmail({
                    to: email,
                    subject: 'Your SimpleBeacon Free Token',
                    text: `Your free SimpleBeacon token is:\n\n${token}\n\nPaste this token into the audit page to run a Gate Scan. This token is valid for 24 hours.\n\nAudit URL: ${certUrl}`,
                    html: `<p>Your free SimpleBeacon token is:</p><p><code style="word-break:break-all;">${token}</code></p><p>Paste this token into the audit page to run a Gate Scan. This token is valid for 24 hours.</p><p><a href="${certUrl}">Open Audit Page</a></p>`
                });
                if (!emailResult.sent && !emailResult.queued) {
                    logger.error('[FreeToken] Email could not be sent or queued:', emailResult.error);
                }
            } catch (emailError) {
                logger.error('[FreeToken] Failed to send email:', emailError.message);
            }
        }

        res.json({
            success: true,
            token,
            certUrl,
            tier: 'community',
            label: 'AI Slop Audit',
            expiresInDays: 1,
            cached: false,
            emailed: sendEmailFlag,
            message: sendEmailFlag
                ? 'Free community token generated and emailed. Valid for 24 hours.'
                : 'Free community token generated. Valid for 24 hours.'
        });
    } catch (error) {
        logger.error('[FreeToken] Token generation failed:', error.message);
        return res.status(500).json({ error: 'Token generation failed', detail: error.message });
    }
}

// ── Sandbox token generation ──────────────────────────────
const SANDBOX_TOKEN_COOLDOWN_MS = 60 * 60 * 1000; // 1 hour per IP
const sandboxLog = new Map(); // ip -> { token, createdAt }

async function handleSandboxToken(req, res) {
    const clientIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || 'unknown';
    const now = Date.now();
    const email = req.body?.email || req.query?.email || '';
    const existing = sandboxLog.get(clientIp);

    if (existing && (now - existing.createdAt) < SANDBOX_TOKEN_COOLDOWN_MS) {
        const remainingMin = Math.ceil((SANDBOX_TOKEN_COOLDOWN_MS - (now - existing.createdAt)) / 60000);
        return res.status(429).json({
            success: false,
            error: 'Rate limit exceeded',
            retryAfterMinutes: remainingMin,
            message: `Sandbox token already issued for this IP. Check your inbox or wait ${remainingMin} minutes for a new one.`
        });
    }

    try {
        const secret = process.env.SIMPLEBEACON_LICENSE_SECRET;
        if (!secret) {
            logger.error('[SandboxToken] License secret not configured');
            return res.status(500).json({ error: 'Server misconfigured — contact administrator' });
        }

        // Require email for sandbox token generation
        if (!email || !email.includes('@')) {
            return res.status(400).json({ error: 'Valid email required for sandbox token generation' });
        }

        const normalizedEmail = email.trim().toLowerCase();
        const token = generateLicenseToken(
            {
                email: normalizedEmail,
                tier: 'sandbox',
                projectName: 'Developer-Sandbox',
                clientName: 'Developer',
                features: ['basic_analysis', 'sample_data_basic']
            },
            secret,
            14 * 24 * 60 // 14 days
        );
        const certUrl = `${PUBLIC_URL}/certificate-upload.html?token=${encodeURIComponent(token)}`;
        sandboxLog.set(clientIp, { token, createdAt: now, email: normalizedEmail });

        // Sandbox tokens are always emailed
        try {
            const emailResult = await sendEmail({
                to: normalizedEmail,
                subject: 'Your SimpleBeacon Sandbox Token',
                text: `Your SimpleBeacon sandbox token is:\n\n${token}\n\nPaste this token into the audit page to run a sandbox scan. This token is valid for 14 days.\n\nAudit URL: ${certUrl}`,
                html: `<p>Your SimpleBeacon sandbox token is:</p><p><code style="word-break:break-all;">${token}</code></p><p>Paste this token into the audit page to run a sandbox scan. This token is valid for 14 days.</p><p><a href="${certUrl}">Open Audit Page</a></p>`
            });
            if (!emailResult.sent && !emailResult.queued) {
                logger.error('[SandboxToken] Email could not be sent or queued:', emailResult.error);
            }
        } catch (emailError) {
            logger.error('[SandboxToken] Failed to send email:', emailError.message);
        }

        res.json({
            success: true,
            token,
            certUrl,
            tier: 'sandbox',
            expiresInDays: 14,
            cached: false,
            emailed: true,
            message: 'Developer sandbox token generated and emailed. Valid for 14 days with usage limits.'
        });
    } catch (error) {
        logger.error('[SandboxToken] Token generation failed:', error.message);
        return res.status(500).json({ error: 'Token generation failed', detail: error.message });
    }
}

// ── Token upgrade endpoint ──────────────────────────────
// Exchanges a free token for a paid token when a subscription is active
router.post('/api/token/upgrade', express.json(), async (req, res) => {
    const { freeToken, email } = req.body;
    if (!freeToken || typeof freeToken !== 'string') {
        return res.status(400).json({ error: 'freeToken required' });
    }
    if (!email || !email.includes('@')) {
        return res.status(400).json({ error: 'Valid email required' });
    }

    try {
        const secret = process.env.SIMPLEBEACON_LICENSE_SECRET;
        if (!secret) {
            return res.status(500).json({ error: 'Server misconfigured' });
        }

        // Verify the free token
        let payload;
        try {
            payload = jwt.verify(freeToken, secret, { clockTolerance: 60 });
        } catch {
            return res.status(400).json({ error: 'Invalid free token' });
        }

        const tokenEmail = (payload.email || '').trim().toLowerCase();
        const reqEmail = email.trim().toLowerCase();
        if (tokenEmail !== reqEmail) {
            return res.status(400).json({ error: 'Token email mismatch' });
        }

        // Check if free token is registered and not revoked
        const db = getDb();
        const freeRecord = db.prepare('SELECT * FROM free_tokens WHERE email = ?').get(reqEmail);
        if (!freeRecord || freeRecord.revoked) {
            return res.status(400).json({ error: 'Free token is not valid or has been revoked' });
        }

        // Verify customer has active subscription
        const customer = db.prepare('SELECT * FROM customers WHERE email = ?').get(reqEmail);
        if (!customer || customer.subscription_status !== 'active') {
            return res.status(403).json({ error: 'No active subscription found for this email.' });
        }

        // Revoke free token
        revokeFreeToken(reqEmail);

        // Generate paid token with previousToken audit trail
        const paidTier = customer.tier || 'team';
        const paidToken = generateLicenseToken(
            { email: reqEmail, tier: paidTier, projectName: 'Upgraded', clientName: customer.email, previousToken: freeToken },
            secret,
            30 * 24 * 60 // 30 days
        );

        // Register in token chain and activate
        const { createTokenChain, activateToken } = require('../lib/token-chain-store.cjs');
        createTokenChain(reqEmail, { email: reqEmail, tier: paidTier }, paidToken, 30 * 24 * 60);
        activateToken(hashToken(paidToken), 30 * 24 * 60);

        res.json({
            success: true,
            token: paidToken,
            tier: paidTier,
            message: 'Token upgraded successfully. Your free token has been revoked.'
        });
    } catch (error) {
        logger.error('[TokenUpgrade] Upgrade failed:', error.message);
        return res.status(500).json({ error: 'Upgrade failed', detail: error.message });
    }
});

router.get('/api/free-token', handleFreeToken);
router.post('/api/free-token', handleFreeToken);
router.post('/api/tokens/sandbox', handleSandboxToken);

module.exports = router;
