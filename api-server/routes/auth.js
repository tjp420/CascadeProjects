/**
 * SimpleBeacon Enterprise Auth Routes
 * POST /api/v2/auth/register
 * POST /api/v2/auth/login
 * POST /api/v2/auth/refresh
 * POST /api/v2/auth/mfa/setup
 * POST /api/v2/auth/mfa/verify
 */

const express = require('express');
const crypto = require('crypto');
const db = require('../lib/db.cjs');
const {
    hashPassword,
    verifyPassword,
    issueAccessToken,
    issueRefreshToken,
    verifyToken,
    requireAuth
} = require('../lib/auth.js');

const router = express.Router();

/**
 * POST /api/v2/auth/register
 * Body: { email, password, displayName? }
 * Creates a local user and a personal organization + workspace.
 */
router.post('/api/v2/auth/register', async (req, res) => {
    const { email, password, displayName } = req.body || {};
    if (!email || !password || password.length < 8) {
        return res.status(400).json({ error: 'email and password (min 8 chars) required' });
    }

    try {
        const existing = await db.get('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
        if (existing) {
            return res.status(409).json({ error: 'Email already registered' });
        }

        const passwordHash = await hashPassword(password);
        const user = await db.get(
            `INSERT INTO users (email, display_name, password_hash, auth_provider)
             VALUES ($1, $2, $3, 'local')
             RETURNING id, email, display_name, created_at`,
            [email.toLowerCase(), displayName || null, passwordHash]
        );

        // Create personal org + workspace
        const org = await db.get(
            `INSERT INTO organizations (slug, name, billing_email, plan)
             VALUES ($1, $2, $3, 'starter')
             RETURNING id`,
            [`user-${user.id}`, `Personal Workspace`, email.toLowerCase()]
        );

        const workspace = await db.get(
            `INSERT INTO workspaces (name, slug, owner_id, billing_email, org_id)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING id`,
            [`Personal`, `personal-${user.id}`, user.id, email.toLowerCase(), org.id]
        );

        // Assign owner role
        const ownerRole = await db.get("SELECT id FROM roles WHERE name = 'admin'");
        await db.query(
            `INSERT INTO workspace_members (workspace_id, user_id, role_id, invitation_accepted)
             VALUES ($1, $2, $3, true)`,
            [workspace.id, user.id, ownerRole.id]
        );

        const accessToken = issueAccessToken({
            userId: user.id,
            email: user.email,
            role: 'admin',
            workspaceId: workspace.id
        });
        const refreshToken = issueRefreshToken({ userId: user.id });

        res.status(201).json({
            user: { id: user.id, email: user.email, displayName: user.display_name },
            workspace: { id: workspace.id, name: 'Personal' },
            accessToken,
            refreshToken
        });
    } catch (err) {
        res.status(500).json({ error: 'Registration failed', detail: err.message });
    }
});

/**
 * POST /api/v2/auth/login
 * Body: { email, password }
 */
router.post('/api/v2/auth/login', async (req, res) => {
    const { email, password } = req.body || {};
    if (!email || !password) {
        return res.status(400).json({ error: 'email and password required' });
    }

    try {
        const user = await db.get(
            `SELECT id, email, display_name, password_hash, is_active, mfa_enabled
             FROM users WHERE email = $1`,
            [email.toLowerCase()]
        );
        if (!user || !user.password_hash) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        if (!user.is_active) {
            return res.status(403).json({ error: 'Account deactivated' });
        }

        const valid = await verifyPassword(password, user.password_hash);
        if (!valid) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Update last login
        await db.query(
            `UPDATE users SET last_login_at = now(), last_login_ip = $1 WHERE id = $2`,
            [req.ip || null, user.id]
        );

        if (user.mfa_enabled) {
            // Return mfaRequired flag; client must hit /mfa/verify with TOTP
            return res.json({ mfaRequired: true, userId: user.id });
        }

        // Find primary workspace + role
        const membership = await db.get(
            `SELECT wm.workspace_id, r.name AS role_name
             FROM workspace_members wm
             JOIN roles r ON r.id = wm.role_id
             WHERE wm.user_id = $1 AND wm.invitation_accepted = true
             ORDER BY wm.joined_at DESC
             LIMIT 1`,
            [user.id]
        );

        const accessToken = issueAccessToken({
            userId: user.id,
            email: user.email,
            role: membership?.role_name || 'viewer',
            workspaceId: membership?.workspace_id
        });
        const refreshToken = issueRefreshToken({ userId: user.id });

        res.json({
            user: { id: user.id, email: user.email, displayName: user.display_name },
            workspace: membership ? { id: membership.workspace_id } : null,
            accessToken,
            refreshToken
        });
    } catch (err) {
        res.status(500).json({ error: 'Login failed', detail: err.message });
    }
});

/**
 * POST /api/v2/auth/refresh
 * Body: { refreshToken }
 */
router.post('/api/v2/auth/refresh', async (req, res) => {
    const { refreshToken } = req.body || {};
    if (!refreshToken) {
        return res.status(400).json({ error: 'refreshToken required' });
    }
    try {
        const decoded = verifyToken(refreshToken);
        if (decoded.type !== 'refresh') {
            return res.status(401).json({ error: 'Invalid token type' });
        }
        const user = await db.get(
            `SELECT id, email, display_name FROM users WHERE id = $1 AND is_active = true`,
            [decoded.sub]
        );
        if (!user) {
            return res.status(401).json({ error: 'User not found or deactivated' });
        }

        const membership = await db.get(
            `SELECT wm.workspace_id, r.name AS role_name
             FROM workspace_members wm
             JOIN roles r ON r.id = wm.role_id
             WHERE wm.user_id = $1 AND wm.invitation_accepted = true
             ORDER BY wm.joined_at DESC
             LIMIT 1`,
            [user.id]
        );

        const newAccess = issueAccessToken({
            userId: user.id,
            email: user.email,
            role: membership?.role_name || 'viewer',
            workspaceId: membership?.workspace_id
        });
        res.json({ accessToken: newAccess });
    } catch (err) {
        res.status(401).json({ error: 'Invalid or expired refresh token', detail: err.message });
    }
});

/**
 * POST /api/v2/auth/mfa/setup
 * Generates TOTP secret, returns QR code URI. Requires auth.
 */
router.post('/api/v2/auth/mfa/setup', requireAuth, async (req, res) => {
    const speakeasy = require('speakeasy');
    const secret = speakeasy.generateSecret({
        name: 'SimpleBeacon',
        length: 32
    });

    await db.query(
        `UPDATE users SET mfa_secret = $1 WHERE id = $2`,
        [secret.base32, req.auth.userId]
    );

    res.json({
        secret: secret.base32,
        otpauthUrl: secret.otpauth_url
    });
});

/**
 * POST /api/v2/auth/mfa/verify
 * Verifies TOTP token and enables MFA. Body: { token }
 */
router.post('/api/v2/auth/mfa/verify', requireAuth, async (req, res) => {
    const { token } = req.body || {};
    if (!token) {
        return res.status(400).json({ error: 'token required' });
    }

    const user = await db.get(
        `SELECT mfa_secret FROM users WHERE id = $1`,
        [req.auth.userId]
    );
    if (!user?.mfa_secret) {
        return res.status(400).json({ error: 'MFA not set up' });
    }

    const speakeasy = require('speakeasy');
    const verified = speakeasy.totp.verify({
        secret: user.mfa_secret,
        encoding: 'base32',
        token: String(token),
        window: 1
    });

    if (!verified) {
        return res.status(401).json({ error: 'Invalid TOTP token' });
    }

    await db.query(
        `UPDATE users SET mfa_enabled = true WHERE id = $1`,
        [req.auth.userId]
    );

    res.json({ mfaEnabled: true });
});

module.exports = router;
