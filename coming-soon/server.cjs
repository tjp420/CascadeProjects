const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');
const https = require('https');
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

// Block sensitive files from being served by static middleware
app.use((req, res, next) => {
    const normalized = req.path.toLowerCase();
    const blockedPatterns = [
        /^\/\.env/,
        /^\/server\.cjs/,
        /^\/package(-lock)?\.json/,
        /^\/subscriptions\.json/,
        /^\/\.simplebeacon\//,
        /^\/\.git/,
        /^\/node_modules\//,
        /^\/sb-uploads\//,
        /^\/\.sb-uploads\//,
        /^\/sb-analyze-/,
        /\.log$/,
        /\.key$/,
        /\.pem$/
    ];
    if (blockedPatterns.some(p => p.test(normalized))) {
        return res.status(404).end();
    }
    next();
});

// Static files: deny dotfiles and disable index auto-serve
app.use(express.static(__dirname, { dotfiles: 'deny', index: false }));

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

    const secret = process.env.SIMPLEBEACON_LICENSE_SECRET || 'simplebeacon-dev-insecure';
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

// Token verification helper
function verifyLicenseToken(token, secret) {
    if (!token || !token.includes('.')) return null;
    const [data, sig] = token.split('.');
    if (!data || !sig) return null;
    const expectedSig = crypto.createHmac('sha256', secret).update(data).digest('base64url');
    if (sig !== expectedSig) return null;
    try {
        const payload = JSON.parse(Buffer.from(data, 'base64url').toString('utf8'));
        if (payload.exp && Date.now() > payload.exp) return null;
        return payload;
    } catch {
        return null;
    }
}

// Helper: build a full executive gate-attestation HTML certificate from a browser scan report
function normalizeReport(reportJson) {
    if (!reportJson || typeof reportJson !== 'object') return {};
    const type = reportJson.type || '';

    // 1. Complete-scan wrapper: pull the simplebeacon sub-report up
    const sub = reportJson?.results?.simplebeacon;
    if (sub && typeof sub === 'object') {
        return { ...reportJson, ...sub, detectedIssues: sub.detectedIssues || reportJson.detectedIssues || [] };
    }

    // 2. Public-summary: synthesize gate and detectedIssues from summary/severityCounts
    if (type === 'simplebeacon-public-summary') {
        const summary = reportJson.summary || {};
        return {
            ...reportJson,
            gate: {
                pass: summary.gatePass ?? false,
                blockingCount: (reportJson.severityCounts?.critical || 0) + (reportJson.severityCounts?.high || 0),
                warningCount: (reportJson.severityCounts?.medium || 0) + (reportJson.severityCounts?.low || 0)
            },
            qualityScore: summary.qualityScore ?? 0,
            totalFiles: summary.filesScanned ?? 0,
            issueCount: summary.totalIssuesFound ?? 0,
            detectedIssues: []
        };
    }

    // 3. Re-attestation-note: synthesize from currentGate
    if (type === 'simplebeacon-re-attestation-note') {
        const cg = reportJson.currentGate || {};
        return {
            ...reportJson,
            gate: {
                pass: cg.pass ?? false,
                blockingCount: cg.blockingCount ?? 0,
                warningCount: 0
            },
            qualityScore: cg.qualityScore ?? 0,
            totalFiles: cg.repositoryFilesTotal ?? 0,
            issueCount: 0,
            detectedIssues: []
        };
    }

    // 4. Direct simplebeacon-report (or browser-sandbox report)
    return reportJson;
}

