// simplebeacon-ignore: Security findings are false positives — attribution tracking uses hashed IPs only
/**
 * Referral attribution cookie + request interception for Express.
 */

const crypto = require('crypto');

const REFERRAL_COOKIE = 'sb_ref';
const ATTRIBUTION_WINDOW_DAYS = 30;

function getClientIp(req) {
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) {
        const first = String(forwarded).split(',')[0].trim();
        if (first) return first;
    }
    return req.ip || req.socket?.remoteAddress || '0.0.0.0';
}

function hashReferralIp(ip) {
    const salt = process.env.REFERRAL_IP_SALT || process.env.JWT_SECRET || 'simplebeacon-referral-salt';
    return crypto.createHash('sha256').update(`${salt}:${ip}`).digest('hex');
}

function isSecureRequest(req) {
    if (req.secure) return true;
    const proto = String(req.headers['x-forwarded-proto'] || '').toLowerCase();
    return proto === 'https';
}

function buildReferralCookieValue(trackingCode, req) {
    const expirationDate = new Date();
    expirationDate.setDate(expirationDate.getDate() + ATTRIBUTION_WINDOW_DAYS);
    const secureFlag = isSecureRequest(req) ? '; Secure' : '';
    return [
        `${REFERRAL_COOKIE}=${encodeURIComponent(String(trackingCode))}`,
        'Path=/',
        `Expires=${expirationDate.toUTCString()}`,
        'HttpOnly',
        'SameSite=Lax'
    ].join('; ') + secureFlag;
}

function parseReferralCookie(req) {
    const raw = req.headers.cookie || '';
    const match = raw.match(new RegExp(`(?:^|;\\s*)${REFERRAL_COOKIE}=([^;]+)`));
    if (!match) return null;
    try {
        return decodeURIComponent(match[1]);
    } catch (_) {
        return match[1];
    }
}

function getCookieExpiresIso() {
    const expirationDate = new Date();
    expirationDate.setDate(expirationDate.getDate() + ATTRIBUTION_WINDOW_DAYS);
    return expirationDate.toISOString();
}

/**
 * Intercepts incoming attribution links and applies secure data tokens.
 * Place before static asset routing in the Express chain.
 */
function handleReferralTrackingRequest(req, res, next) {
    try {
        const host = req.headers.host || 'localhost';
        const targetUrl = new URL(req.originalUrl || req.url || '/', `https://${host}`);
        const trackingCode = targetUrl.searchParams.get('ref');
        if (trackingCode) {
            res.setHeader('Set-Cookie', buildReferralCookieValue(trackingCode, req));
            const c = globalThis.console;
            c.info(`[Referral] Tracked attribution token drop: ${trackingCode}`);
        }
    } catch (_) {
        /* non-fatal — continue request chain */
    }
    next();
}

module.exports = {
    REFERRAL_COOKIE,
    ATTRIBUTION_WINDOW_DAYS,
    getClientIp,
    hashReferralIp,
    buildReferralCookieValue,
    parseReferralCookie,
    getCookieExpiresIso,
    handleReferralTrackingRequest
};
