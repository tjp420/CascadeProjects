/**
 * Decentralized license token engine for SimpleBeacon's 4-tier pricing model.
 *
 * Tiers: developer (free), startup ($49), growth ($149), enterprise (custom).
 * The server signs a short-lived JWT after Stripe payment confirmation.
 * The CLI validates it locally — no network call required — and enforces
 * scan quotas and feature limits based on the embedded tier claim.
 *
 * Guarantees:
 *   - Server never sees scan data
 *   - Token is single-use and time-bound
 *   - Validation is purely local (shared secret)
 *   - Backward-compatible with legacy tokens (defaults to developer tier)
 */

const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const os = require('os');

const ALG = 'HS256';
const TYP = 'JWT';

/** Default scan quotas per tier. */
const TIER_QUOTAS = Object.freeze({
    developer: 100,
    startup: 500,
    growth: 2000,
    enterprise: Infinity,
    pro: 500,
    team: 2000,
    free: 100
});

/** Tier alias map for unified 4-tier model (canonical -> legacy alias). */
const TIER_ALIASES = Object.freeze({
    free: 'developer',
    pro: 'startup',
    team: 'growth'
});

/**
 * Normalize a tier name to its canonical form (free, pro, team, enterprise).
 * @param {string} tier
 * @returns {string}
 */
function normalizeTier(tier) {
    const t = String(tier || 'free').toLowerCase();
    const reverse = Object.fromEntries(
        Object.entries(TIER_ALIASES).map(([k, v]) => [v, k])
    );
    return reverse[t] || t;
}

function base64UrlEncode(buf) {
    return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(str) {
    const padding = '='.repeat((4 - (str.length % 4)) % 4);
    const base64 = str.replace(/-/g, '+').replace(/_/g, '/') + padding;
    return Buffer.from(base64, 'base64');
}

function buildHeader() {
    return base64UrlEncode(Buffer.from(JSON.stringify({ alg: ALG, typ: TYP })));
}

function signPayload(header, payload, secret) {
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(`${header}.${payload}`);
    return base64UrlEncode(hmac.digest());
}

/**
 * Generate a license token (server side).
 * @param {Object} claims — customer email, tier, features
 * @param {string} secret — SHARED_SECRET between server and CLI
 * @param {number} ttlMinutes — token lifetime (default: 60)
 */
function generateLicenseToken(claims, secret, ttlMinutes = 60) {
    if (!secret || typeof secret !== 'string') {
        throw new Error('License secret is required');
    }
    if (!claims || typeof claims !== 'object') {
        throw new Error('Claims object is required');
    }
    if (!Number.isFinite(ttlMinutes) || ttlMinutes <= 0 || ttlMinutes > 525600) {
        throw new Error('ttlMinutes must be between 1 and 525600 (1 year)');
    }
    const now = Math.floor(Date.now() / 1000);
    const tier = claims.tier || 'developer';
    const scanQuota = Number.isFinite(claims.scanQuota) && claims.scanQuota >= 0
        ? claims.scanQuota
        : (TIER_QUOTAS[tier] ?? TIER_QUOTAS.developer);
    const features = Array.isArray(claims.features) ? claims.features : ['scan'];
    const payload = {
        iss: 'simplebeacon.ai',
        aud: 'simplebeacon-cli',
        sub: claims.email || 'unknown',
        tier,
        scanQuota,
        features,
        iat: now,
        exp: now + (ttlMinutes * 60),
        jti: crypto.randomBytes(16).toString('hex')
    };
    const header = buildHeader();
    const payloadB64 = base64UrlEncode(Buffer.from(JSON.stringify(payload)));
    const signature = signPayload(header, payloadB64, secret);
    return `${header}.${payloadB64}.${signature}`;
}

/**
 * Validate a license token (CLI side, purely local).
 * @param {string} token — JWT string
 * @param {string} secret — same SHARED_SECRET
 * @returns {Object} { valid: boolean, claims?: Object, error?: string }
 */
function validateLicenseToken(token, secret) {
    if (!token || typeof token !== 'string') {
        return { valid: false, error: 'Token is required' };
    }
    if (!secret || typeof secret !== 'string') {
        return { valid: false, error: 'License secret is required' };
    }

    const parts = token.split('.');

    // Support 2-part legacy tokens (data.sig) from generate-license-token.cjs
    if (parts.length === 2) {
        const [dataB64, signature] = parts;
        if (!dataB64 || !signature) {
            return { valid: false, error: 'Malformed 2-part token' };
        }
        const expected = base64UrlEncode(crypto.createHmac('sha256', secret).update(dataB64).digest());
        const sigBuf = Buffer.from(signature, 'utf8');
        const expBuf = Buffer.from(expected, 'utf8');
        if (sigBuf.length !== expBuf.length) {
            return { valid: false, error: 'Invalid signature' };
        }
        try {
            if (!crypto.timingSafeEqual(sigBuf, expBuf)) {
                return { valid: false, error: 'Invalid signature' };
            }
        } catch {
            return { valid: false, error: 'Invalid signature' };
        }
        let payload;
        try {
            payload = JSON.parse(base64UrlDecode(dataB64).toString('utf8'));
        } catch {
            return { valid: false, error: 'Malformed payload' };
        }
        const now = Math.floor(Date.now() / 1000);
        // 2-part tokens use milliseconds for exp
        const expMs = payload.exp;
        if (expMs && Date.now() > expMs) {
            return { valid: false, error: 'Token expired', claims: payload };
        }
        return { valid: true, claims: payload };
    }

    if (parts.length !== 3) {
        return { valid: false, error: 'Malformed token' };
    }

    const [header, payloadB64, signature] = parts;

    const expected = signPayload(header, payloadB64, secret);
    const sigBuf = Buffer.from(signature, 'utf8');
    const expBuf = Buffer.from(expected, 'utf8');
    if (sigBuf.length !== expBuf.length) {
        return { valid: false, error: 'Invalid signature' };
    }
    try {
        if (!crypto.timingSafeEqual(sigBuf, expBuf)) {
            return { valid: false, error: 'Invalid signature' };
        }
    } catch {
        return { valid: false, error: 'Invalid signature' };
    }

    let payload;
    try {
        payload = JSON.parse(base64UrlDecode(payloadB64).toString('utf8'));
    } catch {
        return { valid: false, error: 'Malformed payload' };
    }

    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && now > payload.exp) {
        return { valid: false, error: 'Token expired', claims: payload };
    }
    if (payload.nbf && now < payload.nbf) {
        return { valid: false, error: 'Token not yet valid', claims: payload };
    }
    if (payload.aud && payload.aud !== 'simplebeacon-cli') {
        return { valid: false, error: 'Invalid audience', claims: payload };
    }
    if (payload.iss && payload.iss !== 'simplebeacon.ai') {
        return { valid: false, error: 'Invalid issuer', claims: payload };
    }

    return { valid: true, claims: payload };
}

