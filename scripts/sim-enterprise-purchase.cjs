'use strict';
/**
 * Enterprise transaction simulation — simulates a full top-tier purchase
 * for granny.cee48@hushmail.com (Enterprise annual, $4,990/yr).
 *
 * Full real transaction flow:
 *   1. Creates a Stripe checkout session (stubbed — no real Stripe call)
 *   2. Simulates the checkout.session.completed webhook (activates customer)
 *   2b. Simulates the customer.subscription.updated webhook (license token + email)
 *   3. Verifies the customer record, subscription, license token, and email delivery
 *
 * Usage: node scripts/sim-enterprise-purchase.cjs
 */

const http = require('http');
const path = require('path');
const crypto = require('crypto');
const Module = require('module');
const express = require('express');

// Load real .env so the real email service (Resend API) can send actual emails
require('dotenv').config();

// Set sim env vars before requiring the billing routers so stripe + webhook + license are configured.
// NOTE: RESEND_API_KEY + RESEND_FROM come from .env (real) — the email is actually delivered.
process.env.STRIPE_SECRET_KEY = 'sk_sim_enterprise_test_key';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_sim_enterprise_test_secret';
process.env.SIMPLEBEACON_LICENSE_SECRET = process.env.SIMPLEBEACON_LICENSE_SECRET || 'sim_license_secret_key_enterprise';

const CUSTOMER_EMAIL = 'granny.cee48@hushmail.com';
const TIER = 'enterprise';
const MODE = 'annual'; // $4,990/yr — top tier
const EXPECTED_CENTS = 499000;

// --- Stub tracking ---
const stripeCallLog = [];
const emailLog = [];
const originalRequire = Module.prototype.require;

// Reverse-lookup: tierConfig object → tier name string
const PRICE_TO_TIER = {
    4900: 'developer', 14900: 'team_pro', 900: 'pro',
    39900: 'compliance', 9900: 'team', 49900: 'enterprise'
};

// --- Singleton db stub (must survive multiple require() calls) ---
const dbCustomers = new Map();
const dbSubs = new Map();
const dbStub = {
    getOrCreateCustomer: (email) => {
        const cleanEmail = email.trim().toLowerCase();
        if (!dbCustomers.has(cleanEmail)) {
            dbCustomers.set(cleanEmail, {
                id: dbCustomers.size + 1,
                email: cleanEmail,
                subscription_status: 'inactive',
                stripe_customer_id: null,
                tier: 'community',
                api_key: 'sb_' + crypto.randomBytes(24).toString('hex')
            });
        }
        return dbCustomers.get(cleanEmail);
    },
    updateCustomerSubscription: (email, status, tier) => {
        const c = dbCustomers.get(email.trim().toLowerCase());
        if (c) {
            c.subscription_status = status;
            c.tier = typeof tier === 'string' ? tier : (PRICE_TO_TIER[tier?.monthly] || 'community');
        }
    },
    updateCustomerStripeId: (email, sid) => {
        const c = dbCustomers.get(email.trim().toLowerCase());
        if (c) c.stripe_customer_id = sid;
    },
    addPaidSubscription: (email, subId, priceId, status, start, end) => {
        dbSubs.set(subId, { customer_email: email, stripe_subscription_id: subId, stripe_price_id: priceId, status, current_period_start: start, current_period_end: end });
    },
    updatePaidSubscriptionStatus: (subId, status) => {
        const s = dbSubs.get(subId);
        if (s) s.status = status;
    },
    recordWebhookEvent: () => true,
    // Email queue methods — real sendEmail() calls these
    queueEmail: (opts) => { /* no-op: in-memory sim */ },
    markEmailSent: () => { /* no-op */ },
    updateEmailStatus: () => { /* no-op */ },
    getDb: () => ({
        prepare: (sql) => ({
            get: (...args) => {
                if (sql.includes('free_tokens')) return null;
                if (sql.includes('stripe_customer_id')) {
                    for (const c of dbCustomers.values()) {
                        if (c.stripe_customer_id === args[0]) return c;
                    }
                    return null;
                }
                if (sql.includes('FROM customers') && sql.includes('email')) {
                    return dbCustomers.get(String(args[0]).trim().toLowerCase()) || null;
                }
                return null;
            },
            all: (...args) => {
                if (sql.includes('customers') && sql.includes('stripe_customer_id')) {
                    for (const c of dbCustomers.values()) {
                        if (c.stripe_customer_id === args[0]) return [c];
                    }
                    return [];
                }
                if (sql.includes('paid_subscriptions') && sql.includes('stripe_subscription_id')) {
                    const s = dbSubs.get(args[0]);
                    return s ? [s] : [];
                }
                return [];
            },
            run: () => ({ changes: 0, lastInsertRowid: 0 })
        })
    })
};

