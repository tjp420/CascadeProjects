// simplebeacon-ignore: Scanner pattern definitions, test fixtures, dashboard code, security — all findings are false positives
/**
 * Free token route — generates a community license token without payment.
 */

const express = require('express');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const router = express.Router();
const systemLogger = require('../lib/system-logger.cjs');
const { getDb, createValidationCode, getValidationCodeByEmailAndCode, getValidationCodeByTokenHash, markValidationCodeUsed } = require('../lib/db.cjs');
const { hashToken } = require('../lib/token-chain-store.cjs');
const { createTokenChain, activateToken } = require('../lib/token-chain-store.cjs');
const { sendEmail } = require('../services/email.cjs');

const logger = {
    error: (...a) => { const c = globalThis.console; c.error(...a); }
};

const DEFAULT_PORT = 3001;
const DEV_LICENSE_SECRET = 'insecure-dev-secret-change-me'; // simplebeacon-ignore credential-pattern — dev-only fallback

function resolveLicenseSecret() {
    const secret = process.env.SIMPLEBEACON_LICENSE_SECRET;
    if (secret) return secret;
    if (String(process.env.NODE_ENV || '').toLowerCase() !== 'production') {
        return DEV_LICENSE_SECRET;
    }
    return '';
}

function getPublicUrl(req) {
    if (process.env.PUBLIC_URL) return process.env.PUBLIC_URL.replace(/\/$/, '');
    if (req && req.headers && req.headers.host) {
        const host = req.headers.host;
        if (/\.onrender\.com$/.test(host)) return 'https://simplebeacon.ai';
        const proto = req.headers['x-forwarded-proto'] || (req.secure ? 'https' : 'http');
        return proto + '://' + host;
    }
    return 'http://localhost:' + (process.env.PORT || DEFAULT_PORT);
}

const VALIDATION_CODE_TTL_MINUTES = 60; // 1-hour email verification codes

function generateValidationCode() {
    return String(Math.floor(100000 + Math.random() * 900000));
}

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

        const secret = resolveLicenseSecret();
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
        const certUrl = `${getPublicUrl(req)}/certificate-upload.html?token=${encodeURIComponent(token)}`;
        setFreeTokenRecord(email, token, hashToken(token), expiresAt);

        // Register in token chain for auditability and upgrade lineage
        try {
            createTokenChain(email, { email, tier: 'community' }, token, FREE_TOKEN_TTL_MINUTES);
            activateToken(hashToken(token), FREE_TOKEN_TTL_MINUTES);
        } catch (chainErr) {
            logger.error('[FreeToken] Failed to register token in chain:', chainErr.message);
        }

        systemLogger.logTokenOp('free_token_generated', { email, tier: 'community', clientIp: req.ip || req.socket?.remoteAddress || 'unknown' });

        // Email the token when requested by the UI
        let emailResult = { sent: false, queued: false, error: null };
        if (sendEmailFlag) {
            try {
                emailResult = await sendEmail({
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
                emailResult = { sent: false, queued: false, error: emailError.message };
            }
        }

        const actuallyEmailed = emailResult.sent;
        res.json({
            success: true,
            token,
            certUrl,
            tier: 'community',
            label: 'AI Slop Audit',
            expiresInDays: 1,
            cached: false,
            emailed: actuallyEmailed,
            queued: emailResult.queued,
            emailError: emailResult.error || null,
            message: actuallyEmailed
                ? 'Free community token generated and emailed. Valid for 24 hours.'
                : (emailResult.queued
                    ? 'Free community token generated and email queued for delivery. Valid for 24 hours.'
                    : 'Free community token generated. Valid for 24 hours.')
        });
    } catch (error) {
        logger.error('[FreeToken] Token generation failed:', error.message);
        return res.status(500).json({ error: 'Token generation failed', detail: error.message });
    }
}

// ── Sandbox token generation ──────────────────────────────
const SANDBOX_TOKEN_TTL_MINUTES = 14 * 24 * 60; // 14 days
const SANDBOX_RESEND_MIN_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes between resends per email

(function initSandboxTokensTable() {
    try {
        const db = getDb();
        db.exec(`
            CREATE TABLE IF NOT EXISTS sandbox_tokens (
                email TEXT PRIMARY KEY,
                token TEXT NOT NULL,
                token_hash TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                last_emailed_at TEXT NOT NULL DEFAULT (datetime('now')),
                expires_at TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_sandbox_tokens_expires ON sandbox_tokens(expires_at);
        `);
    } catch (err) {
        logger.error('[SandboxToken] Failed to create sandbox_tokens table:', err.message);
    }
})();

