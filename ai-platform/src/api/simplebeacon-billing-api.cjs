/**
 * Simplebeacon Stripe billing — Cloud Teams, Enterprise setup/retainer, webhooks.
 */

const express = require('express');
const Stripe = require('stripe');
const { spawn } = require('child_process');
const path = require('path');
const {
  isMonetizationEnabled,
  upsertSubscription,
  setSubscriptionActive,
  getSubscriptionByEmail,
  syncSubscriptionToDb,
  publicSubscriptionStatus,
  normalizeEmail
} = require('../../server/lib/simplebeacon-subscription-store.cjs');
const { generateLicenseToken, verifyLicenseToken } = require('../../packages/simplebeacon-cli/src/lib/license-token');
const { runSimplebeaconScan } = require('./simplebeacon-api.cjs');
const { sendEmail } = require('../../server/lib/email-service.cjs');
const {
  buildCertificateModel,
  renderCertificateHtml
} = require('../../server/lib/code-hygiene-certificate.cjs');
const { buildCompleteAuditReport } = require('../../server/lib/complete-scan-audit-report.cjs');
const { buildAnalyzeExportZipStream } = require('../../server/lib/analyze-export-bundle.cjs');
const { loadAgencyBranding } = require('../../server/lib/agency-branding-store.cjs');
const { getTierConfigByPriceId, getTierConfigByProduct } = require('../../server/config/stripe.cjs');
const archiver = require('archiver');
const { PassThrough } = require('stream');

function safeStringify(obj, space = 2) {
  const seen = new WeakSet();
  return JSON.stringify(obj, (key, value) => {
    if (typeof value === 'object' && value !== null) {
      if (seen.has(value)) return '[Circular]';
      seen.add(value);
    }
    return value;
  }, space);
}

const REPORT_STORE_DIR = process.env.REPORT_STORE_DIR
  || path.join(process.cwd(), '.simplebeacon', 'report-deliveries');

// Load universal email template once at startup
const EMAIL_TEMPLATE_PATH = path.join(__dirname, '..', '..', '..', 'coming-soon', 'email-template-universal.html');
let emailTemplateHtml = null;
try {
  emailTemplateHtml = require('fs').readFileSync(EMAIL_TEMPLATE_PATH, 'utf8');
} catch {
  emailTemplateHtml = null;
}