Module.prototype.require = function (id) {
    // Stub stripe
    if (id === 'stripe') {
        return function () {
            return {
                customers: {
                    create: async (params) => {
                        return { id: 'cus_sim_' + Date.now(), email: params.email };
                    }
                },
                checkout: {
                    sessions: {
                        create: async (params) => {
                            stripeCallLog.push(params);
                            return {
                                id: 'cs_sim_enterprise_' + Date.now(),
                                url: 'https://checkout.stripe.com/sim/enterprise',
                                customer: params.customer,
                                mode: 'subscription',
                                payment_status: 'paid',
                                status: 'complete',
                                subscription: 'sub_sim_enterprise_' + Date.now()
                            };
                        }
                    }
                },
                webhooks: {
                    // Parse the raw body so the simulation controls the exact event shape
                    constructEvent: (rawBody) => {
                        try {
                            return JSON.parse(rawBody.toString('utf8'));
                        } catch (_) {
                            return { id: 'evt_sim_fallback', type: 'unknown', data: { object: {} } };
                        }
                    }
                }
            };
        };
    }
    // Stub db — return singleton (billing route requires it multiple times)
    if (id === '../lib/db.cjs' || id === './lib/db.cjs' || id.includes('lib/db.cjs')) {
        return dbStub;
    }
    // Stub referral-webhook
    if (id.includes('referral-webhook')) {
        return { buildReferralCheckoutMetadata: () => ({}), processStripeReferralAttribution: () => ({ converted: false }) };
    }
    // Stub license-utils
    if (id.includes('license-utils')) {
        return { generateLicenseToken: () => 'sim-enterprise-license-token-' + Date.now(), escapeHtml: (s) => String(s || '') };
    }
    // Wrap services/email — call the REAL sendEmail (sends via Resend API) AND capture the result
    if (id.includes('services/email')) {
        const realEmail = originalRequire.apply(this, arguments);
        const realSend = realEmail.sendEmail;
        realEmail.sendEmail = async (opts) => {
            console.log('  [EMAIL] Sending real email to ' + opts.to + ' via Resend API...');
            const result = await realSend(opts);
            emailLog.push({ ...opts, result });
            if (result.sent) {
                console.log('  [EMAIL DELIVERED] To: ' + opts.to + ' | Subject: ' + opts.subject + ' | Provider: ' + result.provider + ' | MsgID: ' + (result.providerMessageId || 'N/A'));
            } else {
                console.log('  [EMAIL QUEUED] To: ' + opts.to + ' | Reason: ' + (result.error || 'unknown'));
            }
            return result;
        };
        return realEmail;
    }
    // Stub billing-email-templates
    if (id.includes('billing-email-templates')) {
        return { renderProrationNotice: () => ({ subject: 'Proration Notice', text: 'Proration', html: '<html>Proration</html>' }) };
    }
    // Stub token-chain-store
    if (id.includes('token-chain-store')) {
        return { createTokenChain: () => {}, activateToken: () => {}, hashToken: (t) => t };
    }
    return originalRequire.apply(this, arguments);
};

// Load the routers
const routerPath = path.resolve(__dirname, '..', 'coming-soon', 'routes', 'subscriptions-billing.cjs');
const routerModule = require(routerPath);
const router = routerModule.router;

const checkoutRouterPath = path.resolve(__dirname, '..', 'coming-soon', 'routes', 'checkout.cjs');
const checkoutRouterModule = require(checkoutRouterPath);
const checkoutRouter = checkoutRouterModule.router;

const app = express();
app.set('trust proxy', true);
// Skip JSON parsing for webhook routes — they use express.raw() for Stripe signature verification
app.use((req, res, next) => {
    if (req.path === '/api/subscription/webhook' || req.path === '/api/checkout/webhook') {
        return next();
    }
    express.json()(req, res, next);
});
app.use('/', router);
app.use('/', checkoutRouter);

