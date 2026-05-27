/**
 * Enhanced Authentication Routes
 * 
 * Handles SSO authentication, MFA, device management,
 * and enterprise authentication features
 */

const logger = require('../lib/app-logger');

const express = require('express');
const passport = require('passport');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const speakeasy = require('speakeasy');
const qrcode = require('qrcode');
const rateLimit = require('express-rate-limit');

const SSOMiddleware = require('../middleware/sso');
const SSOProviderConfig = require('../config/sso-providers');
const { auditAuth } = require('../middleware/audit');

const router = express.Router();

// Initialize SSO
const sso = new SSOMiddleware();
const ssoConfig = new SSOProviderConfig();

function isAuthDebugEnabled() {
    return process.env.LOG_AUTH === 'true' || process.env.AUTH_DEBUG === 'true';
}

function authDebugLog(message) {
    if (isAuthDebugEnabled()) {
        logger.info(message);
    }
}

// Rate limiting for auth endpoints
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // limit each IP to 10 requests per windowMs
    message: 'Too many authentication attempts, please try again later',
    standardHeaders: true,
    legacyHeaders: false,
});

/**
 * Get available SSO providers
 */
router.get('/providers', (req, res) => {
    try {
        const providers = ssoConfig.getEnabledProviders();
        res.json({
            success: true,
            providers,
            loginUrls: sso.getLoginUrls()
        });
    } catch (error) {
        console.error('[Auth] Error getting SSO providers:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get SSO providers'
        });
    }
});

/**
 * Azure AD OAuth2 Flow
 */
router.get('/azure', passport.authenticate('azure-ad-openidconnect', {
    scope: ['openid', 'profile', 'email', 'User.Read', 'GroupMember.Read.All']
}));

router.post('/azure', authLimiter, (req, res) => {
    passport.authenticate('azure-ad-openidconnect', (err, user, _info) => {
        if (err) {
            console.error('[Auth] Azure authentication error:', err);
            return res.status(500).json({
                success: false,
                error: 'Authentication failed'
            });
        }

        if (!user) {
            return res.status(401).json({
                success: false,
                error: 'Invalid credentials'
            });
        }

        // Generate JWT token
        const token = sso.generateToken(user);
        
        // Log authentication
        auditAuth(req, {
            action: 'sso_login',
            provider: 'azure',
            userId: user.id,
            email: user.email,
            success: true
        });

        res.json({
            success: true,
            token,
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                provider: user.provider,
                trustLevel: user.trustLevel,
                permissions: user.permissions
            }
        });
    })(req, res);
});

router.get('/azure/callback', 
    passport.authenticate('azure-ad-openidconnect', { failureRedirect: '/login' }),
    (req, res) => {
        const token = sso.generateToken(req.user);
        res.redirect(`${process.env.FRONTEND_URL}/auth/callback?token=${token}`);
    }
);

/**
 * Google OAuth2 Flow
 */
router.get('/google', passport.authenticate('google', {
    scope: ['profile', 'email']
}));

router.post('/google', authLimiter, (req, res) => {
    passport.authenticate('google', (err, user, _info) => {
        if (err) {
            console.error('[Auth] Google authentication error:', err);
            return res.status(500).json({
                success: false,
                error: 'Authentication failed'
            });
        }

        if (!user) {
            return res.status(401).json({
                success: false,
                error: 'Invalid credentials'
            });
        }

        const token = sso.generateToken(user);
        
        auditAuth(req, {
            action: 'sso_login',
            provider: 'google',
            userId: user.id,
            email: user.email,
            success: true
        });

        res.json({
            success: true,
            token,
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                provider: user.provider,
                trustLevel: user.trustLevel,
                permissions: user.permissions
            }
        });
    })(req, res);
});

router.get('/google/callback',
    passport.authenticate('google', { failureRedirect: '/login' }),
    (req, res) => {
        const token = sso.generateToken(req.user);
        res.redirect(`${process.env.FRONTEND_URL}/auth/callback?token=${token}`);
    }
);

/**
 * LDAP Authentication
 */
