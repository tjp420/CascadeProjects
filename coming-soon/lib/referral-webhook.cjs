// simplebeacon-ignore: Security findings are false positives — referral webhook uses hashed attribution IDs only
/**
 * Stripe checkout referral attribution bridge.
 * Resolves sb_ref / metadata attribution IDs and grants ledger rewards on paid conversion.
 */

const {
    getReferralAttributionById,
    getLatestOpenReferralAttribution,
    markReferralAttributionConverted,
    markReferralAttributionSignedUp,
    grantReferralReward,
    getReferrerById
} = require('./db.cjs');
const { parseReferralCookie } = require('./referral-tracking.cjs');
const { sendReferralConversionEmail, sendRefereeWelcomeEmail } = require('./referral-email.cjs');

const DEFAULT_CERT_CREDIT_CENTS = 4900;

const logger = {
    info: (...a) => {
        const c = globalThis.console;
        c.info(...a);
    },
    warn: (...a) => {
        const c = globalThis.console;
        c.warn(...a);
    }
};

function normalizeEmail(value) {
    return String(value || '')
        .trim()
        .toLowerCase();
}

function resolveReferralAttributionFromSession(session) {
    const meta = session?.metadata || {};
    const attributionId = meta.referral_attribution_id || meta.referralAttributionId || '';
    if (attributionId) {
        const row = getReferralAttributionById(attributionId);
        if (row && ['clicked', 'signed_up'].includes(row.status)) return row;
    }

    const slug = meta.referral_slug || meta.sb_ref || meta.ref || '';
    const email = normalizeEmail(meta.email || session.customer_details?.email || session.customer_email || '');
    if (slug) {
        return getLatestOpenReferralAttribution(slug, email || null);
    }
    return null;
}

/**
 * Build Stripe Checkout metadata from sb_ref cookie or explicit client slug.
 */
function buildReferralCheckoutMetadata(req, body) {
    const slug = String(
        body?.referralSlug || body?.referral_slug || body?.sb_ref || parseReferralCookie(req) || ''
    ).trim();
    if (!slug) return {};

    const email = normalizeEmail(body?.email || '');
    const attribution = getLatestOpenReferralAttribution(slug, email || null);
    const metadata = {
        referral_slug: slug.slice(0, 200),
        sb_ref: slug.slice(0, 200)
    };
    if (attribution?.id) {
        metadata.referral_attribution_id = attribution.id;
    }
    return metadata;
}

/**
 * Advance an open attribution to signed_up when a referee creates an account.
 */
function processReferralSignup(req, email) {
    const slug = parseReferralCookie(req);
    if (!slug) return null;

    const normalizedEmail = normalizeEmail(email);
    const attribution = getLatestOpenReferralAttribution(slug, normalizedEmail);
    if (!attribution) return null;

    markReferralAttributionSignedUp(attribution.id, normalizedEmail);
    logger.info(`[Referral] Signed up attribution=${attribution.id} slug=${slug}`);

    sendRefereeWelcomeEmail({ to: normalizedEmail }).catch(err => {
        logger.warn('[Referral] Referee welcome email failed:', err.message);
    });

    return attribution.id;
}

/**
 * Stripe Billing Checkout Webhook Route Extension Handler.
 * Call after checkout.session.completed with payment_status === 'paid'.
 */
function processStripeReferralAttribution(session, options = {}) {
    const rewardValue = Number(options.rewardValue) || DEFAULT_CERT_CREDIT_CENTS;
    const rewardType = options.rewardType || 'cert_credit';
    const refereeEmail = normalizeEmail(
        session?.metadata?.email || session?.customer_details?.email || session?.customer_email || ''
    );

    const attribution = resolveReferralAttributionFromSession(session);
    if (!attribution) {
        logger.info('[Referral] Stripe webhook: standard transaction without referral attributes.');
        return { converted: false, reason: 'no_attribution' };
    }

    const converted = markReferralAttributionConverted(attribution.id, refereeEmail || null);
    if (!converted) {
        logger.warn(`[Referral] Attribution ${attribution.id} could not be converted (already converted or missing).`);
        return { converted: false, reason: 'not_convertible', attributionId: attribution.id };
    }

    const reward = grantReferralReward({
        attributionId: attribution.id,
        referrerId: attribution.referrer_id,
        rewardType,
        rewardValue
    });

    logger.info(
        `[Referral] Conversion recorded attribution=${attribution.id} referrer=${attribution.referrer_id} reward=${reward?.id || 'duplicate'}`
    );

    const referrer = getReferrerById(attribution.referrer_id);
    if (referrer?.user_email) {
        sendReferralConversionEmail({
            referrerEmail: referrer.user_email,
            refereeEmail: refereeEmail || null,
            rewardValueCents: rewardValue
        }).catch(err => {
            logger.warn('[Referral] Conversion email failed:', err.message);
        });
    }

    return {
        converted: true,
        attributionId: attribution.id,
        referrerId: attribution.referrer_id,
        refereeEmail: refereeEmail || null,
        rewardId: reward?.id || null,
        rewardValue
    };
}

module.exports = {
    DEFAULT_CERT_CREDIT_CENTS,
    buildReferralCheckoutMetadata,
    processReferralSignup,
    processStripeReferralAttribution,
    resolveReferralAttributionFromSession
};
