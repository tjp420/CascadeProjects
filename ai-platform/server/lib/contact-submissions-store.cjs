/**
 * Contact form submission store — file-based idempotency guard.
 *
 * Persists contact form submissions to a JSONL file in .simplebeacon/.
 * Follows the same safe-write pattern as the other server stores.
 *
 * @module contact-submissions-store
 */

const fs = require('fs');
const path = require('path');
const logger = require('./app-logger.cjs');

const PROJECT_ROOT = path.join(__dirname, '..', '..');
const STORE_PATH =
  process.env.CONTACT_SUBMISSIONS_STORE ||
  path.join(PROJECT_ROOT, '.simplebeacon', 'contact-submissions.jsonl');

const STORE_DIR = path.dirname(STORE_PATH);

function ensureStoreDir() {
  if (!fs.existsSync(STORE_DIR)) {
    fs.mkdirSync(STORE_DIR, { recursive: true });
  }
}

function sanitize(value) {
  return String(value || '')
    .trim()
    .replace(/[\r\n]+/g, ' ');
}

/**
 * Append a contact form submission to the JSONL store.
 * @param {Object} submission
 * @param {string} [submission.name]
 * @param {string} submission.email
 * @param {string} submission.message
 * @returns {{ success: boolean, id: string }}
 */
function appendContactSubmission({ name, email, message } = {}) {
  ensureStoreDir();
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const record = JSON.stringify({
    id,
    name: sanitize(name),
    email: sanitize(email),
    message: sanitize(message),
    receivedAt: new Date().toISOString(),
  });
  fs.appendFileSync(STORE_PATH, `${record}\n`, 'utf8');
  logger.info('[ContactSubmissions] Recorded submission:', id);
  return { success: true, id };
}

/**
 * Read all recorded submissions.
 * @returns {Array<Object>}
 */
function listContactSubmissions() {
  ensureStoreDir();
  if (!fs.existsSync(STORE_PATH)) return [];
  const raw = fs.readFileSync(STORE_PATH, 'utf8');
  const lines = raw.split('\n').filter(Boolean);
  return lines.map((line) => {
    try {
      return JSON.parse(line);
    } catch {
      return { _raw: line, _parseError: true };
    }
  });
}

module.exports = {
  appendContactSubmission,
  listContactSubmissions,
  STORE_PATH,
};