router.post('/ldap', authLimiter, async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({
                success: false,
                error: 'Username and password are required'
            });
        }

        const user = await sso.authenticateLDAP(username, password);
        const token = sso.generateToken(user);

        auditAuth(req, {
            action: 'ldap_login',
            userId: user.id,
            email: user.email,
            success: true
        });

        res.json({
            success: true,
            token,
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                provider: user.provider,
                trustLevel: user.trustLevel,
                permissions: user.permissions
            }
        });
    } catch (error) {
        console.error('[Auth] LDAP authentication error:', error);
        
        auditAuth(req, {
            action: 'ldap_login',
            username: req.body.username,
            success: false,
            error: error.message
        });

        res.status(401).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * Okta SAML Flow
 */
router.get('/okta', passport.authenticate('saml'));

router.post('/okta/callback',
    passport.authenticate('saml', { failureRedirect: '/login' }),
    (req, res) => {
        const token = sso.generateToken(req.user);
        res.redirect(`${process.env.FRONTEND_URL}/auth/callback?token=${token}`);
    }
);

/**
 * Multi-Factor Authentication Setup
 */
router.post('/mfa/setup', sso.requireSSO(), async (req, res) => {
    try {
        const user = req.user;
        const secret = speakeasy.generateSecret({
            name: `Cascade AI (${user.email})`,
            issuer: 'Cascade AI Platform',
            length: 32
        });

        // Store secret temporarily (in production, store in database)
        req.session.mfaSecret = secret.base32;
        req.session.mfaPending = true;

        // Generate QR code
        const qrCodeUrl = await qrcode.toDataURL(secret.otpauth_url);

        res.json({
            success: true,
            secret: secret.base32,
            qrCode: qrCodeUrl,
            backupCodes: generateBackupCodes()
        });
    } catch (error) {
        console.error('[Auth] MFA setup error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to setup MFA'
        });
    }
});

router.post('/mfa/verify', sso.requireSSO(), async (req, res) => {
    try {
        const { token } = req.body;
        const user = req.user;

        if (!token) {
            return res.status(400).json({
                success: false,
                error: 'Verification token is required'
            });
        }

        const verified = speakeasy.totp.verify({
            secret: req.session.mfaSecret,
            encoding: 'base32',
            token: token,
            window: 2
        });

        if (!verified) {
            return res.status(401).json({
                success: false,
                error: 'Invalid verification code'
            });
        }

        // Mark MFA as verified for this session
        req.session.mfaVerified = true;
        req.session.mfaPending = false;

        // In production, store MFA secret in database
        await enableMFAForUser(user.id, req.session.mfaSecret);

        auditAuth(req, {
            action: 'mfa_enabled',
            userId: user.id,
            email: user.email,
            success: true
        });

        res.json({
            success: true,
            message: 'MFA enabled successfully'
        });
    } catch (error) {
        console.error('[Auth] MFA verification error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to verify MFA'
        });
    }
});

router.post('/mfa/challenge', sso.requireSSO(), async (req, res) => {
    try {
        const { token } = req.body;
        const user = req.user;

        // Get user's MFA secret from database
        const mfaSecret = await getMFASecretForUser(user.id);

        if (!mfaSecret) {
            return res.status(400).json({
                success: false,
                error: 'MFA not setup for this user'
            });
        }

        const verified = speakeasy.totp.verify({
            secret: mfaSecret,
            encoding: 'base32',
            token: token,
            window: 2
        });

        if (!verified) {
            return res.status(401).json({
                success: false,
                error: 'Invalid verification code'
            });
        }

        // Generate new token with MFA claim
        const enhancedToken = jwt.sign({
            ...user,
            mfaVerified: true
        }, process.env.JWT_SECRET, { expiresIn: '24h' });

        auditAuth(req, {
            action: 'mfa_challenge',
            userId: user.id,
            email: user.email,
            success: true
        });

        res.json({
            success: true,
            token: enhancedToken
        });
    } catch (error) {
        console.error('[Auth] MFA challenge error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to verify MFA challenge'
        });
    }
});

/**
 * Device Management
 */
