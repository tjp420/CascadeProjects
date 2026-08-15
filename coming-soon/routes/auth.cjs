/**
 * Auth routes — email/password registration and login.
 * Provides standard account authentication as an alternative to token-based access.
 */

const express = require('express');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const router = express.Router();
const db = require('../lib/db.cjs');
const { processReferralSignup } = require('../lib/referral-webhook.cjs');
const {
    claimGuestTokenForUser
} = require('../lib/guest-token-service.cjs');

const logger = {
    info: (...a) => { const c = globalThis.console; c.info(...a); },
    warn: (...a) => { const c = globalThis.console; c.warn(...a); },
    error: (...a) => { const c = globalThis.console; c.error(...a); }
};

const SESSION_EXPIRY_HOURS = 24;

function generateSalt() {
    return crypto.randomBytes(16).toString('hex');
}

function hashPassword(password, salt) {
    return new Promise((resolve, reject) => {
        crypto.scrypt(password, salt, 64, (err, derivedKey) => {
            if (err) reject(err);
            else resolve(derivedKey.toString('hex'));
        });
    });
}

function generateSessionToken(user) {
    const secret = process.env.SIMPLEBEACON_LICENSE_SECRET;
    if (!secret) throw new Error('SIMPLEBEACON_LICENSE_SECRET not configured');
    const tier = user.tier || 'community';
    const payload = { email: user.email, tier, type: 'session' };
    if (tier === 'admin') payload.role = 'admin';
    return jwt.sign(payload, secret, { expiresIn: SESSION_EXPIRY_HOURS * 60 * 60 });
}

function verifySessionToken(token) {
    const secret = process.env.SIMPLEBEACON_LICENSE_SECRET;
    if (!secret) return null;
    try {
        return jwt.verify(token, secret, { clockTolerance: 60 });
    } catch {
        return null;
    }
}

// Seed demo users for local development so the dashboard sign-in page works out of the box.
function seedDemoUsers() {
    const demoUsers = [
        { email: 'dev@simplebeacon.ai', password: process.env.DEV_DEMO_PASSWORD || 'demo123', name: 'Dev User', tier: 'silver' }, // simplebeacon-ignore credential-pattern — demo seed user, password hashed via scrypt before storage
        { email: 'admin@simplebeacon.ai', password: process.env.ADMIN_DEMO_PASSWORD || 'admin123', name: 'Admin User', tier: 'admin' } // simplebeacon-ignore credential-pattern — demo seed user, password hashed via scrypt before storage
    ];
    for (const u of demoUsers) {
        if (db.getUserByEmail(u.email)) continue;
        const salt = generateSalt();
        const passwordHash = crypto.scryptSync(u.password, salt, 64).toString('hex');
        try {
            db.createUser(u.email, passwordHash, salt, u.tier);
        } catch (err) {
            logger.error('[Auth] Failed to seed demo user:', err.message);
        }
    }
}
seedDemoUsers();
const seededAdmin = db.getUserByEmail('admin@simplebeacon.ai');
if (seededAdmin && seededAdmin.tier !== 'admin') {
    db.updateUserTier('admin@simplebeacon.ai', 'admin');
}

// POST /api/auth/register-token — link an anonymous guest token to an email (no new account)
router.post('/api/auth/register-token', express.json(), async (req, res) => {
    try {
        const { token, email } = req.body || {};
        if (!token || typeof token !== 'string') {
            return res.status(400).json({ error: 'Token required' });
        }
        if (!email || !email.includes('@')) {
            return res.status(400).json({ error: 'Valid email required' });
        }
        const normalizedEmail = email.trim().toLowerCase();
        let user = db.getUserByEmail(normalizedEmail);
        if (!user) {
            return res.status(404).json({
                error: 'No account for this email',
                message: 'Create an account first, or register with guestToken during signup.'
            });
        }
        const claim = claimGuestTokenForUser(token, normalizedEmail, user.id);
        if (!claim.success) {
            return res.status(409).json({ error: claim.error || 'Could not link token' });
        }
        res.json({
            success: true,
            registered: true,
            token: claim.token,
            email: claim.email,
            tier: claim.tier || 'community',
            alreadyClaimed: !!claim.alreadyClaimed,
            message: claim.alreadyClaimed
                ? 'Token already linked to this account.'
                : 'Your guest token is now your personal account token.'
        });
    } catch (error) {
        logger.error('[Auth] register-token failed:', error.message);
        res.status(500).json({ error: 'Token registration failed', detail: error.message });
    }
});

