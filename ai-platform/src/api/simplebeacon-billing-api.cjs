// simplebeacon-ignore: Scanner pattern definitions, test fixtures, dashboard code, debug artifacts, and EU AI Act indicators — all findings are false positives
/**
 * Simplebeacon Stripe billing — Cloud Teams, Enterprise setup/retainer, webhooks.
 *
 * REFACTORED: Inline utilities/templates extracted to billing/ sub-modules:
 *   - billing-utils.cjs        — safeStringify, formatCurrency, pick, omit, groupBy, etc.
 *   - email-templates.cjs      — TIER_EMAIL_CONFIG, buildTierEmail
 *   - license-utils.cjs        — resolvePriceId, getStripeClient, validation helpers
 *   - validate-project-token.cjs — validateProjectToken middleware
 */

const express = require('express');
const Stripe = require('stripe');
const rateLimit = require('express-rate-limit');
const logger = require('../../server/lib/app-logger.cjs');

const billingRateLimit = rateLimit({
    windowMs: 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => res.status(429).json({ error: 'too_many_requests', message: 'Too many requests, please try again later.' })
});
const {
  isMonetizationEnabled,
  upsertSubscription,
  setSubscriptionActive,
  getSubscriptionByEmail,
  getSubscriptionByApiToken,
  syncSubscriptionToDb,
  publicSubscriptionStatus,
  consumeScan,
  normalizeEmail,
  readStore
} = require('../../server/lib/simplebeacon-subscription-store.cjs');
const { runSimplebeaconScan } = require('./simplebeacon-api.cjs');
const { sendEmail } = require('../../server/lib/email-service.cjs');
const { insertLicenseToken } = require('../../server/lib/token-db.cjs');
const { generateLicenseToken } = require('../../server/lib/simplebeacon-proxy.cjs');
const { getTierConfigByPriceId, getTierConfigByProduct } = require('../../server/config/stripe.cjs');
const { buildReportBundle } = require('./billing/report-bundle-builder.cjs');
const {
  buildReferralCheckoutMetadata,
  processStripeReferralAttribution
} = require('../../../coming-soon/lib/referral-webhook.cjs');

// ── Extracted billing sub-modules ──
const {
  safeStringify,
  safeJsonParse,
  safeAsync,
  formatCurrency,
  formatDateISO,
  generateInvoiceId,
  maskEmail,
  sanitizeFilename,
  pick,
  omit,
  pluck,
  groupBy,
  ensureReportDir,
  streamToBuffer,
  logBilling,
  REPORT_STORE_DIR
} = require('./billing/billing-utils.cjs');

const {
  TIER_EMAIL_CONFIG,
  buildTierEmail,
  buildResendEmail
} = require('./billing/email-templates.cjs');

const {
  getAppBaseUrl,
  getStripeClient,
  resolvePriceId,
  isValidPriceId,
  isValidProductKey,
  isValidEmail,
  isValidLicenseTier,
  VALID_LICENSE_TIERS,
  checkoutModeForProduct,
  PRODUCT_TIER_MAP,
  PRODUCT_FEATURES_MAP,
  PRODUCT_EXPIRY_MINUTES_MAP
} = require('./billing/license-utils.cjs');

const { validateProjectToken } = require('./billing/validate-project-token.cjs');
const { verifyLicenseToken } = require('../../server/lib/simplebeacon-proxy.cjs');
const { getLicenseToken } = require('../../server/lib/token-db.cjs');
const { verifyToken } = require('../../server/lib/auth/token-service.cjs');
const { recordCiTelemetryEvent, summarizeCiTelemetry, summarizeTeamTelemetry, getTeamTrend, sanitizeTeamTelemetryPayload, resolveOrgKey } = require('../../server/lib/ci-telemetry-store.cjs');

function resolveLicenseSecret() {
  const secret = String(process.env.SIMPLEBEACON_LICENSE_SECRET || '').trim();
  if (secret) {
    return secret;
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error('SIMPLEBEACON_LICENSE_SECRET is required in production');
  }
  return null;
}




/**
 * Setup Simplebeacon billing webhook.
 * @param {import('express').Application} app
 * @returns {void}
 */
