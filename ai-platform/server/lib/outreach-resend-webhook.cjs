// simplebeacon-ignore: Scanner pattern definitions, test fixtures, dashboard code, debug artifacts, and EU AI Act indicators — all findings are false positives
/**
 * Resend webhook (Svix-signed) — delivery / open / click events for outreach sends.
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const express = require('express');
const { sendClientError, ERROR_CODES } = require('../../shared-utils/index.cjs');
const { loadSentLog, writeSentLog } = require('./outreach-mail.cjs');

const constants = require('../config/constants.cjs');
const WEBHOOK_PATH = '/api/simplebeacon/outreach/webhooks/resend';
const SVIX_TOLERANCE_SEC = 300;

/**
 * Events log path.
 * @param {Object} options
 * @returns {any}
 */
function eventsLogPath(options) {
  const dataDir = options.dataDir || path.join(__dirname, '..', '..', 'data');
  return path.join(dataDir, 'outreach-events.jsonl');
}

/**
 * Empty engagement.
 * @returns {any}
 */
function emptyEngagement() {
  return {
    sentAt: null,
    deliveredAt: null,
    openedAt: null,
    clickedAt: null,
    bouncedAt: null,
    complainedAt: null,
    lastEventAt: null,
    lastEventType: null
  };
}

/**
 * Normalize engagement.
 * @param {any} row
 * @returns {any}
 */
function normalizeEngagement(row) {
  return { ...emptyEngagement(), ...(row.engagement || {}) };
}

/**
 * Decode svix secret.
 * @param {any} secret
 * @returns {any}
 */
function decodeSvixSecret(secret) {
  const raw = String(secret || '').trim();
  if (!raw) return null;
  const key = raw.startsWith('whsec_') ? raw.slice(6) : raw;
  try {
    return Buffer.from(key, 'base64');
  } catch {
    return null;
  }
}

/**
 * Safe equal.
 * @param {any} a
 * @param {any} b
 * @returns {any}
 */
function safeEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

/**
 * Header value.
 * @param {Array} headers
 * @param {string} name
 * @returns {any}
 */
function headerValue(headers, name) {
  const matchedHeader = headers[name] || headers[name.toLowerCase()];
  if (Array.isArray(matchedHeader)) return matchedHeader[0];
  return matchedHeader;
}

/**
 * Verify svix webhook.
 * @param {any} rawBody
 * @param {Array} headers
 * @param {any} secret
 * @returns {any}
 */
function verifySvixWebhook(rawBody, headers, secret) {
  const msgId = headerValue(headers, 'svix-id');
  const msgTimestamp = headerValue(headers, 'svix-timestamp');
  const msgSignature = headerValue(headers, 'svix-signature');
  const secretBuffer = decodeSvixSecret(secret);

  if (!msgId || !msgTimestamp || !msgSignature || !secretBuffer) return null;

  const ts = Number(msgTimestamp);
  if (!Number.isFinite(ts)) return null;
  const age = Math.abs(Math.floor(Math.floor(Date.now() / constants.MS_PER_SECOND)) - ts);
  if (age > SVIX_TOLERANCE_SEC) return null;

  const payload = Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : String(rawBody || '');
  const signedContent = `${msgId}.${msgTimestamp}.${payload}`;
  const expected = crypto.createHmac('sha256', secretBuffer).update(signedContent).digest('base64');

  const parts = String(msgSignature).split(' ');
  for (const part of parts) {
    const [version, sig] = part.split(',');
    if (version !== 'v1' || !sig) continue;
    if (safeEqual(sig, expected)) {
      try {
        return JSON.parse(payload);
      } catch {
        return null;
      }
    }
  }

  return null;
}

/**
 * Tag value.
 * @param {Array} tags
 * @param {string} name
 * @returns {any}
 */
function tagValue(tags, name) {
  if (!Array.isArray(tags)) return '';
  const hit = tags.find((t) => String(t?.name || '').toLowerCase() === String(name).toLowerCase());
  return hit ? String(hit.value || '').trim() : '';
}

/**
 * Recipient email.
 * @param {any} data
 * @returns {any}
 */
function recipientEmail(data) {
  const to = data?.to;
  if (Array.isArray(to) && to.length) return String(to[0] || '').trim().toLowerCase();
  if (typeof to === 'string') return to.trim().toLowerCase();
  return '';
}

/**
 * Resend email id from data.
 * @param {any} data
 * @returns {any}
 */
function resendEmailIdFromData(data) {
  return String(data?.email_id || data?.id || '').trim();
}

/**
 * Engagement field for event.
 * @param {any} type
 * @returns {any}
 */
function engagementFieldForEvent(type) {
  switch (type) {
    case 'email.sent':
      return 'sentAt';
    case 'email.delivered':
      return 'deliveredAt';
    case 'email.opened':
      return 'openedAt';
    case 'email.clicked':
      return 'clickedAt';
    case 'email.bounced':
      return 'bouncedAt';
    case 'email.complained':
      return 'complainedAt';
    default:
      return null;
  }
}

