/**
 * Subscription routes — newsletter signup endpoint.
 */

const express = require('express');
const router = express.Router();
const db = require('../lib/db.cjs');

const SUB_RATE_LIMIT_MS = 60 * 60 * 1000;
const SUB_RATE_LIMIT_MAX = 5;
const subRateLog = new Map(); // ip -> { count, resetAt }

const logger = {
    error: (...a) => { const c = globalThis.console; c.error(...a); }
};

router.post('/api/subscribe', async (req, res) => {
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    const subEntry = subRateLog.get(clientIp);
    if (subEntry && now < subEntry.resetAt) {
        if (subEntry.count >= SUB_RATE_LIMIT_MAX) {
            return res.status(429).json({ error: 'Too many subscription requests. Please try again later.' });
        }
        subEntry.count++;
    } else {
        subRateLog.set(clientIp, { count: 1, resetAt: now + SUB_RATE_LIMIT_MS });
    }

    const { email } = req.body;

    const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!email || typeof email !== 'string' || !EMAIL_REGEX.test(email) || email.length > 254) {
        return res.status(400).json({ error: 'A valid email address is required.' });
    }

    try {
        const result = db.addSubscription(email);
        return res.status(200).json({ message: result.message });
    } catch (error) {
        logger.error('[Subscribe] Storage error:', error.message);
        return res.status(500).json({ error: 'Internal database storage failure.' });
    }
});

module.exports = router;