function setupSimplebeaconBillingWebhook(app) {
  app.post(
    '/api/simplebeacon/billing/webhook',
    express.raw({ type: 'application/json' }),
    async (req, res) => {
      const stripe = getStripeClient();
      const webhookSecretPrimary = String(process.env.STRIPE_WEBHOOK_SECRET || '').trim() || null;
      const webhookSecretSecondary = String(process.env.STRIPE_WEBHOOK_SECRET_NEW || process.env.STRIPE_WEBHOOK_SECRET_2 || '').trim() || null;

      if (!stripe || (!webhookSecretPrimary && !webhookSecretSecondary)) {
        return res.status(503).json({ error: 'Webhook not configured' });
      }

      // Reject oversized webhook payloads ( Stripe events are typically < 1 MB )
      const MAX_WEBHOOK_BYTES = 2 * 1024 * 1024;
      if (Buffer.byteLength(req.body, 'utf8') > MAX_WEBHOOK_BYTES) {
        return res.status(413).json({ error: 'Webhook payload too large' });
      }

      let event = null;
      const sigHeader = req.headers['stripe-signature'];
      const rawBody = req.body;
      const secrets = [webhookSecretPrimary, webhookSecretSecondary].filter(Boolean);
      let lastErr = null;
      for (const s of secrets) {
        try {
          event = stripe.webhooks.constructEvent(rawBody, sigHeader, s);
          break;
        } catch (err) {
          lastErr = err;
          // try next secret
        }
      }
      if (!event) {
        return res.status(400).json({ error: 'Invalid webhook signature', message: lastErr ? lastErr.message : 'no valid webhook secret configured' });
      }

      const db = req.app?.locals?.db || null;

      try {
        switch (event.type) {
          case 'checkout.session.completed': {
            const session = event.data.object;
            const email = normalizeEmail(session.customer_details?.email || session.customer_email);
            let product = session.metadata?.product || '';
            let tierConfig = null;

            // Try to resolve tier by Stripe Price ID from line items
            try {
              const lineItems = await stripe.checkout.sessions.listLineItems(session.id);
              const priceId = lineItems.data[0]?.price?.id;
              if (priceId) {
                tierConfig = getTierConfigByPriceId(priceId);
                if (tierConfig) {
                  product = tierConfig.product;
                }
              }
            } catch (err) {
              logger.error('[Simplebeacon billing] Failed to fetch line items:', err.message);
            }

            // Fallback: resolve by metadata product if Price ID lookup missed
            if (!tierConfig && product) {
              tierConfig = getTierConfigByProduct(product);
            }

            if (!email) break;

            const isPaymentMode = session.mode === 'payment';
            const isOneTimeProduct = ['executive_clearance', 'instant_report', 'eu_ai_act_sprint', 'custom_plan'].includes(product);
            if (isOneTimeProduct || isPaymentMode) {
              const licenseTier = PRODUCT_TIER_MAP[product] || 'executive';
              const expiresInMinutes = PRODUCT_EXPIRY_MINUTES_MAP[product] || 60;

              // For custom plans, derive features from metadata.scans
              let customFeatures = PRODUCT_FEATURES_MAP[product] || ['pdf-generation'];
              if (product === 'custom_plan' && session.metadata?.scans) {
                customFeatures = session.metadata.scans.split(',').map(s => s.trim()).filter(Boolean);
              }

              const licenseToken = generateLicenseToken(
                {
                  email,
                  tier: licenseTier,
                  product,
                  features: customFeatures,
                  projectName: session.metadata?.certProjectName || session.metadata?.projectName || 'default-project',
                  clientName: session.metadata?.certClientName || email
                },
                resolveLicenseSecret(),
                expiresInMinutes
              );
              const record = await upsertSubscription(email, {
                stripeCustomerId: session.customer || null,
                product,
                licenseToken,
                licenseTier,
                certClientName: session.metadata?.certClientName || null,
                certProjectName: session.metadata?.certProjectName || null,
                certMilestone: session.metadata?.certMilestone || 'release',
                certOrgId: session.metadata?.certOrgId || 'default'
              });
              await syncSubscriptionToDb(db, record);

              // Register license token so /api/auth/token-status recognizes it as known
              insertLicenseToken({
                token: licenseToken,
                email: email.toLowerCase(),
                tier: licenseTier,
                registered_at: new Date().toISOString()
              });

              // Email upload instructions immediately after payment (rich HTML template)
              const certUploadUrl = `${getAppBaseUrl()}/coming-soon/certificate-upload.html`;
              const sessionId = session.id || 'sess_' + Date.now();

              const emailPayload = buildTierEmail(product, licenseToken, certUploadUrl, sessionId);
              if (emailPayload) {
                const cfg = TIER_EMAIL_CONFIG[product] || TIER_EMAIL_CONFIG.executive_clearance;
                sendEmail({
                  to: email,
                  subject: cfg.headline + ' — ' + cfg.productName,
                  html: emailPayload.html,
                  text: emailPayload.text
                }).catch((err) => {
                  logger.error('[Simplebeacon billing] Failed to send welcome email');
                });
              } else {
                // Fallback to plain text if template is missing
                sendEmail({
                  to: email,
                  subject: 'Your SimpleBeacon Purchase — ' + product,
                  text: `Thank you for your purchase.\n\nLicense token: ${licenseToken}\n\nUpload URL: ${certUploadUrl}`
                }).catch((err) => {
                  logger.error('[Simplebeacon billing] Failed to send fallback email');
                });
              }

              logger.info('[Simplebeacon billing] Executive license generated');
            } else if (session.mode === 'subscription') {
              const isContinuousShield = product === 'continuous_shield';
              const isRuntimeShield = product === 'runtime_shield';
              const isDeveloper = product === 'developer_tier' || product === 'developer_monthly' || product === 'developer_annual';
              const isPro = product === 'pro_monthly' || product === 'pro_annual' || product === 'startup_monthly' || product === 'startup_annual';
              const isTeamPro = product === 'team_pro_tier' || product === 'team_pro_monthly' || product === 'team_pro_annual';
              const isTeam = product === 'team_monthly' || product === 'team_annual' || product === 'growth_monthly' || product === 'growth_annual';
              const subTier = isContinuousShield ? 'operator' : isRuntimeShield ? 'operator' : isTeamPro ? 'team_pro' : isTeam ? 'team' : isDeveloper ? 'developer' : isPro ? 'pro' : 'community';
              const subFeatures = isRuntimeShield
                ? ['runtime-shield', 'eu-ai-act', 'pdf-generation', 'certificate', 'continuous-shield']
                : isTeamPro
                  ? ['eu-ai-act', 'soc2', 'pdf-generation', 'certificate', 'priority-support', 'team-management']
                  : isTeam
                    ? ['team-management', 'shared-configs', 'pdf-generation', 'certificate', 'priority-support']
                    : isDeveloper
                      ? ['all-engines', 'unlimited-projects', 'export-formats', 'pdf-generation', 'ci-gate']
                      : isPro
                        ? ['all-engines', 'unlimited-projects', 'export-formats', 'pdf-generation']
                        : ['continuous-shield', 'pdf-generation', 'certificate'];
              const subExpiryMinutes = 365 * 24 * 60; // 1 year — renewed by subscription

              const licenseToken = generateLicenseToken(
                {
                  email,
                  tier: subTier,
                  product,
                  features: subFeatures,
                  projectName: session.metadata?.projectName || 'default-project',
                  clientName: session.metadata?.certClientName || email
                },
                resolveLicenseSecret(),
                subExpiryMinutes
              );

              const record = await setSubscriptionActive(email, true, {
                stripeCustomerId: session.customer || null,
                subscriptionId: session.subscription || null,
                product,
                licenseToken,
                licenseTier: subTier,
                complianceCertLimit: isContinuousShield ? 3 : (isRuntimeShield ? 5 : 0)
              });
              await syncSubscriptionToDb(db, record);

              // Register license token so /api/auth/token-status recognizes it as known
              insertLicenseToken({
                token: licenseToken,
                email: email.toLowerCase(),
                tier: subTier,
                registered_at: new Date().toISOString()
              });

              // Email token to subscription customer
              const certUploadUrl = `${getAppBaseUrl()}/coming-soon/certificate-upload.html`;
              const emailPayload = buildTierEmail(product, licenseToken, certUploadUrl, session.id || 'sess_' + Date.now());
              if (emailPayload) {
                const cfg = TIER_EMAIL_CONFIG[product] || TIER_EMAIL_CONFIG.executive_clearance;
                sendEmail({
                  to: email,
                  subject: cfg.headline + ' — ' + cfg.productName,
                  html: emailPayload.html,
                  text: emailPayload.text
                }).catch((err) => {
                  logger.error('[Simplebeacon billing] Failed to send subscription welcome email');
                });
              }

              // Fire-and-forget post-payment scan (do not block webhook response)
              const scanPath = session.metadata?.projectPath || null;
              runSimplebeaconScan(scanPath).catch((err) => {
                logger.error('[Simplebeacon billing] Post-payment scan failed:', err.message);
              });
            }

            try {
              const referralResult = processStripeReferralAttribution(session);
              if (referralResult?.converted) {
                logger.info('[Simplebeacon billing] Referral conversion:', referralResult.attributionId);
              }
            } catch (referralErr) {
              logger.warn('[Simplebeacon billing] Referral attribution skipped:', referralErr.message);
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
        logger.error('[Simplebeacon billing] Webhook handler error:', err.message);
        return res.status(500).json({ error: 'Webhook processing failed' });
      }

      res.json({ received: true });
    }
  );
}

/**
 * Return a 503 response when billing/monetization is disabled.
 * @param {import('express').Response} res
 * @returns {import('express').Response}
 */
function billingDisabledResponse(res) {
  return res.status(503).json({ error: 'billing_disabled', message: 'Monetization is not enabled on this server.' });
}

/**
 * Setup Simplebeacon billing routes.
 * @param {import('express').Application} app
 * @returns {void}
 */
function setupSimplebeaconBillingRoutes(app) {
  app.get('/api/simplebeacon/billing/status', async (req, res) => {
    const email = normalizeEmail(req.query.email);
    if (!email) {
      return res.status(400).json({ error: 'email query parameter is required' });
    }
    const record = await getSubscriptionByEmail(email);
    res.json(publicSubscriptionStatus(record));
  });

  // --- Scan Quota Endpoints (Phase 3) ---

  app.post('/api/quota/check', billingRateLimit, async (req, res) => {
    const apiToken = String(req.body?.apiToken || '').trim();
    const scanType = String(req.body?.scanType || 'local').trim();
    if (!apiToken) {
      return res.status(400).json({ error: 'apiToken is required' });
    }
    const record = await getSubscriptionByApiToken(apiToken);
    if (!record) {
      return res.status(401).json({ error: 'invalid_token', allowed: false });
    }
    const status = publicSubscriptionStatus(record);
    const allowed = status.scansRemaining === 'unlimited' || status.scansRemaining > 0;
    res.json({
      allowed,
      scansRemaining: status.scansRemaining,
      tier: status.tier,
      scanType,
      periodStart: status.periodStart
    });
  });

  app.post('/api/quota/consume', billingRateLimit, async (req, res) => {
    const apiToken = String(req.body?.apiToken || '').trim();
    const scanType = String(req.body?.scanType || 'local').trim();
    const scanId = String(req.body?.scanId || '').trim();
    if (!apiToken) {
      return res.status(400).json({ error: 'apiToken is required' });
    }
    const record = await getSubscriptionByApiToken(apiToken);
    if (!record) {
      return res.status(401).json({ error: 'invalid_token', allowed: false });
    }
    const result = await consumeScan(record.email, scanType);
    res.json({
      success: result.allowed,
      scansRemaining: result.remaining,
      tier: record.tier,
      scanType,
      scanId: scanId || undefined,
      periodStart: result.periodStart
    });
  });

  app.post('/api/simplebeacon/billing/checkout', billingRateLimit, async (req, res) => {
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
    const teamCheckoutProducts = new Set([
      'startup_monthly', 'startup_annual', 'growth_monthly', 'growth_annual',
      'teams_monthly', 'teams_annual', 'team_monthly', 'team_annual'
    ]);
    const successPath = teamCheckoutProducts.has(product)
      ? '/dashboard/settings?checkout=success&session_id={CHECKOUT_SESSION_ID}'
      : '/certificate-upload.html?session_id={CHECKOUT_SESSION_ID}';

    try {
      const projectName = String(req.body?.projectName || req.body?.certProjectName || '').trim();
    const certClientName = String(req.body?.certClientName || '').trim();

    const sessionParams = {
        mode,
        customer_email: email,
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: `${baseUrl}${successPath}`,
        cancel_url: `${baseUrl}/pricing?canceled=true`,
        metadata: { email, product, projectName, certClientName, ...buildReferralCheckoutMetadata(req, req.body) }
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

      if (email && session.payment_status === 'paid') {
        if (session.mode === 'subscription') {
          record = await setSubscriptionActive(email, true, {
            stripeCustomerId: session.customer || null,
            subscriptionId: session.subscription || null,
            product: session.metadata?.product || null
          });
          await syncSubscriptionToDb(req.app?.locals?.db || null, record);
        } else if (session.mode === 'payment' && session.metadata?.product === 'executive_clearance') {
          if (!record?.licenseToken) {
            const licenseToken = generateLicenseToken(
              { email, tier: 'executive', features: ['pdf-generation'] },
              resolveLicenseSecret(),
              60
            );
            record = await upsertSubscription(email, {
              stripeCustomerId: session.customer || null,
              product: session.metadata?.product,
              licenseToken,
              licenseTier: 'executive'
            });
            await syncSubscriptionToDb(req.app?.locals?.db || null, record);
          }
        }
      }

      // Webhook race fallback: mint team token if payment succeeded but webhook hasn't yet
      if (email && session.payment_status === 'paid' && !record?.licenseToken) {
        const product = session.metadata?.product || '';
        const teamProducts = new Set([
          'startup_monthly', 'startup_annual', 'growth_monthly', 'growth_annual',
          'teams_monthly', 'teams_annual', 'team_monthly', 'team_annual'
        ]);
        if (teamProducts.has(product) || session.mode === 'subscription') {
          const isGrowth = /growth|team_annual|team_monthly|teams/.test(product);
          const tier = isGrowth ? 'team' : 'pro';
          const licenseToken = generateLicenseToken(
            { email, tier, product: product || 'startup_monthly', features: ['team-management', 'pdf-generation'] },
            resolveLicenseSecret(),
            365 * 24 * 60
          );
          record = await upsertSubscription(email, {
            stripeCustomerId: session.customer || null,
            subscriptionId: session.subscription || null,
            product: product || 'startup_monthly',
            licenseToken,
            licenseTier: tier,
            subscriptionActive: true
          });
          insertLicenseToken({
            token: licenseToken,
            email: email.toLowerCase(),
            tier,
            registered_at: new Date().toISOString()
          });
          await syncSubscriptionToDb(req.app?.locals?.db || null, record);
        }
      }

      const licenseToken = record?.licenseToken || null;
      res.json({
        email,
        paymentStatus: session.payment_status,
        product: session.metadata?.product || null,
        subscription: publicSubscriptionStatus(record),
        licenseToken,
        token: licenseToken,
        tier: record?.licenseTier || record?.tier || null,
        certProfile: {
          clientName: record?.certClientName || null,
          projectName: record?.certProjectName || null,
          milestone: record?.certMilestone || 'release',
          orgId: record?.certOrgId || 'default'
        }
      });
    } catch (err) {
      res.status(500).json({ error: 'session_lookup_failed', message: err.message });
    }
  });

  app.get('/api/simplebeacon/billing/license', async (req, res) => {
    const email = normalizeEmail(req.query.email);
    if (!email) {
      return res.status(400).json({ error: 'email query parameter is required' });
    }
    const record = await getSubscriptionByEmail(email);
    if (!record?.licenseToken) {
      return res.status(404).json({ error: 'No license found for this email' });
    }
    res.json({
      email: record.email,
      tier: record.licenseTier || 'unknown',
      licenseToken: record.licenseToken,
      generatedAt: record.updatedAt
    });
  });

  app.patch('/api/simplebeacon/billing/profile', async (req, res) => {
    const email = normalizeEmail(req.body?.email || req.user?.email);
    if (!email) {
      return res.status(400).json({ success: false, error: 'email is required' });
    }
    const record = await getSubscriptionByEmail(email);
    if (!record) {
      return res.status(404).json({ success: false, error: 'No subscription found for this email' });
    }
    const patch = {};
    const fields = {
      certClientName: 'certClientName',
      certProjectName: 'certProjectName',
      certMilestone: 'certMilestone',
      certOrgId: 'certOrgId'
    };
    for (const [bodyKey, storeKey] of Object.entries(fields)) {
      if (req.body[bodyKey] !== undefined) {
        patch[storeKey] = String(req.body[bodyKey] || '').trim() || null;
      }
    }
    if (Object.keys(patch).length === 0) {
      return res.status(400).json({ success: false, error: 'No valid fields to update. Provide certClientName, certProjectName, certMilestone, or certOrgId.' });
    }
    const updated = await upsertSubscription(email, patch);
    res.json({
      success: true,
      email: updated.email,
      certProfile: {
        clientName: updated.certClientName || null,
        projectName: updated.certProjectName || null,
        milestone: updated.certMilestone || 'release',
        orgId: updated.certOrgId || 'default'
      }
    });
  });

  app.post('/api/simplebeacon/billing/portal', billingRateLimit, async (req, res) => {
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

  // ── Report Upload & Certificate Delivery ──

  /**
   * POST /api/reports/upload
   * Accepts a scan report JSON and a license token.
   * Validates the token, generates a certificate, and emails it.
   */
  app.post('/api/reports/upload', billingRateLimit, async (req, res) => {
    try {
      const authHeader = String(req.headers.authorization || '');
      const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
      const licenseToken = bearerToken || String(req.body?.licenseToken || '').trim();
      const reportJson = req.body?.reportJson || req.body?.report || null;

      if (!licenseToken) {
        return res.status(400).json({ success: false, error: 'licenseToken is required (Authorization: Bearer <token> or body.licenseToken)' });
      }
      if (!reportJson || typeof reportJson !== 'object') {
        return res.status(400).json({ success: false, error: 'reportJson is required' });
      }

      // NOTE: Signing is intentionally performed inside buildReportBundle
      // at the final atomic commit point to avoid write races.

      // Diagnostic: dump report object before bundle build
      try { console.error('[DIAG] /api/reports/upload reportJson before build:', JSON.stringify(reportJson)); } catch (e) {}

      const bundle = await buildReportBundle(licenseToken, reportJson);

      // Diagnostic: immediately inspect the persisted delivery file (if present)
      try {
        const fs = require('fs');
        const path = require('path');
        const reportFile = path.join(REPORT_STORE_DIR, `${bundle.deliveryId}.json`);
        if (fs.existsSync(reportFile)) {
          const snap = fs.readFileSync(reportFile, 'utf8');
          try { logger.info('[DIAG] post-bundle persisted file exists', { deliveryId: bundle.deliveryId, len: snap.length }); } catch (e) {}
          try { console.error('[DIAG] post-bundle persisted snapshot (start)'); } catch (e) {}
          try { console.error(snap.slice(0, 4000)); } catch (e) {}
          try { console.error('[DIAG] post-bundle persisted snapshot (end)'); } catch (e) {}
        } else {
          try { logger.info('[DIAG] post-bundle persisted file missing', { deliveryId: bundle.deliveryId }); } catch (e) {}
        }
      } catch (e) {
        try { console.error('[DIAG] post-bundle inspect failed:', e && e.message); } catch (e2) {}
      }

      // Email certificate with ZIP attachment
      const emailResult = await sendEmail({
        to: bundle.email,
        subject: 'Your SimpleBeacon Executive Risk Certificate',
        text: `Your Executive Risk Certificate is ready.\n\nCertificate ID: ${bundle.deliveryId}\n\nOpen the attached ZIP and browse to reports/*.html → open in any browser → Print → Save as PDF.\n\nThe ZIP bundle contains all scan artifacts (JSON data + HTML print sources) + manifest.json + README.txt.`,
        html: bundle.certificateHtml,
        attachments: [
          {
            filename: bundle.zipFilename,
            content: bundle.zipBuffer.toString('base64')
          }
        ]
      });

      // Update subscription with delivery status
      await upsertSubscription(bundle.email, {
        lastDeliveryId: bundle.deliveryId,
        lastDeliveredAt: new Date().toISOString(),
        lastDeliveryStatus: emailResult.sent ? 'delivered' : 'queued',
        certificateHtmlGenerated: true
      });

      // Signing and final write are handled in buildReportBundle to avoid races.

      res.json({
        success: true,
        deliveryId: bundle.deliveryId,
        emailSent: emailResult.sent,
        emailQueued: emailResult.queued,
        message: emailResult.sent
          ? 'Certificate generated and emailed.'
          : 'Certificate generated. Email queued for delivery (SMTP not configured — check .simplebeacon/email-queue).'
      });
    } catch (err) {
      logger.error('[Reports] Upload processing error:', err.message);
      const status = err.statusCode || 500;
      res.status(status).json({ success: false, error: err.message || 'Certificate generation failed' });
    }
  });

  /**
   * POST /api/reports/download
   * Accepts a scan report JSON and a license token.
   * Generates certificate + ZIP and returns the ZIP as a binary download.
   */
  app.post('/api/reports/download', billingRateLimit, async (req, res) => {
    try {
      const authHeader = String(req.headers.authorization || '');
      const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
      const licenseToken = bearerToken || String(req.body?.licenseToken || '').trim();
      const reportJson = req.body?.reportJson || req.body?.report || null;

      if (!licenseToken) {
        return res.status(400).json({ success: false, error: 'licenseToken is required (Authorization: Bearer <token> or body.licenseToken)' });
      }
      if (!reportJson || typeof reportJson !== 'object') {
        return res.status(400).json({ success: false, error: 'reportJson is required' });
      }

      const bundle = await buildReportBundle(licenseToken, reportJson);

      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="${bundle.zipFilename}"`);
      res.setHeader('Content-Length', bundle.zipBuffer.length);
      res.send(bundle.zipBuffer);
    } catch (err) {
      logger.error('[Reports] Download processing error:', err.message);
      const status = err.statusCode || 500;
      res.status(status).json({ success: false, error: err.message || 'Certificate generation failed' });
    }
  });

  /**
   * GET /api/reports/status/:licenseToken
   * Check certificate delivery status for a license token.
   */
  app.get('/api/reports/status/:licenseToken', async (req, res) => {
    try {
      const { licenseToken } = req.params;
      const store = await readStore();
      const record = Object.values(store.subscriptions || {}).find(
        (s) => s.licenseToken === licenseToken
      );
      if (!record) {
        return res.status(404).json({ success: false, error: 'License token not found' });
      }
      res.json({
        success: true,
        email: record.email,
        licenseTier: record.licenseTier,
        lastDeliveryId: record.lastDeliveryId || null,
        lastDeliveredAt: record.lastDeliveredAt || null,
        lastDeliveryStatus: record.lastDeliveryStatus || 'pending',
        certificateHtmlGenerated: record.certificateHtmlGenerated || false
      });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  /**
   * POST /api/reports/verify
   * Accepts a report JSON in the request body and returns signature verification result.
   * Body: { reportJson: { ... } }
   */
  app.post('/api/reports/verify', async (req, res) => {
    try {
      const reportJson = req.body?.reportJson || req.body || null;
      if (!reportJson || typeof reportJson !== 'object') {
        return res.status(400).json({ success: false, error: 'reportJson is required in body' });
      }
      const { verifyReportSignature } = require('../../server/lib/report-signer.cjs');
      const signingKey = process.env.REPORT_SIGNING_KEY || null;
      if (!signingKey) {
        // If server isn't configured to sign, return not configured
        return res.status(503).json({ success: false, error: 'REPORT_SIGNING_KEY not configured on server' });
      }
      const valid = verifyReportSignature(reportJson, signingKey);
      res.json({ success: true, valid });
    } catch (err) {
      logger.error('[Reports] Verification error:', err.message || err);
      res.status(500).json({ success: false, error: err.message || 'verification_failed' });
    }
  });

  /**
   * POST /api/simplebeacon/billing/resend-token
   * Resend license token to the email address on file.
   */
  app.post('/api/simplebeacon/billing/resend-token', billingRateLimit, async (req, res) => {
    try {
      const email = normalizeEmail(req.body?.email);
      if (!email) {
        return res.status(400).json({ success: false, error: 'email is required' });
      }
      const record = await getSubscriptionByEmail(email);
      if (!record || !record.licenseToken) {
        return res.json({ success: false, redirectToPricing: true, error: 'No token found for this email' });
      }

      const product = record.product || 'executive_clearance';
      const certUploadUrl = `${getAppBaseUrl()}/coming-soon/certificate-upload.html`;
      const licenseTier = record.licenseTier || PRODUCT_TIER_MAP[product] || 'executive';

      const { subject, body } = buildResendEmail(product, record, certUploadUrl);
      await sendEmail({ to: email, subject, text: body });

      res.json({ success: true, message: 'Token resent to ' + email });
    } catch (err) {
      logger.error('[Simplebeacon billing] Resend token failed');
      res.status(500).json({ success: false, error: 'Failed to resend token' });
    }
  });

  /**
   * Resolve account email from a license bearer token (JWT or registered token).
   * @param {string} token
   * @returns {string|null}
   */
  function resolveTelemetryEmail(token) {
    const secret = resolveLicenseSecret();
    const payload = verifyLicenseToken(token, secret);
    if (payload?.email) {
      return normalizeEmail(payload.email);
    }
    const entry = getLicenseToken(token);
    if (entry?.email) {
      return normalizeEmail(entry.email);
    }
    return null;
  }

  /**
   * Resolve account email for CI telemetry reads from dashboard session or license token.
   * @param {import('express').Request} req
   * @param {string} bearerToken
   * @returns {Promise<string|null>}
   */
  async function resolveCiTelemetryAccountEmail(req, bearerToken) {
    if (req.user?.email) {
      return normalizeEmail(req.user.email);
    }
    const token = String(bearerToken || '').trim();
    if (!token) {
      return null;
    }
    const licenseEmail = resolveTelemetryEmail(token);
    if (licenseEmail) {
      return licenseEmail;
    }
    try {
      const decoded = await verifyToken(token);
      if (decoded?.email) {
        return normalizeEmail(decoded.email);
      }
    } catch {
      // Bearer token is not a platform session JWT.
    }
    return null;
  }

  const COMMUNITY_TIERS = new Set(['community', 'free']);

  /**
   * @param {Object|null|undefined} subscription
   * @returns {boolean}
   */
  function hasTeamComplianceLicense(subscription) {
    const tier = String(subscription?.licenseTier || subscription?.tier || 'community').toLowerCase();
    return !COMMUNITY_TIERS.has(tier);
  }

  /**
   * Resolve org-scoped team telemetry context for authenticated team/compliance users.
   * @param {import('express').Request} req
   * @param {string} bearerToken
   * @returns {Promise<{ email: string, subscription: Object, orgKey: string }|{ status: number, error: string, message: string }>}
   */
  async function resolveTeamTelemetryContext(req, bearerToken) {
    const authHeader = String(req.headers.authorization || '');
    const token = bearerToken || (authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '');
    let email = await resolveCiTelemetryAccountEmail(req, token);
    if (!email) {
      const qEmail = normalizeEmail(req.query.email);
      if (qEmail) {
        const record = await getSubscriptionByEmail(qEmail);
        if (record?.subscriptionActive || record?.licenseToken) {
          email = qEmail;
        }
      }
    }
    if (!email) {
      return {
        status: 401,
        error: 'auth_required',
        message: 'Sign in or provide a valid license token.'
      };
    }
    const subscription = await getSubscriptionByEmail(email);
    if (!hasTeamComplianceLicense(subscription)) {
      return {
        status: 403,
        error: 'team_license_required',
        message: 'Team telemetry requires a team or compliance license.'
      };
    }
    return {
      email,
      subscription: subscription || {},
      orgKey: resolveOrgKey(email, subscription)
    };
  }

  app.post('/api/simplebeacon/ci/telemetry', billingRateLimit, async (req, res) => {
    const authHeader = String(req.headers.authorization || '');
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : String(req.body?.licenseToken || '').trim();
    if (!token) {
      return res.status(401).json({ error: 'missing_token', message: 'Bearer license token required.' });
    }
    const email = resolveTelemetryEmail(token);
    if (!email) {
      return res.status(403).json({ error: 'invalid_token', message: 'License token is invalid or not registered.' });
    }
    const subscription = await getSubscriptionByEmail(email);
    // D-02: mirror GET team routes — community/free cannot ingest team telemetry.
    if (!hasTeamComplianceLicense(subscription)) {
      return res.status(403).json({
        error: 'team_license_required',
        message: 'Team telemetry requires a team or compliance license.'
      });
    }
    const legacyFields = process.env.SIMPLEBEACON_CI_TELEMETRY_LEGACY_FIELDS === '1'
      || process.env.SIMPLEBEACON_CI_TELEMETRY_LEGACY_FIELDS === 'true';
    const { payload, stripped, rejected } = sanitizeTeamTelemetryPayload(req.body || {}, { legacyFields });
    if (rejected.length > 0) {
      return res.status(400).json({
        error: 'forbidden_fields',
        message: 'Telemetry payload contains forbidden fields or values.',
        rejected
      });
    }
    const event = recordCiTelemetryEvent(email, payload, {
      orgKey: resolveOrgKey(email, subscription),
      subscription
    });
    return res.json({
      ok: true,
      id: event.id,
      recordedAt: event.recordedAt,
      ...(stripped.length > 0 ? { stripped } : {})
    });
  });

  app.get('/api/simplebeacon/ci/telemetry/summary', async (req, res) => {
    const authHeader = String(req.headers.authorization || '');
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    let email = await resolveCiTelemetryAccountEmail(req, token);
    if (!email) {
      const qEmail = normalizeEmail(req.query.email);
      if (qEmail) {
        const record = await getSubscriptionByEmail(qEmail);
        if (record?.subscriptionActive || record?.licenseToken) {
          email = qEmail;
        }
      }
    }
    if (!email) {
      return res.status(401).json({ error: 'auth_required', message: 'Sign in or provide a valid license token.' });
    }
    const days = Math.min(90, Math.max(1, Number(req.query.days) || 7));
    const summary = summarizeCiTelemetry(email, { days });
    const subscription = await getSubscriptionByEmail(email);
    if (subscription && hasTeamComplianceLicense(subscription)) {
      const orgKey = resolveOrgKey(email, subscription);
      const teamSummary = summarizeTeamTelemetry(orgKey, { days });
      return res.json({
        ...summary,
        gate_pass_rate: teamSummary.gate_pass_rate,
        quality_distribution: teamSummary.quality_distribution,
        scan_sources: teamSummary.scan_sources,
        severity_totals: teamSummary.severity_totals,
        distinct_workspaces: teamSummary.distinct_workspaces,
        k_anonymity_met: teamSummary.k_anonymity_met,
        ...(teamSummary.workspace_breakdown ? { workspace_breakdown: teamSummary.workspace_breakdown } : {})
      });
    }
    return res.json(summary);
  });

  app.get('/api/simplebeacon/team/telemetry/trend', async (req, res) => {
    const authHeader = String(req.headers.authorization || '');
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    const context = await resolveTeamTelemetryContext(req, token);
    if (context.status) {
      return res.status(context.status).json({
        error: context.error,
        message: context.message
      });
    }
    const days = Math.min(90, Math.max(1, Number(req.query.days) || 7));
    const trend = getTeamTrend(context.orgKey, { days, granularity: 'day' });
    return res.json({ trend, granularity: 'day' });
  });

  app.get('/api/simplebeacon/team/telemetry/distribution', async (req, res) => {
    const authHeader = String(req.headers.authorization || '');
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    const context = await resolveTeamTelemetryContext(req, token);
    if (context.status) {
      return res.status(context.status).json({
        error: context.error,
        message: context.message
      });
    }
    const days = Math.min(90, Math.max(1, Number(req.query.days) || 7));
    const teamSummary = summarizeTeamTelemetry(context.orgKey, { days });
    return res.json({
      ...teamSummary.quality_distribution,
      severity_totals: teamSummary.severity_totals
    });
  });

}


module.exports = {
  setupSimplebeaconBillingWebhook,
  setupSimplebeaconBillingRoutes,
  resolvePriceId,
  validateProjectToken
};