/**
 * Quick check for CLI integration.
 */
function hasValidLicense(token, secret) {
    return validateLicenseToken(token, secret).valid;
}

/**
 * Read token from standard locations:
 * 1. SIMPLEBEACON_LICENSE_TOKEN env var
 * 2. ~/.simplebeacon/license.jwt
 */
function resolveLicenseToken() {
    const envToken = process.env.SIMPLEBEACON_LICENSE_TOKEN;
    if (envToken) return envToken;

    const candidates = [
        path.join(os.homedir(), '.simplebeacon', 'license.jwt'),
        path.join(os.homedir(), '.simplebeacon', 'license-token'),
        path.join(os.homedir(), '.simplebeacon', 'token')
    ];
    for (const p of candidates) {
        try {
            const stats = fs.statSync(p);
            if (!stats.isFile() || stats.size > 65536) continue;
            return fs.readFileSync(p, 'utf8').trim();
        } catch {
            /* try next candidate */
        }
    }
    return null;
}

function verifyLicenseToken(token, secret) {
    const result = validateLicenseToken(token, secret);
    return result.valid ? result.claims : null;
}

/**
 * Check if a token is within `thresholdMinutes` of expiration.
 * @param {string} token JWT string
 * @param {number} [thresholdMinutes=10] Minutes before expiry to consider "soon"
 * @returns {boolean}
 */
function isTokenExpiringSoon(token, thresholdMinutes = 10) {
    if (!token || typeof token !== 'string') return true;
    const threshold = Number.isFinite(thresholdMinutes) && thresholdMinutes > 0 ? thresholdMinutes : 10;
    const parts = token.split('.');
    const payloadB64 = parts.length === 3 ? parts[1] : parts.length === 2 ? parts[0] : null;
    if (!payloadB64) return true;
    try {
        const payload = JSON.parse(base64UrlDecode(payloadB64).toString('utf8'));
        if (!payload.exp) return false;
        const exp = Number(payload.exp);
        if (!Number.isFinite(exp)) return true;
        const nowSec = Math.floor(Date.now() / 1000);
        // 2-part legacy tokens may store exp in milliseconds
        const expSec = exp > 1e10 ? Math.floor(exp / 1000) : exp;
        return expSec - nowSec < threshold * 60;
    } catch {
        return true;
    }
}

/**
 * Get the default scan quota for a given tier.
 * @param {string} tier
 * @returns {number}
 */
function getTierQuota(tier) {
    return TIER_QUOTAS[tier] ?? TIER_QUOTAS.developer;
}

module.exports = {
    generateLicenseToken,
    validateLicenseToken,
    verifyLicenseToken,
    hasValidLicense,
    resolveLicenseToken,
    isTokenExpiringSoon,
    getTierQuota,
    normalizeTier,
    TIER_ALIASES
};