const TIER_EMAIL_CONFIG = {
  instant_report: {
    headline: 'Your Report is Ready',
    productName: 'Website Security Report',
    price: '$19.00',
    paymentMethod: 'Paid via Stripe',
    receiptClass: '',
    primaryCta: 'Download Report →',
    stepsTitle: "What you get",
    stepsList: `<li>SEO, SSL, mobile, speed, accessibility, headers audit</li>
      <li>PDF report delivered instantly — download now</li>
      <li>No account, no subscription, no recurring fees</li>`,
    featuresList: `<li>Full website security scan (10+ checks)</li>
      <li>Executive PDF report</li>
      <li>Remediation checklist</li>
      <li>Zero-retention guarantee</li>`,
    privacyText: 'Your domain and report only exist in server RAM during processing. After download, data is explicitly deleted. We do not store or log it.',
    supportText: 'Questions about your report? Email',
    tokenVisible: false,
    featuresVisible: true,
    deliveryVisible: false,
    secondaryVisible: false
  },
  executive_clearance: {
    headline: 'Payment Confirmed',
    productName: 'Executive Risk Certificate',
    price: '$499.00',
    paymentMethod: 'Paid via Stripe',
    receiptClass: '',
    primaryCta: 'Upload Report & Generate Certificate →',
    stepsTitle: 'Next steps',
    stepsList: `<li>Run <code>npx simplebeacon scan --gate --offline</code> locally</li>
      <li>Upload the generated <code>.simplebeacon/report.json</code></li>
      <li>Our analyst reviews and generates your signed certificate</li>
      <li>Receive your Executive Risk Certificate within 48 hours</li>`,
    privacyText: 'Your source code never leaves your machine. Only the scan report JSON (findings summary, no code) is uploaded for certificate generation.',
    supportText: 'Lost your token? Email',
    tokenVisible: true,
    featuresVisible: false,
    deliveryVisible: true,
    deliveryHeadline: '48-Hour Delivery',
    deliveryDetail: 'A compliance analyst will review your scan and generate your signed certificate within 2 business days.',
    secondaryVisible: false
  },
  eu_ai_act_sprint: {
    headline: 'Payment Confirmed',
    productName: 'EU AI Act Sprint',
    price: '$2,499.00',
    paymentMethod: 'Paid via Stripe',
    receiptClass: '',
    primaryCta: 'Launch Dashboard →',
    stepsTitle: 'Self-service workflow',
    stepsList: `<li>Click the dashboard link above</li>
      <li>Paste your license token (already filled if you use the link)</li>
      <li>Upload source code zip or select a local directory</li>
      <li>The scan runs locally — no code leaves your machine</li>
      <li>Download your EU AI Act Readiness PDF instantly</li>`,
    privacyText: 'Your source code never leaves your machine. The scan runs entirely locally in your browser and Node.js process. Only anonymized findings are uploaded for PDF generation.',
    supportText: 'EU AI Act questions? Email',
    tokenVisible: true,
    featuresVisible: false,
    deliveryVisible: false,
    secondaryVisible: false
  },
  continuous_shield: {
    headline: 'Subscription Active',
    productName: 'Continuous Shield',
    price: '$1,499.00 / month',
    paymentMethod: 'Paid via Stripe',
    receiptClass: 'enterprise',
    primaryCta: 'Upload Report & Generate Certificate →',
    stepsTitle: 'Getting started',
    stepsList: `<li>Run <code>npx simplebeacon scan --gate --offline</code> locally</li>
      <li>Upload the generated <code>.simplebeacon/report.json</code></li>
      <li>Generate certificates up to 3 times per month</li>
      <li>Install the GitHub Action for automatic PR gating</li>`,
    privacyText: 'Your source code never leaves your machine. Only the scan report JSON (findings summary, no code) is uploaded for certificate generation.',
    supportText: 'Questions about your subscription? Email',
    tokenVisible: true,
    featuresVisible: false,
    deliveryVisible: false,
    secondaryVisible: false
  },
  runtime_shield: {
    headline: 'Subscription Active',
    productName: 'Runtime Shield',
    price: '$2,999.00 / month',
    paymentMethod: 'Paid via Stripe',
    receiptClass: 'enterprise',
    primaryCta: 'Upload Report & Generate Certificate →',
    stepsTitle: 'Getting started',
    stepsList: `<li>Run <code>npx simplebeacon scan --gate --offline</code> locally</li>
      <li>Upload the generated <code>.simplebeacon/report.json</code></li>
      <li>Generate certificates up to 5 times per month</li>
      <li>Install the Runtime Sentinel for live monitoring</li>`,
    privacyText: 'Your source code never leaves your machine. Only the scan report JSON (findings summary, no code) is uploaded for certificate generation.',
    supportText: 'Questions about your subscription? Email',
    tokenVisible: true,
    featuresVisible: false,
    deliveryVisible: false,
    secondaryVisible: false
  }
};

function buildTierEmail(product, licenseToken, certUploadUrl, sessionId) {
  if (!emailTemplateHtml) return null;
  const cfg = TIER_EMAIL_CONFIG[product] || TIER_EMAIL_CONFIG.executive_clearance;
  const date = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const invoiceId = 'INV-' + Math.random().toString(36).substr(2, 9).toUpperCase();
  const baseUrl = getAppBaseUrl();

  let html = emailTemplateHtml;
  const r = (placeholder, value) => {
    html = html.replace(new RegExp(placeholder, 'g'), value || '');
  };

  r('{{HEADLINE}}', cfg.headline);
  r('{{PRODUCT_NAME}}', cfg.productName);
  r('{{PRICE}}', cfg.price);
  r('{{PAYMENT_METHOD}}', cfg.paymentMethod);
  r('{{DATE}}', date);
  r('{{INVOICE_LINE}}', cfg.price === 'Free' ? 'Community Access' : `Invoice #${invoiceId}`);
  r('{{RECEIPT_CLASS}}', cfg.receiptClass);
  r('{{LICENSE_TOKEN}}', licenseToken || '');
  r('{{PRIMARY_URL}}', `${certUploadUrl}?session_id=${sessionId}`);
  r('{{PRIMARY_CTA}}', cfg.primaryCta);
  r('{{SECONDARY_URL}}', 'https://github.com/tjp420/simplebeacon/blob/main/docs/ANTI-BLOAT-MANIFESTO.md');
  r('{{SECONDARY_CTA}}', cfg.secondaryCta || '');
  r('{{STEPS_TITLE}}', cfg.stepsTitle);
  r('{{STEPS_LIST}}', cfg.stepsList);
  r('{{FEATURES_LIST}}', cfg.featuresList || '');
  r('{{PRIVACY_TEXT}}', cfg.privacyText);
  r('{{SUPPORT_TEXT}}', cfg.supportText);
  r('{{DELIVERY_HEADLINE}}', cfg.deliveryHeadline || '');
  r('{{DELIVERY_DETAIL}}', cfg.deliveryDetail || '');

  // Show/hide sections via CSS class
  r('{{TOKEN_VISIBLE}}', cfg.tokenVisible ? 'visible' : '');
  r('{{SECONDARY_VISIBLE}}', cfg.secondaryVisible ? 'visible' : '');
  r('{{FEATURES_VISIBLE}}', cfg.featuresVisible ? 'visible' : '');
  r('{{DELIVERY_VISIBLE}}', cfg.deliveryVisible ? 'visible' : '');

  const textLines = [
    `${cfg.headline} — ${cfg.productName}`,
    '',
    `Price: ${cfg.price}`,
    cfg.tokenVisible ? `Token: ${licenseToken}` : '',
    '',
    `${cfg.stepsTitle}:`,
    cfg.stepsList.replace(/<[^>]*>/g, ''),
    '',
    `Dashboard: ${certUploadUrl}?session_id=${sessionId}`,
    '',
    cfg.privacyText
  ].filter(Boolean).join('\n');

  return { html, text: textLines };
}

