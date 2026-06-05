const path = require('path');
// Allow ai-platform backend modules to resolve dependencies from coming-soon/node_modules
const Module = require('module');
const comingSoonNodeModules = path.join(__dirname, 'node_modules');
if (!Module.globalPaths.includes(comingSoonNodeModules)) {
    Module.globalPaths.unshift(comingSoonNodeModules);
}

const express = require('express');
const fs = require('fs').promises;
const crypto = require('crypto');
const app = express();
const PORT = process.env.PORT || 3001;

const PUBLIC_URL = process.env.PUBLIC_URL || ('http://' + 'localhost' + ':' + PORT);

// Free-token rate limiter: one per IP per hour (prevents unlimited abuse)
const FREE_TOKEN_COOLDOWN_MS = 60 * 60 * 1000; // 1 hour
const freeTokenLog = new Map(); // ip -> { token, certUrl, createdAt }

// Inline token generator (matches packages/simplebeacon-cli/src/lib/license-token.js)
function generateLicenseToken(payload, secret, expiresInMinutes) {
  const issuedAt = Date.now();
  const expiresAt = issuedAt + (expiresInMinutes * 60 * 1000);
  const tokenPayload = {
    email: payload.email || '',
    tier: payload.tier || 'executive',
    features: payload.features || [],
    clientName: payload.clientName || payload.email || 'Client',
    projectName: payload.projectName || 'Project',
    iat: issuedAt,
    exp: expiresAt
  };
  const data = Buffer.from(JSON.stringify(tokenPayload)).toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(data).digest('base64url');
  return `${data}.${sig}`;
}
const SUBSCRIPTIONS_FILE = path.join(__dirname, 'subscriptions.json');
const EMAIL_QUEUE_DIR = path.join(__dirname, '.simplebeacon', 'email-queue');

function ensureQueueDir() {
    const fsSync = require('fs');
    if (!fsSync.existsSync(EMAIL_QUEUE_DIR)) {
        fsSync.mkdirSync(EMAIL_QUEUE_DIR, { recursive: true });
    }
}

function queueEmailToDisk({ to, subject, text, html }) {
    const fsSync = require('fs');
    ensureQueueDir();
    const id = 'email_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
    const filePath = path.join(EMAIL_QUEUE_DIR, id + '.json');
    const payload = {
        id,
        to,
        subject,
        text: text || '',
        html: html || undefined,
        queuedAt: new Date().toISOString()
    };
    fsSync.writeFileSync(filePath, JSON.stringify(payload, null, 2) + '\n');
    return { sent: false, queued: true, queuePath: filePath };
}

// Resend API email sender
function sendViaResend({ to, from, subject, text, html }) {
    return new Promise((resolve, reject) => {
        const key = process.env.RESEND_API_KEY;
        if (!key || !key.startsWith('re_')) return reject(new Error('Resend not configured'));
        const payload = JSON.stringify({ from, to: [to], subject, text, html });
        const req = https.request({
            hostname: 'api.resend.com',
            path: '/emails',
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
        }, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    try { resolve({ id: JSON.parse(data).id }); } catch { resolve({ id: null }); }
                } else { reject(new Error('Resend ' + res.statusCode + ': ' + data)); }
            });
        });
        req.on('error', reject);
        req.write(payload);
        req.end();
    });
}

// SMTP email sender (requires nodemailer)
async function sendViaSmtp({ to, from, subject, text, html }) {
    let nodemailer;
    try { nodemailer = require('nodemailer'); } catch { throw new Error('nodemailer not installed'); }
    const cfg = { host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT) || 587, user: process.env.SMTP_USER, pass: process.env.SMTP_PASS, from: process.env.SMTP_FROM || from || 'trevor_punt@live.com', secure: process.env.SMTP_SECURE === 'true' || Number(process.env.SMTP_PORT) === 465 };
    if (!cfg.host || !cfg.user || !cfg.pass) throw new Error('SMTP not configured');
    const transporter = nodemailer.createTransport({ host: cfg.host, port: cfg.port, secure: cfg.secure, auth: { user: cfg.user, pass: cfg.pass } });
    await transporter.sendMail({ from: cfg.from, to, subject, text: text || '', html: html || undefined });
    return { sent: true };
}

