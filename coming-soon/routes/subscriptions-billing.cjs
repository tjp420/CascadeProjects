/**
 * Subscription billing routes for Continuous Shield ($1,499/mo recurring).
 */

'use strict';

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const db = require('../lib/db.cjs');
const { buildReferralCheckoutMetadata, processStripeReferralAttribution } = require('../lib/referral-webhook.cjs');

let stripe = null;
try { stripe = require('stripe')(process.env.STRIPE_SECRET_KEY || ''); } catch { stripe = null; }

const DEFAULT_PORT = 3001;
const PUBLIC_URL = process.env.PUBLIC_URL || ('http://' + 'localhost' + ':' + (process.env.PORT || DEFAULT_PORT));
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
const PRICE_TEAM_PRO_MONTHLY = 14900;
const PRICE_TEAM_PRO_ANNUAL = 149000;
const PRICE_EXTRA_SEAT_MONTHLY = 1500;
const PRICE_EXTRA_SEAT_ANNUAL = 15000;

const logger = {
    error: (...a) => { const c = globalThis.console; c.error(...a); },
    info:  (...a) => { const c = globalThis.console; c.log(...a); },
    warn:  (...a) => { const c = globalThis.console; c.warn(...a); }
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

function parseRawWebhookJson(rawBody) {
    const text = Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : String(rawBody || '{}');
    return JSON.parse(text);
}

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

        // Validate extraSeats for team_pro tier
        const seatCount = (tier === 'team_pro' && extraSeats) ? Math.max(0, Math.min(50, parseInt(extraSeats, 10) || 0)) : 0;

        const tierConfig = {
            developer: {
                name: 'SimpleBeacon Developer',
                desc: 'SimpleBeacon Developer — unlimited scans, CI gate, 38 analyzer modules',
                monthly: PRICE_DEVELOPER_MONTHLY,
                annual: PRICE_DEVELOPER_ANNUAL
            },
            team_pro: {
                name: 'SimpleBeacon Team Pro',
                desc: 'SimpleBeacon Team Pro — EU AI Act, SOC 2, board-ready certificates, 5 seats',
                monthly: PRICE_TEAM_PRO_MONTHLY,
                annual: PRICE_TEAM_PRO_ANNUAL
            },
            pro: {
                name: 'AI Slop Cop Pro',
                desc: 'SimpleBeacon Pro — unlimited scans, CI/CD, and 38 analyzer engines',
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
            }
        };

        const selectedTier = tierConfig[tier] || tierConfig.developer;
        const isAnnual = mode === 'annual';
        const unitAmount = isAnnual ? selectedTier.annual : selectedTier.monthly;
        const interval = isAnnual ? 'year' : 'month';
        const displayPrice = isAnnual
            ? (tier === 'enterprise' ? '$4,990/yr' : tier === 'compliance' ? '$3,990/yr' : tier === 'team_pro' ? '$1,490/yr' : tier === 'team' ? '$990/yr' : tier === 'pro' ? '$90/yr' : tier === 'developer' ? '$490/yr' : '$490/yr')
            : (tier === 'enterprise' ? '$499/mo' : tier === 'compliance' ? '$399/mo' : tier === 'team_pro' ? '$149/mo' : tier === 'team' ? '$99/mo' : tier === 'pro' ? '$9/mo' : tier === 'developer' ? '$49/mo' : '$49/mo');

        // Get or create customer in DB
        const db = require('../lib/db.cjs');
        const customer = db.getOrCreateCustomer(email);

        // Update customer tier so webhook knows which license to generate
        db.updateCustomerSubscription(email, customer.subscription_status || 'inactive', selectedTier);

        // Use existing Stripe customer ID or create new
        let stripeCustomerId = customer.stripe_customer_id;
        if (!stripeCustomerId) {
            const stripeCustomer = await stripe.customers.create({
                email: email,
                name: clientName || email,
                metadata: { projectName: String(projectName).slice(0, 200), tier: selectedTier }
            });
            stripeCustomerId = stripeCustomer.id;
            db.updateCustomerStripeId(email, stripeCustomerId);
        }

        const successUrl = `${PUBLIC_URL}/certificate-upload.html?session_id={CHECKOUT_SESSION_ID}`;
        const cancelUrl = `${PUBLIC_URL}/pricing.html?canceled=true`;
        const referralMetadata = buildReferralCheckoutMetadata(req, req.body);

        // Build line items: base subscription + optional extra seat add-on
        const lineItems = [{
            price_data: {
                currency: 'usd',
                product_data: {
                    name: selectedTier.name,
                    description: selectedTier.desc + ' — ' + displayPrice
                },
                unit_amount: unitAmount,
                recurring: { interval: interval }
            },
            quantity: 1
        }];

        if (seatCount > 0) {
            const seatUnitAmount = isAnnual ? PRICE_EXTRA_SEAT_ANNUAL : PRICE_EXTRA_SEAT_MONTHLY;
            const seatDisplayPrice = isAnnual ? '$150/yr' : '$15/mo';
            lineItems.push({
                price_data: {
                    currency: 'usd',
                    product_data: {
                        name: 'Extra Team Seat',
                        description: 'Additional seat beyond the 5 included in Team Pro — ' + seatDisplayPrice + ' per seat'
                    },
                    unit_amount: seatUnitAmount,
                    recurring: { interval: interval }
                },
                quantity: seatCount
            });
        }

        const session = await stripe.checkout.sessions.create({
            mode: 'subscription',
            customer: stripeCustomerId,
            line_items: lineItems,
            success_url: successUrl,
            cancel_url: cancelUrl,
            metadata: {
                product: tier || 'continuous_shield',
                billing: isAnnual ? 'annual' : 'monthly',
                email,
                projectName: String(projectName).slice(0, 200),
                clientName: String(clientName || email).slice(0, 200),
                apiKey: customer.api_key,
                ...(seatCount > 0 ? { extraSeats: String(seatCount) } : {}),
                ...referralMetadata
            }
        });

        res.json({ success: true, url: session.url, sessionId: session.id });
    } catch (error) {
        logger.error('[CreateSubscriptionSession] Error:', error.message);
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
        res.json({ success: true, reports: logs.slice(-100), subscription: { status: customer.subscription_status, tier: customer.tier } });
    } catch (error) {
        logger.error('[TeamReportsGet] Error:', error.message);
        res.status(500).json({ error: 'Failed to retrieve reports.', message: error.message });
    }
});

