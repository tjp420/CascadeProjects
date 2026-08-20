/**
 * Email service — handles sending via Resend, SMTP, or disk queue fallback.
 */

const https = require('https');
const crypto = require('crypto');
const path = require('path');
const db = require('../lib/db.cjs');
const {
    getFromAddress,
    getSmtpSettings,
    hasResendApiKey,
    getEmailStatus,
    isEmailConfigured
} = require('../lib/email-config.cjs');

const EMAIL_QUEUE_DIR = path.join(__dirname, '..', '.simplebeacon', 'email-queue');

function ensureQueueDir() {
    const fsSync = require('fs');
    if (!fsSync.existsSync(EMAIL_QUEUE_DIR)) {
        fsSync.mkdirSync(EMAIL_QUEUE_DIR, { recursive: true });
    }
}

function queueEmailToDisk({ to, subject, text, html }) {
    const id = 'email_' + Date.now() + '_' + crypto.randomBytes(4).toString('hex');
    try {
        db.queueEmail({ id, to, subject, text, html });
        return { sent: false, queued: true, queueId: id };
    } catch (err) {
        // Fallback to disk if SQLite fails
        const fsSync = require('fs');
        ensureQueueDir();
        const filePath = path.join(EMAIL_QUEUE_DIR, id + '.json');
        fsSync.writeFileSync(
            filePath,
            JSON.stringify({ id, to, subject, text, html, queuedAt: new Date().toISOString() }, null, 2) + '\n'
        );
        return { sent: false, queued: true, queuePath: filePath };
    }
}

function sendViaResend({ to, from, subject, text, html }) {
    return new Promise((resolve, reject) => {
        const key = process.env.RESEND_API_KEY;
        if (!key || !key.startsWith('re_')) return reject(new Error('Resend not configured'));
        const payload = JSON.stringify({ from, to: [to], subject, text, html });
        const req = https.request(
            {
                hostname: 'api.resend.com',
                path: '/emails',
                method: 'POST',
                timeout: 15000,
                headers: {
                    Authorization: 'Bearer ' + key,
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(payload)
                }
            },
            res => {
                let data = '';
                res.on('data', chunk => {
                    data += chunk;
                });
                res.on('end', () => {
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        try {
                            resolve({ id: JSON.parse(data).id });
                        } catch {
                            resolve({ id: null });
                        }
                    } else {
                        reject(new Error('Resend ' + res.statusCode + ': ' + data));
                    }
                });
            }
        );
        req.on('error', reject);
        req.on('timeout', () => {
            req.destroy();
            reject(new Error('Resend request timed out'));
        });
        req.write(payload);
        req.end();
    });
}

async function sendViaSmtp({ to, from, subject, text, html }) {
    let nodemailer;
    try {
        nodemailer = require('nodemailer');
    } catch {
        throw new Error('nodemailer not installed');
    }
    const smtp = getSmtpSettings();
    if (!smtp) throw new Error('SMTP not configured');
    const transporter = nodemailer.createTransport({
        host: smtp.host,
        port: smtp.port,
        secure: smtp.secure,
        auth: { user: smtp.user, pass: smtp.pass }
    });
    const fromAddr = smtp.from || from || getFromAddress();
    await transporter.sendMail({ from: fromAddr, to, subject, text: text || '', html: html || undefined });
    return { sent: true, provider: smtp.mode || 'smtp' };
}

async function sendEmail(options) {
    const { to, subject, text, html, queueId: existingQueueId } = options;
    if (!to || !subject) return { sent: false, queued: false, error: 'to and subject required' };

    let queueId = existingQueueId;
    if (!queueId) {
        queueId = 'email_' + Date.now() + '_' + crypto.randomBytes(4).toString('hex');
        db.queueEmail({ id: queueId, to, subject, text, html });
    }

    try {
        const result = await sendViaResend({ to, from: getFromAddress(), subject, text, html });
        db.markEmailSent(queueId, 'resend', result.id);
        return { sent: true, queued: false, queueId, provider: 'resend', providerMessageId: result.id };
    } catch (err) {
        db.updateEmailStatus(queueId, 'pending', err.message);
    }

    try {
        const smtpResult = await sendViaSmtp({ to, from: getFromAddress(), subject, text, html });
        db.markEmailSent(queueId, smtpResult.provider || 'smtp', null);
        return { sent: true, queued: false, queueId, provider: smtpResult.provider || 'smtp' };
    } catch (err) {
        db.updateEmailStatus(queueId, 'pending', err.message);
    }

    return {
        sent: false,
        queued: true,
        queueId,
        error: isEmailConfigured()
            ? 'Email delivery failed. Message queued for retry.'
            : 'Email not configured. Set RESEND_API_KEY on the server (Render env vars).'
    };
}

module.exports = {
    sendEmail,
    queueEmailToDisk,
    sendViaResend,
    sendViaSmtp,
    getEmailStatus: () => getEmailStatus({ db }),
    isEmailConfigured,
    hasResendApiKey
};
