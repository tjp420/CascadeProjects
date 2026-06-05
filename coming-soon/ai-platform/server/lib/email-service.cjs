/**
 * Email service — Resend REST API → SMTP fallback → disk queue fallback.
 *
 * Priority:
 *   1. Resend REST API (requires RESEND_API_KEY)
 *   2. SMTP via nodemailer (requires SMTP_HOST, SMTP_USER, SMTP_PASS)
 *   3. Queue JSON to disk for later retry
 *
 * Env: RESEND_API_KEY, RESEND_FROM, SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM, SMTP_SECURE
 */

const https = require('https');
const path = require('path');
const fs = require('fs');

let nodemailer = null;
try {
  nodemailer = require('nodemailer');
} catch {
  nodemailer = null;
}

const QUEUE_DIR = process.env.EMAIL_QUEUE_DIR
  || path.join(process.cwd(), '.simplebeacon', 'email-queue');

function ensureQueueDir() {
  if (!fs.existsSync(QUEUE_DIR)) {
    fs.mkdirSync(QUEUE_DIR, { recursive: true });
  }
}

function getResendConfig() {
  const key = process.env.RESEND_API_KEY || process.env.SMTP_PASS || '';
  if (!key.startsWith('re_')) return null;
  const from = process.env.RESEND_FROM || process.env.SMTP_FROM || 'certificates@simplebeacon.ai';
  return { key, from };
}

function getSmtpConfig() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT) || 587;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM || 'trevor_punt@live.com';
  const secure = process.env.SMTP_SECURE === 'true' || port === 465;

  if (!host || !user || !pass) return null;
  return { host, port, user, pass, from, secure };
}

function createTransporter() {
  const cfg = getSmtpConfig();
  if (!cfg || !nodemailer) return null;
  return nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    auth: { user: cfg.user, pass: cfg.pass }
  });
}

function sendViaResend({ to, from, subject, text, html, attachments = [] }) {
  return new Promise((resolve, reject) => {
    const cfg = getResendConfig();
    if (!cfg) return reject(new Error('Resend not configured'));

    const body = {
      from,
      to: Array.isArray(to) ? to : [to],
      subject,
      text: text || undefined,
      html: html || undefined
    };
    if (attachments.length) {
      body.attachments = attachments.map((a) => ({
        filename: a.filename,
        content: a.content
      }));
    }
    const payload = JSON.stringify(body);

    const req = https.request({
      hostname: 'api.resend.com',
      path: '/emails',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${cfg.key}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            const json = JSON.parse(data);
            resolve({ id: json.id });
          } catch {
            resolve({ id: null });
          }
        } else {
          reject(new Error(`Resend API error ${res.statusCode}: ${data}`));
        }
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

function queueEmailToDisk({ to, subject, text, html, attachments = [] }) {
  ensureQueueDir();
  const id = `email_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const filePath = path.join(QUEUE_DIR, `${id}.json`);
  const payload = {
    id,
    to,
    subject,
    text: text || '',
    html: html || undefined,
    attachments: attachments.map((a) => ({
      filename: a.filename,
      content: a.content.slice(0, 80) + '...'
    })),
    queuedAt: new Date().toISOString()
  };
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2) + '\n');
  return { sent: false, queued: true, queuePath: filePath };
}

/**
 * Send an email.
 * @param {Object} options — to, subject, text, html
 * @returns {Promise<{sent: boolean, queued: boolean, error?: string, id?: string}>}
 */
async function sendEmail(options = {}) {
  const { to, subject, text, html, attachments } = options;
  if (!to || !subject) {
    return { sent: false, queued: false, error: 'to and subject are required' };
  }

  const cfg = getResendConfig();
  if (cfg) {
    try {
      const result = await sendViaResend({ to, from: cfg.from, subject, text, html, attachments });
      return { sent: true, queued: false, id: result.id };
    } catch (err) {
      console.error('[Email] Resend API failed:', err.message);
      // fall through to SMTP
    }
  }

  const transporter = createTransporter();
  if (transporter) {
    try {
      const smtpCfg = getSmtpConfig();
      const mailOptions = {
        from: smtpCfg.from,
        to,
        subject,
        text: text || '',
        html: html || undefined
      };
      if (attachments?.length) {
        mailOptions.attachments = attachments.map((a) => ({
          filename: a.filename,
          content: Buffer.from(a.content, 'base64')
        }));
      }
      await transporter.sendMail(mailOptions);
      return { sent: true, queued: false };
    } catch (err) {
      console.error('[Email] SMTP send failed:', err.message);
      // fall through to queue
    }
  }

  return queueEmailToDisk({ to, subject, text, html, attachments });
}

module.exports = { sendEmail, getResendConfig, getSmtpConfig, QUEUE_DIR };
