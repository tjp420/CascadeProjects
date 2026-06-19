/**
 * Subscription billing routes for Continuous Shield ($1,499/mo recurring).
 */

'use strict';

const express = require('express');
const router = express.Router();
const crypto = require('crypto');

let stripe = null;
try { stripe = require('stripe')(process.env.STRIPE_SECRET_KEY || ''); } catch { stripe = null; }

const DEFAULT_PORT = 3001;
const PUBLIC_URL = process.env.PUBLIC_URL || ('http://' + 'localhost' + ':' + (process.env.PORT || DEFAULT_PORT));

const logger = {
    error: (...a) => { const c = globalThis.console; c.error(...a); },
    info:  (...a) => { const c = globalThis.console; c.log(...a); }
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

        const { email, projectName, clientName, tier, mode } = req.body;
        if (!email || !projectName) {
            return res.status(400).json({ error: 'Email and project name are required.' });
        }

        const PRICE_TEAM_MONTHLY = 4900;
        const PRICE_TEAM_ANNUAL = 49000;
        const PRICE_ENTERPRISE_MONTHLY = 49900;
        const PRICE_ENTERPRISE_ANNUAL = 499000;
        const PRICE_ENTERPRISE_THRESHOLD = 49900;
        const tierConfig = {
            team: {
                name: 'Continuous Shield Team',
                desc: 'SimpleBeacon Team — unlimited repos, devs, and scans',
                monthly: PRICE_TEAM_MONTHLY,
                annual: PRICE_TEAM_ANNUAL
            },
            enterprise: {
                name: 'Compliance Suite',
                desc: 'SimpleBeacon Enterprise — EU AI Act, quarterly certs, analyst support',
                monthly: PRICE_ENTERPRISE_MONTHLY,
                annual: PRICE_ENTERPRISE_ANNUAL
            }
        };

        const selectedTier = tierConfig[tier] || tierConfig.team;
        const isAnnual = mode === 'annual';
        const unitAmount = isAnnual ? selectedTier.annual : selectedTier.monthly;
        const interval = isAnnual ? 'year' : 'month';
        const displayPrice = isAnnual
            ? (tier === 'enterprise' ? '$4,990/yr' : '$490/yr')
            : (tier === 'enterprise' ? '$499/mo' : '$49/mo');

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

        const session = await stripe.checkout.sessions.create({
            mode: 'subscription',
            customer: stripeCustomerId,
            line_items: [{
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
            }],
            success_url: successUrl,
            cancel_url: cancelUrl,
            metadata: {
                product: tier || 'continuous_shield',
                billing: isAnnual ? 'annual' : 'monthly',
                email,
                projectName: String(projectName).slice(0, 200),
                clientName: String(clientName || email).slice(0, 200),
                apiKey: customer.api_key
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
        let event;
        try {
            if (stripe && secret && sig) {
                event = stripe.webhooks.constructEvent(req.body, sig, secret);
            } else {
                event = JSON.parse(req.body);
            }
        } catch (err) {
            logger.error('[SubscriptionWebhook] Signature verification failed:', err.message);
            return res.status(400).send('Webhook Error: ' + err.message);
        }

        const db = require('../lib/db.cjs');

        if (event.type === 'customer.subscription.created' || event.type === 'customer.subscription.updated') {
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
            const detectedTier = unitAmount >= PRICE_ENTERPRISE_THRESHOLD ? 'enterprise' : 'team';
            const finalTier = customer.tier && customer.tier !== 'community' ? customer.tier : detectedTier;
            const tierLabel = finalTier === 'enterprise' ? 'Compliance Suite' : 'Continuous Shield Team';
            const features = finalTier === 'enterprise'
                ? ['continuous_shield', 'team_dashboard', 'ci_integration', 'compliance_certificate', 'eu_ai_act', 'analyst_support']
                : ['continuous_shield', 'team_dashboard', 'ci_integration'];

            db.updateCustomerSubscription(customer.email, status, finalTier);
            db.addPaidSubscription(customer.email, sub.id, priceId, status, periodStart, periodEnd);

            if (status === 'active') {
                const licenseSecret = process.env.SIMPLEBEACON_LICENSE_SECRET;
                if (licenseSecret) {
                    const interval = sub.items?.data?.[0]?.price?.recurring?.interval || 'month';
                    const ttlMinutes = interval === 'year' ? 60 * 24 * 365 : 60 * 24 * 30;
                    const ttlLabel = interval === 'year' ? '1 year' : '30 days';
                    const tokenPayload = {
                        email: customer.email,
                        tier: finalTier,
                        projectName: customer.email,
                        clientName: customer.email,
                        features: features
                    };
                    const token = generateLicenseToken(tokenPayload, licenseSecret, ttlMinutes);
                    // Register subscription token in chain registry
                    try {
                        const { createTokenChain } = require('../lib/token-chain-store.cjs');
                        createTokenChain(customer.email, tokenPayload, token, ttlMinutes);
                    } catch (chainErr) {
                        logger.error('[SubscriptionWebhook] Chain creation failed:', chainErr.message);
                    }
                    try {
                        const { sendEmail } = require('../services/email.cjs');
                        await sendEmail({
                            to: customer.email,
                            subject: 'Your ' + tierLabel + ' License Token',
                            text: `Your ${tierLabel} subscription is active.\n\nLicense Token: ${token}\n\nThis token is valid for ${ttlLabel} and unlocks the team dashboard + CI integration.\n\nAPI Key: ${customer.api_key}\n\nUse this API key in your GitHub Action to post scan results to your team dashboard.`,
                            html: `<p>Your <strong>${tierLabel}</strong> subscription is active.</p><p>License Token: <code>${token}</code></p><p>API Key: <code>${customer.api_key}</code></p><p>Use the API key in your GitHub Action to post scan results to your team dashboard.</p>`
                        });
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
        if (event.type === 'invoice.payment_failed') {
            const invoice = event.data.object;
            const subscriptionId = invoice.subscription;
            logger.warn('[SubscriptionWebhook] Payment failed for subscription:', subscriptionId);
            // Attempt to find customer by subscription via paid_subscriptions table
            const subRows = db.getDb().prepare('SELECT customer_email FROM paid_subscriptions WHERE stripe_subscription_id = ?').all(subscriptionId);
            if (subRows.length > 0) {
                const email = subRows[0].customer_email;
                db.updateCustomerSubscription(email, 'past_due', null);
                logger.warn('[SubscriptionWebhook] Marked past_due:', email);
            }
        }

        if (event.type === 'invoice.payment_succeeded') {
            const invoice = event.data.object;
            logger.info('[SubscriptionWebhook] Payment succeeded for subscription:', invoice.subscription);
        }

        res.json({ received: true });
    });
}

module.exports = { router, setupSubscriptionWebhook };
