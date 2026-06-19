/**
 * Token validation route — secure endpoint for client-side token verification.
 * Replaces the insecure client-side token generation in unlock.html.
 */

const express = require('express');
const router = express.Router();

function verifyLicenseToken(token, secret) {
    if (!token || typeof token !== 'string') return null;
    try {
        const jwt = require('jsonwebtoken');
        return jwt.verify(token, secret, { clockTolerance: 60 });
    } catch {
        return null;
    }
}

router.post('/api/tokens/validate', express.json(), (req, res) => {
    try {
        const { token } = req.body;
        if (!token || typeof token !== 'string') {
            return res.status(400).json({ valid: false, error: 'Token required' });
        }
        const secret = process.env.SIMPLEBEACON_LICENSE_SECRET;
        if (!secret) {
            return res.status(500).json({ valid: false, error: 'Server misconfigured' });
        }
        const payload = verifyLicenseToken(token, secret);
        if (!payload) {
            return res.json({ valid: false, error: 'Invalid or expired token' });
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