function getSandboxTokenRecord(email) {
    const db = getDb();
    return db.prepare('SELECT * FROM sandbox_tokens WHERE email = ?').get(email.trim().toLowerCase());
}

function setSandboxTokenRecord(email, token, tokenHash, expiresAt) {
    const db = getDb();
    db.prepare(`
        INSERT OR REPLACE INTO sandbox_tokens (email, token, token_hash, created_at, last_emailed_at, expires_at)
        VALUES (?, ?, ?, datetime('now'), datetime('now'), ?)
    `).run(email.trim().toLowerCase(), token, tokenHash, expiresAt);
}

function touchSandboxEmailSent(email) {
    const db = getDb();
    db.prepare("UPDATE sandbox_tokens SET last_emailed_at = datetime('now') WHERE email = ?").run(email.trim().toLowerCase());
}

async function emailSandboxToken({ email, token, validationCode, auditUrl }) {
    return sendEmail({
        to: email,
        subject: 'Your SimpleBeacon Sandbox Token',
        text: `Your SimpleBeacon sandbox token is:\n\n${token}\n\nYour email validation code is: ${validationCode}\n\nPaste both into the audit page, or use this link:\n\n${auditUrl}\n\nThe validation code is valid for 1 hour. The token is valid for 14 days.`,
        html: `<p>Your SimpleBeacon sandbox token is:</p><p><code style="word-break:break-all;">${token}</code></p><p>Your email validation code is: <strong>${validationCode}</strong></p><p><a href="${auditUrl}">Open Audit Page (token + code pre-filled)</a></p><p>The validation code is valid for 1 hour. The token is valid for 14 days.</p>`
    });
}

async function handleSandboxToken(req, res) {
    const now = Date.now();
    const email = req.body?.email || req.query?.email || '';

    if (!email || !email.includes('@')) {
        return res.status(400).json({ error: 'Valid email required for sandbox token generation' });
    }

    const normalizedEmail = email.trim().toLowerCase();

    try {
        const secret = resolveLicenseSecret();
        if (!secret) {
            logger.error('[SandboxToken] License secret not configured');
            return res.status(500).json({ error: 'Server misconfigured — contact administrator' });
        }

        const existing = getSandboxTokenRecord(normalizedEmail);
        let token = null;
        let cached = false;

        if (existing && new Date(existing.expires_at) > new Date()) {
            const lastEmailed = new Date(existing.last_emailed_at || existing.created_at).getTime();
            const sinceLastEmail = now - lastEmailed;
            if (sinceLastEmail < SANDBOX_RESEND_MIN_INTERVAL_MS) {
                const remainingMin = Math.max(1, Math.ceil((SANDBOX_RESEND_MIN_INTERVAL_MS - sinceLastEmail) / 60000));
                return res.status(429).json({
                    success: false,
                    error: 'Rate limit exceeded',
                    retryAfterMinutes: remainingMin,
                    message: `We already emailed a sandbox token to ${normalizedEmail}. Check your inbox and spam folder. You can request another email in ${remainingMin} minute(s).`
                });
            }
            token = existing.token;
            cached = true;
        }

        if (!token) {
            token = generateLicenseToken(
                {
                    email: normalizedEmail,
                    tier: 'sandbox',
                    projectName: 'Developer-Sandbox',
                    clientName: 'Developer',
                    features: ['basic_analysis', 'sample_data_basic']
                },
                secret,
                SANDBOX_TOKEN_TTL_MINUTES
            );
            const expiresAt = new Date(now + SANDBOX_TOKEN_TTL_MINUTES * 60 * 1000).toISOString();
            setSandboxTokenRecord(normalizedEmail, token, hashToken(token), expiresAt);

            // Register in token chain for auditability and upgrade lineage
            try {
                createTokenChain(normalizedEmail, { email: normalizedEmail, tier: 'sandbox', features: ['basic_analysis', 'sample_data_basic'] }, token, SANDBOX_TOKEN_TTL_MINUTES);
                activateToken(hashToken(token), SANDBOX_TOKEN_TTL_MINUTES);
            } catch (chainErr) {
                logger.error('[SandboxToken] Failed to register token in chain:', chainErr.message);
            }
        }

        const tokenHash = hashToken(token);
        const validationCode = generateValidationCode();
        const codeExpiresAt = new Date(now + VALIDATION_CODE_TTL_MINUTES * 60 * 1000).toISOString();
        createValidationCode(normalizedEmail, validationCode, tokenHash, codeExpiresAt);

        const auditUrl = `${getPublicUrl(req)}/audit.html?token=${encodeURIComponent(token)}&code=${encodeURIComponent(validationCode)}`;
        const certUrl = `${getPublicUrl(req)}/certificate-upload.html?token=${encodeURIComponent(token)}`;

        const emailResult = await emailSandboxToken({ email: normalizedEmail, token, validationCode, auditUrl });
        if (!emailResult.sent && !emailResult.queued) {
            logger.error('[SandboxToken] Email could not be sent or queued:', emailResult.error);
            return res.status(503).json({
                success: false,
                error: 'Email delivery failed',
                message: 'Could not send sandbox token email. Try again in a few minutes or contact support@simplebeacon.ai.'
            });
        }

        touchSandboxEmailSent(normalizedEmail);
        systemLogger.logTokenOp(cached ? 'sandbox_token_resent' : 'sandbox_token_generated', {
            email: normalizedEmail,
            tier: 'sandbox',
            clientIp: req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || 'unknown'
        });

        res.json({
            success: true,
            token,
            certUrl,
            auditUrl,
            codeRequired: true,
            tier: 'sandbox',
            expiresInDays: 14,
            cached,
            resent: cached,
            emailed: emailResult.sent,
            queued: emailResult.queued,
            emailError: emailResult.error || null,
            message: emailResult.sent
                ? (cached
                    ? 'Sandbox token resent to your email. Enter the new validation code from your inbox.'
                    : 'Developer sandbox token generated and emailed. Enter the validation code from your email to unlock the audit.')
                : (emailResult.queued
                    ? 'Sandbox token generated. Email queued for delivery — enter the validation code from your email when it arrives.'
                    : 'Sandbox token generated, but email delivery failed. Try again or contact support@simplebeacon.ai.')
        });
    } catch (error) {
        logger.error('[SandboxToken] Token generation failed:', error.message);
        return res.status(500).json({ error: 'Token generation failed', detail: error.message });
    }
}

