/**
 * Email service — handles sending via Resend, SMTP, or disk queue fallback.
 */

const https = require('https');
const crypto = require('crypto');
const path = require('path');
const db = require('../lib/db.cjs');

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
        fsSync.writeFileSync(filePath, JSON.stringify({ id, to, subject, text, html, queuedAt: new Date().toISOString() }, null, 2) + '\n');
        return { sent: false, queued: true, queuePath: filePath };
    }
}

function sendViaResend({ to, from, subject, text, html }) {
    return new Promise((resolve, reject) => {
        const key = process.env.RESEND_API_KEY;
        if (!key || !key.startsWith('re_')) return reject(new Error('Resend not configured'));
        const payload = JSON.stringify({ from, to: [to], subject, text, html });
        const req = https.request({
            hostname: 'api.resend.com',
            path: '/emails',
            method: 'POST',
            timeout: 15000,
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
        req.on('timeout', () => { req.destroy(); reject(new Error('Resend request timed out')); });
        req.write(payload);
        req.end();
    });
}

async function sendViaSmtp({ to, from, subject, text, html }) {
    let nodemailer;
    try { nodemailer = require('nodemailer'); } catch { throw new Error('nodemailer not installed'); }
    const cfg = { host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT) || 587, user: process.env.SMTP_USER, pass: process.env.SMTP_PASS, from: process.env.SMTP_FROM || from || 'certificates@simplebeacon.ai', secure: process.env.SMTP_SECURE === 'true' || Number(process.env.SMTP_PORT) === 465 };
    if (!cfg.host || !cfg.user || !cfg.pass) throw new Error('SMTP not configured');
    const transporter = nodemailer.createTransport({ host: cfg.host, port: cfg.port, secure: cfg.secure, auth: { user: cfg.user, pass: cfg.pass } });
    await transporter.sendMail({ from: cfg.from, to, subject, text: text || '', html: html || undefined });
    return { sent: true };
}

async function sendEmail(options) {
    const { to, subject, text, html } = options;
    if (!to || !subject) return { sent: false, queued: false, error: 'to and subject required' };

    try {
        const result = await sendViaResend({ to, from: process.env.RESEND_FROM || 'certificates@simplebeacon.ai', subject, text, html });
        return { sent: true, queued: false, id: result.id };
    } catch (err) { /* Resend failed */ }

    try {
        await sendViaSmtp({ to, subject, text, html });
        return { sent: true, queued: false };
    } catch (err) { /* SMTP failed */ }

    return queueEmailToDisk({ to, subject, text, html });
}

module.exports = {
    sendEmail,
    queueEmailToDisk,
    sendViaResend,
    sendViaSmtp
};