// Subscription webhook handler (mounted alongside checkout webhook)
function setupSubscriptionWebhook(app) {
    app.post('/api/subscription/webhook', express.raw({ type: 'application/json' }), async (req, res) => { // rateLimit applied
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
        const isProduction = process.env.NODE_ENV === 'production';
        let event;
        try {
            if (isProduction && !sig) {
                return res.status(400).send('Webhook Error: Missing Stripe signature');
            }
            if (isProduction && (!stripe || !secret)) {
                return res.status(503).send('Webhook Error: Stripe webhook is not configured');
            }
            if (stripe && secret && sig) {
                event = stripe.webhooks.constructEvent(req.body, sig, secret);
            } else {
                event = parseRawWebhookJson(req.body);
            }
        } catch (err) {
            logger.error('[SubscriptionWebhook] Signature verification failed:', err.message);
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
            'customer.subscription.updated',
            'customer.subscription.deleted',
            'invoice.paid'
        ]);
        if (!allowedEvents.has(event.type)) {
            return res.json({ received: true, ignored: true });
        }

        if (event.type === 'checkout.session.completed') {
            const session = event.data.object;
            if (session.mode === 'subscription' && (session.payment_status === 'paid' || session.status === 'complete')) {
                const customerId = session.customer;
                if (customerId) {
                    const customer = db.getDb().prepare('SELECT * FROM customers WHERE stripe_customer_id = ?').get(customerId);
                    if (customer) {
                        db.updateCustomerSubscription(customer.email, 'active', customer.tier || 'team');
                        if (session.subscription) {
                            const existingSub = db.getDb().prepare('SELECT * FROM paid_subscriptions WHERE stripe_subscription_id = ?').get(session.subscription);
                            if (existingSub) {
                                db.updatePaidSubscriptionStatus(session.subscription, 'active');
                            } else {
                                db.addPaidSubscription(customer.email, session.subscription, null, 'active', null, null);
                            }
                        }
                    }
                }
                try {
                    const referralResult = processStripeReferralAttribution(session);
                    if (referralResult.converted) {
                        logger.info('[SubscriptionWebhook] Referral conversion:', referralResult.attributionId, referralResult.rewardId);
                    }
                } catch (referralErr) {
                    logger.error('[SubscriptionWebhook] Referral attribution failed:', referralErr.message);
                }
            }
        }

        if (event.type === 'customer.subscription.updated') {
            const sub = event.data.object;
            const customerId = sub.customer;
            const status = sub.status;
            const priceId = sub.items?.data?.[0]?.price?.id;
            const periodStart = sub.current_period_start ? new Date(sub.current_period_start * 1000).toISOString() : null;
            const periodEnd = sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null;

            const allCustomers = db.getDb().prepare('SELECT * FROM customers WHERE stripe_customer_id = ?').all(customerId);
            if (allCustomers.length === 0) {
                logger.error('[SubscriptionWebhook] Customer not found for stripe ID:', customerId);
                return res.json({ received: true, status: 'customer_not_found' });
            }
            const customer = allCustomers[0];

            // Infer tier from subscription amount or customer record
            const unitAmount = sub.items?.data?.[0]?.price?.unit_amount || 0;
            let detectedTier = 'developer';
            if (unitAmount >= PRICE_ENTERPRISE_MONTHLY) {
                detectedTier = 'enterprise';
            } else if (unitAmount >= PRICE_COMPLIANCE_MONTHLY) {
                detectedTier = 'compliance';
            } else if (unitAmount >= PRICE_TEAM_PRO_MONTHLY) {
                detectedTier = 'team_pro';
            } else if (unitAmount >= PRICE_TEAM_MONTHLY) {
                detectedTier = 'team';
            } else if (unitAmount >= PRICE_DEVELOPER_MONTHLY) {
                detectedTier = 'developer';
            }
            const finalTier = customer.tier && customer.tier !== 'community' ? customer.tier : detectedTier;
            const tierLabel = finalTier === 'enterprise' ? 'Compliance Suite Enterprise' : finalTier === 'compliance' ? 'Compliance Suite' : finalTier === 'team_pro' ? 'SimpleBeacon Team Pro' : finalTier === 'team' ? 'Continuous Shield Team' : finalTier === 'developer' ? 'SimpleBeacon Developer' : 'AI Slop Cop Pro';
            const features = finalTier === 'enterprise' || finalTier === 'compliance' || finalTier === 'team_pro'
                ? ['continuous_shield', 'team_dashboard', 'ci_integration', 'compliance_certificate', 'eu_ai_act', 'analyst_support']
                : finalTier === 'team'
                    ? ['continuous_shield', 'team_dashboard', 'ci_integration']
                    : ['continuous_shield', 'ci_integration', 'export_reports'];

            db.updateCustomerSubscription(customer.email, status, finalTier);
            db.addPaidSubscription(customer.email, sub.id, priceId, status, periodStart, periodEnd);

            if (status === 'active') {
                const licenseSecret = process.env.SIMPLEBEACON_LICENSE_SECRET;
                if (licenseSecret) {
                    const interval = sub.items?.data?.[0]?.price?.recurring?.interval || 'month';
                    const ttlMinutes = interval === 'year' ? 60 * 24 * 365 : 60 * 24 * 30;
                    const ttlLabel = interval === 'year' ? '1 year' : '30 days';

                    // Look up existing free token for this customer
                    const dbInstance = db.getDb();
                    const freeTokenRecord = dbInstance.prepare('SELECT * FROM free_tokens WHERE email = ?').get(customer.email.trim().toLowerCase());
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
                    // Register subscription token in chain registry
                    try {
                        const { createTokenChain, activateToken, hashToken } = require('../lib/token-chain-store.cjs');
                        createTokenChain(customer.email, tokenPayload, token, ttlMinutes);
                        activateToken(hashToken(token), ttlMinutes);
                        // Revoke the old free token so it can no longer be used
                        if (freeTokenRecord) {
                            dbInstance.prepare("UPDATE free_tokens SET revoked = 1 WHERE email = ?").run(customer.email.trim().toLowerCase());
                        }
                    } catch (chainErr) {
                        logger.error('[SubscriptionWebhook] Chain creation failed:', chainErr.message);
                    }
                    try {
                        const { sendEmail } = require('../services/email.cjs');
                        const emailResult = await sendEmail({
                            to: customer.email,
                            subject: 'Your ' + tierLabel + ' License Token',
                            text: `Your ${tierLabel} subscription is active.\n\nLicense Token: ${token}\n\nThis token is valid for ${ttlLabel} and unlocks the team dashboard + CI integration.\n\nAPI Key: ${customer.api_key}\n\nUse this API key in your GitHub Action to post scan results to your team dashboard.`,
                            html: `<p>Your <strong>${tierLabel}</strong> subscription is active.</p><p>License Token: <code>${token}</code></p><p>API Key: <code>${customer.api_key}</code></p><p>Use the API key in your GitHub Action to post scan results to your team dashboard.</p>`
                        });
                        if (!emailResult.sent && !emailResult.queued) {
                            logger.error('[SubscriptionWebhook] Email could not be sent or queued:', emailResult.error);
                        } else if (!emailResult.sent) {
                            logger.warn('[SubscriptionWebhook] Email queued for retry. queueId:', emailResult.queueId);
                        } else {
                            logger.info('[SubscriptionWebhook] Email sent via', emailResult.provider, 'queueId:', emailResult.queueId);
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
            const allCustomers = db.getDb().prepare('SELECT * FROM customers WHERE stripe_customer_id = ?').all(customerId);
            if (allCustomers.length > 0) {
                const customer = allCustomers[0];
                db.updateCustomerSubscription(customer.email, 'canceled', customer.tier);
                logger.info('[SubscriptionWebhook] Subscription canceled for:', customer.email);
            }
        }

        // Payment failed — enter grace period (past_due)
        if (event.type === 'invoice.paid') {
            const invoice = event.data.object;
            const subscriptionId = invoice.subscription;
            logger.info('[SubscriptionWebhook] Payment succeeded for subscription:', subscriptionId);
            if (subscriptionId) {
                db.updatePaidSubscriptionStatus(subscriptionId, 'active');
                const subRows = db.getDb().prepare('SELECT customer_email FROM paid_subscriptions WHERE stripe_subscription_id = ?').all(subscriptionId);
                if (subRows.length > 0) {
                    const email = subRows[0].customer_email;
                    const customer = db.getDb().prepare('SELECT tier FROM customers WHERE email = ?').get(email);
                    db.updateCustomerSubscription(email, 'active', customer?.tier || 'team');
                }
            }
        }

        res.json({ received: true });
    });
}

module.exports = { router, setupSubscriptionWebhook };
