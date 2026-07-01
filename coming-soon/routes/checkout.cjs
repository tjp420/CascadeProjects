/**
 * Test checkout route — generates a license token immediately without Stripe.
 */

const express = require('express');
const path = require('path');
const router = express.Router();
const { sendEmail } = require('../services/email.cjs');
const { generateLicenseToken, escapeHtml } = require('../lib/license-utils.cjs');

// Stripe client for Custom Plan checkout sessions (resolves from root node_modules)
let stripe = null;
try { stripe = require('stripe')(process.env.STRIPE_SECRET_KEY || ''); } catch { stripe = null; }

const SCAN_OPTION_MAP = {
  gate: { name: 'Gate Scan', price: 29 },
  consolidation: { name: 'Consolidation', price: 19 },
  'mock-data': { name: 'Mock Data', price: 19 },
  roadmap: { name: 'Roadmap', price: 19 },
  codebase: { name: 'Codebase Audit', price: 49 },
  'file-reduction': { name: 'File Reduction', price: 29 },
  'data-quality': { name: 'Data Quality', price: 39 },
  cleanup: { name: 'Cleanup', price: 19 },
  'npm-audit': { name: 'npm Audit', price: 29 },
  compliance: { name: 'Compliance', price: 49 },
  'eu-ai-act': { name: 'EU AI Act', price: 99 },
  'dependency-vulns': { name: 'Dependency Vulns', price: 29 },
  'build-readiness': { name: 'Build Readiness', price: 19 },
  'ai-indicators': { name: 'AI System Indicators', price: 19 },
  governance: { name: 'License & Governance', price: 19 }
};

const logger = {
    error: (...a) => { const c = globalThis.console; c.error(...a); }
};

// Email template constants
const EMAIL_STYLES = {
    codeBg: '#f4f4f4',
    codePadding: '2px 6px',
    codeRadius: '4px',
    ctaPadding: '10px 18px',
    ctaBg: '#2ea44f',
    ctaRadius: '6px',
    mutedColor: '#666',
    finePrintSize: '0.9em',
    finePrintMargin: '12px'
};

function buildFallbackEmailHtml(clientName, email, projectName, config, token, certUrl) {
    var s = EMAIL_STYLES;
    return '<p>Hi ' + escapeHtml(clientName || email) + ',</p>' +
        '<p>Your license token for <strong>' + escapeHtml(projectName) + '</strong> has been generated.</p>' +
        '<p>Tier: <strong>' + escapeHtml(config.label) + '</strong><br>' +
        'Project: <strong>' + escapeHtml(projectName) + '</strong><br>' +
        'Token: <code style="background:' + s.codeBg + ';padding:' + s.codePadding + ';border-radius:' + s.codeRadius + ';">' + token + '</code></p>' +
        '<p><a href="' + certUrl + '" style="display:inline-block;padding:' + s.ctaPadding + ';background:' + s.ctaBg + ';color:#fff;text-decoration:none;border-radius:' + s.ctaRadius + ';">Upload Report &amp; Download Certificate</a></p>' +
        '<p>This token expires in ' + config.days + ' days.</p>' +
        '<p style="color:' + s.mutedColor + ';font-size:' + s.finePrintSize + ';margin-top:' + s.finePrintMargin + ';"><strong>Didn\'t see this email?</strong> Check your spam or junk folder — license tokens sometimes end up there. If it\'s missing, contact support.</p>';
}

const DEFAULT_PORT = 3001;
const PUBLIC_URL = process.env.PUBLIC_URL || ('http://' + 'localhost' + ':' + (process.env.PORT || DEFAULT_PORT));

// In-memory store: sessionId -> { token, email, projectName, createdAt }
const sessionTokenStore = new Map();
const MS_PER_HOUR = 60 * 60 * 1000;
const SESSION_TOKEN_TTL_MS = 24 * MS_PER_HOUR; // 24 hours

function cleanupSessionTokens() {
    const now = Date.now();
    for (const [sid, entry] of sessionTokenStore) {
        if (now - entry.createdAt > SESSION_TOKEN_TTL_MS) sessionTokenStore.delete(sid);
    }
}
setInterval(cleanupSessionTokens, 60 * 60 * 1000);

