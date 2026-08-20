/**
 * Email management routes — self-service resend, admin queue monitoring,
 * and Resend delivery webhooks.
 */

const express = require('express');
const router = express.Router();
const db = require('../lib/db.cjs');
const { sendEmail } = require('../services/email.cjs');
const { generateLicenseToken } = require('../lib/license-utils.cjs');
const { createTokenChain, activateToken, hashToken } = require('../lib/token-chain-store.cjs');

const logger = {
    error: (...a) => {
        const c = globalThis.console;
        c.error(...a);
    },
    info: (...a) => {
        const c = globalThis.console;
        c.info(...a);
    },
    warn: (...a) => {
        const c = globalThis.console;
        c.warn(...a);
    }
};

// ── Admin auth helper (mirrors routes/admin.cjs) ───────────────────────────
function requireAdmin(req, res, next) {
    const secret = process.env.SIMPLEBEACON_LICENSE_SECRET;
    const auth = req.headers.authorization || '';
    const token = auth.replace(/^Bearer\s+/i, '');
    if (!token) return res.status(401).json({ error: 'Admin token required' });
    const { verifyAdminToken } = require('../lib/admin-token.cjs');
    const payload = verifyAdminToken(token, secret);
    if (!payload) return res.status(403).json({ error: 'Invalid or expired admin token' });
    req.adminPayload = payload;
    next();
}

// ── Rate limiter for self-service resend ────────────────────────────────────
const RESEND_COOLDOWN_MS = 60 * 60 * 1000; // 1 hour
const resendLog = new Map(); // email -> { count, resetAt }

function checkResendRateLimit(email) {
    const now = Date.now();
    const key = email.trim().toLowerCase();
    const entry = resendLog.get(key);
    if (entry && now < entry.resetAt) {
        if (entry.count >= 3) return { allowed: false, retryAfterMin: Math.ceil((entry.resetAt - now) / 60000) };
        entry.count++;
        return { allowed: true };
    }
    resendLog.set(key, { count: 1, resetAt: now + RESEND_COOLDOWN_MS });
    return { allowed: true };
}

// ── Self-service: resend token email ───────────────────────────────────────
router.post('/api/emails/resend-token', express.json(), async (req, res) => {
    try {
        const { email } = req.body;
        if (!email || !email.includes('@')) {
            return res.status(400).json({ error: 'Valid email required' });
        }

        const rate = checkResendRateLimit(email);
        if (!rate.allowed) {
            return res.status(429).json({ error: `Rate limit exceeded. Retry after ${rate.retryAfterMin} minutes.` });
        }

        const customer = db.getOrCreateCustomer(email.trim().toLowerCase());
        if (!customer || customer.subscription_status !== 'active') {
            return res.status(403).json({ error: 'No active subscription found for this email.' });
        }

        // Find active paid subscription
        const dbInstance = db.getDb();
        const activeSub = dbInstance
            .prepare(
                "SELECT * FROM paid_subscriptions WHERE customer_email = ? AND status = 'active' ORDER BY current_period_end DESC LIMIT 1"
            )
            .get(customer.email);
        if (!activeSub) {
            return res.status(403).json({ error: 'No active paid subscription found.' });
        }

        // Determine tier and TTL
        const finalTier = customer.tier || 'team';
        const ttlMinutes = activeSub.current_period_end
            ? Math.max(60 * 24 * 30, Math.ceil((new Date(activeSub.current_period_end) - Date.now()) / 60000))
            : 60 * 24 * 30;
        const ttlLabel = ttlMinutes >= 60 * 24 * 365 ? '1 year' : '30 days';

        const features =
            finalTier === 'enterprise'
                ? [
                      'continuous_shield',
                      'team_dashboard',
                      'ci_integration',
                      'compliance_certificate',
                      'eu_ai_act',
                      'analyst_support'
                  ]
                : ['continuous_shield', 'team_dashboard', 'ci_integration'];

        const licenseSecret = process.env.SIMPLEBEACON_LICENSE_SECRET;
        if (!licenseSecret) {
            return res.status(500).json({ error: 'Server misconfigured' });
        }

        // Generate new token (old one remains valid until expiry)
        const tokenPayload = {
            email: customer.email,
            tier: finalTier,
            projectName: customer.email,
            clientName: customer.email,
            features
        };
        const token = generateLicenseToken(tokenPayload, licenseSecret, ttlMinutes);

        // Register and activate
        createTokenChain(customer.email, tokenPayload, token, ttlMinutes);
        activateToken(hashToken(token), ttlMinutes);

        // Send email
        const emailResult = await sendEmail({
            to: customer.email,
            subject: 'Your ' + finalTier + ' License Token',
            text: `Your ${finalTier} subscription is active.\n\nLicense Token: ${token}\n\nThis token is valid for ${ttlLabel}.\n\nAPI Key: ${customer.api_key}\n\nUse this API key in your GitHub Action to post scan results to your team dashboard.`,
            html: `<p>Your <strong>${finalTier}</strong> subscription is active.</p><p>License Token: <code>${token}</code></p><p>API Key: <code>${customer.api_key}</code></p><p>Use the API key in your GitHub Action to post scan results to your team dashboard.</p>`
        });

        if (!emailResult.sent && !emailResult.queued) {
            logger.error('[ResendToken] Email could not be sent or queued:', emailResult.error);
            return res.status(500).json({ error: 'Failed to send token email.', detail: emailResult.error });
        }

        res.json({
            success: true,
            message: emailResult.sent
                ? 'Token email sent successfully.'
                : 'Token email queued for delivery. You will receive it shortly.',
            emailQueued: !emailResult.sent
        });
    } catch (error) {
        logger.error('[ResendToken] Unexpected error:', error.message);
        res.status(500).json({ error: 'Failed to resend token', detail: error.message });
    }
});