function ensureReportDir() {
  const fs = require('fs');
  if (!fs.existsSync(REPORT_STORE_DIR)) {
    fs.mkdirSync(REPORT_STORE_DIR, { recursive: true });
  }
}

function streamToBuffer(stream) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    stream.on('data', (chunk) => chunks.push(chunk));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
  });
}

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
    executive_clearance:
      process.env.STRIPE_PRICE_ID_EXECUTIVE_CLEARANCE ||
      process.env.SIMPLEBEACON_EXECUTIVE_CLEARANCE_ID,
    instant_report:
      process.env.STRIPE_PRICE_ID_INSTANT_REPORT ||
      process.env.SIMPLEBEACON_INSTANT_REPORT_ID,
    eu_ai_act_sprint:
      process.env.STRIPE_PRICE_ID_EU_AI_ACT_SPRINT ||
      process.env.SIMPLEBEACON_EU_AI_ACT_SPRINT_ID,
    continuous_shield:
      process.env.STRIPE_PRICE_ID_CONTINUOUS_SHIELD ||
      process.env.SIMPLEBEACON_CONTINUOUS_SHIELD_ID,
    runtime_shield:
      process.env.STRIPE_PRICE_ID_RUNTIME_SHIELD ||
      process.env.SIMPLEBEACON_RUNTIME_SHIELD_ID
  };
  return map[product] || null;
}

function checkoutModeForProduct(product) {
  const oneTimeProducts = ['executive_clearance', 'instant_report', 'eu_ai_act_sprint'];
  return oneTimeProducts.includes(product) ? 'payment' : 'subscription';
}

function billingDisabledResponse(res) {
  return res.status(503).json({
    error: 'billing_unavailable',
    message: 'Monetization is disabled or Stripe is not configured.',
    enabled: isMonetizationEnabled()
  });
}

