/**
 * Simplebeacon Stripe billing — Cloud Teams, Enterprise setup/retainer, webhooks.
 */

const express = require('express');
const Stripe = require('stripe');
const {
  isMonetizationEnabled,
  upsertSubscription,
  setSubscriptionActive,
  getSubscriptionByEmail,
  syncSubscriptionToDb,
  publicSubscriptionStatus,
  normalizeEmail
} = require('../../server/lib/simplebeacon-subscription-store.cjs');

const TEAMS_MONTHLY_LABEL = '$49/month';
const TEAMS_ANNUAL_LABEL = '$390/year';

function getAppBaseUrl() {
  return (
    process.env.SIMPLEBEACON_APP_URL ||
    process.env.PUBLIC_APP_URL ||
    `http://localhost:${process.env.PORT || 54355}`
  ).replace(/\/$/, '');
}

function getStripeClient() {
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) return null;
  return Stripe(secret);
}

function resolvePriceId(product) {
  const map = {
    teams_monthly:
      process.env.STRIPE_PRICE_ID_TEAMS_MONTHLY ||
      process.env.STRIPE_PRICE_ID ||
      process.env.SIMPLEBEACON_PRO_PRICE_ID,
    teams_annual:
      process.env.STRIPE_PRICE_ID_TEAMS_ANNUAL ||
      process.env.STRIPE_ANNUAL_PRICE_ID ||
      process.env.SIMPLEBEACON_ANNUAL_PROMOTION_ID,
    enterprise_setup:
      process.env.STRIPE_PRICE_ID_ENTERPRISE_SETUP ||
      process.env.SIMPLEBEACON_ENTERPRISE_SETUP_ID,
    enterprise_retainer:
      process.env.STRIPE_PRICE_ID_ENTERPRISE_RETAINER ||
      process.env.SIMPLEBEACON_ENTERPRISE_RETAINER_ID
  };
  return map[product] || null;
}

function checkoutModeForProduct(product) {
  if (product === 'enterprise_setup') return 'payment';
  return 'subscription';
}

function billingDisabledResponse(res) {
  return res.status(503).json({
    error: 'billing_unavailable',
    message: 'Monetization is disabled or Stripe is not configured.',
    enabled: isMonetizationEnabled()
  });
}

function buildPlanPayload() {
  const teamsMonthlyId = resolvePriceId('teams_monthly');
  const teamsAnnualId = resolvePriceId('teams_annual');
  const enterpriseSetupId = resolvePriceId('enterprise_setup');
  const enterpriseRetainerId = resolvePriceId('enterprise_retainer');

  return {
    enabled: isMonetizationEnabled(),
    internalDashboard: process.env.SIMPLEBEACON_INTERNAL_DASHBOARD === 'true',
    calendlyUrl: process.env.SIMPLEBEACON_CALENDLY_URL || '',
    foundingMember: {
      slots: Number(process.env.SIMPLEBEACON_FOUNDING_SLOTS || 50),
      label: 'Founding Member Launch',
      active: process.env.SIMPLEBEACON_FOUNDING_LAUNCH !== 'false'
    },
    tiers: {
      community: {
        price: '$0',
        name: 'Community',
        features: [
          'Simplebeacon CLI (local scanning)',
          'JSON + text reports',
          'CI gate (--gate --fail-on high)',
          'minimal / standard / cascade profiles',
          'GitHub Actions + pre-commit hooks'
        ]
      },
      cloudTeams: {
        name: 'Cloud Teams',
        monthly: {
          priceLabel: TEAMS_MONTHLY_LABEL,
          checkoutProduct: 'teams_monthly',
          configured: Boolean(teamsMonthlyId)
        },
        annual: {
          priceLabel: TEAMS_ANNUAL_LABEL,
          savingsLabel: 'Save $198 vs monthly',
          checkoutProduct: 'teams_annual',
          configured: Boolean(teamsAnnualId)
        },
        features: [
          'Hosted dashboard + scan history',
          'Compliance Audit dashboard (scan layers)',
          'Analyze dashboard + CLI assess/compliance',
          'Assessment workflow UI + JSON export',
          'API quota on hosted scan/assess actions',
          'Self-serve config / allowlists in Settings'
        ]
      },
      enterprise: {
        name: 'Enterprise Perimeter',
        setup: {
          priceLabel: 'From $5,000',
          checkoutProduct: 'enterprise_setup',
          configured: Boolean(enterpriseSetupId)
        },
        retainer: {
          priceLabel: '$2,500/month',
          checkoutProduct: 'enterprise_retainer',
          configured: Boolean(enterpriseRetainerId)
        },
        features: [
          'Everything in Cloud Teams (software)',
          'Consultant-led allowlist + CI deploy',
          'Human triage of gate findings',
          'Executive memo for diligence / audits',
          'Reporting-only CI phase before --gate',
          'Optional monthly retainer for curation'
        ]
      }
    },
    // Legacy fields consumed by older clients
    priceLabel: TEAMS_MONTHLY_LABEL,
    tiersLegacy: {
      paid: {
        price: TEAMS_MONTHLY_LABEL,
        features: [
          'Dashboard + scan history',
          'Compliance Audit dashboard',
          'Analyze dashboard + assessments UI',
          'JSON exports + API quota'
        ]
      }
    }
  };
}