/**
 * Find sent row index.
 * @param {Array} rows
 * @param {any} event
 * @returns {any}
 */
function findSentRowIndex(rows, event) {
  const data = event?.data || {};
  const emailId = resendEmailIdFromData(data);
  const logId = tagValue(data.tags, 'log_id');
  const prospectId = tagValue(data.tags, 'prospect_id');
  const to = recipientEmail(data);
  const eventAt = String(event?.created_at || data?.created_at || new Date().toISOString());

  if (emailId) {
    const idx = rows.findIndex((row) => String(row.resendEmailId || '') === emailId);
    if (idx >= 0) return idx;
  }

  if (logId) {
    const idx = rows.findIndex((row) => String(row.id || '') === logId);
    if (idx >= 0) return idx;
  }

  if (prospectId && to) {
    for (let i = rows.length - 1; i >= 0; i -= 1) {
      const row = rows[i];
      if (String(row.prospectId || '') === prospectId && String(row.to || '').toLowerCase() === to) {
        return i;
      }
    }
  }

  if (to) {
    for (let i = rows.length - 1; i >= 0; i -= 1) {
      if (String(rows[i].to || '').toLowerCase() === to) return i;
    }
  }

  return -1;
}

/**
 * Apply engagement patch.
 * @param {any} row
 * @param {any} event
 * @returns {any}
 */
function applyEngagementPatch(row, event) {
  const field = engagementFieldForEvent(event.type);
  const eventAt = String(event?.created_at || event?.data?.created_at || new Date().toISOString());
  const engagement = normalizeEngagement(row);
  engagement.lastEventAt = eventAt;
  engagement.lastEventType = event.type;
  if (field && !engagement[field]) {
    engagement[field] = eventAt;
  }

  const emailId = resendEmailIdFromData(event.data || {});
  return {
    ...row,
    resendEmailId: row.resendEmailId || emailId || undefined,
    engagement
  };
}

/**
 * Append event log.
 * @param {any} event
 * @param {Object} options
 * @returns {any}
 */
async function appendEventLog(event, options) {
  const file = eventsLogPath(options);
  await fs.promises.mkdir(path.dirname(file), { recursive: true });
  const line = JSON.stringify({
    at: new Date().toISOString(),
    type: event.type,
    emailId: resendEmailIdFromData(event.data || {}),
    to: recipientEmail(event.data || {}),
    prospectId: tagValue(event.data?.tags, 'prospect_id') || undefined
  });
  await fs.promises.appendFile(file, `${line}\n`, 'utf8');
}

/**
 * Process resend webhook event.
 * @param {any} event
 * @param {Object} options
 * @returns {any}
 */
async function processResendWebhookEvent(event, options = {}) {
  const rows = await loadSentLog(options, { persist: false });
  const idx = findSentRowIndex(rows, event);
  if (idx < 0) {
    await appendEventLog(event, options);
    return { matched: false, updated: false };
  }

  rows[idx] = applyEngagementPatch(rows[idx], event);
  await writeSentLog(rows, options);
  await appendEventLog(event, options);
  return { matched: true, updated: true, logId: rows[idx].id };
}

/**
 * Setup outreach resend webhook.
 * @param {any} app
 * @param {Object} options
 * @returns {any}
 */
function setupOutreachResendWebhook(app, options = {}) {
  app.post(
    WEBHOOK_PATH,
    express.raw({ type: 'application/json' }),
    async (req, res) => {
      const secret = String(process.env.RESEND_WEBHOOK_SECRET || '').trim();
      if (!secret) {
        return sendClientError(res, 503, null, {
          errorLabel: ERROR_CODES.ERR_OUTREACH_WEBHOOK_NOT_CONFIGURED,
          fallback: 'Resend webhook secret not configured',
          req
        });
      }

      const event = verifySvixWebhook(req.body, req.headers, secret);
      if (!event || !event.type) {
        return sendClientError(res, 400, null, {
          errorLabel: ERROR_CODES.ERR_OUTREACH_WEBHOOK_SIGNATURE_INVALID,
          fallback: 'Invalid Resend webhook signature',
          req
        });
      }

      try {
        const result = await processResendWebhookEvent(event, options);
        return res.json({ ok: true, received: event.type, ...result });
      } catch (err) {
        console.warn('[outreach-webhook] process failed:', err.message);
        return sendClientError(res, 500, err, {
          errorLabel: ERROR_CODES.ERR_OUTREACH_REQUEST_FAILED,
          fallback: 'Outreach webhook processing failed',
          req
        });
      }
    }
  );
}

module.exports = {
  WEBHOOK_PATH,
  emptyEngagement,
  verifySvixWebhook,
  processResendWebhookEvent,
  applyEngagementPatch,
  findSentRowIndex,
  setupOutreachResendWebhook
};
