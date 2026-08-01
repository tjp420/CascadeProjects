// simplebeacon-ignore: debugArtifacts
/**
 * Email service — Cloudflare Email Sending → Resend REST API → SMTP fallback → disk queue fallback.
 *
 * Priority:
 *   1. Cloudflare Email Sending REST API (requires CF_API_TOKEN, CF_ACCOUNT_ID)
 *   2. Resend REST API (requires RESEND_API_KEY)
 *   3. SMTP via nodemailer (requires SMTP_HOST, SMTP_USER, SMTP_PASS)
 *   4. Queue JSON to disk for later retry
 *
 * Env: CF_API_TOKEN, CF_ACCOUNT_ID, CF_EMAIL_FROM, RESEND_API_KEY, RESEND_FROM, SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM, SMTP_SECURE
 */

const https = require('https');
const path = require('path');
const logger = require('./app-logger.cjs');
const fs = require('fs');

let nodemailer = null;
try {
  nodemailer = require('nodemailer');
} catch {
  nodemailer = null;
}

const QUEUE_DIR = process.env.EMAIL_QUEUE_DIR
  || path.join(process.cwd(), '.simplebeacon', 'email-queue');

/**
 * Ensure queue dir.
 * @returns {any}
 */
function ensureQueueDir() {
  if (!fs.existsSync(QUEUE_DIR)) {
    fs.mkdirSync(QUEUE_DIR, { recursive: true });
  }
}

/**
 * Get resend config.
 * @returns {any}
 */
function getCloudflareConfig() {
  const apiToken = process.env.CF_API_TOKEN || '';
  const accountId = process.env.CF_ACCOUNT_ID || '';
  if (!apiToken || !accountId) return null;
  const from = process.env.CF_EMAIL_FROM || 'certificates@simplebeacon.ai';
  return { apiToken, accountId, from };
}

function getResendConfig() {
  const primary = String(process.env.RESEND_API_KEY || '').trim();
  const secondary = String(process.env.RESEND_API_KEY_NEW || process.env.RESEND_API_KEY_2 || '').trim();
  const keys = [];
  if (primary) keys.push(primary);
  if (secondary) keys.push(secondary);
  // Only accept keys that look like Resend keys (start with re_)
  const validKeys = keys.filter(k => k && k.startsWith('re_'));
  if (!validKeys.length) return null;
  const from = process.env.RESEND_FROM || process.env.SMTP_FROM || 'certificates@simplebeacon.ai';
  // Backwards-compatible: expose `key` for primary, and `keys` for fallback order
  return { key: primary && primary.startsWith('re_') ? primary : validKeys[0], keys: validKeys, from };
}

/**
 * Get smtp config.
 * @returns {any}
 */
function getSmtpConfig() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT) || 587;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM || 'certificates@simplebeacon.ai';
  const secure = process.env.SMTP_SECURE === 'true' || port === 465;

  if (!host || !user || !pass) return null;
  return { host, port, user, pass, from, secure };
}

/**
 * Create transporter.
 * @returns {any}
 */
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

/**
 * Send via resend.
 * @param {Object} options
 * @param {any} from
 * @param {any} subject
 * @param {string} text
 * @param {any} html
 * @param {Array} attachments
 * @returns {any}
 */
function sendViaCloudflare({ to, from, subject, text, html }) {
  return new Promise((resolve, reject) => {
    const cfg = getCloudflareConfig();
    if (!cfg) return reject(new Error('Cloudflare Email not configured'));

    const body = JSON.stringify({
      from,
      to: Array.isArray(to) ? to : [to],
      subject,
      text: text || undefined,
      html: html || undefined
    });

    const req = https.request({
      hostname: 'api.cloudflare.com',
      path: `/client/v4/accounts/${cfg.accountId}/email/sending/send`,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${cfg.apiToken}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            const json = JSON.parse(data);
            resolve({ id: json.result?.messageId || json.result?.id || null });
          } catch {
            resolve({ id: null });
          }
        } else {
          reject(new Error(`Cloudflare Email API error ${res.statusCode}: ${data}`));
        }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
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
    // Try each configured Resend key in order until one succeeds.
    const keys = Array.isArray(cfg.keys) && cfg.keys.length ? cfg.keys : [cfg.key];
    let lastErr = null;
    const tryKey = (index) => {
      if (index >= keys.length) {
        return reject(new Error(lastErr ? lastErr.message : 'All Resend keys failed'));
      }
      const key = keys[index];
      const req = https.request({
        hostname: 'api.resend.com',
        path: '/emails',
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${key}`,
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
              return resolve({ id: json.id });
            } catch {
              return resolve({ id: null });
            }
          }
          // If auth error, try next key
          if (res.statusCode === 401 || res.statusCode === 403) {
            lastErr = new Error(`Resend auth failed ${res.statusCode}: ${data}`);
            return tryKey(index + 1);
          }
          // Other errors are fatal
          return reject(new Error(`Resend API error ${res.statusCode}: ${data}`));
        });
      });
      req.on('error', (err) => {
        lastErr = err;
        tryKey(index + 1);
      });
      req.write(payload);
      req.end();
    };
    tryKey(0);
  });
}

/**
 * Queue email to disk.
 * @param {Object} options
 * @param {any} subject
 * @param {string} text
 * @param {any} html
 * @param {Array} attachments
 * @returns {any}
 */
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

  // 1. Cloudflare Email Sending
  const cfCfg = getCloudflareConfig();
  if (cfCfg) {
    try {
      const result = await sendViaCloudflare({ to, from: cfCfg.from, subject, text, html });
      return { sent: true, queued: false, id: result.id, provider: 'cloudflare' };
    } catch (err) {
      logger.error('[Email] Cloudflare failed:', err.message);
      // fall through to Resend
    }
  }

  // 2. Resend REST API
  const cfg = getResendConfig();
  if (cfg) {
    try {
      const result = await sendViaResend({ to, from: cfg.from, subject, text, html, attachments });
      return { sent: true, queued: false, id: result.id, provider: 'resend' };
    } catch (err) {
      logger.error('[Email] Resend API failed'); // simplebeacon-ignore pii-logging — error detail removed
      // fall through to SMTP
    }
  }

  // 3. SMTP fallback
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
      return { sent: true, queued: false, provider: 'smtp' };
    } catch (err) {
      logger.error('[Email] SMTP send failed:', err.message);
      // fall through to queue
    }
  }

  // 4. Disk queue fallback
  return { ...queueEmailToDisk({ to, subject, text, html, attachments }), provider: 'queued' };
}

module.exports = { sendEmail, getCloudflareConfig, getResendConfig, getSmtpConfig, QUEUE_DIR };
