/**
 * Subscription billing routes for Continuous Shield ($1,499/mo recurring).
 */

'use strict';

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const db = require('../lib/db.cjs');
const { captureException: sentryCapture } = require('../lib/sentry.cjs');
const { buildReferralCheckoutMetadata, processStripeReferralAttribution } = require('../lib/referral-webhook.cjs');

let stripe = null;
try {
    stripe = require('stripe')(process.env.STRIPE_SECRET_KEY || '');
} catch {
    stripe = null;
}

const DEFAULT_PORT = 3001;
const PUBLIC_URL = process.env.PUBLIC_URL || 'http://' + 'localhost' + ':' + (process.env.PORT || DEFAULT_PORT);
// DASHBOARD_URL is the public-facing dashboard URL for email links (must be reachable from the user's browser).
// Falls back to the production dashboard — never localhost, since users open these links on their own machines.
const DASHBOARD_URL = process.env.DASHBOARD_URL || 'https://simplebeacon.ai/dashboard/';
const SUBSCRIPTION_WEBHOOK_SOURCE = 'subscription-webhook';

const PRICE_PRO_MONTHLY = 900;
const PRICE_PRO_ANNUAL = 9000;
const PRICE_COMPLIANCE_MONTHLY = 39900;
const PRICE_COMPLIANCE_ANNUAL = 399000;
const PRICE_TEAM_MONTHLY = 9900;
const PRICE_TEAM_ANNUAL = 99000;
const PRICE_ENTERPRISE_MONTHLY = 49900;
const PRICE_ENTERPRISE_ANNUAL = 499000;
const PRICE_DEVELOPER_MONTHLY = 4900;
const PRICE_DEVELOPER_ANNUAL = 49000;
const PRICE_EARLY_ACCESS_MONTHLY = 2900;   // $29/mo — Beta Price Lock (40% off Developer)
const PRICE_EARLY_ACCESS_ANNUAL = 29000;   // $290/yr — Beta Price Lock annual
const PRICE_TEAM_PRO_MONTHLY = 14900;
const PRICE_TEAM_PRO_ANNUAL = 149000;
const PRICE_EXTRA_SEAT_MONTHLY = 1500;
const PRICE_EXTRA_SEAT_ANNUAL = 15000;

// One-time purchase prices (no recurring billing)
const PRICE_ONE_TIME_CERTIFICATE = 14900;   // $149 one-time
const PRICE_EXECUTIVE_CLEARANCE = 49900;     // $499 one-time
const PRICE_EU_AI_ACT_SPRINT = 249900;       // $2,499 one-time

const logger = {
    error: (...a) => {
        const c = globalThis.console;
        c.error(...a);
    },
    info: (...a) => {
        const c = globalThis.console;
        c.log(...a);
    },
    warn: (...a) => {
        const c = globalThis.console;
        c.warn(...a);
    }
};

const { generateLicenseToken } = require('../lib/license-utils.cjs');

// Rate limiter: max 3 subscription checkout attempts per IP per hour
const SUB_CHECKOUT_RATE_LIMIT_MS = 60 * 60 * 1000;
const SUB_CHECKOUT_RATE_LIMIT_MAX = 3;
const subCheckoutRateLog = new Map();

// Webhook rate limiter: generous limit for Stripe callbacks (max 30 per minute per IP)
const WEBHOOK_RATE_LIMIT_MS = 60 * 1000;
const WEBHOOK_RATE_LIMIT_MAX = 30;
const webhookRateLog = new Map();

