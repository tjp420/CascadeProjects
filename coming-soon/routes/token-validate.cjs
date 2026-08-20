// simplebeacon-ignore git-sensitive-file — auth/token implementation file, not a leaked secret
/**
 * Token validation route — secure endpoint for client-side token verification.
 * Replaces the insecure client-side token generation in unlock.html.
 */

const express = require('express');
const router = express.Router();
const { hashToken, getTokenNode } = require('../lib/token-chain-store.cjs');
const { getValidationCodeByTokenHash, markValidationCodeUsed } = require('../lib/db.cjs');

function verifyLicenseToken(token, secret) {
    if (!token || typeof token !== 'string') return null;
    try {
        const jwt = require('jsonwebtoken');
        return jwt.verify(token, secret, { clockTolerance: 60 });
    } catch {
        return null;
    }
}

const FREE_TIERS = ['community', 'sandbox', 'starter', 'instant', 'free', 'developer'];

router.post('/api/tokens/validate', express.json(), (req, res) => {
    try {
        const { token, password } = req.body;
        if (!token || typeof token !== 'string') {
            return res.status(400).json({ valid: false, error: 'Token required' });
        }
        if (!password || typeof password !== 'string') {
            return res.status(400).json({ valid: false, error: 'Password required' });
        }
        const secret = process.env.SIMPLEBEACON_LICENSE_SECRET;
        if (!secret) {
            return res.status(500).json({ valid: false, error: 'Server misconfigured' });
        }
        const payload = verifyLicenseToken(token, secret);
        if (!payload) {
            return res.json({ valid: false, error: 'Invalid or expired token' });
        }

        const tier = payload.tier || 'community';
        const tokenEmail = (payload.email || '').trim().toLowerCase();
        const tokenHash = hashToken(token);
        const db = require('../lib/db.cjs');
        const dbInstance = db.getDb();

        // Paid tiers must be registered in the token chain and linked to an active subscription
        if (!FREE_TIERS.includes(tier)) {
            const node = getTokenNode(tokenHash);
            if (!node) {
                return res.json({ valid: false, error: 'Token not registered' });
            }
            if (node.status !== 'active') {
                return res.json({ valid: false, error: 'Token is not active' });
            }
            const registryEmail = (node.email || '').trim().toLowerCase();
            if (tokenEmail !== registryEmail) {
                return res.json({ valid: false, error: 'Token email mismatch' });
            }

            // Verify active subscription in database
            const customer = dbInstance.prepare('SELECT * FROM customers WHERE email = ?').get(registryEmail);
            if (!customer || customer.subscription_status !== 'active') {
                return res.json({ valid: false, error: 'No active subscription found' });
            }
            const activeSub = dbInstance
                .prepare(
                    "SELECT * FROM paid_subscriptions WHERE customer_email = ? AND status = 'active' ORDER BY current_period_end DESC LIMIT 1"
                )
                .get(registryEmail);
            if (!activeSub) {
                return res.json({ valid: false, error: 'No active paid subscription found' });
            }

            // Verify password against user account
            const user = dbInstance.prepare('SELECT * FROM users WHERE email = ?').get(registryEmail);
            if (!user || !user.password_hash || !user.salt) {
                return res.json({
                    valid: false,
                    error: 'Account password not set. Please set a password on your profile page.'
                });
            }
            const crypto = require('crypto');
            const inputHash = crypto.pbkdf2Sync(password, user.salt, 100000, 64, 'sha512').toString('hex');
            if (inputHash !== user.password_hash) {
                return res.json({ valid: false, error: 'Incorrect password' });
            }
        } else {
            // Free tokens: verify email validation code
            const codeRecord = getValidationCodeByTokenHash(tokenHash);
            if (!codeRecord) {
                return res.json({
                    valid: false,
                    error: 'No validation code found for this token. Request a new code.'
                });
            }
            if (codeRecord.used) {
                return res.json({ valid: false, error: 'Validation code already used' });
            }
            if (codeRecord.expires_at && new Date(codeRecord.expires_at) < new Date()) {
                return res.json({ valid: false, error: 'Validation code expired' });
            }
            if (codeRecord.code !== password) {
                return res.json({ valid: false, error: 'Incorrect validation code' });
            }
            markValidationCodeUsed(codeRecord.id);
        }

        res.json({
            valid: true,
            email: payload.email || null,
            tier: payload.tier || 'community',
            features: payload.features || [],
            expiry: payload.exp || null
        });
    } catch (err) {
        // Error logged via system logger to avoid direct console exposure
        res.status(500).json({ valid: false, error: 'Internal error' });
    }
});

module.exports = router;
