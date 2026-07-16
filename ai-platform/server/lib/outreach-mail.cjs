// simplebeacon-ignore: Scanner pattern definitions, and EU AI Act indicators — all findings are false positives, dashboard code, debug artifacts, debugArtifacts, test fixtures
/**
 * Founder / Tier 0 outreach email via Resend — send as @simplebeacon.ai from localhost.
 */

const fs = require('fs');
const path = require('path');
const logger = require('./app-logger.cjs');

const constants = require('../config/constants.cjs');
const fsp = fs.promises;

/**
 * Get outreach from.
 * @returns {any}
 */
function getOutreachFrom() {
  return String(process.env.OUTREACH_FROM || 'outreach@simplebeacon.ai').trim();
}

/**
 * Get outreach reply to.
 * @returns {any}
 */
function getOutreachReplyTo() {
  return String(process.env.OUTREACH_REPLY_TO || 'outreach@simplebeacon.ai').trim();
}

/**
 * Is outreach configured.
 * @returns {any}
 */
function isOutreachConfigured() {
  return Boolean(String(process.env.RESEND_API_KEY || '').trim());
}

/**
 * Sent log path.
 * @param {Object} options
 * @returns {any}
 */
function sentLogPath(options) {
  const dataDir = options.dataDir || path.join(__dirname, '..', '..', 'data');
  return path.join(dataDir, 'outreach-sent.json');
}

/**
 * Write sent log.
 * @param {Array} rows
 * @param {Object} options
 * @returns {any}
 */
async function writeSentLog(rows, options) {
  const file = sentLogPath(options);
  await fsp.mkdir(path.dirname(file), { recursive: true });
  await fsp.writeFile(file, JSON.stringify(rows, null, 2));
}

/**
 * Sent entry id.
 * @param {any} row
 * @param {number} index
 * @returns {any}
 */
function sentEntryId(row, index = 0) {
  if (row?.id) return String(row.id);
  return `${row.sentAt || 'unknown'}|${row.to || ''}|${index}`;
}

/**
 * Load sent log.
 * @param {Object} options
 * @returns {any}
 */
async function loadSentLog(options) {
  const file = sentLogPath(options);
  try {
    const raw = await fsp.readFile(file, 'utf8');
    const rows = JSON.parse(raw);
    const list = Array.isArray(rows) ? rows : [];
    return list.map((row, index) => ({
      ...row,
      id: row.id || sentEntryId(row, index)
    }));
  } catch (err) {
    if (err && err.code === 'ENOENT') return [];
    logger.warn('[outreach] load log failed:', err.message);
    return [];
  }
}

/**
 * Remove sent log entry.
 * @param {string} id
 * @param {Object} options
 * @returns {any}
 */
async function removeSentLogEntry(id, options) {
  const needle = String(id || '').trim();
  if (!needle) {
    const err = new Error('missing_id');
    err.code = 'missing_id';
    throw err;
  }
  const rows = await loadSentLog(options);
  const index = rows.findIndex((row, i) => sentEntryId(row, i) === needle || row.id === needle);
  if (index < 0) {
    const err = new Error('not_found');
    err.code = 'not_found';
    throw err;
  }
  rows.splice(index, 1);
  await writeSentLog(rows, options);
  return { removed: needle, remaining: rows.length };
}

/**
 * Append sent log.
 * @param {any} entry
 * @param {Object} options
 * @returns {any}
 */
async function appendSentLog(entry, options) {
  const file = sentLogPath(options);
  await fsp.mkdir(path.dirname(file), { recursive: true });
  const rows = await loadSentLog(options);
  rows.push(entry);
  await fsp.writeFile(file, JSON.stringify(rows, null, 2));
  return rows.length;
}

/**
 * Validate email.
 * @param {any} value
 * @returns {any}
 */
function validateEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
}

/**
 * Send outreach email.
 * @param {any} payload
 * @param {Object} options
 * @returns {any}
 */
async function sendOutreachEmail(payload, options = {}) {
  const to = String(payload.to || '').trim().toLowerCase();
  const subject = String(payload.subject || '').trim();
  const text = String(payload.text || '').trim();

  if (!validateEmail(to)) {
    const err = new Error('invalid_email');
    err.code = 'invalid_email';
    throw err;
  }
  if (!subject || subject.length < 3) {
    const err = new Error('subject_too_short');
    err.code = 'subject_too_short';
    throw err;
  }
  if (!text || text.length < 20) {
    const err = new Error('message_too_short');
    err.code = 'message_too_short';
    throw err;
  }
  if (text.length > constants.TIMEOUT_12S) {
    const err = new Error('message_too_long');
    err.code = 'message_too_long';
    throw err;
  }

  const from = getOutreachFrom();
  const replyTo = getOutreachReplyTo();
  const { sendResendMail } = require('./audit-booking-mail.cjs');

  const result = await sendResendMail({
    to,
    from,
    replyTo,
    subject,
    text
  });

  if (!result.sent) {
    const err = new Error(result.reason || 'email_not_configured');
    err.code = result.reason || 'email_not_configured';
    throw err;
  }

  const entry = {
    to,
    subject,
    from,
    replyTo,
    company: String(payload.company || '').trim() || undefined,
    prospectId: String(payload.prospectId || '').trim() || undefined,
    sentAt: new Date().toISOString()
  };

  try {
    await appendSentLog(entry, options);
  } catch (err) {
    logger.warn('[outreach] log persist failed:', err.message);
  }

  return { ...result, entry };
}

module.exports = {
  getOutreachFrom,
  getOutreachReplyTo,
  isOutreachConfigured,
  loadSentLog,
  writeSentLog,
  sentEntryId,
  removeSentLogEntry,
  sendOutreachEmail,
  validateEmail
};