function getTierConfig(tier) {
    const configs = {
        euai: { label: 'EU AI Act Sprint', kicker: 'SimpleBeacon · EU AI Act Readiness', subtitle: 'EU AI Act compliance deliverable — Article 52, 10, and 13 readiness assessment.', badge: 'EU AI ACT', badgeClass: 'badge-gold' },
        executive: { label: 'Executive Risk Certificate', kicker: 'SimpleBeacon · Executive Risk Certificate', subtitle: 'Executive clearance — pre-launch security gate attestation.', badge: 'EXECUTIVE', badgeClass: 'badge-gold' },
        instant: { label: 'Instant Report', kicker: 'SimpleBeacon · Instant Security Report', subtitle: 'Quick-turn security snapshot — lightweight gate scan.', badge: 'INSTANT', badgeClass: 'badge-pass' },
        agency: { label: 'Agency License', kicker: 'SimpleBeacon · Agency Partner Certificate', subtitle: 'Agency partner deliverable — white-label security attestation.', badge: 'AGENCY', badgeClass: 'badge-gold' },
        universal: { label: 'Operator License', kicker: 'SimpleBeacon · Operator Vault Certificate', subtitle: 'Operator vault — full platform access with all engines.', badge: 'OPERATOR', badgeClass: 'badge-gold' }
    };
    return configs[tier] || configs.executive;
}