function setupSimplebeaconBillingWebhook(app) {
  app.post(
    '/api/simplebeacon/billing/webhook',
    express.raw({ type: 'application/json' }),
    async (req, res) => {
      const stripe = getStripeClient();
      const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

      if (!stripe || !webhookSecret) {
        return res.status(503).json({ error: 'Webhook not configured' });
      }

      let event;
      try {
        event = stripe.webhooks.constructEvent(req.body, req.headers['stripe-signature'], webhookSecret);
      } catch (err) {
        return res.status(400).json({ error: 'Invalid webhook signature', message: err.message });
      }

      const db = req.app?.locals?.db || null;

      try {
        switch (event.type) {
          case 'checkout.session.completed': {
            const session = event.data.object;
            const email = normalizeEmail(session.customer_details?.email || session.customer_email);
            const product = session.metadata?.product || '';
            if (email && session.mode === 'subscription') {
              const record = await setSubscriptionActive(email, true, {
                stripeCustomerId: session.customer || null,
                subscriptionId: session.subscription || null,
                product
              });
              await syncSubscriptionToDb(db, record);
            }
            break;
          }
          case 'customer.subscription.updated': {
            const subscription = event.data.object;
            const email = normalizeEmail(subscription.metadata?.email);
            if (email) {
              const active = ['active', 'trialing'].includes(subscription.status);
              const record = await setSubscriptionActive(email, active, {
                stripeCustomerId: subscription.customer || null,
                subscriptionId: subscription.id,
                product: subscription.metadata?.product || null
              });
              await syncSubscriptionToDb(db, record);
            }
            break;
          }
          case 'customer.subscription.deleted': {
            const subscription = event.data.object;
            const email = normalizeEmail(subscription.metadata?.email);
            if (email) {
              const record = await setSubscriptionActive(email, false, {
                subscriptionId: subscription.id
              });
              await syncSubscriptionToDb(db, record);
            }
            break;
          }
          default:
            break;
        }
      } catch (err) {
        console.error('[Simplebeacon billing] Webhook handler error:', err.message);
        return res.status(500).json({ error: 'Webhook processing failed' });
      }

      res.json({ received: true });
    }
  );
}

function setupSimplebeaconBillingRoutes(app) {
  app.get('/api/simplebeacon/billing/plan', (_req, res) => {
    res.json(buildPlanPayload());
  });

  app.get('/api/simplebeacon/billing/status', async (req, res) => {
    const email = normalizeEmail(req.query.email);
    if (!email) {
      return res.status(400).json({ error: 'email query parameter is required' });
    }
    const record = await getSubscriptionByEmail(email);
    res.json(publicSubscriptionStatus(record));
  });

  app.post('/api/simplebeacon/billing/checkout', async (req, res) => {
    if (!isMonetizationEnabled()) {
      return billingDisabledResponse(res);
    }

    const stripe = getStripeClient();
    const product = String(req.body?.product || 'teams_monthly').trim();
    const priceId = resolvePriceId(product);
    if (!stripe || !priceId) {
      return res.status(503).json({
        error: 'billing_unavailable',
        message: `Checkout not configured for product: ${product}`,
        product
      });
    }

    const email = normalizeEmail(req.body?.email);
    if (!email) {
      return res.status(400).json({ error: 'email is required' });
    }

    await upsertSubscription(email, {});

    const baseUrl = getAppBaseUrl();
    const mode = checkoutModeForProduct(product);

    try {
      const sessionParams = {
        mode,
        customer_email: email,
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: `${baseUrl}/app#/pricing?success=true&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${baseUrl}/app#/pricing?canceled=true`,
        metadata: { email, product }
      };

      if (mode === 'subscription') {
        sessionParams.subscription_data = {
          metadata: { email, product }
        };
      }

      const session = await stripe.checkout.sessions.create(sessionParams);
      res.json({ url: session.url, sessionId: session.id, product });
    } catch (err) {
      res.status(500).json({ error: 'checkout_failed', message: err.message });
    }
  });

  app.get('/api/simplebeacon/billing/session', async (req, res) => {
    const stripe = getStripeClient();
    const sessionId = req.query.session_id;
    if (!stripe || !sessionId) {
      return res.status(400).json({ error: 'session_id is required' });
    }

    try {
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      const email = normalizeEmail(session.customer_details?.email || session.customer_email);
      let record = email ? await getSubscriptionByEmail(email) : null;

      if (email && session.mode === 'subscription' && session.payment_status === 'paid') {
        record = await setSubscriptionActive(email, true, {
          stripeCustomerId: session.customer || null,
          subscriptionId: session.subscription || null,
          product: session.metadata?.product || null
        });
        await syncSubscriptionToDb(req.app?.locals?.db || null, record);
      }

      res.json({
        email,
        paymentStatus: session.payment_status,
        product: session.metadata?.product || null,
        subscription: publicSubscriptionStatus(record)
      });
    } catch (err) {
      res.status(500).json({ error: 'session_lookup_failed', message: err.message });
    }
  });

  app.post('/api/simplebeacon/billing/portal', async (req, res) => {
    if (!isMonetizationEnabled()) {
      return billingDisabledResponse(res);
    }

    const stripe = getStripeClient();
    if (!stripe) {
      return billingDisabledResponse(res);
    }

    const email = normalizeEmail(req.body?.email);
    if (!email) {
      return res.status(400).json({ error: 'email is required' });
    }

    const record = await getSubscriptionByEmail(email);
    if (!record?.stripeCustomerId) {
      return res.status(404).json({ error: 'No Stripe customer for this email' });
    }

    try {
      const session = await stripe.billingPortal.sessions.create({
        customer: record.stripeCustomerId,
        return_url: `${getAppBaseUrl()}/simplebeacon-dashboard/index.html#/pricing`
      });
      res.json({ url: session.url });
    } catch (err) {
      res.status(500).json({ error: 'portal_failed', message: err.message });
    }
  });
}

module.exports = {
  setupSimplebeaconBillingWebhook,
  setupSimplebeaconBillingRoutes,
  buildPlanPayload,
  resolvePriceId
};