// Send email with fallback: Resend → SMTP → disk queue
async function sendEmail(options) {
    const { to, subject, text, html } = options;
    if (!to || !subject) return { sent: false, queued: false, error: 'to and subject required' };

    // Try Resend first (key hardcoded fallback in sendViaResend)
    try {
        const result = await sendViaResend({ to, from: process.env.RESEND_FROM || 'certificates@simplebeacon.ai', subject, text, html });
        return { sent: true, queued: false, id: result.id };
    } catch (err) { console.error('[Email] Resend failed:', err.message); }

    // Try SMTP fallback
    try {
        await sendViaSmtp({ to, subject, text, html });
        return { sent: true, queued: false };
    } catch (err) { console.error('[Email] SMTP failed:', err.message); }

    // Fallback to disk queue
    return queueEmailToDisk({ to, subject, text, html });
}

// Security headers (helmet-lite)
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    if (req.headers['x-forwarded-proto'] === 'https' || req.secure) {
        res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains');
    }
    next();
});

// CORS — allow any origin only in development
app.use((req, res, next) => {
    const isDev = process.env.NODE_ENV !== 'production';
    const allowedOrigin = isDev ? '*' : (process.env.ALLOWED_ORIGIN || '');
    if (allowedOrigin) {
        res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
        return res.status(204).end();
    }
    next();
});

// Billing webhook must use raw body before JSON parser
const { setupSimplebeaconBillingWebhook } = require('../ai-platform/src/api/simplebeacon-billing-api.cjs');
setupSimplebeaconBillingWebhook(app);

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.static(__dirname));

// Mount backend routes directly (no proxy needed)
const { setupFlexibleAnalyzeAPI } = require('../ai-platform/server/routes/flexible-analyze-api.cjs');
const platformRoot = path.join(__dirname, '../ai-platform');
setupFlexibleAnalyzeAPI(app, {
    baseDir: platformRoot,
    monorepoRoot: path.join(platformRoot, '..')
});

const { setupSimplebeaconBillingRoutes } = require('../ai-platform/src/api/simplebeacon-billing-api.cjs');
setupSimplebeaconBillingRoutes(app);

// Pricing config endpoint
app.get('/api/config/pricing', (_req, res) => {
    res.json({
        success: true,
        pricing: {
            instant: { stripeLink: process.env.STRIPE_LINK_INSTANT || 'https://buy.stripe.com/4gM28q83ZavR50P2GqeEo07' },
            executive: { stripeLink: process.env.STRIPE_LINK_EXECUTIVE || 'https://buy.stripe.com/00w5kCbgb47t78X1CmeEo05' },
            euSprint: { stripeLink: process.env.STRIPE_LINK_EU_SPRINT || 'https://buy.stripe.com/fZu28qesn6fB1ODftceEo06' }
        }
    });
});

// Ensure subscriptions.json exists on server boot
async function initStorage() {
    try {
        await fs.access(SUBSCRIPTIONS_FILE);
    } catch {
        await fs.writeFile(SUBSCRIPTIONS_FILE, JSON.stringify([], null, 2), 'utf8');
    }
}
initStorage();

// API Endpoint for Newsletter Signups
app.post('/api/subscribe', async (req, res) => {
    const { email } = req.body;

    // Server-side baseline validation
    if (!email || typeof email !== 'string' || !email.includes('@')) {
        return res.status(400).json({ error: 'A valid email address is required.' });
    }

    try {
        // Atomic read-then-write loop to prevent truncation
        const fileData = await fs.readFile(SUBSCRIPTIONS_FILE, 'utf8');
        const subscriptions = JSON.parse(fileData || '[]');

        // Prevent duplicate entries
        if (subscriptions.some(entry => entry.email.toLowerCase() === email.toLowerCase())) {
            return res.status(200).json({ message: 'Email already registered.' });
        }

        // Append new subscriber record with ISO timestamp
        subscriptions.push({
            email: email.trim(),
            timestamp: new Date().toISOString()
        });

        // Write back to disk with clean formatting
        await fs.writeFile(SUBSCRIPTIONS_FILE, JSON.stringify(subscriptions, null, 2), 'utf8');
        return res.status(200).json({ message: 'Successfully subscribed.' });

    } catch (error) {
        return res.status(500).json({ error: 'Internal database storage failure.' });
    }
});