// Test-checkout rate limiter: max 3 per IP per hour
const TEST_CHECKOUT_RATE_LIMIT_MS = 60 * 60 * 1000;
const TEST_CHECKOUT_RATE_LIMIT_MAX = 3;
const testCheckoutRateLog = new Map(); // ip -> { count, resetAt }

router.post('/api/test-checkout', async (req, res) => {
    try {
        const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
        const now = Date.now();
        const tcEntry = testCheckoutRateLog.get(clientIp);
        if (tcEntry && now < tcEntry.resetAt) {
            if (tcEntry.count >= TEST_CHECKOUT_RATE_LIMIT_MAX) {
                return res.status(429).json({ error: 'Too many test checkout requests. Please try again later.' });
            }
            tcEntry.count++;
        } else {
            testCheckoutRateLog.set(clientIp, { count: 1, resetAt: now + TEST_CHECKOUT_RATE_LIMIT_MS });
        }

        const { email, projectName, clientName, tier, scans } = req.body;
        if (!email || !projectName) {
            return res.status(400).json({ error: 'Email and project name are required.' });
        }

        // Block paid-tier bypass via test endpoint in production
        const paidTiers = ['instant_report', 'executive_clearance', 'eu_ai_act_sprint', 'runtime_shield', 'custom_plan'];
        const isPaidTier = paidTiers.includes(tier) || (Array.isArray(scans) && scans.length > 0);
        if (isPaidTier && process.env.SIMPLEBEACON_DEMO_MODE !== 'true') {
            return res.status(403).json({ error: 'Paid tiers require Stripe checkout. Use /api/create-checkout-session instead.' });
        }
        if (typeof projectName !== 'string' || projectName.length > 200) {
            return res.status(400).json({ error: 'Project name must be a string under 200 characters.' });
        }
        if (clientName && (typeof clientName !== 'string' || clientName.length > 200)) {
            return res.status(400).json({ error: 'Client name must be a string under 200 characters.' });
        }

        const tierMap = {
            instant_report: { label: 'Instant Report', days: 7, tier: 'instant' },
            executive_clearance: { label: 'Executive Risk Certificate', days: 90, tier: 'executive' },
            eu_ai_act_sprint: { label: 'EU AI Act Sprint', days: 30, tier: 'euai' },
            runtime_shield: { label: 'Runtime Shield', days: 30, tier: 'universal' },
            custom_plan: { label: 'Custom Audit Plan', days: 90, tier: 'custom' },
            team: { label: 'AI Slop Cop Team', days: 30, tier: 'team' },
            enterprise: { label: 'AI Slop Cop Enterprise', days: 30, tier: 'enterprise' }
        };
        const VALID_TIERS = Object.keys(tierMap);
        const isCustom = Array.isArray(scans) && scans.length > 0;
        const safeTier = VALID_TIERS.includes(tier) ? tier : (isCustom ? 'custom_plan' : 'executive_clearance');
        const config = tierMap[safeTier];
        const minutes = config.days * 24 * 60;
        const secret = process.env.SIMPLEBEACON_LICENSE_SECRET;
        if (!secret) {
            return res.status(500).json({ error: 'License secret not configured' });
        }

        const tokenPayload = {
            email,
            tier: config.tier,
            projectName,
            clientName: clientName || email
        };
        if (isCustom) {
            tokenPayload.features = scans.filter(s => typeof s === 'string' && s.length > 0);
        }
        const token = generateLicenseToken(tokenPayload, secret, minutes);

        const certUrl = `${PUBLIC_URL}/certificate-upload.html?token=${encodeURIComponent(token)}`;

        // Load branded email template
        let emailHtml;
        try {
            const fsSync = require('fs');
            const templatePath = path.join(__dirname, '..', 'email-template-universal.html');
            let template = fsSync.readFileSync(templatePath, 'utf8');

            const isFree = tier === 'free' || tier === 'community';
            const isEnterprise = tier === 'eu_ai_act_sprint' || tier === 'runtime_shield';
            const priceMap = {
                instant_report: '$19.00',
                executive_clearance: '$499.00',
                eu_ai_act_sprint: '$2,499.00',
                runtime_shield: '$2,999.00/mo'
            };
            const stepsMap = {
                instant_report: '<li>Click the button above to open the certificate upload page</li><li>Paste your license token (already filled if you use the link)</li><li>Upload your source code zip or select a local directory</li><li>The scan runs locally — no code leaves your machine</li><li>Download your Code Hygiene Certificate PDF instantly</li>',
                executive_clearance: '<li>Click the button above to open your dashboard</li><li>Paste your license token (already filled if you use the link)</li><li>Upload your source code or select a local directory</li><li>Run the Complete Scan with all 15 analyzers</li><li>Download your Executive Risk Certificate + Audit Report ZIP</li>',
                eu_ai_act_sprint: '<li>Click the button above to open your dashboard</li><li>Paste your license token (already filled if you use the link)</li><li>Upload your source code zip or select a local directory</li><li>Run the EU AI Act compliance scan</li><li>Download your EU AI Act Readiness PDF instantly</li>',
                runtime_shield: '<li>Click the button above to open your dashboard</li><li>Paste your license token (already filled if you use the link)</li><li>Configure runtime sentinel for your stack</li><li>Set per-request and per-minute AI API spend caps</li><li>Monitor real-time spend dashboard with alerts</li>'
            };
            const featuresMap = {
                instant_report: '<li>Code Hygiene Gate scan</li><li>Production leak detection</li><li>Mock data / fixture detection</li><li>Instant PDF certificate</li>',
                executive_clearance: '<li>Complete Scan (15 analyzers)</li><li>Codebase analysis + npm audit</li><li>Compliance checklist + EU AI Act</li><li>Executive audit report + certificate ZIP</li><li>Re-attestation support</li>',
                eu_ai_act_sprint: '<li>EU AI Act Article 52-55 assessment</li><li>Risk classification (minimal / limited / high / unacceptable)</li><li>Conformity gap analysis</li><li>Remediation roadmap</li><li>Ready-to-submit documentation</li>',
                runtime_shield: '<li>Runtime sentinel library + middleware</li><li>Per-request, per-minute, per-hour spend caps</li><li>Real-time dashboard + Slack/PagerDuty alerts</li><li>Custom budget-policy rules</li><li>Dedicated cost-governance onboarding</li>'
            };
            const deliveryMap = {
                instant_report: { visible: '', headline: '', detail: '' },
                executive_clearance: { visible: '', headline: '', detail: '' },
                eu_ai_act_sprint: { visible: 'visible', headline: 'Manual review included', detail: 'A compliance analyst will review your scan within 24 hours and email a finalized attestation package.' },
                runtime_shield: { visible: 'visible', headline: 'Onboarding scheduled', detail: 'A Solutions Engineer will contact you within 1 business day to begin runtime integration.' }
            };

            const d = deliveryMap[tier] || deliveryMap.executive_clearance;

            const safe = (v) => String(v).replace(/\$/g, '$$$$');
            template = template
                .replace(/\{\{HEADLINE\}\}/g, safe(isFree ? 'Welcome!' : 'Payment Confirmed'))
                .replace(/\{\{PRODUCT_NAME\}\}/g, safe(config.label)) // simplebeacon-ignore: template replacement, not a TODO/magic-number
                .replace(/\{\{RECEIPT_CLASS\}\}/g, safe(isFree ? 'free' : isEnterprise ? 'enterprise' : ''))
                .replace(/\{\{PRICE\}\}/g, safe(isFree ? 'Free' : (priceMap[tier] || '$499.00')))
                .replace(/\{\{PAYMENT_METHOD\}\}/g, safe(isFree ? 'No payment required' : 'Paid via Stripe'))
                .replace(/\{\{DATE\}\}/g, safe(new Date().toLocaleDateString('en-US')))
                .replace(/\{\{INVOICE_LINE\}\}/g, safe(isFree ? 'Community tier — no invoice' : 'Invoice #INV-' + Date.now().toString(36).toUpperCase()))
                .replace(/\{\{TOKEN_STYLE\}\}/g, safe(isFree ? 'style="display:none;"' : 'style="display:block;"'))
                .replace(/\{\{LICENSE_TOKEN\}\}/g, safe(token))
                .replace(/\{\{PRIMARY_URL\}\}/g, safe(certUrl))
                .replace(/\{\{PRIMARY_CTA\}\}/g, safe(isFree ? 'Get Started →' : 'Upload Report & Download Certificate'))
                .replace(/\{\{SECONDARY_STYLE\}\}/g, safe('style="display:none;"'))
                .replace(/\{\{SECONDARY_URL\}\}/g, safe('#'))
                .replace(/\{\{SECONDARY_CTA\}\}/g, safe('View Documentation'))
                .replace(/\{\{STEPS_TITLE\}\}/g, safe('What happens next'))
                .replace(/\{\{STEPS_LIST\}\}/g, safe(stepsMap[tier] || stepsMap.executive_clearance))
                .replace(/\{\{FEATURES_STYLE\}\}/g, safe('style="display:block;"'))
                .replace(/\{\{FEATURES_LIST\}\}/g, safe(featuresMap[tier] || featuresMap.executive_clearance))
                .replace(/\{\{DELIVERY_STYLE\}\}/g, safe(d.visible === 'visible' ? 'style="display:block;"' : 'style="display:none;"'))
                .replace(/\{\{DELIVERY_HEADLINE\}\}/g, safe(d.headline))
                .replace(/\{\{DELIVERY_DETAIL\}\}/g, safe(d.detail))
                .replace(/\{\{PRIVACY_TEXT\}\}/g, safe('Your source code never leaves your machine. The scan runs entirely locally in your browser and Node.js process. Only anonymized findings are uploaded for PDF generation.'))
                .replace(/\{\{SUPPORT_TEXT\}\}/g, safe("Didn't see your token? Check your spam folder or email us at"));

            emailHtml = template;
        } catch (templateErr) {
            emailHtml = buildFallbackEmailHtml(clientName, email, projectName, config, token, certUrl);
        }

        const emailResult = await sendEmail({
            to: email,
            subject: 'Your SimpleBeacon License Token — ' + config.label,
            text: `Hi ${clientName || email},\n\nYour license token for "${projectName}" has been generated.\n\nTier: ${config.label}\nProject: ${projectName}\nToken: ${token}\n\nUpload your scan report here:\n${certUrl}\n\nThis token expires in ${config.days} days.\n\nDidn't receive this email? Check your spam or junk folder — sometimes license emails end up there.\n`,
            html: emailHtml
        });

        res.json({
            success: true,
            token,
            certUrl,
            email,
            projectName,
            clientName: clientName || email,
            tier: config.label,
            expiresInDays: config.days,
            emailSent: emailResult.sent,
            emailQueued: emailResult.queued,
            queueId: emailResult.queueId || null,
            provider: emailResult.provider || null,
            providerMessageId: emailResult.providerMessageId || null,
            emailError: emailResult.error || null
        });
    } catch (error) {
        logger.error('[TestCheckout] Unexpected error:', error.message);
        return res.status(500).json({ error: 'Checkout processing failed. Please try again.' });
    }
});