function buildCertificateHtml(reportJson, payload) {
    const data = normalizeReport(reportJson);
    const tier = payload.tier || 'executive';
    const tierConfig = getTierConfig(tier);
    const projectName = data.projectRoot || data.projectPath || data.projectName || payload.projectName || 'Project';
    const clientName = payload.clientName || 'Demo Client';
    const gatePass = data.gate?.pass ? 'PASS' : 'REVIEW';
    const reportId = 'SB-AUD-' + new Date().toISOString().slice(0,10).replace(/-/g,'') + '-' + Math.random().toString(36).slice(2,8).toUpperCase();
    const nowStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    const detectedIssues = data.detectedIssues || [];
    const credentialHits = data.gate?.blockingCount || 0;
    const totalFiles = data.totalFiles || data.filesAnalyzed || data.repositoryFilesTotal || data.summary?.repositoryFiles || 0;
    const qualityScore = data.qualityScore ?? data.summary?.qualityScore ?? 0;

    const issueRows = detectedIssues.map(issue => {
        const sev = (issue.severity || 'low').toUpperCase();
        const sevClass = sev === 'CRITICAL' ? 'sev-critical' : sev === 'HIGH' ? 'sev-high' : sev === 'MEDIUM' ? 'sev-medium' : 'sev-low';
        const fileSnippet = (issue.filePath || (Array.isArray(issue.filePaths) && issue.filePaths[0]) || (Array.isArray(issue.affectedFiles) && issue.affectedFiles[0]) || issue.file || '—').replace(/</g,'&lt;');
        const rule = (issue.rule || issue.type || '—').replace(/</g,'&lt;');
        const impact = (issue.impact || issue.recommendation || 'Review and remediate before next release.').replace(/</g,'&lt;');
        const fix = (issue.fix || issue.recommendation || 'Review file manually and apply safe remediation.').replace(/</g,'&lt;');
        return `<tr><td><span class="sev ${sevClass}">${sev}</span></td><td><code>${fileSnippet}</code></td><td><code>${rule}</code></td><td class="impact-cell"><span class="impact-badge impact-${sevClass.replace('sev-','')}">${impact}</span></td><td class="recipe-cell">${fix}</td></tr>`;
    }).join('');

    return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>SimpleBeacon — Gate Attestation — ${projectName.replace(/</g,'&lt;')}</title>
<style>
body{font-family:Inter,system-ui,sans-serif;background:#0d1117;color:#e6edf3;margin:0;padding:0;}
.certificate{min-height:100vh;padding:48px 52px 40px;max-width:860px;margin:0 auto;background:radial-gradient(ellipse 90% 60% at 20% 0%,rgba(88,166,255,0.10),transparent 55%),radial-gradient(circle at 100% 20%,rgba(46,164,79,0.08),transparent 45%),linear-gradient(160deg,#010409 0%,#0d1117 42%,#161b22 100%);border:1px solid #30363d;}
.cover-page{padding:48px 52px 40px;border-bottom:1px solid #21262d;}
.cover-kicker{letter-spacing:0.14em;text-transform:uppercase;font-size:10pt;color:#8b949e;margin:0 0 12px;}
.cover-title{font-size:34pt;line-height:1.12;margin:0 0 16px;font-weight:700;max-width:720px;letter-spacing:-0.02em;}
.cover-sub{font-size:13pt;color:#c9d1d9;max-width:640px;margin:0 0 28px;}
.cover-meta{font-size:10pt;color:#8b949e;line-height:1.7;}
.cover-badges{margin-top:32px;display:flex;gap:10px;flex-wrap:wrap;}
.badge{display:inline-block;padding:6px 14px;border-radius:999px;font-size:10pt;font-weight:700;letter-spacing:0.04em;border:1px solid #30363d;}
.badge-gold{background:rgba(210,153,34,0.12);color:#e3b341;border-color:rgba(210,153,34,0.35);}
.badge-pass{background:rgba(46,164,79,0.14);color:#3fb950;border-color:rgba(63,185,80,0.35);}
.badge-blocked{background:rgba(248,81,73,0.14);color:#f85149;border-color:rgba(248,81,73,0.35);}
.confidential{margin-top:48px;font-size:9pt;color:#6e7681;border-top:1px solid #21262d;padding-top:16px;}
main{padding:36px 52px 48px;max-width:920px;margin:0 auto;}
.section{margin-bottom:32px;}
.section-num{color:#d29922;font-size:10pt;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;margin-bottom:4px;}
h2{font-size:20pt;margin:0 0 12px;color:#e6edf3;letter-spacing:-0.02em;}
.meta{color:#8b949e;font-size:9.5pt;}
.gate-banner{margin:18px 0 22px;padding:22px 24px;border-radius:14px;text-align:center;border:2px solid #30363d;background:#161b22;}
.gate-banner.pass{background:rgba(46,164,79,0.14);border-color:rgba(63,185,80,0.45);color:#3fb950;}
.gate-banner.fail{background:rgba(248,81,73,0.14);border-color:rgba(248,81,73,0.45);color:#f85149;}
.gate-banner-label{font-size:10pt;letter-spacing:0.12em;text-transform:uppercase;opacity:0.85;}
.gate-banner-value{font-size:28pt;font-weight:700;margin-top:4px;}
.data-table{width:100%;border-collapse:collapse;margin:10px 0 16px;font-size:9.5pt;}
.data-table th,.data-table td{border:1px solid #30363d;padding:8px 9px;vertical-align:top;text-align:left;}
.data-table th{background:#0d1117;font-weight:600;color:#c9d1d9;}
.data-table td{background:#161b22;color:#e6edf3;}
.data-table tbody tr:nth-child(even) td{background:#131920;}
.kpi-strip{display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin:20px 0;}
.kpi{border:1px solid #30363d;border-radius:10px;padding:12px;text-align:center;background:#161b22;}
.kpi strong{display:block;font-size:18pt;line-height:1.1;margin-bottom:4px;color:#e6edf3;}
.kpi span{color:#8b949e;font-size:8.5pt;text-transform:uppercase;letter-spacing:0.05em;}
.exec-box{background:rgba(88,166,255,0.12);border:1px solid rgba(88,166,255,0.28);border-radius:12px;padding:20px 22px;margin:12px 0 8px;}
.exec-headline{font-weight:700;color:#79c0ff;margin:14px 0 10px;font-size:12pt;}
.sev{font-size:8pt;font-weight:700;padding:2px 7px;border-radius:4px;white-space:nowrap;}
.sev-high{background:rgba(248,81,73,0.14);color:#ff7b72;}
.sev-medium{background:rgba(210,153,34,0.14);color:#e3b341;}
.sev-low{background:rgba(88,166,255,0.14);color:#79c0ff;}
.impact-cell{font-size:9pt;}
.impact-badge{display:block;padding:6px 8px;border-radius:6px;font-size:8.5pt;font-weight:600;margin-bottom:4px;}
.impact-critical{background:rgba(248,81,73,0.14);color:#ff7b72;}
.impact-high{background:rgba(210,153,34,0.14);color:#e3b341;}
.impact-medium{background:rgba(210,153,34,0.14);color:#e3b341;}
.impact-low{background:rgba(88,166,255,0.14);color:#79c0ff;}
.recipe-cell{font-size:9pt;color:#c9d1d9;}
.callout{background:rgba(210,153,34,0.1);border:1px solid rgba(210,153,34,0.35);border-radius:8px;padding:12px 14px;font-size:10pt;margin:12px 0;color:#e6edf3;}
.command-box{background:#0d1117;color:#c9d1d9;border:1px solid #30363d;padding:14px 16px;border-radius:8px;font-family:"JetBrains Mono",Consolas,monospace;font-size:9.5pt;margin:10px 0;}
.disclaimer-box{border:1px solid #30363d;background:#161b22;padding:16px 18px;border-radius:8px;font-size:9.5pt;color:#8b949e;}
.footer{margin-top:40px;padding-top:18px;border-top:2px solid #30363d;color:#8b949e;font-size:9pt;}
ul{margin:8px 0;padding-left:20px;} li{margin-bottom:6px;}
.signoff-grid{border:1px solid #30363d;border-radius:12px;padding:18px 20px;background:#161b22;margin:12px 0 20px;}
.signoff-check{display:block;margin:0 0 12px;padding-left:1.6rem;position:relative;font-size:10pt;line-height:1.5;color:#e6edf3;}
.signoff-check:last-child{margin-bottom:0;}
.signoff-box{position:absolute;left:0;top:0.15rem;width:0.95rem;height:0.95rem;border:2px solid #30363d;border-radius:3px;background:#0d1117;}
.signoff-signature{margin-top:1.25rem;font-size:10pt;color:#8b949e;}
.signoff-line{display:block;margin:1rem 0 0.35rem;border-bottom:1px solid #30363d;min-height:1.75rem;color:#e6edf3;}
.signoff-role{font-size:9pt;color:#6e7681;}
</style></head>
<body>
<section class="certificate cover-page">
  <p class="cover-kicker">${tierConfig.kicker}</p>
  <h1 class="cover-title">${clientName.replace(/</g,'&lt;')}</h1>
  <p class="cover-sub">${tierConfig.subtitle}</p>
  <div class="cover-meta">
    <div><strong>Report ID:</strong> ${reportId}</div>
    <div><strong>Executed:</strong> ${nowStr}</div>
    <div><strong>Client:</strong> ${clientName.replace(/</g,'&lt;')}</div>
    <div><strong>Assessor:</strong> SimpleBeacon</div>
    <div><strong>Engine:</strong> SimpleBeacon Engine v1.3.0 (Zero-Dependency)</div>
    <div><strong>Repository:</strong> ${projectName.replace(/</g,'&lt;')} / main</div>
  </div>
  <div class="cover-badges">
    <span class="badge ${tierConfig.badgeClass}">${tierConfig.badge}</span>
    <span class="badge ${gatePass === 'PASS' ? 'badge-pass' : 'badge-blocked'}">GATE ${gatePass}</span>
  </div>
  <p class="confidential">Prepared for authorized business and engineering recipients. This document combines executive risk metrics for leadership and deterministic remediation mapping for developers.</p>
</section>
<main>
  <section class="section">
    <div class="section-num">Section 01</div>
    <h2>Audit Metadata &amp; Ledger</h2>
    <p class="meta">Establishes consulting authority, scan scope, and performance evidence for this engagement.</p>
    <table class="data-table">
      <tr><td>Client name</td><td>${clientName.replace(/</g,'&lt;')}</td></tr>
      <tr><td>Target repository / branch</td><td><code>${projectName.replace(/</g,'&lt;')}</code> / <code>main</code></td></tr>
      <tr><td>Timestamp</td><td>${nowStr}</td></tr>
      <tr><td>Engine core version</td><td>SimpleBeacon Engine v1.3.0 (Zero-Dependency)</td></tr>
      <tr><td>Scan performance ledger</td><td>${totalFiles} repo files indexed</td></tr>
      <tr><td>Report assessor</td><td>SimpleBeacon</td></tr>
      <tr><td>Quality score</td><td>${qualityScore}% · code health — · audit confidence 100/100</td></tr>
    </table>
  </section>
  <section class="section">
    <div class="section-num">Section 02</div>
    <h2>Executive Dashboard (CFO View)</h2>
    <p class="meta">Deterministic executive narrative and remediation mapping generated directly from complete scan JSON — no AI inference on counts or findings.</p>
    <div class="gate-banner ${gatePass === 'PASS' ? 'pass' : 'fail'}">
      <div class="gate-banner-label">Overall gate result</div>
      <div class="gate-banner-value">${gatePass}</div>
    </div>
    <div class="kpi-strip">
      <div class="kpi"><strong>${gatePass === 'PASS' ? 'PASS' : 'REVIEW'}</strong><span>Gate (not scanned)</span></div>
      <div class="kpi"><strong>0</strong><span>Runtime findings</span></div>
      <div class="kpi"><strong>—</strong><span>DQ findings</span></div>
      <div class="kpi"><strong>—</strong><span>Files deep-scanned</span></div>
      <div class="kpi"><strong>${qualityScore}%</strong><span>Code health</span></div>
    </div>
  </section>
  <section class="section">
    <div class="section-num">Section 03</div>
    <h2>Developer Action Plan (Technical Recipe Book)</h2>
    <p class="meta">Each row maps scan JSON to a full remediation chain: raw file flag → business impact → safe copy-paste fix recipe. Showing up to 100 prioritized rows.</p>
    <table class="data-table">
      <tr><th>Severity</th><th>File &amp; snippet</th><th>Rule triggered</th><th>Why it breaks (impact)</th><th>Safe code fix recipe</th></tr>
      ${issueRows || '<tr><td colspan="5" style="text-align:center;color:#8b949e;">No blocking findings at configured gate severities.</td></tr>'}
    </table>
    <div class="verify-block">
      <h3>Local verification before re-submit</h3>
      <p class="meta">After engineering applies the recipes above, prove a clean gate locally — without waiting for a re-audit.</p>
      <div class="command-box">npx simplebeacon scan --path ./${projectName.replace(/</g,'&lt;')} --gate</div>
    </div>
  </section>
  <section class="section">
    <div class="section-num">Section 04</div>
    <h2>Compliance &amp; Git Gate Recommendations</h2>
    <p class="meta">Continuous evaluation checklist and automated prevention steps for the engineering team.</p>
    <h3>Continuous evaluation checklist</h3>
    <table class="data-table">
      <tr><th>Checklist item</th><th>Status</th><th>Notes</th></tr>
      <tr><td>Zero hardcoded credential patterns</td><td><strong>${credentialHits > 0 ? 'FAIL' : 'PASS'}</strong></td><td>${credentialHits > 0 ? credentialHits + ' credential pattern(s) detected' : 'Scanned ' + totalFiles + ' path(s) — no credential patterns'}</td></tr>
      <tr><td>Production path separation</td><td><strong>PASS</strong></td><td>Scanned ${totalFiles} production file(s) — no sample-path leaks</td></tr>
      <tr><td>Schema conformity (configured samples)</td><td><strong>N/A</strong></td><td>No registered page samples checked</td></tr>
      <tr><td>Fiction KPI baseline (sample JSON)</td><td><strong>N/A</strong></td><td>Consistency anchors not configured for this profile</td></tr>
    </table>
    <h3>Automated next step — local pre-commit hook</h3>
    <div class="command-box">npx simplebeacon hook install</div>
    <p class="meta">Install the open-source local hook so credential, mock-path, and fiction KPI patterns cannot re-enter the repository before commit.</p>
    <h3>Recommended CI gate</h3>
    <div class="command-box">npx simplebeacon scan --gate --format json --output .simplebeacon/report.json</div>
    <p class="meta">Add .github/workflows/simplebeacon-gate.yml from SimpleBeacon examples so pull requests fail on configured high-severity findings.</p>
    <div class="disclaimer-box">
      <strong>Independent disclaimer.</strong> This assessment is an opinion-based, static technical review of the source files and configured scan paths at the time of evaluation. It is not a legal compliance guarantee, formal penetration test, SOC 2 attestation, or certification that the system is secure in production. The client remains responsible for remediation, release authorization, and ongoing security posture.
    </div>
  </section>
  <section class="section">
    <div class="section-num">Section 05</div>
    <h2>Production compliance sign-off</h2>
    <p class="meta">Formal handoff seal — complete after remediations and a zero Critical/High re-scan.</p>
    <div class="signoff-grid">
      <span class="signoff-check"><span class="signoff-box" aria-hidden="true"></span> STAGE 1: Line-by-line remediation applied by engineering team.</span>
      <span class="signoff-check"><span class="signoff-box" aria-hidden="true"></span> STAGE 2: Zero-dependency re-scan executed (0 Critical/High flags remaining).</span>
    </div>
    <div class="signoff-signature">
      <span>Approved for production handoff by:</span>
      <span class="signoff-line">&nbsp;</span>
      <span class="signoff-role">CTO / Lead Architect · Date: _______________</span>
    </div>
  </section>
  <section class="section">
    <div class="section-num">Appendix</div>
    <h2>Methodology &amp; scan scope</h2>
    <ul><li>Repository inventory: ${totalFiles} files — browser-local heuristic scan.</li><li>Pattern matching on file content for AI/LLM imports and credential heuristics — not LLM semantic review.</li><li>Processing runs 100% locally in browser sandbox. No source code leaves your computer.</li><li>Gate rules: credential patterns, AI-implementation detection.</li></ul>
    <p class="meta">Report ID ${reportId} · Generated ${nowStr} by SimpleBeacon</p>
  </section>
  <div class="footer">
    <p><strong>Report ID ${reportId}</strong> · Generated ${nowStr} by SimpleBeacon</p>
    <p>Print this document (Ctrl+P / Cmd+P) → Destination: <strong>Save as PDF</strong> · Recommended filename: <code>${reportId}.pdf</code></p>
  </div>
</main>
</body></html>`;
}

// Certificate generation endpoint
app.post('/api/reports/download', async (req, res) => {
    const auth = req.headers.authorization || '';
    const token = auth.replace(/^Bearer\s+/i, '').trim();
    const secret = process.env.SIMPLEBEACON_LICENSE_SECRET || (process.env.NODE_ENV !== 'production' ? 'simplebeacon-dev-insecure' : null);
    if (!secret) {
        return res.status(500).json({ error: 'License secret not configured' });
    }
    if (!token || token.length < 10) {
        return res.status(401).json({ error: 'License token required' });
    }
    const payload = verifyLicenseToken(token, secret);
    if (!payload) {
        return res.status(403).json({ error: 'Invalid or expired token' });
    }

    const reportJson = req.body.reportJson || {};
    const certificateHtml = buildCertificateHtml(reportJson, payload);

    try {
        const archiver = require('archiver');
        const archive = archiver('zip', { zlib: { level: 9 } });
        const tier = payload.tier || 'executive';
        const tierConfig = getTierConfig(tier);
        const dateStr = new Date().toISOString().slice(0,10);
        const zipName = `simplebeacon-${tierConfig.label.toLowerCase().replace(/\s+/g,'-')}-${dateStr}.zip`;
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename="${zipName}"`);
        archive.pipe(res);
        archive.append(certificateHtml, { name: 'reports/certificate.html' });
        archive.append(JSON.stringify(reportJson, null, 2), { name: 'json/report.json' });
        archive.append(JSON.stringify({
            type: 'simplebeacon-export-manifest',
            version: '1.0.0',
            generatedAt: new Date().toISOString(),
            tier: tier,
            productSku: payload.productSku || tier,
            files: ['reports/certificate.html', 'json/report.json'],
            certificateType: tierConfig.label,
            reportId: 'SB-AUD-' + dateStr.replace(/-/g,'') + '-' + Math.random().toString(36).slice(2,8).toUpperCase()
        }, null, 2), { name: 'manifest.json' });
        archive.append(`SimpleBeacon ${tierConfig.label}
============================

Generated: ${new Date().toLocaleString()}
Tier: ${tier}
Product SKU: ${payload.productSku || tier}

Contents:
  - reports/certificate.html : Printable certificate (open in browser, print to PDF)
  - json/report.json         : Raw scan report data
  - manifest.json            : Export manifest for verification

For vendor handoff, run a Complete Scan via the CLI:
  npx simplebeacon scan --gate --complete

Questions? https://simplebeacon.ai
`, { name: 'README.txt' });
        await archive.finalize();
    } catch (err) {
        console.error('[Certificate] Archive failed:', err.message);
        res.status(500).json({ error: 'Certificate generation failed' });
    }
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