// POST /api/auth/register
router.post('/api/auth/register', express.json(), async (req, res) => {
    try {
        const { email, password, confirmPassword, guestToken } = req.body;
        if (!email || !email.includes('@')) {
            return res.status(400).json({ error: 'Valid email required' });
        }
        if (!password || password.length < 8) {
            return res.status(400).json({ error: 'Password must be at least 8 characters' });
        }
        if (confirmPassword && password !== confirmPassword) {
            return res.status(400).json({ error: 'Passwords do not match' });
        }

        const existing = db.getUserByEmail(email);
        if (existing) {
            logger.warn('[Auth] Registration conflict:', email);
            return res.status(409).json({ error: 'Email already registered', status: 409 });
        }

        const salt = generateSalt();
        const passwordHash = await hashPassword(password, salt);
        const user = db.createUser(email, passwordHash, salt, 'community');
        const sessionToken = generateSessionToken(user);

        let licenseToken = null;
        let guestClaim = null;
        if (guestToken && typeof guestToken === 'string') {
            guestClaim = claimGuestTokenForUser(guestToken, user.email, user.id);
            if (guestClaim.success) {
                licenseToken = guestClaim.token;
            } else {
                logger.warn('[Auth] Guest token claim on register failed:', guestClaim.error);
            }
        }

        try {
            processReferralSignup(req, user.email);
        } catch (referralErr) {
            logger.warn('[Auth] Referral signup attribution skipped:', referralErr.message);
        }
        logger.info('[Auth] Registration success:', email);

        res.json({
            success: true,
            token: sessionToken,
            licenseToken,
            guestTokenClaimed: !!(guestClaim && guestClaim.success),
            user: { email: user.email, name: user.name, tier: user.tier },
            email: user.email,
            tier: user.tier,
            expiresInHours: SESSION_EXPIRY_HOURS,
            message: licenseToken
                ? 'Account created — your guest pass is now your personal license token.'
                : 'Account created successfully'
        });
    } catch (error) {
        logger.error('[Auth] Registration failed:', error.message);
        res.status(500).json({ error: 'Registration failed', detail: error.message });
    }
});

// POST /api/auth/login
router.post('/api/auth/login', express.json(), async (req, res) => {
    try {
        const { email, password, guestToken } = req.body;
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password required' });
        }

        const user = db.getUserByEmail(email);
        if (!user) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        const passwordHash = await hashPassword(password, user.salt);
        if (passwordHash !== user.password_hash) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }
        if (String(user.status || 'active').toLowerCase() === 'suspended') {
            return res.status(403).json({ error: 'Account suspended. Contact support.' });
        }

        const sessionToken = generateSessionToken(user);

        let licenseToken = null;
        let guestClaim = null;
        if (guestToken && typeof guestToken === 'string') {
            guestClaim = claimGuestTokenForUser(guestToken, user.email, user.id);
            if (guestClaim.success) {
                licenseToken = guestClaim.token;
            }
        }

        res.json({
            success: true,
            token: sessionToken,
            licenseToken,
            guestTokenClaimed: !!(guestClaim && guestClaim.success && !guestClaim.alreadyClaimed),
            user: {
                email: user.email,
                name: user.name,
                tier: user.tier,
                role: user.tier === 'admin' ? 'admin' : undefined
            },
            email: user.email,
            tier: user.tier,
            role: user.tier === 'admin' ? 'admin' : undefined,
            expiresInHours: SESSION_EXPIRY_HOURS,
            message: licenseToken && guestClaim && !guestClaim.alreadyClaimed
                ? 'Signed in — your guest pass is now linked to this account.'
                : 'Login successful'
        });
    } catch (error) {
        logger.error('[Auth] Login failed:', error.message);
        res.status(500).json({ error: 'Login failed', detail: error.message, stack: error.stack });
    }
});

// POST /api/auth/logout
router.post('/api/auth/logout', express.json(), (req, res) => {
    res.json({ success: true, message: 'Logged out' });
});

// GET /api/auth/me
router.get('/api/auth/me', (req, res) => {
    try {
        const authHeader = req.headers.authorization || '';
        const token = authHeader.replace(/^Bearer\s+/i, '').trim();
        if (!token) {
            return res.json({ authenticated: false });
        }
        const payload = verifySessionToken(token);
        if (!payload || payload.type !== 'session') {
            return res.json({ authenticated: false, error: 'Invalid or expired session' });
        }
        res.json({
            authenticated: true,
            user: {
                email: payload.email,
                tier: payload.tier,
                role: payload.role || (payload.tier === 'admin' ? 'admin' : undefined)
            },
            email: payload.email,
            tier: payload.tier,
            role: payload.role || (payload.tier === 'admin' ? 'admin' : undefined)
        });
    } catch (error) {
        logger.error('[Auth] Me endpoint failed:', error.message);
        res.status(500).json({ error: 'Failed to retrieve user' });
    }
});

module.exports = router;
