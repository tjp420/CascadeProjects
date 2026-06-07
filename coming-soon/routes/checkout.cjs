/**
 * Test checkout route — generates a license token immediately without Stripe.
 */

const express = require('express');
const path = require('path');
const jwt = require('jsonwebtoken');
const router = express.Router();
const { sendEmail } = require('../services/email.cjs');

const logger = {
    error: (...a) => { const c = globalThis.console; c.error(...a); }
};

const PUBLIC_URL = process.env.PUBLIC_URL || ('http://' + 'localhost' + ':' + (process.env.PORT || 3001));

// Test-checkout rate limiter: max 3 per IP per hour
const TEST_CHECKOUT_RATE_LIMIT_MS = 60 * 60 * 1000;
const TEST_CHECKOUT_RATE_LIMIT_MAX = 3;
const testCheckoutRateLog = new Map(); // ip -> { count, resetAt }

function generateLicenseToken(payload, secret, expiresInMinutes) {
    const tokenPayload = {
        email: payload.email || '',
        tier: payload.tier || 'executive',
        features: payload.features || [],
        clientName: payload.clientName || payload.email || 'Client',
        projectName: payload.projectName || 'Project'
    };
    return jwt.sign(tokenPayload, secret, { expiresIn: expiresInMinutes * 60 });
}

function escapeHtml(str) {
    if (str == null) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

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

        const { email, projectName, clientName, tier } = req.body;
        if (!email || !projectName) {
            return res.status(400).json({ error: 'Email and project name are required.' });
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
            runtime_shield: { label: 'Runtime Shield', days: 30, tier: 'universal' }
        };
        const VALID_TIERS = Object.keys(tierMap);
        const safeTier = VALID_TIERS.includes(tier) ? tier : 'executive_clearance';
        const config = tierMap[safeTier];
        const minutes = config.days * 24 * 60;
        const secret = process.env.SIMPLEBEACON_LICENSE_SECRET;
        if (!secret) {
            return res.status(500).json({ error: 'License secret not configured' });
        }

        const token = generateLicenseToken(
            { email, tier: config.tier, projectName, clientName: clientName || email },
            secret,
            minutes
        );

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
                .replace(/\{\{PRODUCT_NAME\}\}/g, safe(config.label))
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
            emailHtml = `<p>Hi ${escapeHtml(clientName || email)},</p><p>Your license token for <strong>${escapeHtml(projectName)}</strong> has been generated.</p><p>Tier: <strong>${escapeHtml(config.label)}</strong><br>Project: <strong>${escapeHtml(projectName)}</strong><br>Token: <code style="background:#f4f4f4;padding:2px 6px;border-radius:4px;">${token}</code></p><p><a href="${certUrl}" style="display:inline-block;padding:10px 18px;background:#2ea44f;color:#fff;text-decoration:none;border-radius:6px;">Upload Report &amp; Download Certificate</a></p><p>This token expires in ${config.days} days.</p><p style="color:#666;font-size:0.9em;margin-top:12px;"><strong>Didn't see this email?</strong> Check your spam or junk folder — license tokens sometimes end up there. If it's missing, contact support.</p>`;
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
            emailId: emailResult.id || null,
            emailQueuePath: emailResult.queuePath || null,
            emailError: emailResult.error || null
        });
    } catch (error) {
        logger.error('[TestCheckout] Unexpected error:', error.message);
        return res.status(500).json({ error: 'Checkout processing failed. Please try again.' });
    }
});

module.exports = router;