// Create a Stripe Checkout Session for Continuous Shield subscription
router.post('/api/create-subscription-session', async (req, res) => {
    try {
        if (!stripe) {
            return res.status(503).json({ error: 'Stripe is not configured. Set STRIPE_SECRET_KEY.' });
        }

        const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
        const now = Date.now();
        const entry = subCheckoutRateLog.get(clientIp);
        if (entry && now < entry.resetAt) {
            if (entry.count >= SUB_CHECKOUT_RATE_LIMIT_MAX) {
                return res.status(429).json({ error: 'Too many subscription requests. Please try again later.' });
            }
            entry.count++;
        } else {
            subCheckoutRateLog.set(clientIp, { count: 1, resetAt: now + SUB_CHECKOUT_RATE_LIMIT_MS });
        }

        const { email, projectName, clientName, tier, mode, extraSeats } = req.body;
        if (!email || !projectName) {
            return res.status(400).json({ error: 'Email and project name are required.' });
        }

        // Validate email format
        const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!EMAIL_RE.test(String(email))) {
            return res.status(400).json({ error: 'A valid email address is required.' });
        }

        // Sanitize string inputs: strip control characters, enforce length
        function sanitize(str, maxLen) {
            return String(str || '')
                .replace(/[\x00-\x1F\x7F]/g, '')
                .trim()
                .slice(0, maxLen);
        }
        const cleanProjectName = sanitize(projectName, 200);
        const cleanClientName = sanitize(clientName || email, 200);
        const cleanEmail = sanitize(email, 254);

        if (!cleanProjectName) {
            return res.status(400).json({ error: 'Project name must not be empty.' });
        }

        // Validate extraSeats for team_pro tier
        const seatCount =
            tier === 'team_pro' && extraSeats ? Math.max(0, Math.min(50, parseInt(extraSeats, 10) || 0)) : 0;

        const tierConfig = {
            developer: {
                name: 'SimpleBeacon Developer',
                desc: 'SimpleBeacon Developer — unlimited scans, CI gate, 48 analyzer modules',
                monthly: PRICE_DEVELOPER_MONTHLY,
                annual: PRICE_DEVELOPER_ANNUAL
            },
            early_access: {
                name: 'SimpleBeacon Early Access (Beta Price Lock)',
                desc: 'SimpleBeacon Early Access — Beta Price Lock: full Developer + Team Pro features at 40% off. Grandfathered for life.',
                monthly: PRICE_EARLY_ACCESS_MONTHLY,
                annual: PRICE_EARLY_ACCESS_ANNUAL
            },
            team_pro: {
                name: 'SimpleBeacon Team Pro',
                desc: 'SimpleBeacon Team Pro — EU AI Act, SOC 2, board-ready certificates, 5 seats',
                monthly: PRICE_TEAM_PRO_MONTHLY,
                annual: PRICE_TEAM_PRO_ANNUAL
            },
            pro: {
                name: 'AI Slop Cop Pro',
                desc: 'SimpleBeacon Pro — unlimited scans, CI/CD, and 48 analyzer engines',
                monthly: PRICE_PRO_MONTHLY,
                annual: PRICE_PRO_ANNUAL
            },
            compliance: {
                name: 'Compliance Suite',
                desc: 'SimpleBeacon Compliance Suite — EU AI Act, SOC 2, quarterly certs, analyst support',
                monthly: PRICE_COMPLIANCE_MONTHLY,
                annual: PRICE_COMPLIANCE_ANNUAL
            },
            team: {
                name: 'SimpleBeacon Agency Reputation Suite',
                desc: 'SimpleBeacon Agency Reputation Suite — unlimited repos, devs, and scans',
                monthly: PRICE_TEAM_MONTHLY,
                annual: PRICE_TEAM_ANNUAL
            },
            enterprise: {
                name: 'Compliance Suite Enterprise',
                desc: 'SimpleBeacon Enterprise — EU AI Act, quarterly certs, analyst support',
                monthly: PRICE_ENTERPRISE_MONTHLY,
                annual: PRICE_ENTERPRISE_ANNUAL
            },
            one_time_certificate: {
                name: 'Audit Certificate',
                desc: 'SimpleBeacon Audit Certificate — 1 board-ready certificate, PDF + JSON + remediation roadmap, EU AI Act + SOC 2 alignment. Valid for 12 months.',
                oneTime: PRICE_ONE_TIME_CERTIFICATE,
                displayPrice: '$149 one-time'
            },
            executive_clearance: {
                name: 'Executive Risk Certificate',
                desc: 'SimpleBeacon Executive Risk Certificate — signed certificate, A–F hygiene grade + liability estimate, remediation checklist + evidence pack. Valid for 90 days.',
                oneTime: PRICE_EXECUTIVE_CLEARANCE,
                displayPrice: '$499 one-time'
            },
            eu_ai_act_sprint: {
                name: 'EU AI Act Sprint',
                desc: 'SimpleBeacon EU AI Act Sprint — readiness audit, Annex III + Article 14 + Article 50 checks, verified evidence pack, 30-day analyst support.',
                oneTime: PRICE_EU_AI_ACT_SPRINT,
                displayPrice: '$2,499 one-time'
            }
        };

        const selectedTier = tierConfig[tier] || tierConfig.developer;
        const isOneTime = !!selectedTier.oneTime;
        const isAnnual = mode === 'annual';
        const unitAmount = isOneTime ? selectedTier.oneTime : (isAnnual ? selectedTier.annual : selectedTier.monthly);
        const checkoutMode = isOneTime ? 'payment' : 'subscription';
        const displayPrice = isOneTime
            ? selectedTier.displayPrice
            : isAnnual
                ? tier === 'enterprise'
                    ? '$4,990/yr'
                    : tier === 'compliance'
                      ? '$3,990/yr'
                      : tier === 'team_pro'
                        ? '$1,490/yr'
                        : tier === 'team'
                          ? '$990/yr'
                          : tier === 'pro'
                            ? '$90/yr'
                            : tier === 'developer'
                              ? '$490/yr'
                              : '$490/yr'
                : tier === 'enterprise'
                  ? '$499/mo'
                  : tier === 'compliance'
                    ? '$399/mo'
                    : tier === 'team_pro'
                      ? '$149/mo'
                      : tier === 'team'
                        ? '$99/mo'
                        : tier === 'pro'
                          ? '$9/mo'
                          : tier === 'developer'
                            ? '$49/mo'
                            : '$49/mo';

        // Get or create customer in DB
        const db = require('../lib/db.cjs');
        const customer = db.getOrCreateCustomer(cleanEmail);

        // Update customer tier so webhook knows which license to generate
        db.updateCustomerSubscription(cleanEmail, customer.subscription_status || 'inactive', tier);

        // Use existing Stripe customer ID or create new
        let stripeCustomerId = customer.stripe_customer_id;
        if (!stripeCustomerId) {
            const stripeCustomer = await stripe.customers.create({
                email: cleanEmail,
                name: cleanClientName,
                metadata: { projectName: cleanProjectName, tier: tier }
            });
            stripeCustomerId = stripeCustomer.id;
            db.updateCustomerStripeId(cleanEmail, stripeCustomerId);
        }

        const successUrl = `${PUBLIC_URL}/dashboard/#/license-manager?checkout=success&session_id={CHECKOUT_SESSION_ID}`;
        const cancelUrl = `${PUBLIC_URL}/pricing.html?canceled=true`;
        const referralMetadata = buildReferralCheckoutMetadata(req, req.body);

        // Build line items: base subscription or one-time payment + optional extra seat add-on
        const lineItems = [
            {
                price_data: {
                    currency: 'usd',
                    product_data: {
                        name: selectedTier.name,
                        description: selectedTier.desc + ' — ' + displayPrice
                    },
                    unit_amount: unitAmount,
                    ...(isOneTime ? {} : { recurring: { interval: isAnnual ? 'year' : 'month' } })
                },
                quantity: 1
            }
        ];

        if (seatCount > 0) {
            const seatUnitAmount = isAnnual ? PRICE_EXTRA_SEAT_ANNUAL : PRICE_EXTRA_SEAT_MONTHLY;
            const seatDisplayPrice = isAnnual ? '$150/yr' : '$15/mo';
            lineItems.push({
                price_data: {
                    currency: 'usd',
                    product_data: {
                        name: 'Extra Team Seat',
                        description:
                            'Additional seat beyond the 5 included in Team Pro — ' + seatDisplayPrice + ' per seat'
                    },
                    unit_amount: seatUnitAmount,
                    recurring: { interval: interval }
                },
                quantity: seatCount
            });
        }

        const session = await stripe.checkout.sessions.create({
            mode: checkoutMode,
            customer: stripeCustomerId,
            line_items: lineItems,
            success_url: successUrl,
            cancel_url: cancelUrl,
            metadata: {
                product: tier || 'continuous_shield',
                billing: isOneTime ? 'one-time' : (isAnnual ? 'annual' : 'monthly'),
                email: cleanEmail,
                projectName: cleanProjectName,
                clientName: cleanClientName,
                apiKey: customer.api_key,
                ...(seatCount > 0 ? { extraSeats: String(seatCount) } : {}),
                ...referralMetadata
            }
        });

        res.json({ success: true, url: session.url, sessionId: session.id });
    } catch (error) {
        logger.error('[CreateSubscriptionSession] Error:', error.message);
        sentryCapture(error, { endpoint: 'create-subscription-session' });
        res.status(500).json({ error: 'Failed to create subscription session.', message: error.message });
    }
});