// Test checkout endpoint — generates a token immediately without Stripe
app.post('/api/test-checkout', async (req, res) => {
    const { email, projectName, clientName, tier } = req.body;
    if (!email || !projectName) {
        return res.status(400).json({ error: 'Email and project name are required.' });
    }

    const tierMap = {
        instant_report: { label: 'Instant Report', days: 7, tier: 'instant' },
        executive_clearance: { label: 'Executive Risk Certificate', days: 90, tier: 'executive' },
        eu_ai_act_sprint: { label: 'EU AI Act Sprint', days: 30, tier: 'euai' },
        runtime_shield: { label: 'Runtime Shield', days: 30, tier: 'universal' }
    };
    const config = tierMap[tier] || tierMap.executive_clearance;
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
        const templatePath = path.join(__dirname, 'email-template-universal.html');
        let template = fsSync.readFileSync(templatePath, 'utf8');

        // Tier-aware content
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
            executive_clearance: '<li>Click the button above to open your dashboard</li><li>Paste your license token (already filled if you use the link)</li><li>Upload your source code or select a local directory</li><li>Run the Complete Scan with all 11 analyzers</li><li>Download your Executive Risk Certificate + Audit Report ZIP</li>',
            eu_ai_act_sprint: '<li>Click the button above to open your dashboard</li><li>Paste your license token (already filled if you use the link)</li><li>Upload your source code zip or select a local directory</li><li>Run the EU AI Act compliance scan</li><li>Download your EU AI Act Readiness PDF instantly</li>',
            runtime_shield: '<li>Click the button above to open your dashboard</li><li>Paste your license token (already filled if you use the link)</li><li>Configure runtime sentinel for your stack</li><li>Set per-request and per-minute AI API spend caps</li><li>Monitor real-time spend dashboard with alerts</li>'
        };
        const featuresMap = {
            instant_report: '<li>Code Hygiene Gate scan</li><li>Production leak detection</li><li>Mock data / fixture detection</li><li>Instant PDF certificate</li>',
            executive_clearance: '<li>Complete Scan (11 analyzers)</li><li>Codebase analysis + npm audit</li><li>Compliance checklist + EU AI Act</li><li>Executive audit report + certificate ZIP</li><li>Re-attestation support</li>',
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

        template = template
            .replace(/\{\{HEADLINE\}\}/g, isFree ? 'Welcome!' : 'Payment Confirmed')
            .replace(/\{\{PRODUCT_NAME\}\}/g, config.label)
            .replace(/\{\{RECEIPT_CLASS\}\}/g, isFree ? 'free' : isEnterprise ? 'enterprise' : '')
            .replace(/\{\{PRICE\}\}/g, isFree ? 'Free' : (priceMap[tier] || '$499.00'))
            .replace(/\{\{PAYMENT_METHOD\}\}/g, isFree ? 'No payment required' : 'Paid via Stripe')
            .replace(/\{\{DATE\}\}/g, new Date().toLocaleDateString('en-US'))
            .replace(/\{\{INVOICE_LINE\}\}/g, isFree ? 'Community tier — no invoice' : 'Invoice #INV-' + Date.now().toString(36).toUpperCase())
            .replace(/\{\{TOKEN_STYLE\}\}/g, isFree ? 'style="display:none;"' : 'style="display:block;"')
            .replace(/\{\{LICENSE_TOKEN\}\}/g, token)
            .replace(/\{\{PRIMARY_URL\}\}/g, certUrl)
            .replace(/\{\{PRIMARY_CTA\}\}/g, isFree ? 'Get Started →' : 'Upload Report & Download Certificate')
            .replace(/\{\{SECONDARY_STYLE\}\}/g, 'style="display:none;"')
            .replace(/\{\{SECONDARY_URL\}\}/g, '#')
            .replace(/\{\{SECONDARY_CTA\}\}/g, 'View Documentation')
            .replace(/\{\{STEPS_TITLE\}\}/g, 'What happens next')
            .replace(/\{\{STEPS_LIST\}\}/g, stepsMap[tier] || stepsMap.executive_clearance)
            .replace(/\{\{FEATURES_STYLE\}\}/g, 'style="display:block;"')
            .replace(/\{\{FEATURES_LIST\}\}/g, featuresMap[tier] || featuresMap.executive_clearance)
            .replace(/\{\{DELIVERY_STYLE\}\}/g, d.visible === 'visible' ? 'style="display:block;"' : 'style="display:none;"')
            .replace(/\{\{DELIVERY_HEADLINE\}\}/g, d.headline)
            .replace(/\{\{DELIVERY_DETAIL\}\}/g, d.detail)
            .replace(/\{\{PRIVACY_TEXT\}\}/g, 'Your source code never leaves your machine. The scan runs entirely locally in your browser and Node.js process. Only anonymized findings are uploaded for PDF generation.')
            .replace(/\{\{SUPPORT_TEXT\}\}/g, "Didn't see your token? Check your spam folder or email us at");

        emailHtml = template;
    } catch (templateErr) {
        console.error('[Email] Template load failed, falling back to inline:', templateErr.message);
        emailHtml = `<p>Hi ${clientName || email},</p><p>Your license token for <strong>${projectName}</strong> has been generated.</p><p>Tier: <strong>${config.label}</strong><br>Project: <strong>${projectName}</strong><br>Token: <code style="background:#f4f4f4;padding:2px 6px;border-radius:4px;">${token}</code></p><p><a href="${certUrl}" style="display:inline-block;padding:10px 18px;background:#2ea44f;color:#fff;text-decoration:none;border-radius:6px;">Upload Report &amp; Download Certificate</a></p><p>This token expires in ${config.days} days.</p><p style="color:#666;font-size:0.9em;margin-top:12px;"><strong>Didn't see this email?</strong> Check your spam or junk folder — license tokens sometimes end up there. If it's missing, contact support.</p>`;
    }

    // Send email with token (Resend → SMTP → disk queue)
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
});

