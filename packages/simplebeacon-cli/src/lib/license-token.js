/**
 * Decentralized license token engine for the $499 Executive PDF pipeline.
 *
 * The server signs a short-lived JWT after Stripe payment confirmation.
 * The CLI validates it locally — no network call required — and compiles
 * the PDF entirely on the developer's machine.
 *
 * Guarantees:
 *   - Server never sees scan data
 *   - Token is single-use and time-bound
 *   - Validation is purely local (shared secret)
 */

const crypto = require('crypto');

const ALG = 'HS256';
const TYP = 'JWT';

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
    const now = Math.floor(Date.now() / 1000);
    const payload = {
        iss: 'simplebeacon.ai',
        aud: 'simplebeacon-cli',
        sub: claims.email || 'unknown',
        tier: claims.tier || 'executive',
        features: claims.features || ['pdf-generation'],
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
        try {
            if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
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
    try {
        if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
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

    const os = require('os');
    const fs = require('fs');
    const homePath = path.join(os.homedir(), '.simplebeacon', 'license.jwt');
    try {
        return fs.readFileSync(homePath, 'utf8').trim();
    } catch {
        return null;
    }
}

function verifyLicenseToken(token, secret) {
    const result = validateLicenseToken(token, secret);
    return result.valid ? result.claims : null;
}

module.exports = {
    generateLicenseToken,
    validateLicenseToken,
    verifyLicenseToken,
    hasValidLicense,
    resolveLicenseToken
};
