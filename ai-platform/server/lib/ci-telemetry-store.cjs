/**
 * Lightweight CI telemetry store for Team tier dashboards.
 * Metadata only — no source code, file paths, or issue descriptions.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const STORE_PATH =
  process.env.SIMPLEBEACON_CI_TELEMETRY_STORE ||
  path.join(__dirname, '../../.simplebeacon', 'ci-telemetry.json');
const MAX_EVENTS = Number(process.env.SIMPLEBEACON_CI_TELEMETRY_MAX || 50000);
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function readStore() {
  try {
    const raw = fs.readFileSync(STORE_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed.events) ? parsed : { events: [] };
  } catch {
    return { events: [] };
  }
}

function writeStore(store) {
  fs.mkdirSync(path.dirname(STORE_PATH), { recursive: true });
  const tmp = `${STORE_PATH}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(store, null, 2)}\n`, 'utf8');
  fs.renameSync(tmp, STORE_PATH);
}

function accountKey(email) {
  return crypto
    .createHash('sha256')
    .update(String(email || '').toLowerCase())
    .digest('hex')
    .slice(0, 16);
}

/**
 * @param {string} email
 * @param {Object} payload
 */
function recordCiTelemetryEvent(email, payload) {
  const store = readStore();
  const event = {
    id: `ci_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
    accountKey: accountKey(email),
    email: String(email || '').toLowerCase(),
    recordedAt: new Date().toISOString(),
    ...payload,
  };
  store.events.push(event);
  if (store.events.length > MAX_EVENTS) {
    store.events = store.events.slice(-MAX_EVENTS);
  }
  writeStore(store);
  return event;
}

/**
 * @param {string} email
 * @param {{ days?: number }} [options]
 */
function summarizeCiTelemetry(email, options = {}) {
  const days = Number(options.days) || 7;
  const since = Date.now() - days * 24 * 60 * 60 * 1000;
  const key = accountKey(email);
  const events = readStore().events.filter((ev) => {
    if (ev.accountKey !== key) return false;
    const ts = Date.parse(ev.recordedAt || ev.timestamp || '');
    return Number.isFinite(ts) && ts >= since;
  });

  const repos = new Set();
  let gatesTripped = 0;
  let criticalsBlocked = 0;
  let diffsAnalyzed = 0;

  for (const ev of events) {
    if (ev.repository) repos.add(ev.repository);
    if (ev.gate_pass === false || (ev.gates_tripped || 0) > 0) gatesTripped += 1;
    criticalsBlocked += Number(ev.critical_blocked || 0);
    diffsAnalyzed += Number(ev.diff_files || ev.files_scanned || 0);
  }

  return {
    periodDays: days,
    total_scans: events.length,
    repositories: repos.size,
    diffs_analyzed: diffsAnalyzed,
    gates_tripped: gatesTripped,
    criticals_blocked: criticalsBlocked,
    merges_blocked_this_week: gatesTripped,
    updatedAt: new Date().toISOString(),
  };
}

module.exports = {
  recordCiTelemetryEvent,
  summarizeCiTelemetry,
  accountKey,
};