// Free token endpoint — no email or payment required
app.get('/api/free-token', (req, res) => {
    const clientIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || 'unknown';
    const now = Date.now();
    const existing = freeTokenLog.get(clientIp);

    if (existing && (now - existing.createdAt) < FREE_TOKEN_COOLDOWN_MS) {
        const remainingMin = Math.ceil((FREE_TOKEN_COOLDOWN_MS - (now - existing.createdAt)) / 60000);
        return res.json({
            success: true,
            token: existing.token,
            certUrl: existing.certUrl,
            tier: 'community',
            label: 'AI Slop Audit',
            expiresInDays: 7,
            cached: true,
            retryAfterMinutes: remainingMin,
            message: `Free token already issued. Reuse this token or wait ${remainingMin} minutes for a new one.`
        });
    }

    const secret = process.env.SIMPLEBEACON_LICENSE_SECRET;
    if (!secret) {
        return res.status(500).json({ error: 'License secret not configured' });
    }
    const token = generateLicenseToken(
        { email: 'guest@simplebeacon.ai', tier: 'community', projectName: 'Free-Demo', clientName: 'Guest' },
        secret,
        7 * 24 * 60 // 7 days
    );
    const certUrl = `${PUBLIC_URL}/certificate-upload.html?token=${encodeURIComponent(token)}`;
    freeTokenLog.set(clientIp, { token, certUrl, createdAt: now });
    res.json({
        success: true,
        token,
        certUrl,
        tier: 'community',
        label: 'AI Slop Audit',
        expiresInDays: 7,
        cached: false,
        message: 'Free community token generated. Valid for 7 days.'
    });
});

// Serve specific pages explicitly
app.get('/certificate-upload.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'certificate-upload.html'));
});
app.get('/pricing.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'pricing.html'));
});

// Serve other frontend paths
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

if (require.main === module) {
    app.listen(PORT, () => {
        // Server ready
    });
}

module.exports = app;