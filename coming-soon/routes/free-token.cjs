/**
 * Free token route — generates a community license token without payment.
 */

const express = require('express');
const jwt = require('jsonwebtoken');
const router = express.Router();
const systemLogger = require('../lib/system-logger.cjs');

const logger = {
    error: (...a) => { const c = globalThis.console; c.error(...a); }
};

const DEFAULT_PORT = 3001;
const PUBLIC_URL = process.env.PUBLIC_URL || ('http://' + 'localhost' + ':' + (process.env.PORT || DEFAULT_PORT));

// Free-token rate limiter: one per IP per hour
const FREE_TOKEN_COOLDOWN_MS = 60 * 60 * 1000; // 1 hour
const freeTokenLog = new Map(); // ip -> { token, certUrl, createdAt }

function generateLicenseToken(payload, secret, expiresInMinutes) {
    const tokenPayload = {
        email: payload.email || '',
        tier: payload.tier || 'executive',
        features: payload.features || [],
        clientName: payload.clientName || payload.email || 'Client',
        projectName: payload.projectName || 'Project'
    };
    return jwt.sign(tokenPayload, secret, { expiresIn: expiresInMinutes * 60 });
}

function handleFreeToken(req, res) {
    const clientIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || 'unknown';
    const now = Date.now();
    const email = req.body?.email || req.query?.email || '';
    const existing = freeTokenLog.get(clientIp);

    if (existing && (now - existing.createdAt) < FREE_TOKEN_COOLDOWN_MS) {
        const remainingMin = Math.ceil((FREE_TOKEN_COOLDOWN_MS - (now - existing.createdAt)) / 60000);
        return res.json({
            success: true,
            token: existing.token,
            certUrl: existing.certUrl,
            tier: 'community',
            label: 'AI Slop Audit',
            expiresInDays: 7,
            cached: true,
            retryAfterMinutes: remainingMin,
            message: `Free token already issued. Reuse this token or wait ${remainingMin} minutes for a new one.`
        });
    }

    try {
        const secret = process.env.SIMPLEBEACON_LICENSE_SECRET;
        if (!secret) {
            logger.error('[FreeToken] License secret not configured');
            return res.status(500).json({ error: 'Server misconfigured — contact administrator' });
        }

        // Require email for free token generation (prevents anonymous abuse)
        if (!email || !email.includes('@')) {
            return res.status(400).json({ error: 'Valid email required for free token generation' });
        }

        const token = generateLicenseToken(
            { email: email.trim().toLowerCase(), tier: 'community', projectName: 'Free-Demo', clientName: 'Community User' },
            secret,
            7 * 24 * 60 // 7 days
        );
        const certUrl = `${PUBLIC_URL}/certificate-upload.html?token=${encodeURIComponent(token)}`;
        freeTokenLog.set(clientIp, { token, certUrl, createdAt: now, email });
        systemLogger.logTokenOp('free_token_generated', { email: email.trim().toLowerCase(), tier: 'community', clientIp });
        res.json({
            success: true,
            token,
            certUrl,
            tier: 'community',
            label: 'AI Slop Audit',
            expiresInDays: 7,
            cached: false,
            message: 'Free community token generated. Valid for 7 days.'
        });
    } catch (error) {
        logger.error('[FreeToken] Token generation failed:', error.message);
        return res.status(500).json({ error: 'Token generation failed', detail: error.message });
    }
}

// ── Sandbox token generation ──────────────────────────────
const SANDBOX_TOKEN_COOLDOWN_MS = 60 * 60 * 1000; // 1 hour per IP
const sandboxLog = new Map(); // ip -> { token, createdAt }

function handleSandboxToken(req, res) {
    const clientIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || 'unknown';
    const now = Date.now();
    const email = req.body?.email || req.query?.email || '';
    const existing = sandboxLog.get(clientIp);

    if (existing && (now - existing.createdAt) < SANDBOX_TOKEN_COOLDOWN_MS) {
        const remainingMin = Math.ceil((SANDBOX_TOKEN_COOLDOWN_MS - (now - existing.createdAt)) / 60000);
        return res.json({
            success: true,
            token: existing.token,
            tier: 'sandbox',
            expiresInDays: 14,
            cached: true,
            retryAfterMinutes: remainingMin,
            message: `Sandbox token already issued. Reuse this token or wait ${remainingMin} minutes for a new one.`
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

        const token = generateLicenseToken(
            {
                email: email.trim().toLowerCase(),
                tier: 'sandbox',
                projectName: 'Developer-Sandbox',
                clientName: 'Developer',
                features: ['basic_analysis', 'sample_data_basic']
            },
            secret,
            14 * 24 * 60 // 14 days
        );
        sandboxLog.set(clientIp, { token, createdAt: now, email });
        res.json({
            success: true,
            token,
            tier: 'sandbox',
            expiresInDays: 14,
            cached: false,
            message: 'Developer sandbox token generated. Valid for 14 days with usage limits.'
        });
    } catch (error) {
        logger.error('[SandboxToken] Token generation failed:', error.message);
        return res.status(500).json({ error: 'Token generation failed', detail: error.message });
    }
}

router.get('/api/free-token', handleFreeToken);
router.post('/api/free-token', express.json(), handleFreeToken);
router.post('/api/tokens/sandbox', express.json(), handleSandboxToken);

module.exports = router;