function buildPlanPayload() {
  const continuousShieldId = resolvePriceId('continuous_shield');

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
        model: 'Free / Open Source',
        audience: 'Individual Developers',
        features: [
          'Simplebeacon CLI (local scanning)',
          'Unlimited local repository checking',
          'Terminal diff patching (--fix with Ollama)',
          'JSON + text reports',
          'CI gate (--gate --fail-on high)',
          'GitHub Actions + pre-commit hooks',
          'Privacy-blind --anonymize mode'
        ]
      },
      executive: {
        name: 'Executive Clearance',
        priceLabel: '$499 one-time',
        model: 'Per Report / Token',
        audience: 'Bootstrapped Startups',
        checkoutProduct: 'executive_clearance',
        configured: Boolean(resolvePriceId('executive_clearance')),
        features: [
          'Official EU AI Act audit PDF generation',
          'License token delivered after payment',
          'Hand to investors, boards, or auditors',
          'EU AI Act structured report template',
          'Deterministic rule catalog access',
          'Privacy-blind scan compatibility'
        ]
      },
      continuousShield: {
        name: 'Continuous Shield',
        priceLabel: '$1,499 / month',
        model: 'Subscription',
        audience: 'Growing Engineering Teams',
        checkoutProduct: 'continuous_shield',
        configured: Boolean(continuousShieldId),
        features: [
          'Automated GitHub Action blocking on every PR',
          'Up to 3 compliance certifications per month',
          'Team-wide scan history dashboard',
          'Custom organizational rule schemas',
          'Priority support',
          'Everything in Executive Clearance'
        ]
      },
      runtimeShield: {
        name: 'Runtime Shield',
        priceLabel: '$2,999 / month',
        model: 'Subscription',
        audience: 'AI-First Engineering Teams',
        checkoutProduct: 'runtime_shield',
        configured: Boolean(resolvePriceId('runtime_shield')),
        features: [
          'Everything in Continuous Shield',
          'Runtime sentinel library + middleware',
          'Per-request, per-minute, and per-hour AI API spend caps',
          'Real-time spend dashboard with Slack/PagerDuty alerts',
          'Custom budget-policy rule authoring',
          'Dedicated cost-governance onboarding'
        ]
      },
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
              console.error('[Simplebeacon billing] Failed to fetch line items:', err.message);
            }

            // Fallback: resolve by metadata product if Price ID lookup missed
            if (!tierConfig && product) {
              tierConfig = getTierConfigByProduct(product);
            }

            if (!email) break;

            const isPaymentMode = session.mode === 'payment';
            const isOneTimeProduct = ['executive_clearance', 'instant_report', 'eu_ai_act_sprint'].includes(product);
            if (isOneTimeProduct || isPaymentMode) {
              const tierMap = {
                instant_report: 'instant',
                executive_clearance: 'executive',
                eu_ai_act_sprint: 'euai'
              };
              const licenseTier = tierMap[product] || 'executive';
              const featuresMap = {
                instant_report: ['instant-report'],
                executive_clearance: ['pdf-generation', 'certificate'],
                eu_ai_act_sprint: ['eu-ai-act', 'pdf-generation', 'certificate']
              };
              // Tier-based expiry: instant=7 days, executive=90 days, euai=30 days
              const expiryMap = {
                instant_report: 7 * 24 * 60,
                executive_clearance: 90 * 24 * 60,
                eu_ai_act_sprint: 30 * 24 * 60
              };
              const expiresInMinutes = expiryMap[product] || 60;

              const licenseToken = generateLicenseToken(
                {
                  email,
                  tier: licenseTier,
                  product,
                  features: featuresMap[product] || ['pdf-generation'],
                  projectName: session.metadata?.certProjectName || session.metadata?.projectName || 'default-project',
                  clientName: session.metadata?.certClientName || email
                },
                process.env.SIMPLEBEACON_LICENSE_SECRET || 'simplebeacon-dev-insecure',
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
                  console.error('[Simplebeacon billing] Failed to send welcome email:', err.message);
                });
              } else {
                // Fallback to plain text if template is missing
                sendEmail({
                  to: email,
                  subject: 'Your SimpleBeacon Purchase — ' + product,
                  text: `Thank you for your purchase.\n\nLicense token: ${licenseToken}\n\nUpload URL: ${certUploadUrl}`
                }).catch((err) => {
                  console.error('[Simplebeacon billing] Failed to send fallback email:', err.message);
                });
              }

              console.log(`[Simplebeacon billing] Executive license generated for ${email}: ${licenseToken.slice(0, 24)}...`);
            } else if (session.mode === 'subscription') {
              const isContinuousShield = product === 'continuous_shield';
              const isRuntimeShield = product === 'runtime_shield';
              const subTier = isContinuousShield ? 'operator' : isRuntimeShield ? 'operator' : 'community';
              const subFeatures = isRuntimeShield
                ? ['runtime-shield', 'eu-ai-act', 'pdf-generation', 'certificate', 'continuous-shield']
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
                process.env.SIMPLEBEACON_LICENSE_SECRET || 'simplebeacon-dev-insecure',
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
                  console.error('[Simplebeacon billing] Failed to send subscription welcome email:', err.message);
                });
              }

              // Fire-and-forget post-payment scan (do not block webhook response)
              const scanPath = session.metadata?.projectPath || null;
              runSimplebeaconScan(scanPath).catch((err) => {
                console.error('[Simplebeacon billing] Post-payment scan failed:', err.message);
              });
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
      const projectName = String(req.body?.projectName || req.body?.certProjectName || '').trim();
    const certClientName = String(req.body?.certClientName || '').trim();

    const sessionParams = {
        mode,
        customer_email: email,
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: `${baseUrl}/coming-soon/certificate-upload.html?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${baseUrl}/app#/pricing?canceled=true`,
        metadata: { email, product, projectName, certClientName }
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
              process.env.SIMPLEBEACON_LICENSE_SECRET || 'simplebeacon-dev-insecure',
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

      res.json({
        email,
        paymentStatus: session.payment_status,
        product: session.metadata?.product || null,
        subscription: publicSubscriptionStatus(record),
        licenseToken: record?.licenseTier === 'executive' ? record.licenseToken : null,
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

  // ── Report Upload & Certificate Delivery ──

  /**
   * Shared helper: validates token, generates certificate + audit report + ZIP.
   * Returns bundle object for both email and direct-download flows.
   */
  async function buildReportBundle(licenseToken, reportJson) {
    const { readStore } = require('../../server/lib/simplebeacon-subscription-store.cjs');
    const store = await readStore();
    let record = Object.values(store.subscriptions || {}).find(
      (s) => s.licenseToken === licenseToken
    );
    let payload = null;
    if (!record) {
      // Fallback: cryptographically verify tokens not in store
      const secret = process.env.SIMPLEBEACON_LICENSE_SECRET || 'simplebeacon-dev-insecure';
      payload = verifyLicenseToken(licenseToken, secret);
      if (!payload) {
        const err = new Error('Invalid license token');
        err.statusCode = 401;
        throw err;
      }
      const tier = payload.tier || 'executive';
      record = {
        licenseToken,
        licenseTier: tier,
        email: payload.email || '',
        features: payload.features || [],
        certClientName: payload.clientName || 'Client',
        certProjectName: payload.projectName || 'Project'
      };
    } else {
      // Token found in store — enrich with cert fields from payload if missing
      const secret = process.env.SIMPLEBEACON_LICENSE_SECRET || 'simplebeacon-dev-insecure';
      payload = verifyLicenseToken(licenseToken, secret);
      if (payload) {
        record.certClientName = record.certClientName || payload.clientName || record.clientName || 'Client';
        record.certProjectName = record.certProjectName || payload.projectName || record.projectName || 'Project';
      }
    }
    if (!['executive', 'agency', 'universal', 'euai', 'instant', 'community'].includes(record.licenseTier)) {
      const err = new Error('License tier does not include certificate delivery');
      err.statusCode = 403;
      throw err;
    }

    const email = record.email;
    const deliveryId = `delivery_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    // Store the uploaded report
    ensureReportDir();
    const fs = require('fs');
    const reportPath = path.join(REPORT_STORE_DIR, `${deliveryId}.json`);
    fs.writeFileSync(reportPath, JSON.stringify(reportJson, null, 2));

    // Load payer-specific agency branding (configured at payment time via certOrgId)
    let branding = null;
    try {
      const platformRoot = path.join(__dirname, '..', '..');
      branding = loadAgencyBranding(platformRoot, record.certOrgId || 'default');
    } catch {
      branding = null;
    }

    // Generate certificate using stored cert profile (pre-configured at payment)
    const certificateModel = buildCertificateModel({
      report: reportJson,
      certificate_id: deliveryId,
      generated_at: new Date().toISOString(),
      milestone: record.certMilestone || 'release',
      client_name: record.certClientName || 'Client',
      project_name: record.certProjectName || 'Project',
      agency_name: branding?.agency_name || record.email || 'SimpleBeacon',
      branding: branding || { agency_name: record.email || 'SimpleBeacon' }
    });
    const certificateHtml = renderCertificateHtml(certificateModel);

    const totalScanned = reportJson.ruleScopedFilesAnalyzed
      || reportJson.repositoryFilesTotal
      || reportJson.llmSlopFilesScanned
      || 0;

    // Generate full audit report HTML (printable PDF source)
    let auditReportHtml = null;
    let auditReportFilename = null;
    try {
      const auditResult = await buildCompleteAuditReport({
        type: 'simplebeacon-complete-scan',
        version: '1.3.0',
        generatedAt: new Date().toISOString(),
        projectPath: reportJson.projectRoot || reportJson.scanTargetRoot || '',
        results: results
      }, {
        client: record.certClientName || 'Client',
        company: record.certClientName || 'Client',
        assessor: 'SimpleBeacon',
        aiProvider: 'demo'
      });
      auditReportHtml = auditResult.html;
      auditReportFilename = auditResult.filename;
    } catch (auditErr) {
      console.warn('[Reports] Audit report generation skipped:', auditErr.message);
    }

    // Build full export ZIP with all JSON artifacts + HTML reports via analyze-export-bundle
    const TIER_TO_DELIVERABLE_SKU = {
      community: 'community',
      executive: 'clearance499',
      agency: 'agency999',
      universal: 'operator',
      euai: 'euai2499',
      instant: 'moneyPrinter19'
    };
    const PRODUCT_TO_DELIVERABLE_SKU = {
      executive_clearance: 'clearance499',
      eu_ai_act_sprint: 'euai2499',
      instant_report: 'moneyPrinter19',
      community: 'community'
    };
    const tierLabel = TIER_TO_DELIVERABLE_SKU[record.licenseTier]
      || PRODUCT_TO_DELIVERABLE_SKU[record.product]
      || record.product
      || 'operator';
    // Extract embedded analysis results from upload-directory reportJson
    const embeddedResults = reportJson._completeResults || {};
    const simplebeaconReport = (() => {
      if (!reportJson.gate && !reportJson.issues) return null;
      const base = { ...reportJson };
      const embeddedKeys = [
        '_completeResults', '_codebaseAnalysis', '_npmAuditAnalysis',
        '_complianceAnalysis', '_dataCleanupAnalysis', '_dataQualityAnalysis',
        '_cleanupAssistantAnalysis', '_fileReductionAnalysis', '_roadmapAnalysis',
        '_consolidationAnalysis', '_mockScanAnalysis', '_euAiActAnalysis',
        '_analysisError'
      ];
      for (const key of embeddedKeys) delete base[key];
      return base;
    })();
    // Browser sandbox sends results as direct keys; ai-platform CLI sends as _ prefixed keys
    const browserMockScan = reportJson.mockDataCategories?.length ? { categories: reportJson.mockDataCategories, total: reportJson.mockSampleFiles || reportJson.mockDataCategories.length } : null;
    const browserDataQuality = reportJson.dataQuality?.emptyJsonCount !== undefined ? reportJson.dataQuality : null;
    const browserCleanup = reportJson.cleanup?.debugArtifactCount !== undefined ? reportJson.cleanup : null;
    const browserNpmAudit = reportJson.npmAudit?.packageJsonCount !== undefined ? reportJson.npmAudit : null;
    const browserCompliance = reportJson.compliance?.licenseCount !== undefined ? reportJson.compliance : null;
    const browserEuAiAct = reportJson.euAiActSummary?.highRiskIndicators !== undefined ? reportJson.euAiActSummary : null;

    const results = {
      simplebeacon: embeddedResults.simplebeacon || simplebeaconReport || reportJson,
      codebase: embeddedResults.codebase || reportJson._codebaseAnalysis || reportJson.codebase || null,
      mockScan: embeddedResults.mockScan || reportJson._mockScanAnalysis || browserMockScan || null,
      roadmap: embeddedResults.roadmap || reportJson._roadmapAnalysis || reportJson.roadmap || null,
      consolidation: embeddedResults.consolidation || reportJson._consolidationAnalysis || reportJson.consolidation || null,
      fileReduction: embeddedResults.fileReduction || reportJson._fileReductionAnalysis || reportJson.fileReduction || null,
      dataQuality: embeddedResults.dataQuality || embeddedResults.dataCleanup || reportJson._dataQualityAnalysis || browserDataQuality || null,
      cleanupAssistant: embeddedResults.cleanupAssistant || reportJson._cleanupAssistantAnalysis || browserCleanup || null,
      npmAudit: embeddedResults.npmAudit || reportJson._npmAuditAnalysis || browserNpmAudit || null,
      compliance: embeddedResults.compliance || reportJson._complianceAnalysis || browserCompliance || null,
      euAiAct: embeddedResults.euAiAct || reportJson._euAiActAnalysis || browserEuAiAct || (reportJson.type === 'simplebeacon-eu-ai-act-sprint' ? reportJson : null) || null
    };
    // Derive enginesRun from which result keys have actual data
    const enginesRun = [
      'simplebeacon',
      ...(results.codebase ? ['codebase'] : []),
      ...(results.mockScan ? ['mock-scan'] : []),
      ...(results.roadmap ? ['roadmap'] : []),
      ...(results.consolidation ? ['consolidation'] : []),
      ...(results.fileReduction ? ['file-reduction'] : []),
      ...(results.dataQuality ? ['data-quality'] : []),
      ...(results.cleanupAssistant ? ['cleanup-assistant'] : []),
      ...(results.npmAudit ? ['npm-audit'] : []),
      ...(results.compliance ? ['compliance'] : []),
      ...(results.euAiAct ? ['eu-ai-act'] : [])
    ];
    // Alias sprint for EU AI Act export bundle compatibility
    if (results.euAiAct && !results.sprint) {
      results.sprint = results.euAiAct;
    }
    const completeScanPayload = {
      type: 'simplebeacon-complete-scan',
      version: '1.3.0',
      generatedAt: new Date().toISOString(),
      projectPath: reportJson.projectRoot || reportJson.scanTargetRoot || '',
      results,
      enginesRun,
      analysisConfig: { selectedEngines: enginesRun }
    };
    console.log('[buildReportBundle] results keys with data:', Object.keys(results).filter(k => !!results[k]));
    console.log('[buildReportBundle] enginesRun:', enginesRun);

    let zipBuffer;
    let zipFilename;
    try {
      const { stream, filename } = await buildAnalyzeExportZipStream(completeScanPayload, {
        deliverableSku: tierLabel,
        internalDashboard: true,
        hasAuditDeliverableAccess: true,
        client: record.certClientName || 'Client',
        company: record.certClientName || 'Client',
        projectName: record.certProjectName || 'Project',
        assessor: 'SimpleBeacon',
        includeEuAiAct: tierLabel === 'euai2499' || record.licenseTier === 'euai2499' || record.licenseTier === 'euai' || record.licenseTier === 'universal'
      });
      zipBuffer = await streamToBuffer(stream);
      zipFilename = filename;
    } catch (zipErr) {
      console.warn('[Reports] Full export ZIP failed, falling back to minimal:', zipErr.message, zipErr.code || '');
      // Fallback: build a minimal ZIP that includes the correct analysis artifacts
      const chunks = [];
      const pass = new PassThrough();
      const archive = archiver('zip', { zlib: { level: 9 } });
      pass.on('data', (c) => chunks.push(c));
      pass.on('end', () => { zipBuffer = Buffer.concat(chunks); });
      archive.pipe(pass);
      const date = new Date().toISOString().slice(0, 10);
      const slug = String(reportJson.projectRoot || reportJson.scanTargetRoot || 'project')
        .replace(/[\\/]/g, '-').replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 40);
      const root = `simplebeacon-export-${tierLabel}-${slug}-${date}`;
      archive.append(certificateHtml, { name: `${root}/reports/agency-certificate.html` });
      if (auditReportHtml) archive.append(auditReportHtml, { name: `${root}/reports/executive-audit.html` });
      if (results.euAiAct?.html) {
        archive.append(results.euAiAct.html, { name: `${root}/reports/eu-ai-act-audit.html` });
      } else if (results.euAiAct) {
        try {
          const { buildEuAiActAuditReport } = require('../lib/eu-ai-act-audit-report.cjs');
          const gateReport = results.simplebeacon || reportJson;
          const eu = await buildEuAiActAuditReport({
            projectPath: reportJson.projectRoot || reportJson.scanTargetRoot || '',
            clientName: record.certClientName || 'Client',
            artifacts: {
              report: gateReport,
              platformRoot: reportJson.projectRoot || reportJson.scanTargetRoot || ''
            }
          });
          archive.append(eu.html, { name: `${root}/reports/eu-ai-act-audit.html` });
        } catch (euErr) {
          console.warn('[Reports] EU AI Act audit HTML generation skipped in fallback:', euErr.message);
        }
      }

      // Write the primary report
      const primaryReport = reportJson._completeResults || reportJson;
      let primaryText;
      try { primaryText = JSON.stringify(primaryReport, null, 2); }
      catch (e) { primaryText = safeStringify(primaryReport, 2); }
      archive.append(primaryText, { name: `${root}/json/report.json` });

      // Write all computed analysis artifacts regardless of tier
      const analysisMap = {
        '_mockScanAnalysis': { file: 'json/fiction-digest.json' },
        '_codebaseAnalysis': { file: 'json/codebase-summary.json' },
        '_roadmapAnalysis': { file: 'json/roadmap.json' },
        '_complianceAnalysis': { file: 'json/compliance-checklist.json' },
        '_fileReductionAnalysis': { file: 'json/file-reduction.json' },
        '_dataQualityAnalysis': { file: 'json/data-quality.json' },
        '_cleanupAssistantAnalysis': { file: 'json/cleanup-brief.json' },
        '_npmAuditAnalysis': { file: 'json/npm-audit.json' },
        '_euAiActAnalysis': { file: 'json/eu-ai-act-sprint.json' },
        '_consolidationAnalysis': { file: 'json/consolidation.json' },
        '_reAttestationReadme': { file: 'json/re-attestation-note.json' }
      };
      for (const [key, meta] of Object.entries(analysisMap)) {
        if (reportJson[key]) {
          let text;
          try { text = JSON.stringify(reportJson[key], null, 2); }
          catch (e) { text = safeStringify(reportJson[key], 2); }
          archive.append(text, { name: `${root}/${meta.file}` });
        }
      }

      // Build a minimal manifest
      const manifest = {
        type: 'simplebeacon-export-bundle-manifest',
        version: '1.0.0',
        generatedAt: new Date().toISOString(),
        tierId: tierLabel,
        fallback: true,
        fallbackReason: zipErr.message,
        artifactCount: 1 + Object.entries(analysisMap).filter(([k]) => reportJson[k]).length
      };
      let manifestText;
      try { manifestText = JSON.stringify(manifest, null, 2); }
      catch (e) { manifestText = safeStringify(manifest, 2); }
      archive.append(manifestText, { name: `${root}/manifest.json` });

      archive.append('SimpleBeacon fallback export — analysis artifacts included.\n', { name: `${root}/README.txt` });
      await archive.finalize();
      pass.end();
      zipFilename = `${root}.zip`;
    }

    return { record, email, deliveryId, certificateHtml, auditReportHtml, zipBuffer, zipFilename };
  }

  /**
   * POST /api/reports/upload
   * Accepts a scan report JSON and a license token.
   * Validates the token, generates a certificate, and emails it.
   */
  app.post('/api/reports/upload', async (req, res) => {
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
      const { upsertSubscription } = require('../../server/lib/simplebeacon-subscription-store.cjs');
      await upsertSubscription(bundle.email, {
        lastDeliveryId: bundle.deliveryId,
        lastDeliveredAt: new Date().toISOString(),
        lastDeliveryStatus: emailResult.sent ? 'delivered' : 'queued',
        certificateHtmlGenerated: true
      });

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
      console.error('[Reports] Upload processing error:', err.message);
      const status = err.statusCode || 500;
      res.status(status).json({ success: false, error: err.message || 'Certificate generation failed' });
    }
  });

  /**
   * POST /api/reports/download
   * Accepts a scan report JSON and a license token.
   * Generates certificate + ZIP and returns the ZIP as a binary download.
   */
  app.post('/api/reports/download', async (req, res) => {
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
      console.error('[Reports] Download processing error:', err.message);
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
      const { readStore } = require('../../server/lib/simplebeacon-subscription-store.cjs');
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
   * POST /api/simplebeacon/billing/resend-token
   * Resend license token to the email address on file.
   */
  app.post('/api/simplebeacon/billing/resend-token', async (req, res) => {
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
      const tierMap = {
        instant_report: 'instant',
        executive_clearance: 'executive',
        eu_ai_act_sprint: 'euai'
      };
      const licenseTier = record.licenseTier || tierMap[product] || 'executive';

      const productEmailSubject = {
        instant_report: 'Your SimpleBeacon Instant Report — Token Resent',
        executive_clearance: 'Your SimpleBeacon Executive Risk Certificate — Token Resent',
        eu_ai_act_sprint: 'Your SimpleBeacon EU AI Act Sprint — Token Resent'
      };

      const productEmailBody = {
        instant_report: `Here is your license token again:

${record.licenseToken}

Your instant report was sent to this email. If you did not receive it, check your spam folder or contact trevor_punt@live.com.`,
        executive_clearance: `Here is your license token again:

${record.licenseToken}

Upload your scan report at: ${certUploadUrl}

1. Run the scan locally: npx simplebeacon scan --gate --offline
2. Upload your report JSON and paste the token above.
3. We will generate your certificate within 48 hours.`,
        eu_ai_act_sprint: `Here is your license token again:

${record.licenseToken}

Upload your scan at: ${certUploadUrl}

1. Run the EU AI Act scan: npx simplebeacon scan --gate --offline --config .simplebeacon/config-full-coverage.json
2. Upload your report JSON and paste the token above.
3. We will generate your EU AI Act Readiness Report within 48 hours.`
      };

      await sendEmail({
        to: email,
        subject: productEmailSubject[product] || productEmailSubject.executive_clearance,
        text: productEmailBody[product] || productEmailBody.executive_clearance
      });

      res.json({ success: true, message: 'Token resent to ' + email });
    } catch (err) {
      console.error('[Simplebeacon billing] Resend token failed:', err.message);
      res.status(500).json({ success: false, error: 'Failed to resend token' });
    }
  });
}

/**
 * Middleware: validates a SimpleBeacon license token (project-bound, time-bound).
 * Checks token signature, expiry, and attaches project context to req.
 */
function validateProjectToken(req, res, next) {
  const { verifyLicenseToken } = require('../../packages/simplebeacon-cli/src/lib/license-token');
  const authHeader = String(req.headers.authorization || '');
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : (req.body?.licenseToken || req.query?.licenseToken || '');

  if (!token) {
    return res.status(401).json({ error: 'missing_token', message: 'License token required. Paste the token from your payment email.' });
  }

  const payload = verifyLicenseToken(token, process.env.SIMPLEBEACON_LICENSE_SECRET || 'simplebeacon-dev-insecure');
  if (!payload) {
    return res.status(403).json({ error: 'invalid_token', message: 'License token is invalid or expired.' });
  }

  // Attach project context for downstream handlers
  req.licensePayload = payload;
  req.projectContext = {
    email: payload.email,
    tier: payload.tier,
    product: payload.product,
    features: payload.features || [],
    projectName: payload.projectName || 'default-project',
    clientName: payload.clientName || payload.email,
    issuedAt: payload.iat,
    expiresAt: payload.exp
  };

  next();
}

module.exports = {
  setupSimplebeaconBillingWebhook,
  setupSimplebeaconBillingRoutes,
  buildPlanPayload,
  resolvePriceId,
  validateProjectToken
};
