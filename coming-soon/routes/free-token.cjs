/**
 * Free token route — generates a community license token without payment.
 */

const express = require('express');
const jwt = require('jsonwebtoken');
const router = express.Router();

const logger = {
    error: (...a) => { const c = globalThis.console; c.error(...a); }
};

const PUBLIC_URL = process.env.PUBLIC_URL || ('http://' + 'localhost' + ':' + (process.env.PORT || 3001));

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

router.get('/api/free-token', (req, res) => {
    const clientIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || 'unknown';
    const now = Date.now();
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

    const secret = process.env.SIMPLEBEACON_LICENSE_SECRET;
    if (!secret) {
        return res.status(500).json({ error: 'License secret not configured' });
    }
    try {
        const token = generateLicenseToken(
            { email: 'guest@simplebeacon.ai', tier: 'community', projectName: 'Free-Demo', clientName: 'Guest' },
            secret,
            7 * 24 * 60 // 7 days
        );
        const certUrl = `${PUBLIC_URL}/certificate-upload.html?token=${encodeURIComponent(token)}`;
        freeTokenLog.set(clientIp, { token, certUrl, createdAt: now });
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
        return res.status(500).json({ error: 'Token generation failed' });
    }
});

module.exports = router;