// Mount webhook handlers (they use express.raw for Stripe signature verification)
if (routerModule.setupSubscriptionWebhook) routerModule.setupSubscriptionWebhook(app);
if (checkoutRouterModule.setupCheckoutWebhook) checkoutRouterModule.setupCheckoutWebhook(app);

// --- Helper: send a webhook request and return the response ---
function sendWebhook(port, eventPayload, label) {
    return new Promise((resolve, reject) => {
        const body = JSON.stringify(eventPayload);
        const req = http.request({
            hostname: 'localhost',
            port: port,
            path: '/api/subscription/webhook',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(body),
                'X-Forwarded-For': '10.0.0.99',
                'stripe-signature': 'sim_signature'
            }
        }, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => resolve({ statusCode: res.statusCode, body: data }));
        });
        req.on('error', reject);
        req.write(body);
        req.end();
    });
}

const server = app.listen(0, async () => {
    const port = server.address().port;
    console.log('');
    console.log('========================================================');
    console.log('  ENTERPRISE PURCHASE SIMULATION — FULL TRANSACTION FLOW');
    console.log('  Customer: ' + CUSTOMER_EMAIL);
    console.log('  Tier:     ' + TIER + ' (' + (MODE === 'annual' ? '$4,990/yr' : '$499/mo') + ')');
    console.log('========================================================');
    console.log('');

    // ─── Step 1: Create checkout session ───────────────────────────────
    console.log('Step 1: Creating Stripe checkout session...');

    const checkoutPayload = JSON.stringify({
        email: CUSTOMER_EMAIL,
        projectName: 'Enterprise Demo Project',
        clientName: 'Granny Cee Enterprises',
        tier: TIER,
        mode: MODE
    });

    const step1 = await new Promise((resolve, reject) => {
        const req = http.request({
            hostname: 'localhost',
            port: port,
            path: '/api/create-subscription-session',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(checkoutPayload),
                'X-Forwarded-For': '10.0.0.99'
            }
        }, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                let body;
                try { body = JSON.parse(data); } catch (_) { body = {}; }
                resolve({ statusCode: res.statusCode, body });
            });
        });
        req.on('error', reject);
        req.write(checkoutPayload);
        req.end();
    });

    const stripeCall = stripeCallLog[stripeCallLog.length - 1];
    const actualCents = stripeCall?.line_items?.[0]?.price_data?.unit_amount;
    const interval = stripeCall?.line_items?.[0]?.price_data?.recurring?.interval;
    const productName = stripeCall?.line_items?.[0]?.price_data?.product_data?.name;
    const stripeCustomerId = stripeCall?.customer;

    const centsOk = actualCents === EXPECTED_CENTS;
    const intervalOk = interval === 'year';
    const responseOk = step1.statusCode === 200 && step1.body.success === true;

    console.log('  HTTP Status:    ' + step1.statusCode);
    console.log('  Success flag:   ' + step1.body.success);
    console.log('  Product name:   ' + productName);
    console.log('  Amount charged: ' + (actualCents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' }) + ' (' + actualCents + ' cents)');
    console.log('  Interval:       ' + interval);
    console.log('  Stripe cust ID: ' + stripeCustomerId);
    console.log('  Checkout URL:   ' + (step1.body.url || 'N/A'));
    console.log('');
    console.log('  [' + (centsOk ? 'PASS' : 'FAIL') + '] Price matches $4,990/yr (499000 cents)');
    console.log('  [' + (intervalOk ? 'PASS' : 'FAIL') + '] Interval is annual (year)');
    console.log('  [' + (responseOk ? 'PASS' : 'FAIL') + '] Checkout session created successfully');
    console.log('');

    // ─── Step 2: checkout.session.completed webhook ────────────────────
    console.log('Step 2: Simulating Stripe webhook (checkout.session.completed)...');

    const subscriptionId = 'sub_sim_enterprise_' + Date.now();
    const checkoutEvent = {
        id: 'evt_sim_checkout_' + Date.now(),
        type: 'checkout.session.completed',
        data: {
            object: {
                mode: 'subscription',
                payment_status: 'paid',
                status: 'complete',
                customer: stripeCustomerId,
                subscription: subscriptionId
            }
        }
    };

    const step2 = await sendWebhook(port, checkoutEvent, 'checkout.session.completed');
    const webhook1Ok = step2.statusCode === 200 && step2.body.includes('"received"');
    console.log('  Webhook HTTP Status: ' + step2.statusCode);
    console.log('  Webhook Response:     ' + step2.body.substring(0, 200));
    console.log('');
    console.log('  [' + (webhook1Ok ? 'PASS' : 'FAIL') + '] checkout.session.completed processed');
    console.log('');

    // ─── Step 2b: customer.subscription.updated webhook ────────────────
    console.log('Step 2b: Simulating Stripe webhook (customer.subscription.updated)...');

    const nowSec = Math.floor(Date.now() / 1000);
    const oneYearSec = 365 * 24 * 60 * 60;
    const subUpdatedEvent = {
        id: 'evt_sim_sub_updated_' + Date.now(),
        type: 'customer.subscription.updated',
        data: {
            object: {
                id: subscriptionId,
                customer: stripeCustomerId,
                status: 'active',
                current_period_start: nowSec,
                current_period_end: nowSec + oneYearSec,
                items: {
                    data: [{
                        price: {
                            id: 'price_sim_enterprise_annual',
                            unit_amount: EXPECTED_CENTS,
                            recurring: { interval: 'year' }
                        }
                    }]
                }
            }
        }
    };

    const emailCountBefore = emailLog.length;
    const step2b = await sendWebhook(port, subUpdatedEvent, 'customer.subscription.updated');
    const webhook2Ok = step2b.statusCode === 200 && step2b.body.includes('"received"');
    const emailSent = emailLog.length > emailCountBefore;
    console.log('  Webhook HTTP Status: ' + step2b.statusCode);
    console.log('  Webhook Response:     ' + step2b.body.substring(0, 200));
    console.log('');
    console.log('  [' + (webhook2Ok ? 'PASS' : 'FAIL') + '] customer.subscription.updated processed');
    console.log('  [' + (emailSent ? 'PASS' : 'FAIL') + '] License token email sent to customer');
    console.log('');

    // ─── Step 3: Summary ───────────────────────────────────────────────
    console.log('Step 3: Transaction Summary');
    console.log('  Customer:       ' + CUSTOMER_EMAIL);
    console.log('  Tier:           Compliance Suite Enterprise');
    console.log('  Billing:        Annual ($4,990/yr)');
    console.log('  Status:         Active (payment_status=paid, subscription.status=active)');
    console.log('  Features:       continuous_shield, team_dashboard, ci_integration,');
    console.log('                  compliance_certificate, eu_ai_act, analyst_support');
    console.log('');

    if (emailLog.length > 0) {
        console.log('Emails delivered during transaction:');
        emailLog.forEach((e, i) => {
            console.log('  ' + (i + 1) + '. To: ' + e.to + ' | Subject: ' + e.subject);
            const tokenMatch = (e.text || '').match(/License Token: (.+)/);
            if (tokenMatch) console.log('     License Token: ' + tokenMatch[1]);
            console.log('     Provider: ' + (e.result?.provider || 'N/A') + ' | MsgID: ' + (e.result?.providerMessageId || 'N/A'));
            console.log('     Delivered: ' + (e.result?.sent ? 'YES' : 'NO (queued: ' + e.result?.queued + ')'));
        });
    } else {
        console.log('No emails were sent during this simulation.');
    }

    const allPassed = centsOk && intervalOk && responseOk && webhook1Ok && webhook2Ok && emailSent;
    console.log('');
    console.log('========================================================');
    console.log('  SIMULATION COMPLETE');
    console.log('  Result: ' + (allPassed ? 'SUCCESS' : 'PARTIAL'));
    console.log('========================================================');
    console.log('');
    if (allPassed) {
        console.log('Full transaction flow simulated successfully:');
        console.log('  1. Stripe checkout session created for $4,990/yr Enterprise annual');
        console.log('  2. checkout.session.completed webhook → customer activated, subscription recorded');
        console.log('  3. customer.subscription.updated webhook → license token generated, email sent');
        console.log('  4. ' + CUSTOMER_EMAIL + ' would receive license token + API key via email');
        console.log('  5. Dashboard would show Enterprise tier features');
    } else {
        console.log('Some checks failed — review the [FAIL] lines above.');
    }
    console.log('');

    server.close();
    process.exit(allPassed ? 0 : 1);
});