// ── Admin: list pending emails ───────────────────────────────────────────────
router.get('/api/admin/emails/pending', requireAdmin, (req, res) => {
    try {
        const emails = db.getPendingEmails(100);
        res.json({ success: true, count: emails.length, emails });
    } catch (error) {
        logger.error('[AdminEmails] Failed to list pending:', error.message);
        res.status(500).json({ error: 'Failed to retrieve pending emails' });
    }
});

// ── Admin: manually retry a specific email ──────────────────────────────────
router.post('/api/admin/emails/retry', requireAdmin, express.json(), async (req, res) => {
    try {
        const { queueId } = req.body;
        if (!queueId) return res.status(400).json({ error: 'queueId required' });

        const dbInstance = db.getDb();
        const email = dbInstance.prepare('SELECT * FROM email_queue WHERE id = ?').get(queueId);
        if (!email) return res.status(404).json({ error: 'Email not found' });
        if (email.status === 'sent') return res.json({ success: true, message: 'Email already sent.' });

        db.incrementEmailAttempts(queueId);
        const result = await sendEmail({
            to: email.recipient,
            subject: email.subject,
            text: email.body_text,
            html: email.body_html,
            queueId: email.id
        });

        if (result.sent) {
            res.json({ success: true, message: 'Email sent successfully.', provider: result.provider });
        } else if (result.queued) {
            res.json({ success: false, message: 'Email queued for retry.', error: result.error });
        } else {
            res.status(500).json({ success: false, error: result.error });
        }
    } catch (error) {
        logger.error('[AdminEmails] Retry failed:', error.message);
        res.status(500).json({ error: 'Retry failed', detail: error.message });
    }
});

// ── Resend delivery webhook ────────────────────────────────────────────────
router.post('/api/webhooks/resend', express.json(), (req, res) => {
    try {
        const { type, data } = req.body;
        if (!type || !data) {
            return res.status(400).json({ error: 'Invalid webhook payload' });
        }

        const messageId = data.email_id || data.id;
        if (!messageId) {
            return res.status(400).json({ error: 'Missing message ID' });
        }

        const email = db.getEmailByProviderMessageId(messageId);
        if (!email) {
            logger.warn('[ResendWebhook] Unknown message ID:', messageId);
            return res.json({ received: true, status: 'unknown_message' });
        }

        const now = new Date().toISOString();
        let status = email.status;

        switch (type) {
            case 'email.sent':
                db.updateEmailStatus(email.id, 'sent', null);
                status = 'sent';
                break;
            case 'email.delivered': {
                const dbInstance = db.getDb();
                dbInstance
                    .prepare("UPDATE email_queue SET status = 'delivered', delivered_at = ? WHERE id = ?")
                    .run(now, email.id);
                status = 'delivered';
                break;
            }
            case 'email.bounced': {
                const dbInstance = db.getDb();
                dbInstance
                    .prepare("UPDATE email_queue SET status = 'bounced', bounced_at = ? WHERE id = ?")
                    .run(now, email.id);
                status = 'bounced';
                break;
            }
            case 'email.complained': {
                const dbInstance = db.getDb();
                dbInstance
                    .prepare("UPDATE email_queue SET status = 'complained', bounced_at = ? WHERE id = ?")
                    .run(now, email.id);
                status = 'complained';
                break;
            }
            case 'email.opened': {
                const dbInstance = db.getDb();
                dbInstance.prepare('UPDATE email_queue SET opened_at = ? WHERE id = ?').run(now, email.id);
                break;
            }
            default:
                logger.warn('[ResendWebhook] Unknown event type:', type);
        }

        logger.info('[ResendWebhook] Processed', type, 'for', email.recipient, 'status:', status);
        res.json({ received: true, type, status });
    } catch (error) {
        logger.error('[ResendWebhook] Error:', error.message);
        res.status(500).json({ error: 'Webhook processing failed' });
    }
});

module.exports = router;