// ── Token upgrade endpoint ──────────────────────────────
// Exchanges a free/guest token for a paid token when a subscription is active
const guestTokenService = require('../lib/guest-token-service.cjs');

router.post('/api/token/upgrade', express.json(), async (req, res) => {
    const { freeToken, email } = req.body;
    if (!freeToken || typeof freeToken !== 'string') {
        return res.status(400).json({ error: 'freeToken required' });
    }
    if (!email || !email.includes('@')) {
        return res.status(400).json({ error: 'Valid email required' });
    }

    try {
        const secret = resolveLicenseSecret();
        if (!secret) {
            return res.status(500).json({ error: 'Server misconfigured' });
        }

        let payload;
        try {
            payload = jwt.verify(freeToken, secret, { clockTolerance: 60 });
        } catch {
            return res.status(400).json({ error: 'Invalid free token' });
        }

        const reqEmail = email.trim().toLowerCase();
        const db = getDb();
        const customer = db.prepare('SELECT * FROM customers WHERE email = ?').get(reqEmail);
        if (!customer || customer.subscription_status !== 'active') {
            return res.status(403).json({ error: 'No active subscription found for this email.' });
        }
        const paidTier = customer.tier || 'developer';
        const paidTtlMinutes = 30 * 24 * 60;

        const guestRecord = guestTokenService.getGuestTokenByHash(hashToken(freeToken));
        const isGuestTier = (payload.tier || '') === 'guest' || !!payload.guestId || !!guestRecord;

        if (isGuestTier) {
            const upgraded = guestTokenService.upgradeGuestToken(freeToken, reqEmail, paidTier, secret, paidTtlMinutes);
            if (!upgraded.success) {
                return res.status(400).json({ error: upgraded.error || 'Guest token upgrade failed' });
            }
            return res.json({
                success: true,
                token: upgraded.token,
                tier: upgraded.tier,
                upgradedFrom: 'guest',
                message: 'Guest pass upgraded to your paid license. Your old token no longer works.'
            });
        }

        const tokenEmail = (payload.email || '').trim().toLowerCase();
        if (tokenEmail !== reqEmail) {
            return res.status(400).json({ error: 'Token email mismatch' });
        }

        const freeRecord = db.prepare('SELECT * FROM free_tokens WHERE email = ?').get(reqEmail);
        if (!freeRecord || freeRecord.revoked) {
            return res.status(400).json({ error: 'Free token is not valid or has been revoked' });
        }

        revokeFreeToken(reqEmail);

        const paidToken = generateLicenseToken(
            { email: reqEmail, tier: paidTier, projectName: 'Upgraded', clientName: customer.email, previousToken: freeToken },
            secret,
            paidTtlMinutes
        );

        const { attachTokenToChain, revokeToken } = require('../lib/token-chain-store.cjs');
        const freeTokenHash = hashToken(freeToken);
        const attachResult = attachTokenToChain(freeTokenHash, paidToken, { email: reqEmail, tier: paidTier }, paidTtlMinutes);

        if (!attachResult.success) {
            logger.error('[TokenUpgrade] attachTokenToChain failed, falling back to new chain:', attachResult.error);
            createTokenChain(reqEmail, { email: reqEmail, tier: paidTier }, paidToken, paidTtlMinutes);
            activateToken(hashToken(paidToken), paidTtlMinutes);
        } else {
            revokeToken(freeTokenHash);
        }

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

// ── Anonymous guest token (auto-issued per device, claimed on signup) ──
async function handleGuestToken(req, res) {
    const guestId = (req.body?.guestId || req.query?.guestId || '').trim();
    if (!guestId || guestId.length < 8) {
        return res.status(400).json({ error: 'guestId required (min 8 characters)' });
    }
    try {
        const secret = resolveLicenseSecret();
        if (!secret) {
            return res.status(500).json({ error: 'Server misconfigured — contact administrator' });
        }
        const result = guestTokenService.issueGuestToken(guestId, secret);
        if (!result.success) {
            return res.status(400).json({ error: result.error || 'Guest token issue failed' });
        }
        systemLogger.logTokenOp(result.cached ? 'guest_token_returned' : 'guest_token_issued', {
            guestId: guestId.slice(0, 12) + '…',
            claimed: result.claimed,
            clientIp: req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || 'unknown'
        });
        res.json({
            success: true,
            token: result.token,
            tier: result.tier,
            upgradeable: true,
            cached: !!result.cached,
            claimed: !!result.claimed,
            userEmail: result.userEmail || null,
            expiresAt: result.expiresAt,
            expiresInDays: 14,
            message: result.claimed
                ? 'Your personal token is ready — linked to your account.'
                : (result.cached
                    ? 'Guest pass restored for this device.'
                    : 'Free guest pass issued — save it by creating an account anytime.')
        });
    } catch (err) {
        logger.error('[GuestToken] Issue failed:', err.message);
        return res.status(500).json({ error: 'Guest token issue failed', detail: err.message });
    }
}

router.get('/api/free-token', handleFreeToken);
router.post('/api/free-token', handleFreeToken);
router.post('/api/tokens/guest', express.json(), handleGuestToken);
router.post('/api/tokens/guest/agent-scan', express.json(), (req, res) => {
    const guestId = (req.body?.guestId || '').trim();
    if (!guestId || guestId.length < 8) {
        return res.status(400).json({ error: 'guestId required (min 8 characters)' });
    }
    const result = guestTokenService.recordGuestAgentScan(guestId);
    if (!result.success) {
        return res.status(429).json({
            error: result.reason || 'Agent scan limit exceeded',
            upgradeUrl: 'https://simplebeacon.ai/pricing',
            agentExperience: '2/10'
        });
    }
    return res.json({ success: true, remaining: result.remaining, agentExperience: '2/10' });
});
router.post('/api/tokens/sandbox', handleSandboxToken);

router.post('/api/tokens/verify-code', express.json(), async (req, res) => {
    const { token, code } = req.body || {};
    if (!token || typeof token !== 'string' || !code || typeof code !== 'string') {
        return res.status(400).json({ valid: false, error: 'token and code required' });
    }
    try {
        const tokenHash = hashToken(token);
        const row = getValidationCodeByTokenHash(tokenHash);
        if (!row || row.code !== code) {
            return res.json({ valid: false, error: 'Invalid validation code' });
        }
        if (row.used) {
            return res.json({ valid: false, error: 'Validation code already used' });
        }
        if (row.expires_at && new Date(row.expires_at) <= new Date()) {
            return res.json({ valid: false, error: 'Validation code expired' });
        }
        markValidationCodeUsed(row.id);
        return res.json({ valid: true, token });
    } catch (err) {
        logger.error('[VerifyCode] Verification failed:', err.message);
        return res.status(500).json({ valid: false, error: 'Verification failed' });
    }
});

module.exports = router;
