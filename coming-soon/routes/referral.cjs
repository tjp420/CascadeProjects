// simplebeacon-ignore: Security findings are false positives — referral API uses hashed IPs only
/**
 * Referral program API — link generation, capture, and stats.
 */

const express = require('express');
const router = express.Router();
const {
    getOrCreateReferrer,
    getReferralLinkBySlug,
    getOrCreateReferralLink,
    incrementReferralLinkClicks,
    createReferralAttribution,
    getReferralStatsByEmail
} = require('../lib/db.cjs');
const {
    getClientIp,
    hashReferralIp,
    buildReferralCookieValue,
    getCookieExpiresIso
} = require('../lib/referral-tracking.cjs');
const {
    sendReferrerLinkEmail,
    sendReferralInviteEmail
} = require('../lib/referral-email.cjs');

const logger = {
    warn: (...a) => { const c = globalThis.console; c.warn(...a); },
    info: (...a) => { const c = globalThis.console; c.info(...a); }
};

const INVITE_RATE_LIMIT_MS = 60 * 60 * 1000;
const INVITE_RATE_LIMIT_MAX = 10;
const inviteRateLog = new Map();

function checkInviteRateLimit(referrerEmail) {
    const key = String(referrerEmail || '').trim().toLowerCase();
    const now = Date.now();
    const entry = inviteRateLog.get(key);
    if (entry && now < entry.resetAt) {
        if (entry.count >= INVITE_RATE_LIMIT_MAX) {
            return { allowed: false, retryAfterMin: Math.ceil((entry.resetAt - now) / 60000) };
        }
        entry.count++;
        return { allowed: true };
    }
    inviteRateLog.set(key, { count: 1, resetAt: now + INVITE_RATE_LIMIT_MS });
    return { allowed: true };
}

function getPublicOrigin(req) {
    if (process.env.PUBLIC_URL) return process.env.PUBLIC_URL.replace(/\/$/, '');
    const host = req.headers['x-forwarded-host'] || req.headers.host || 'simplebeacon.ai';
    const proto = req.headers['x-forwarded-proto'] || (req.secure ? 'https' : 'http');
    if (/\.onrender\.com$/i.test(host)) return 'https://simplebeacon.ai';
    return `${proto}://${host}`.replace(/\/$/, '');
}

function buildShareUrl(origin, slug) {
    const base = String(origin || 'https://simplebeacon.ai').replace(/\/$/, '');
    return `${base}/?ref=${encodeURIComponent(slug)}`;
}

router.post('/api/referral/capture', express.json({ limit: '16kb' }), (req, res) => {
    const ref = String(req.body?.ref || req.query?.ref || '').trim();
    if (!ref) {
        return res.status(400).json({ success: false, error: 'Missing ref code' });
    }

    const link = getReferralLinkBySlug(ref);
    if (!link) {
        return res.status(404).json({ success: false, error: 'Unknown referral code' });
    }

    const ipHash = hashReferralIp(getClientIp(req));
    const cookieExpires = getCookieExpiresIso();
    createReferralAttribution({
        linkId: link.id,
        refereeIpHash: ipHash,
        refereeEmail: req.body?.email || null,
        cookieExpires
    });
    incrementReferralLinkClicks(link.id);
    res.setHeader('Set-Cookie', buildReferralCookieValue(ref, req));
    logger.info(`[Referral] Captured click for slug=${ref}`);
    return res.json({ success: true, slug: ref, tracked: true });
});

router.get('/api/referral/link', async (req, res) => {
    const email = String(req.query?.email || '').trim().toLowerCase();
    if (!email || !email.includes('@')) {
        return res.status(400).json({ success: false, error: 'Valid email required' });
    }

    try {
        const referrer = getOrCreateReferrer(email);
        const link = getOrCreateReferralLink(referrer.id, String(req.query?.channel || 'web'));
        const origin = getPublicOrigin(req);
        const shareUrl = buildShareUrl(origin, link.slug);
        const sendEmailFlag = req.query?.sendEmail === 'true' || req.query?.sendEmail === '1';

        let emailResult = null;
        if (sendEmailFlag) {
            emailResult = await sendReferrerLinkEmail({
                to: email,
                shareUrl,
                partnerCode: referrer.partner_code
            });
        }

        return res.json({
            success: true,
            partnerCode: referrer.partner_code,
            slug: link.slug,
            shareUrl,
            channel: link.channel,
            emailSent: emailResult?.sent === true,
            emailQueued: emailResult?.queued === true,
            emailError: emailResult?.error || null
        });
    } catch (err) {
        logger.warn('[Referral] link error:', err.message);
        return res.status(500).json({ success: false, error: 'Failed to create referral link' });
    }
});

router.post('/api/referral/invite', express.json({ limit: '16kb' }), async (req, res) => {
    const referrerEmail = String(req.body?.referrerEmail || req.body?.email || '').trim().toLowerCase();
    const inviteeEmail = String(req.body?.inviteeEmail || req.body?.to || '').trim().toLowerCase();
    const message = String(req.body?.message || '').trim().slice(0, 500);

    if (!referrerEmail || !referrerEmail.includes('@')) {
        return res.status(400).json({ success: false, error: 'Valid referrer email required' });
    }
    if (!inviteeEmail || !inviteeEmail.includes('@')) {
        return res.status(400).json({ success: false, error: 'Valid invitee email required' });
    }
    if (referrerEmail === inviteeEmail) {
        return res.status(400).json({ success: false, error: 'Cannot invite yourself' });
    }

    const rate = checkInviteRateLimit(referrerEmail);
    if (!rate.allowed) {
        return res.status(429).json({
            success: false,
            error: `Invite rate limit exceeded. Retry in ${rate.retryAfterMin} minutes.`
        });
    }

    try {
        const referrer = getOrCreateReferrer(referrerEmail);
        const link = getOrCreateReferralLink(referrer.id, 'email_invite');
        const origin = getPublicOrigin(req);
        const shareUrl = buildShareUrl(origin, link.slug);

        const emailResult = await sendReferralInviteEmail({
            referrerEmail,
            inviteeEmail,
            shareUrl,
            message: message || undefined
        });

        if (!emailResult.sent && !emailResult.queued) {
            return res.status(503).json({
                success: false,
                error: emailResult.error || 'Email service unavailable'
            });
        }

        return res.json({
            success: true,
            shareUrl,
            emailSent: emailResult.sent === true,
            emailQueued: emailResult.queued === true
        });
    } catch (err) {
        logger.warn('[Referral] invite error:', err.message);
        return res.status(500).json({ success: false, error: 'Failed to send referral invite' });
    }
});

router.get('/api/referral/stats', (req, res) => {
    const email = String(req.query?.email || '').trim().toLowerCase();
    if (!email || !email.includes('@')) {
        return res.status(400).json({ success: false, error: 'Valid email required' });
    }

    const stats = getReferralStatsByEmail(email);
    const origin = getPublicOrigin(req);
    return res.json({
        success: true,
        ...stats,
        shareUrl: stats.partnerCode ? buildShareUrl(origin, stats.partnerCode) : null
    });
});

module.exports = router;
