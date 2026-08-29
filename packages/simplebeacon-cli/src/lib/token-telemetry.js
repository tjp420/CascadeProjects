"use strict";

/**
 * Local-only token-usage telemetry.
 *
 * Records per-action token estimates to a JSON ledger on disk so the ROI of
 * token-saving capabilities (summaries, trimming, retrieval) can be measured
 * without sending any data anywhere. All data stays under .simplebeacon/.
 *
 * Privacy: local-only, aggregate-only. No source content is ever recorded —
 * only token counts, action names, capability tags, and timestamps.
 */

const fs = require("fs");
const path = require("path");

const DEFAULT_TELEMETRY_DIR = ".simplebeacon/telemetry";
const DEFAULT_LEDGER_NAME = "token-ledger.json";
const MAX_LEDGER_ENTRIES = 10000;

/**
 * Load the telemetry ledger from disk.
 * @param {string} ledgerPath
 * @returns {{entries: Array, version: number}}
 */
function loadLedger(ledgerPath) {
  try {
    const raw = fs.readFileSync(ledgerPath, "utf8");
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.entries)) {
      return { entries: [], version: 1 };
    }
    return parsed;
  } catch {
    return { entries: [], version: 1 };
  }
}

/**
 * Persist the telemetry ledger to disk (atomic-ish write).
 * Trims to MAX_LEDGER_ENTRIES to keep the file bounded.
 * @param {string} ledgerPath
 * @param {{entries: Array, version: number}} ledger
 * @returns {void}
 */
function saveLedger(ledgerPath, ledger) {
  const dir = path.dirname(ledgerPath);
  try {
    fs.mkdirSync(dir, { recursive: true });
  } catch {
    /* directory may already exist */
  }
  if (ledger.entries.length > MAX_LEDGER_ENTRIES) {
    ledger.entries = ledger.entries.slice(-MAX_LEDGER_ENTRIES);
  }
  const tmp = `${ledgerPath}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(ledger, null, 2));
  fs.renameSync(tmp, ledgerPath);
}

/**
 * Record a single token-usage event.
 *
 * @param {Object} params
 * @param {string} params.ledgerPath   Absolute path to ledger JSON
 * @param {string} params.action       Short action name (e.g. "summarize", "trim", "search")
 * @param {string} params.capability   Capability tag: "summary" | "estimator" | "embeddings" | "baseline"
 * @param {number} params.inputTokens  Estimated tokens consumed as input
 * @param {number} [params.outputTokens] Estimated tokens produced as output
 * @param {number} [params.savedTokens]  Estimated tokens saved vs baseline (for ROI)
 * @param {string} [params.detail]     Optional short opaque detail (no source content)
 * @returns {{entry: Object, ledgerSize: number}}
 */
function recordEvent({
  ledgerPath,
  action,
  capability,
  inputTokens,
  outputTokens = 0,
  savedTokens = 0,
  detail = null,
}) {
  if (!ledgerPath || typeof ledgerPath !== "string") {
    throw new TypeError("recordEvent requires a ledgerPath string");
  }
  if (!action || typeof action !== "string") {
    throw new TypeError("recordEvent requires an action string");
  }
  const ledger = loadLedger(ledgerPath);
  const entry = {
    timestamp: new Date().toISOString(),
    action,
    capability: capability || "unknown",
    inputTokens: Math.max(0, Math.floor(inputTokens || 0)),
    outputTokens: Math.max(0, Math.floor(outputTokens || 0)),
    savedTokens: Math.max(0, Math.floor(savedTokens || 0)),
    detail: detail || null,
  };
  ledger.entries.push(entry);
  saveLedger(ledgerPath, ledger);
  return { entry, ledgerSize: ledger.entries.length };
}

/**
 * Aggregate telemetry into a summary report for ROI analysis.
 *
 * @param {string} ledgerPath
 * @param {Object} [options]
 * @param {string} [options.since]  ISO date — only include entries after this
 * @returns {Object} aggregate report
 */
function summarizeLedger(ledgerPath, options = {}) {
  const ledger = loadLedger(ledgerPath);
  let entries = ledger.entries;
  if (options.since) {
    const sinceMs = Date.parse(options.since);
    if (Number.isFinite(sinceMs)) {
      entries = entries.filter(
        (e) => Date.parse(e.timestamp) >= sinceMs,
      );
    }
  }
  const byCapability = {};
  let totalInput = 0;
  let totalOutput = 0;
  let totalSaved = 0;
  for (const e of entries) {
    const cap = e.capability || "unknown";
    if (!byCapability[cap]) {
      byCapability[cap] = {
        calls: 0,
        inputTokens: 0,
        outputTokens: 0,
        savedTokens: 0,
      };
    }
    byCapability[cap].calls += 1;
    byCapability[cap].inputTokens += e.inputTokens;
    byCapability[cap].outputTokens += e.outputTokens;
    byCapability[cap].savedTokens += e.savedTokens;
    totalInput += e.inputTokens;
    totalOutput += e.outputTokens;
    totalSaved += e.savedTokens;
  }
  return {
    generatedAt: new Date().toISOString(),
    windowSince: options.since || null,
    totalCalls: entries.length,
    totalInputTokens: totalInput,
    totalOutputTokens: totalOutput,
    totalSavedTokens: totalSaved,
    netTokenCost: totalInput + totalOutput - totalSaved,
    byCapability,
  };
}

/**
 * Resolve the default ledger path for a project root.
 * @param {string} projectRoot
 * @returns {string}
 */
function defaultLedgerPath(projectRoot) {
  return path.join(projectRoot || process.cwd(), DEFAULT_TELEMETRY_DIR, DEFAULT_LEDGER_NAME);
}

module.exports = {
  DEFAULT_TELEMETRY_DIR,
  DEFAULT_LEDGER_NAME,
  MAX_LEDGER_ENTRIES,
  loadLedger,
  saveLedger,
  recordEvent,
  summarizeLedger,
  defaultLedgerPath,
};