router.post('/api/create-checkout-session', async (req, res) => {
    try {
        if (!stripe) {
            return res.status(503).json({ error: 'Stripe is not configured. Set STRIPE_SECRET_KEY.' });
        }

        const { email, projectName, clientName, scans, total } = req.body;
        if (!email || !projectName || !Array.isArray(scans) || scans.length === 0) {
            return res.status(400).json({ error: 'Email, project name, and at least one scan are required.' });
        }

        const lineItems = [];
        for (const scanId of scans) {
            const opt = SCAN_OPTION_MAP[scanId];
            if (!opt) continue;
            lineItems.push({
                price_data: {
                    currency: 'usd',
                    product_data: { name: opt.name, description: 'SimpleBeacon ' + opt.name },
                    unit_amount: opt.price * 100
                },
                quantity: 1
            });
        }

        if (lineItems.length === 0) {
            return res.status(400).json({ error: 'No valid scans selected.' });
        }

        const successUrl = `${PUBLIC_URL}/certificate-upload.html?session_id={CHECKOUT_SESSION_ID}`;
        const cancelUrl = `${PUBLIC_URL}/pricing.html?canceled=true`;

        const session = await stripe.checkout.sessions.create({
            mode: 'payment',
            customer_email: email,
            line_items: lineItems,
            success_url: successUrl,
            cancel_url: cancelUrl,
            metadata: {
                product: 'custom_plan',
                email,
                projectName: String(projectName).slice(0, 200),
                clientName: String(clientName || email).slice(0, 200),
                scans: scans.join(','),
                total: String(total || '')
            }
        });

        res.json({ success: true, url: session.url, sessionId: session.id });
    } catch (error) {
        logger.error('[CreateCheckoutSession] Error:', error.message);
        res.status(500).json({ error: 'Failed to create checkout session.', message: error.message });
    }
});