// Team report upload endpoint — accepts scan summaries from CI/CD
router.post('/api/team/reports', async (req, res) => {
    try {
        const authHeader = req.headers.authorization || '';
        const apiKey = authHeader.replace(/^Bearer\s+/i, '');
        if (!apiKey) {
            return res.status(401).json({ error: 'Missing API key. Use Authorization: Bearer <api_key>' });
        }

        const db = require('../lib/db.cjs');
        const customer = db.getCustomerByApiKey(apiKey);
        if (!customer) {
            return res.status(401).json({ error: 'Invalid API key.' });
        }
        if (customer.subscription_status !== 'active') {
            return res.status(403).json({ error: 'Subscription inactive. Please renew your Continuous Shield plan.' });
        }

        const { projectName, reportSummary, timestamp } = req.body;
        if (!projectName || !reportSummary) {
            return res.status(400).json({ error: 'projectName and reportSummary are required.' });
        }

        // Store report summary in a simple in-memory log (for MVP; can upgrade to DB table)
        if (!global.teamReportLog) global.teamReportLog = [];
        global.teamReportLog.push({
            email: customer.email,
            apiKey: apiKey.slice(0, 8) + '...',
            projectName,
            reportSummary,
            timestamp: timestamp || new Date().toISOString(),
            receivedAt: new Date().toISOString()
        });
        // Keep only last 1000 entries
        if (global.teamReportLog.length > 1000) global.teamReportLog = global.teamReportLog.slice(-1000);

        res.json({ success: true, message: 'Report received.', entriesInQueue: global.teamReportLog.length });
    } catch (error) {
        logger.error('[TeamReports] Error:', error.message);
        res.status(500).json({ error: 'Failed to process report.', message: error.message });
    }
});

// Get team reports for a customer (dashboard endpoint)
router.get('/api/team/reports', async (req, res) => {
    try {
        const authHeader = req.headers.authorization || '';
        const apiKey = authHeader.replace(/^Bearer\s+/i, '');
        if (!apiKey) {
            return res.status(401).json({ error: 'Missing API key.' });
        }

        const db = require('../lib/db.cjs');
        const customer = db.getCustomerByApiKey(apiKey);
        if (!customer) {
            return res.status(401).json({ error: 'Invalid API key.' });
        }

        const logs = (global.teamReportLog || []).filter(r => r.email === customer.email);
        res.json({
            success: true,
            reports: logs.slice(-100),
            subscription: { status: customer.subscription_status, tier: customer.tier }
        });
    } catch (error) {
        logger.error('[TeamReportsGet] Error:', error.message);
        res.status(500).json({ error: 'Failed to retrieve reports.', message: error.message });
    }
});

