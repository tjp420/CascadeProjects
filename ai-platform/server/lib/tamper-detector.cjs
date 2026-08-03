'use strict';

const fs = require('fs');
const path = require('path');

const STORE_PATH = process.env.AUDIT_LOG_PATH || path.join(process.cwd(), '.simplebeacon', 'audit-log.json');

/**
 * Check recent audit entries for repeated PROOF_VERIFY_FAILED events
 * sharing the same payloadHash. Returns an alert object when threshold
 * is reached and no prior alert exists within the window.
 *
 * @param {object} opts
 * @param {string} opts.payloadHash
 * @param {number} [opts.threshold=3]
 * @param {number} [opts.windowHours=24]
 * @returns {null|object} alert or null
 */
function check(payloadHash, opts = {}) {
  if (!payloadHash) return null;
  const threshold = Number.isFinite(opts.threshold) ? opts.threshold : 3;
  const windowHours = Number.isFinite(opts.windowHours) ? opts.windowHours : 24;

  let store;
  try {
    if (!fs.existsSync(STORE_PATH)) return null;
    const raw = fs.readFileSync(STORE_PATH, 'utf8');
    store = JSON.parse(raw);
  } catch (e) {
    return null;
  }

  const now = new Date();
  const windowStart = new Date(now.getTime() - windowHours * 3600 * 1000).toISOString();

  const entries = Object.values(store.entries || {}).filter((e) => {
    try {
      if (e.action !== 'PROOF_VERIFY_FAILED') return false;
      if (!e.metadata || e.metadata.payloadHash !== payloadHash) return false;
      if (e.timestamp < windowStart) return false;
      return true;
    } catch {
      return false;
    }
  });

  if (entries.length < threshold) return null;

  // Avoid duplicate alerts: check if a PROOF_TAMPER_ALERT for same payloadHash
  // already exists in the window
  const existingAlert = Object.values(store.entries || {}).some((e) => {
    try {
      if (e.action !== 'PROOF_TAMPER_ALERT') return false;
      if (!e.metadata || e.metadata.payloadHash !== payloadHash) return false;
      if (e.timestamp < windowStart) return false;
      return true;
    } catch {
      return false;
    }
  });

  if (existingAlert) return null;

  // Build alert summary
  const sample = entries.slice(0, 5).map((e) => ({ id: e.id, timestamp: e.timestamp, reason: e.metadata && e.metadata.reason }));

  return {
    payloadHash,
    count: entries.length,
    windowStart,
    windowEnd: now.toISOString(),
    sampleEntries: sample,
  };
}

module.exports = { check };