router.get('/api/session-token/:sessionId', async (req, res) => {
    const entry = sessionTokenStore.get(req.params.sessionId);
    if (!entry) {
        return res.status(404).json({ error: 'Session not found or expired.' });
    }
    res.json({ success: true, token: entry.token, email: entry.email, projectName: entry.projectName, tier: entry.tier });
});

function setupCheckoutWebhook(app) {
    app.post('/api/checkout/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
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
            logger.error('[CheckoutWebhook] Signature verification failed:', err.message);
            return res.status(400).send('Webhook Error: ' + err.message);
        }

        if (event.type === 'checkout.session.completed') {
            const session = event.data.object;
            if (session.payment_status !== 'paid') {
                logger.error('[CheckoutWebhook] Session not paid:', session.id, session.payment_status);
                return res.json({ received: true, status: 'unpaid' });
            }
            const meta = session.metadata || {};
            const email = meta.email || session.customer_email || '';
            const projectName = meta.projectName || '';
            const clientName = meta.clientName || email;
            const scans = (meta.scans || '').split(',').filter(Boolean);
            const total = meta.total || '';
            const product = meta.product || 'custom_plan';

            const tierMap = {
                instant_report: { label: 'Instant Report', days: 7, tier: 'instant' },
                executive_clearance: { label: 'Executive Risk Certificate', days: 90, tier: 'executive' },
                eu_ai_act_sprint: { label: 'EU AI Act Sprint', days: 30, tier: 'euai' },
                runtime_shield: { label: 'Runtime Shield', days: 30, tier: 'universal' },
                custom_plan: { label: 'Custom Audit Plan', days: 90, tier: 'custom' },
                team: { label: 'AI Slop Cop Team', days: 30, tier: 'team' },
                enterprise: { label: 'AI Slop Cop Enterprise', days: 30, tier: 'enterprise' }
            };
            const config = tierMap[product] || tierMap.custom_plan;
            const minutes = config.days * 24 * 60;
            const licenseSecret = process.env.SIMPLEBEACON_LICENSE_SECRET;
            if (!licenseSecret) {
                logger.error('[CheckoutWebhook] SIMPLEBEACON_LICENSE_SECRET not set');
                return res.status(500).send('License secret not configured');
            }

            const tokenPayload = {
                email,
                tier: config.tier,
                projectName,
                clientName,
                features: scans
            };
            const token = generateLicenseToken(tokenPayload, licenseSecret, minutes);
            const certUrl = `${PUBLIC_URL}/certificate-upload.html?token=${encodeURIComponent(token)}`;

            // Register token in chain registry (owner token)
            try {
                const { createTokenChain } = require('../lib/token-chain-store.cjs');
                createTokenChain(email, tokenPayload, token, minutes);
            } catch (chainErr) {
                logger.error('[CheckoutWebhook] Chain creation failed:', chainErr.message);
            }

            sessionTokenStore.set(session.id, {
                token,
                email,
                projectName,
                tier: config.tier,
                createdAt: Date.now()
            });

            let emailHtml;
            try {
                const fsSync = require('fs');
                const templatePath = path.join(__dirname, '..', 'email-template-universal.html');
                let template = fsSync.readFileSync(templatePath, 'utf8');
                const priceMap = {
                    instant_report: '$19.00',
                    executive_clearance: '$499.00',
                    eu_ai_act_sprint: '$2,499.00',
                    runtime_shield: '$2,999.00/mo'
                };
                const safe = (v) => String(v).replace(/\$/g, '$$$$');
                template = template
                    .replace(/\{\{HEADLINE\}\}/g, safe('Payment Confirmed'))
                    .replace(/\{\{PRODUCT_NAME\}\}/g, safe(config.label))
                    .replace(/\{\{RECEIPT_CLASS\}\}/g, '')
                    .replace(/\{\{PRICE\}\}/g, safe(total ? '$' + total : (priceMap[product] || '$499.00')))
                    .replace(/\{\{PAYMENT_METHOD\}\}/g, safe('Paid via Stripe'))
                    .replace(/\{\{DATE\}\}/g, safe(new Date().toLocaleDateString('en-US')))
                    .replace(/\{\{INVOICE_LINE\}\}/g, safe('Invoice #INV-' + Date.now().toString(36).toUpperCase()))
                    .replace(/\{\{TOKEN_STYLE\}\}/g, safe('style="display:block;"'))
                    .replace(/\{\{LICENSE_TOKEN\}\}/g, safe(token))
                    .replace(/\{\{PRIMARY_URL\}\}/g, safe(certUrl))
                    .replace(/\{\{PRIMARY_CTA\}\}/g, safe('Upload Report & Download Certificate'))
                    .replace(/\{\{SECONDARY_STYLE\}\}/g, safe('style="display:none;"'))
                    .replace(/\{\{SECONDARY_URL\}\}/g, safe('#'))
                    .replace(/\{\{SECONDARY_CTA\}\}/g, safe('View Documentation'))
                    .replace(/\{\{STEPS_TITLE\}\}/g, safe('What happens next'))
                    .replace(/\{\{STEPS_LIST\}\}/g, safe('<li>Click the button above to open the certificate upload page</li><li>Paste your license token (already filled if you use the link)</li><li>Upload your source code zip or select a local directory</li><li>The scan runs locally — no code leaves your machine</li><li>Download your certificate instantly</li>'))
                    .replace(/\{\{FEATURES_STYLE\}\}/g, safe('style="display:block;"'))
                    .replace(/\{\{FEATURES_LIST\}\}/g, safe(scans.map(s => { const opt = SCAN_OPTION_MAP[s]; return '<li>' + (opt ? opt.name : s) + '</li>'; }).join('') || '<li>Custom Audit Plan</li>'))
                    .replace(/\{\{DELIVERY_STYLE\}\}/g, safe('style="display:none;"'))
                    .replace(/\{\{DELIVERY_HEADLINE\}\}/g, '')
                    .replace(/\{\{DELIVERY_DETAIL\}\}/g, '')
                    .replace(/\{\{PRIVACY_TEXT\}\}/g, safe('Your source code never leaves your machine. The scan runs entirely locally in your browser and Node.js process. Only anonymized findings are uploaded for PDF generation.'))
                    .replace(/\{\{SUPPORT_TEXT\}\}/g, safe("Didn't see your token? Check your spam folder or email us at"));
                emailHtml = template;
            } catch (templateErr) {
                emailHtml = `<p>Hi ${escapeHtml(clientName || email)},</p><p>Your license token for <strong>${escapeHtml(projectName)}</strong> has been generated.</p><p>Tier: <strong>${escapeHtml(config.label)}</strong><br>Project: <strong>${escapeHtml(projectName)}</strong><br>Token: <code style="background:#f4f4f4;padding:2px 6px;border-radius:4px;">${token}</code></p><p><a href="${certUrl}" style="display:inline-block;padding:10px 18px;background:#2ea44f;color:#fff;text-decoration:none;border-radius:6px;">Upload Report &amp; Download Certificate</a></p><p>This token expires in ${config.days} days.</p>`;
            }

            try {
                const emailResult = await sendEmail({
                    to: email,
                    subject: 'Your SimpleBeacon License Token — ' + config.label,
                    text: `Hi ${clientName || email},\n\nYour license token for "${projectName}" has been generated.\n\nTier: ${config.label}\nProject: ${projectName}\nToken: ${token}\n\nUpload your scan report here:\n${certUrl}\n\nThis token expires in ${config.days} days.\n`,
                    html: emailHtml
                });
                if (!emailResult.sent && !emailResult.queued) {
                    logger.error('[CheckoutWebhook] Email could not be sent or queued:', emailResult.error);
                } else if (!emailResult.sent) {
                    logger.warn('[CheckoutWebhook] Email queued for retry. queueId:', emailResult.queueId);
                } else {
                    logger.info('[CheckoutWebhook] Email sent via', emailResult.provider, 'queueId:', emailResult.queueId);
                }
            } catch (emailErr) {
                logger.error('[CheckoutWebhook] Email failed:', emailErr.message);
            }
        }

        res.json({ received: true });
    });
}

module.exports = { router, setupCheckoutWebhook };