// Subscription webhook handler (mounted alongside checkout webhook)
function setupSubscriptionWebhook(app) {
    app.post('/api/subscription/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
        // rateLimit applied
        // Apply rate limiting to webhooks (generous: 30/min per IP)
        const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
        const now = Date.now();
        const entry = webhookRateLog.get(clientIp);
        if (entry && now - entry.windowStart < WEBHOOK_RATE_LIMIT_MS) {
            if (entry.count >= WEBHOOK_RATE_LIMIT_MAX) {
                logger.error('[SubscriptionWebhook] Rate limit exceeded for IP:', clientIp);
                return res.status(429).send('Too Many Requests');
            }
            entry.count++;
        } else {
            webhookRateLog.set(clientIp, { count: 1, windowStart: now });
        }

        const sig = req.headers['stripe-signature'];
        const secret = process.env.STRIPE_WEBHOOK_SECRET;
        let event;
        try {
            if (!sig) {
                return res.status(400).send('Webhook Error: Missing Stripe signature');
            }
            if (!stripe || !secret) {
                return res.status(503).send('Webhook Error: Stripe webhook is not configured');
            }
            event = stripe.webhooks.constructEvent(req.body, sig, secret);
        } catch (err) {
            logger.error('[SubscriptionWebhook] Signature verification failed:', err.message);
            sentryCapture(err, { endpoint: 'subscription-webhook', stage: 'signature-verification' });
            return res.status(400).send('Webhook Error: ' + err.message);
        }

        const rawBodyBuffer = Buffer.isBuffer(req.body) ? req.body : Buffer.from(String(req.body || ''), 'utf8');
        const payloadHash = crypto.createHash('sha256').update(rawBodyBuffer).digest('hex');
        if (event && event.id) {
            const inserted = db.recordWebhookEvent(event.id, SUBSCRIPTION_WEBHOOK_SOURCE, event.type, payloadHash);
            if (!inserted) {
                return res.json({ received: true, duplicate: true });
            }
        }

        const allowedEvents = new Set([
            'checkout.session.completed',
            'customer.subscription.created',
            'customer.subscription.updated',
            'customer.subscription.deleted',
            'customer.subscription.paused',
            'customer.subscription.resumed',
            'invoice.paid',
            'invoice.payment_failed',
            'customer.subscription.trial_will_end',
            'charge.dispute.created',
            'charge.refunded',
            'invoice.upcoming'
        ]);
        if (!allowedEvents.has(event.type)) {
            return res.json({ received: true, ignored: true });
        }

        if (event.type === 'checkout.session.completed') {
            const session = event.data.object;
            if (
                session.mode === 'subscription' &&
                (session.payment_status === 'paid' || session.status === 'complete')
            ) {
                const customerId = session.customer;
                if (customerId) {
                    const customer = db
                        .getDb()
                        .prepare('SELECT * FROM customers WHERE stripe_customer_id = ?')
                        .get(customerId);
                    if (customer) {
                        db.updateCustomerSubscription(customer.email, 'active', customer.tier || 'team');
                        if (session.subscription) {
                            const existingSub = db
                                .getDb()
                                .prepare('SELECT * FROM paid_subscriptions WHERE stripe_subscription_id = ?')
                                .get(session.subscription);
                            if (existingSub) {
                                db.updatePaidSubscriptionStatus(session.subscription, 'active');
                            } else {
                                db.addPaidSubscription(
                                    customer.email,
                                    session.subscription,
                                    null,
                                    'active',
                                    null,
                                    null
                                );
                            }
                        }
                    }
                }
                try {
                    const referralResult = processStripeReferralAttribution(session);
                    if (referralResult.converted) {
                        logger.info(
                            '[SubscriptionWebhook] Referral conversion:',
                            referralResult.attributionId,
                            referralResult.rewardId
                        );
                    }
                } catch (referralErr) {
                    logger.error('[SubscriptionWebhook] Referral attribution failed:', referralErr.message);
                }
            }
        }

        if (event.type === 'customer.subscription.created' || event.type === 'customer.subscription.updated') {
            const sub = event.data.object;
            const customerId = sub.customer;
            const status = sub.status;
            const priceId = sub.items?.data?.[0]?.price?.id;
            const periodStart = sub.current_period_start
                ? new Date(sub.current_period_start * 1000).toISOString()
                : null;
            const periodEnd = sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null;

            const allCustomers = db
                .getDb()
                .prepare('SELECT * FROM customers WHERE stripe_customer_id = ?')
                .all(customerId);
            if (allCustomers.length === 0) {
                logger.error('[SubscriptionWebhook] Customer not found for stripe ID:', customerId);
                return res.json({ received: true, status: 'customer_not_found' });
            }
            const customer = allCustomers[0];

            // Infer tier from subscription amount using exact price matching
            // Using >= ranges breaks for annual prices (e.g. developer annual 49000 >= team_pro monthly 14900)
            const unitAmount = sub.items?.data?.[0]?.price?.unit_amount || 0;
            const interval = sub.items?.data?.[0]?.price?.recurring?.interval || 'month';
            const PRICE_TIER_MAP = {
                [PRICE_DEVELOPER_MONTHLY]: 'developer',
                [PRICE_DEVELOPER_ANNUAL]: 'developer',
                [PRICE_TEAM_PRO_MONTHLY]: 'team_pro',
                [PRICE_TEAM_PRO_ANNUAL]: 'team_pro',
                [PRICE_TEAM_MONTHLY]: 'team',
                [PRICE_TEAM_ANNUAL]: 'team',
                [PRICE_COMPLIANCE_MONTHLY]: 'compliance',
                [PRICE_COMPLIANCE_ANNUAL]: 'compliance',
                [PRICE_ENTERPRISE_MONTHLY]: 'enterprise',
                [PRICE_ENTERPRISE_ANNUAL]: 'enterprise',
                [PRICE_PRO_MONTHLY]: 'pro',
                [PRICE_PRO_ANNUAL]: 'pro'
            };
            let detectedTier = PRICE_TIER_MAP[unitAmount] || 'developer';
            const finalTier = customer.tier && customer.tier !== 'community' ? customer.tier : detectedTier;
            const tierLabel =
                finalTier === 'enterprise'
                    ? 'Compliance Suite Enterprise'
                    : finalTier === 'compliance'
                      ? 'Compliance Suite'
                      : finalTier === 'team_pro'
                        ? 'SimpleBeacon Team Pro'
                        : finalTier === 'team'
                          ? 'Continuous Shield Team'
                          : finalTier === 'developer'
                            ? 'SimpleBeacon Developer'
                            : 'AI Slop Cop Pro';
            const features =
                finalTier === 'enterprise' || finalTier === 'compliance' || finalTier === 'team_pro'
                    ? [
                          'continuous_shield',
                          'team_dashboard',
                          'ci_integration',
                          'compliance_certificate',
                          'eu_ai_act',
                          'analyst_support'
                      ]
                    : finalTier === 'team'
                      ? ['continuous_shield', 'team_dashboard', 'ci_integration']
                      : ['continuous_shield', 'ci_integration', 'export_reports'];

            db.updateCustomerSubscription(customer.email, status, finalTier);
            const existingSub = db
                .getDb()
                .prepare('SELECT * FROM paid_subscriptions WHERE stripe_subscription_id = ?')
                .get(sub.id);
            if (existingSub) {
                db.updatePaidSubscriptionStatus(sub.id, status);
            } else {
                db.addPaidSubscription(customer.email, sub.id, priceId, status, periodStart, periodEnd);
            }

            // Detect tier change for proration notification
            const oldTier = customer.tier;
            const tierChanged = oldTier && oldTier !== 'community' && oldTier !== finalTier;
            if (tierChanged && status === 'active') {
                const isAnnual = interval === 'year';
                try {
                    const { renderProrationNotice } = require('../services/billing-email-templates.cjs');
                    const { sendEmail } = require('../services/email.cjs');
                    const TIER_PRICES = {
                        developer: { monthly: 4900, annual: 49000 },
                        team_pro: { monthly: 14900, annual: 149000 },
                        team: { monthly: 1500, annual: 15000 },
                        compliance: { monthly: 39900, annual: 399000 },
                        enterprise: { monthly: 49900, annual: 499000 },
                        pro: { monthly: 900, annual: 9000 }
                    };
                    const oldPrice = TIER_PRICES[oldTier]
                        ? isAnnual
                            ? TIER_PRICES[oldTier].annual
                            : TIER_PRICES[oldTier].monthly
                        : 0;
                    const newPrice = TIER_PRICES[finalTier]
                        ? isAnnual
                            ? TIER_PRICES[finalTier].annual
                            : TIER_PRICES[finalTier].monthly
                        : 0;
                    const cycleDays = isAnnual ? 365 : 30;
                    const now = Date.now();
                    const periodEndMs = sub.current_period_end
                        ? sub.current_period_end * 1000
                        : now + cycleDays * 24 * 60 * 60 * 1000;
                    const daysRemaining = Math.max(0, Math.round((periodEndMs - now) / (24 * 60 * 60 * 1000)));
                    const oldDaily = Math.round(oldPrice / cycleDays);
                    const newDaily = Math.round(newPrice / cycleDays);
                    const netCents = newDaily * daysRemaining - oldDaily * daysRemaining;
                    const absAmt = Math.abs(netCents);
                    const display = `$${(absAmt / 100).toFixed(2)} ${netCents > 0 ? 'charge' : 'credit'}`;
                    const isUpgrade = newPrice > oldPrice;

                    logger.info('[SubscriptionWebhook] Tier change:', oldTier, '→', finalTier, 'proration:', display);

                    const { subject, text, html } = renderProrationNotice({
                        fromTier: oldTier,
                        toTier: finalTier,
                        isUpgrade,
                        daysRemaining,
                        netAdjustmentCents: netCents,
                        netAdjustmentDisplay: display,
                        isAnnual
                    });
                    await sendEmail({ to: customer.email, subject, text, html });
                    logger.info('[SubscriptionWebhook] Proration notice sent to', customer.email);
                } catch (prorationErr) {
                    logger.error('[SubscriptionWebhook] Proration notice failed:', prorationErr.message);
                }
            }

            if (status === 'active') {
                const licenseSecret = process.env.SIMPLEBEACON_LICENSE_SECRET;
                if (licenseSecret) {
                    const interval = sub.items?.data?.[0]?.price?.recurring?.interval || 'month';
                    const ttlMinutes = interval === 'year' ? 60 * 24 * 365 : 60 * 24 * 30;
                    const ttlLabel = interval === 'year' ? '1 year' : '30 days';

                    // Look up existing free token for this customer
                    const dbInstance = db.getDb();
                    const freeTokenRecord = dbInstance
                        .prepare('SELECT * FROM free_tokens WHERE email = ?')
                        .get(customer.email.trim().toLowerCase());
                    const previousToken = freeTokenRecord ? freeTokenRecord.token : null;

                    const tokenPayload = {
                        email: customer.email,
                        tier: finalTier,
                        projectName: customer.email,
                        clientName: customer.email,
                        features: features,
                        previousToken: previousToken || undefined
                    };
                    const token = generateLicenseToken(tokenPayload, licenseSecret, ttlMinutes);
                    // Store token in session-token store so the post-checkout redirect can retrieve it
                    try {
                        const sessionTokenStore = require('./session-token-store.cjs');
                        sessionTokenStore.set(session.id, {
                            token,
                            email: customer.email,
                            projectName: customer.email,
                            tier: finalTier,
                        });
                    } catch (storeErr) {
                        logger.warn('[SubscriptionWebhook] Session token store failed:', storeErr.message);
                    }
                    // Register subscription token in chain registry
                    try {
                        const { createTokenChain, activateToken, hashToken } = require('../lib/token-chain-store.cjs');
                        createTokenChain(customer.email, tokenPayload, token, ttlMinutes);
                        activateToken(hashToken(token), ttlMinutes);
                        // Revoke the old free token so it can no longer be used
                        if (freeTokenRecord) {
                            dbInstance
                                .prepare('UPDATE free_tokens SET revoked = 1 WHERE email = ?')
                                .run(customer.email.trim().toLowerCase());
                        }
                    } catch (chainErr) {
                        logger.error('[SubscriptionWebhook] Chain creation failed:', chainErr.message);
                    }
                    try {
                        const { sendEmail } = require('../services/email.cjs');
                        const {
                            renderLicenseConfirmation
                        } = require('../services/email-templates/license-confirmation-email.cjs');
                        const emailContent = renderLicenseConfirmation({
                            tierLabel,
                            token,
                            apiKey: customer.api_key,
                            ttlLabel,
                            customerEmail: customer.email,
                            features,
                            dashboardUrl: DASHBOARD_URL,
                            signInUrl: DASHBOARD_URL + 'signin'
                        });
                        const emailResult = await sendEmail({
                            to: customer.email,
                            subject: emailContent.subject,
                            text: emailContent.text,
                            html: emailContent.html
                        });
                        if (!emailResult.sent && !emailResult.queued) {
                            logger.error('[SubscriptionWebhook] Email could not be sent or queued:', emailResult.error);
                        } else if (!emailResult.sent) {
                            logger.warn('[SubscriptionWebhook] Email queued for retry. queueId:', emailResult.queueId);
                        } else {
                            logger.info(
                                '[SubscriptionWebhook] Email sent via',
                                emailResult.provider,
                                'queueId:',
                                emailResult.queueId
                            );
                        }
                    } catch (emailErr) {
                        logger.error('[SubscriptionWebhook] Email failed:', emailErr.message);
                    }
                }
            }
        }

        // Subscription canceled — revoke access immediately
        if (event.type === 'customer.subscription.deleted') {
            const sub = event.data.object;
            const customerId = sub.customer;
            const allCustomers = db
                .getDb()
                .prepare('SELECT * FROM customers WHERE stripe_customer_id = ?')
                .all(customerId);
            if (allCustomers.length > 0) {
                const customer = allCustomers[0];
                db.updateCustomerSubscription(customer.email, 'canceled', customer.tier);
                logger.info('[SubscriptionWebhook] Subscription canceled for:', customer.email);

                try {
                    const { sendEmail } = require('../services/email.cjs');
                    const { renderSubscriptionCanceled } = require('../services/billing-email-templates.cjs');
                    const { subject, text, html } = renderSubscriptionCanceled();
                    await sendEmail({ to: customer.email, subject, text, html });
                    logger.info('[SubscriptionWebhook] Cancellation email sent to', customer.email);
                } catch (emailErr) {
                    logger.error('[SubscriptionWebhook] Cancellation email failed:', emailErr.message);
                }
            }
        }

        // Payment failed — enter grace period (past_due)
        if (event.type === 'invoice.paid') {
            const invoice = event.data.object;
            const subscriptionId = invoice.subscription;
            logger.info('[SubscriptionWebhook] Payment succeeded for subscription:', subscriptionId);
            if (subscriptionId) {
                db.updatePaidSubscriptionStatus(subscriptionId, 'active');
                const subRows = db
                    .getDb()
                    .prepare('SELECT customer_email FROM paid_subscriptions WHERE stripe_subscription_id = ?')
                    .all(subscriptionId);
                if (subRows.length > 0) {
                    const email = subRows[0].customer_email;
                    const customer = db.getDb().prepare('SELECT tier FROM customers WHERE email = ?').get(email);
                    db.updateCustomerSubscription(email, 'active', customer?.tier || 'team');
                }
            }
        }

        if (event.type === 'invoice.payment_failed') {
            const invoice = event.data.object;
            const subscriptionId = invoice.subscription;
            const attemptCount = invoice.attempt_count || 1;
            const nextRetry = invoice.next_payment_attempt
                ? new Date(invoice.next_payment_attempt * 1000).toISOString()
                : null;
            logger.warn(
                '[SubscriptionWebhook] Payment FAILED for subscription:',
                subscriptionId,
                'attempt:',
                attemptCount,
                'nextRetry:',
                nextRetry || 'none'
            );
            if (subscriptionId) {
                db.updatePaidSubscriptionStatus(subscriptionId, 'past_due');
                const subRows = db
                    .getDb()
                    .prepare('SELECT customer_email FROM paid_subscriptions WHERE stripe_subscription_id = ?')
                    .all(subscriptionId);
                if (subRows.length > 0) {
                    const email = subRows[0].customer_email;
                    const customer = db.getDb().prepare('SELECT tier FROM customers WHERE email = ?').get(email);
                    db.updateCustomerSubscription(email, 'past_due', customer?.tier || 'team');
                    logger.warn(
                        '[SubscriptionWebhook] Subscription marked past_due for:',
                        email,
                        'attempt:',
                        attemptCount
                    );
                    try {
                        const { sendEmail } = require('../services/email.cjs');
                        const { renderPaymentFailed } = require('../services/billing-email-templates.cjs');
                        const { subject, text, html } = renderPaymentFailed({ attemptCount, nextRetry });
                        await sendEmail({ to: email, subject, text, html });
                        logger.info('[SubscriptionWebhook] Payment failure email sent to', email);
                    } catch (emailErr) {
                        logger.error('[SubscriptionWebhook] Payment failure email failed:', emailErr.message);
                    }
                }
            }
        }

        if (event.type === 'customer.subscription.trial_will_end') {
            const sub = event.data.object;
            const customerId = sub.customer;
            const trialEnd = sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null;
            logger.info('[SubscriptionWebhook] Trial ending soon for customer:', customerId, 'trial ends:', trialEnd);
            const allCustomers = db
                .getDb()
                .prepare('SELECT * FROM customers WHERE stripe_customer_id = ?')
                .all(customerId);
            if (allCustomers.length > 0) {
                const customer = allCustomers[0];
                try {
                    const { sendEmail } = require('../services/email.cjs');
                    const { renderTrialEnding } = require('../services/billing-email-templates.cjs');
                    const { subject, text, html } = renderTrialEnding({ trialEnd });
                    await sendEmail({ to: customer.email, subject, text, html });
                    logger.info('[SubscriptionWebhook] Trial ending email sent to', customer.email);
                } catch (emailErr) {
                    logger.error('[SubscriptionWebhook] Trial ending email failed:', emailErr.message);
                }
            }
        }

        if (event.type === 'charge.dispute.created') {
            const dispute = event.data.object;
            const chargeId = dispute.charge;
            const reason = dispute.reason || 'unspecified';
            const status = dispute.status || 'needs_response';
            const amount = dispute.amount ? (dispute.amount / 100).toFixed(2) : 'unknown';
            const currency = dispute.currency || 'usd';
            logger.warn(
                '[SubscriptionWebhook] Dispute CREATED — charge:',
                chargeId,
                'reason:',
                reason,
                'amount:',
                amount,
                currency.toUpperCase(),
                'status:',
                status
            );
            try {
                const { sendEmail } = require('../services/email.cjs');
                const { renderDisputeAlert } = require('../services/billing-email-templates.cjs');
                const { subject, text, html } = renderDisputeAlert({
                    chargeId,
                    reason,
                    status,
                    amountCents: dispute.amount,
                    currency
                });
                await sendEmail({
                    to: process.env.DISPUTE_ALERT_EMAIL || 'support@simplebeacon.ai',
                    subject,
                    text,
                    html
                });
                logger.info('[SubscriptionWebhook] Dispute alert email sent for charge', chargeId);
            } catch (emailErr) {
                logger.error('[SubscriptionWebhook] Dispute alert email failed:', emailErr.message);
            }
        }

        if (event.type === 'invoice.upcoming') {
            const invoice = event.data.object;
            const subscriptionId = invoice.subscription;
            if (!subscriptionId) {
                logger.info('[SubscriptionWebhook] invoice.upcoming: no subscription on invoice', invoice.id);
            } else {
                const subRows = db
                    .getDb()
                    .prepare('SELECT customer_email FROM paid_subscriptions WHERE stripe_subscription_id = ?')
                    .all(subscriptionId);
                if (subRows.length > 0) {
                    const email = subRows[0].customer_email;
                    const customer = db.getDb().prepare('SELECT tier FROM customers WHERE email = ?').get(email);
                    const tier = customer?.tier || 'pro';
                    const amountCents = invoice.amount_due || invoice.total;
                    const currency = invoice.currency || 'usd';
                    const dueDate = invoice.due_date ? new Date(invoice.due_date * 1000).toISOString() : null;
                    const invoiceNumber = invoice.number || invoice.id || null;
                    logger.info(
                        '[SubscriptionWebhook] Invoice upcoming for:',
                        email,
                        'amount:',
                        amountCents,
                        currency,
                        'due:',
                        dueDate
                    );
                    try {
                        const { sendEmail } = require('../services/email.cjs');
                        const { renderInvoiceUpcoming } = require('../services/billing-email-templates.cjs');
                        const { subject, text, html } = renderInvoiceUpcoming({
                            amountCents,
                            currency,
                            dueDate,
                            tier,
                            invoiceNumber
                        });
                        await sendEmail({ to: email, subject, text, html });
                        logger.info('[SubscriptionWebhook] Invoice upcoming email sent to', email);
                    } catch (emailErr) {
                        logger.error('[SubscriptionWebhook] Invoice upcoming email failed:', emailErr.message);
                    }
                }
            }
        }

        // Subscription paused — suspend features, notify customer
        if (event.type === 'customer.subscription.paused') {
            const sub = event.data.object;
            const customerId = sub.customer;
            const allCustomers = db
                .getDb()
                .prepare('SELECT * FROM customers WHERE stripe_customer_id = ?')
                .all(customerId);
            if (allCustomers.length > 0) {
                const customer = allCustomers[0];
                db.updateCustomerSubscription(customer.email, 'paused', customer.tier || 'developer');
                const resumeDate = sub.pause_collection?.resumes_at
                    ? new Date(sub.pause_collection.resumes_at * 1000).toISOString()
                    : null;
                logger.info('[SubscriptionWebhook] Subscription paused for', customer.email, 'resume:', resumeDate);
                try {
                    const { sendEmail } = require('../services/email.cjs');
                    const { renderSubscriptionPaused } = require('../services/billing-email-templates.cjs');
                    const { subject, text, html } = renderSubscriptionPaused({
                        tier: customer.tier || 'developer',
                        resumeDate
                    });
                    await sendEmail({ to: customer.email, subject, text, html });
                    logger.info('[SubscriptionWebhook] Paused email sent to', customer.email);
                } catch (emailErr) {
                    logger.error('[SubscriptionWebhook] Paused email failed:', emailErr.message);
                }
            }
        }

        // Subscription resumed — restore features, notify customer
        if (event.type === 'customer.subscription.resumed') {
            const sub = event.data.object;
            const customerId = sub.customer;
            const allCustomers = db
                .getDb()
                .prepare('SELECT * FROM customers WHERE stripe_customer_id = ?')
                .all(customerId);
            if (allCustomers.length > 0) {
                const customer = allCustomers[0];
                db.updateCustomerSubscription(customer.email, 'active', customer.tier || 'developer');
                logger.info('[SubscriptionWebhook] Subscription resumed for', customer.email);
                try {
                    const { sendEmail } = require('../services/email.cjs');
                    const { renderSubscriptionResumed } = require('../services/billing-email-templates.cjs');
                    const { subject, text, html } = renderSubscriptionResumed({ tier: customer.tier || 'developer' });
                    await sendEmail({ to: customer.email, subject, text, html });
                    logger.info('[SubscriptionWebhook] Resumed email sent to', customer.email);
                } catch (emailErr) {
                    logger.error('[SubscriptionWebhook] Resumed email failed:', emailErr.message);
                }
            }
        }

        // Charge refunded — notify customer, record refund in DB
        if (event.type === 'charge.refunded') {
            const charge = event.data.object;
            const chargeId = charge.id;
            const amountRefunded = charge.amount_refunded || 0;
            const totalAmount = charge.amount || 0;
            const currency = charge.currency || 'usd';
            const isFullRefund = amountRefunded >= totalAmount;
            const reason = charge.refund_reason || (charge.metadata && charge.metadata.refund_reason) || null;
            const customerEmail = charge.billing_details?.email || (charge.metadata && charge.metadata.email);

            logger.info(
                '[SubscriptionWebhook] Charge REFUNDED — charge:',
                chargeId,
                'amount:',
                (amountRefunded / 100).toFixed(2),
                currency.toUpperCase(),
                isFullRefund ? '(full)' : '(partial)',
                reason ? 'reason: ' + reason : ''
            );

            // Record refund in subscription status if we can find the customer
            if (customerEmail) {
                try {
                    const customer = db.getDb().prepare('SELECT * FROM customers WHERE email = ?').get(customerEmail);
                    if (customer) {
                        // Mark subscription as refunded (keep tier but update status)
                        db.updateCustomerSubscription(customerEmail, 'refunded', customer.tier || 'developer');
                    }
                } catch (dbErr) {
                    logger.error('[SubscriptionWebhook] Refund DB update failed:', dbErr.message);
                }

                try {
                    const { sendEmail } = require('../services/email.cjs');
                    const { renderRefundIssued } = require('../services/billing-email-templates.cjs');
                    const { subject, text, html } = renderRefundIssued({
                        amountCents: amountRefunded,
                        currency,
                        chargeId,
                        reason,
                        isFullRefund
                    });
                    await sendEmail({ to: customerEmail, subject, text, html });
                    logger.info('[SubscriptionWebhook] Refund email sent to', customerEmail);
                } catch (emailErr) {
                    logger.error('[SubscriptionWebhook] Refund email failed:', emailErr.message);
                }
            } else {
                logger.warn('[SubscriptionWebhook] charge.refunded: no customer email on charge', chargeId);
            }
        }

        res.json({ received: true });
    });
}

module.exports = { router, setupSubscriptionWebhook };
