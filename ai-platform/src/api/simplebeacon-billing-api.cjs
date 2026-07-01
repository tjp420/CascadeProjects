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
const { spawn } = require('child_process');
const path = require('path');
const {
  isMonetizationEnabled,
  upsertSubscription,
  setSubscriptionActive,
  getSubscriptionByEmail,
  getSubscriptionByApiToken,
  syncSubscriptionToDb,
  publicSubscriptionStatus,
  consumeScan,
  normalizeEmail
} = require('../../server/lib/simplebeacon-subscription-store.cjs');
const { runSimplebeaconScan } = require('./simplebeacon-api.cjs');
const { sendEmail } = require('../../server/lib/email-service.cjs');
const { insertLicenseToken } = require('../../server/lib/token-db.cjs');
const { generateLicenseToken, verifyLicenseToken } = require('../../../packages/simplebeacon-cli/src/lib/license-token.js');
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
  buildTierEmail
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
  checkoutModeForProduct
} = require('./billing/license-utils.cjs');

const { validateProjectToken } = require('./billing/validate-project-token.cjs');




/**
 * Setup simplebeacon billing webhook.
 * @param {any} app
 * @returns {any}
 */
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
            const isOneTimeProduct = ['executive_clearance', 'instant_report', 'eu_ai_act_sprint', 'custom_plan'].includes(product);
            if (isOneTimeProduct || isPaymentMode) {
              const tierMap = {
                instant_report: 'instant',
                executive_clearance: 'executive',
                eu_ai_act_sprint: 'euai',
                custom_plan: 'custom'
              };
              const licenseTier = tierMap[product] || 'executive';
              const featuresMap = {
                instant_report: ['instant-report'],
                executive_clearance: ['pdf-generation', 'certificate'],
                eu_ai_act_sprint: ['eu-ai-act', 'pdf-generation', 'certificate'],
                custom_plan: ['custom-plan', 'pdf-generation', 'certificate']
              };
              // Tier-based expiry: instant=7 days, executive=90 days, euai=30 days, custom=30 days
              const expiryMap = {
                instant_report: 7 * 24 * 60,
                executive_clearance: 90 * 24 * 60,
                eu_ai_act_sprint: 30 * 24 * 60,
                custom_plan: 30 * 24 * 60
              };
              const expiresInMinutes = expiryMap[product] || 60;

              // For custom plans, derive features from metadata.scans
              let customFeatures = featuresMap[product] || ['pdf-generation'];
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
                  console.error('[Simplebeacon billing] Failed to send welcome email');
                });
              } else {
                // Fallback to plain text if template is missing
                sendEmail({
                  to: email,
                  subject: 'Your SimpleBeacon Purchase — ' + product,
                  text: `Thank you for your purchase.\n\nLicense token: ${licenseToken}\n\nUpload URL: ${certUploadUrl}`
                }).catch((err) => {
                  console.error('[Simplebeacon billing] Failed to send fallback email');
                });
              }

              console.log('[Simplebeacon billing] Executive license generated');
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
                  console.error('[Simplebeacon billing] Failed to send subscription welcome email');
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

/**
 * Setup simplebeacon billing routes.
 * @param {any} app
 * @returns {any}
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

  app.post('/api/quota/check', async (req, res) => {
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

  app.post('/api/quota/consume', async (req, res) => {
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
/**
 * Simplebeacon report.
 * @param {any} (
 * @returns {any}
 */
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
const { generateLicenseToken, verifyLicenseToken } = require('../../server/lib/simplebeacon-proxy.cjs');

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

Your instant report was sent to this email. If you did not receive it, check your spam folder or contact support.`,
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
      console.error('[Simplebeacon billing] Resend token failed');
      res.status(500).json({ success: false, error: 'Failed to resend token' });
    }
  });

  // ── Scan Quota Management ──

  /**
   * POST /api/quota/check
   * Check if a user has scan quota remaining.
   * Body: { apiToken, scanType: 'local' | 'pipeline' }
   */
  app.post('/api/quota/check', async (req, res) => {
    try {
      const { consumeScan, getSubscriptionByApiToken } = require('../../server/lib/simplebeacon-subscription-store.cjs');
      const token = req.body?.apiToken || req.headers['x-api-token'] || '';
      const scanType = req.body?.scanType || 'local';

      if (!token) {
        return res.status(400).json({ allowed: false, reason: 'missing_token' });
      }

      const record = await getSubscriptionByApiToken(token);
      if (!record) {
        return res.status(404).json({ allowed: false, reason: 'unknown_token' });
      }

      const result = await consumeScan(record.email, scanType);
      // Roll back the consumption since this is just a check
      if (result.allowed) {
        const { readStore, writeStore } = require('../../server/lib/simplebeacon-subscription-store.cjs');
        const store = await readStore();
        if (store.subscriptions[record.email]) {
          store.subscriptions[record.email].scansThisPeriod = Math.max(0, store.subscriptions[record.email].scansThisPeriod - 1);
          await writeStore(store);
        }
      }

      res.json({ allowed: result.allowed, scansRemaining: result.remaining, tier: record.tier || 'developer', scanType });
    } catch (err) {
      console.error('[Simplebeacon billing] Quota check failed:', err.message);
      res.status(500).json({ allowed: false, error: 'quota_check_failed', message: err.message });
    }
  });

  /**
   * POST /api/quota/consume
   * Record a scan usage against the user's quota.
   * Body: { apiToken, scanType: 'local' | 'pipeline', scanId }
   */
  app.post('/api/quota/consume', async (req, res) => {
    try {
      const { consumeScan, getSubscriptionByApiToken } = require('../../server/lib/simplebeacon-subscription-store.cjs');
      const token = req.body?.apiToken || req.headers['x-api-token'] || '';
      const scanType = req.body?.scanType || 'local';
      const scanId = req.body?.scanId || '';

      if (!token) {
        return res.status(400).json({ allowed: false, reason: 'missing_token' });
      }

      const record = await getSubscriptionByApiToken(token);
      if (!record) {
        return res.status(404).json({ allowed: false, reason: 'unknown_token' });
      }

      const result = await consumeScan(record.email, scanType);
      res.json({
        allowed: result.allowed,
        scansRemaining: result.remaining,
        scansUsed: result.limit === Infinity ? result.limit : result.limit - result.remaining,
        tier: record.tier || 'developer',
        scanType,
        scanId
      });
    } catch (err) {
      console.error('[Simplebeacon billing] Quota consume failed:', err.message);
      res.status(500).json({ allowed: false, error: 'quota_consume_failed', message: err.message });
    }
  });
}


module.exports = {
  setupSimplebeaconBillingWebhook,
  setupSimplebeaconBillingRoutes,
  resolvePriceId,
  validateProjectToken
};