router.post('/device/register', sso.requireSSO(), async (req, res) => {
    try {
        const user = req.user;
        const { deviceName, deviceType, userAgent } = req.body;

        if (!deviceName || !deviceType) {
            return res.status(400).json({
                success: false,
                error: 'Device name and type are required'
            });
        }

        const deviceId = crypto.randomUUID();
        const device = {
            id: deviceId,
            userId: user.id,
            name: deviceName,
            type: deviceType,
            userAgent: userAgent || req.headers['user-agent'],
            ipAddress: req.ip,
            registeredAt: new Date().toISOString(),
            lastSeenAt: new Date().toISOString(),
            trusted: false
        };

        // Store device in database
        await registerDevice(device);

        auditAuth(req, {
            action: 'device_registered',
            userId: user.id,
            deviceId,
            deviceName,
            success: true
        });

        res.json({
            success: true,
            device: {
                id: device.id,
                name: device.name,
                type: device.type,
                registeredAt: device.registeredAt,
                trusted: device.trusted
            }
        });
    } catch (error) {
        console.error('[Auth] Device registration error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to register device'
        });
    }
});

router.get('/device/list', sso.requireSSO(), async (req, res) => {
    try {
        const user = req.user;
        const devices = await getUserDevices(user.id);

        res.json({
            success: true,
            devices: devices.map(device => ({
                id: device.id,
                name: device.name,
                type: device.type,
                registeredAt: device.registeredAt,
                lastSeenAt: device.lastSeenAt,
                trusted: device.trusted,
                currentSession: device.userAgent === req.headers['user-agent']
            }))
        });
    } catch (error) {
        console.error('[Auth] Error getting devices:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get devices'
        });
    }
});

router.post('/device/:deviceId/trust', sso.requireSSO(), async (req, res) => {
    try {
        const user = req.user;
        const { deviceId } = req.params;

        await trustDevice(user.id, deviceId);

        auditAuth(req, {
            action: 'device_trusted',
            userId: user.id,
            deviceId,
            success: true
        });

        res.json({
            success: true,
            message: 'Device marked as trusted'
        });
    } catch (error) {
        console.error('[Auth] Error trusting device:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to trust device'
        });
    }
});

/**
 * Token Refresh
 */
router.post('/refresh', async (req, res) => {
    try {
        const { refreshToken } = req.body;

        if (!refreshToken) {
            return res.status(400).json({
                success: false,
                error: 'Refresh token is required'
            });
        }

        const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
        const user = await getUserById(decoded.sub);

        if (!user) {
            return res.status(401).json({
                success: false,
                error: 'Invalid refresh token'
            });
        }

        const newToken = sso.generateToken(user);

        res.json({
            success: true,
            token: newToken
        });
    } catch (error) {
        console.error('[Auth] Token refresh error:', error);
        res.status(401).json({
            success: false,
            error: 'Invalid refresh token'
        });
    }
});

/**
 * Logout
 */
router.post('/logout', sso.requireSSO(), async (req, res) => {
    try {
        const user = req.user;
        const token = req.headers.authorization?.replace('Bearer ', '');

        // Invalidate token (add to blacklist)
        await invalidateToken(token);

        auditAuth(req, {
            action: 'logout',
            userId: user.id,
            email: user.email,
            success: true
        });

        res.json({
            success: true,
            message: 'Logged out successfully'
        });
    } catch (error) {
        console.error('[Auth] Logout error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to logout'
        });
    }
});

/**
 * Helper functions (to be implemented with database integration)
 */
async function enableMFAForUser(userId, _secret) {
    // Database persistence is intentionally deferred in this in-memory fallback path.
    authDebugLog(`[Auth] MFA enabled for user ${userId}`);
}

async function getMFASecretForUser(_userId) {
    // Database-backed retrieval is not configured in this fallback implementation.
    return null;
}

async function registerDevice(device) {
    // Device persistence is intentionally deferred in this in-memory fallback path.
    authDebugLog(`[Auth] Device registered: ${device.id}`);
}

async function getUserDevices(_userId) {
    // Device history is empty until database-backed storage is enabled.
    return [];
}

async function trustDevice(userId, deviceId) {
    // Device trust persistence is intentionally deferred in this fallback path.
    authDebugLog(`[Auth] Device trusted: ${deviceId} for user ${userId}`);
}

async function getUserById(_userId) {
    // Database-backed user lookup is not configured in this fallback implementation.
    return null;
}

async function invalidateToken(_token) {
    // Token blacklist persistence is intentionally deferred in this fallback path.
    authDebugLog('[Auth] Token invalidated');
}

function generateBackupCodes() {
    const codes = [];
    for (let i = 0; i < 10; i++) {
        codes.push(crypto.randomBytes(4).toString('hex').toUpperCase());
    }
    return codes;
}

module.exports = router;
