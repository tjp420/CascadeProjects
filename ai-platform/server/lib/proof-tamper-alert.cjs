"use strict";

const fs = require("fs");
const path = require("path");
const siem = require("./siem-exporter.cjs");
const auditLogger = require("./audit-logger.cjs");

// Configurable via env
const WINDOW_HOURS = Number(process.env.PROOF_TAMPER_WINDOW_HOURS || 24);
const THRESHOLD = Number(process.env.PROOF_TAMPER_THRESHOLD || 3);
// Audit suppression interval in minutes (separate from tamper window). Default 15 minutes.
const AUDIT_SUPPRESSION_MINUTES = Number(
  process.env.PROOF_TAMPER_AUDIT_SUPPRESSION_MINUTES || 15,
);
const PERSIST_PATH = process.env.PROOF_TAMPER_PERSIST_PATH || null;
const PERSIST_INTERVAL_MS = 60 * 1000; // persist every minute when enabled

class ProofTamperAlert {
  constructor() {
    // Map payloadHash -> array of epoch ms timestamps
    this._map = new Map();
    this._windowMs = WINDOW_HOURS * 60 * 60 * 1000;
    this._threshold = THRESHOLD;
    this._persistPath = PERSIST_PATH ? path.resolve(PERSIST_PATH) : null;
    this._lastAlerted = new Map(); // payloadHash -> last alerted epoch ms
    this._lastAuditLog = new Map(); // payloadHash -> last audit-log epoch ms (suppression)

    if (this._persistPath) {
      this._loadFromDisk();
      this._persistTimer = setInterval(
        () => this._saveToDisk().catch(() => {}),
        PERSIST_INTERVAL_MS,
      );
      if (this._persistTimer && this._persistTimer.unref)
        this._persistTimer.unref();
    }
  }

  _loadFromDisk() {
    try {
      if (!fs.existsSync(this._persistPath)) return;
      const raw = fs.readFileSync(this._persistPath, "utf8");
      const obj = JSON.parse(raw || "{}");
      for (const k of Object.keys(obj)) {
        this._map.set(k, (obj[k] || []).map((t) => Number(t)).filter(Boolean));
      }
    } catch (e) {
      // ignore
    }
  }

  async _saveToDisk() {
    try {
      const out = {};
      for (const [k, arr] of this._map.entries()) out[k] = arr.slice();
      await fs.promises.mkdir(path.dirname(this._persistPath), {
        recursive: true,
      });
      await fs.promises.writeFile(this._persistPath, JSON.stringify(out), {
        encoding: "utf8",
      });
    } catch (e) {
      // swallow
    }
  }

  _pruneArray(arr) {
    const cutoff = Date.now() - this._windowMs;
    return arr.filter((t) => t >= cutoff);
  }

  recordFailure(payloadHash, reason) {
    try {
      if (!payloadHash) payloadHash = "(unknown)";
      const now = Date.now();
      const arr = this._map.get(payloadHash) || [];
      arr.push(now);
      const pruned = this._pruneArray(arr);
      this._map.set(payloadHash, pruned);

      const count = pruned.length;

      // Avoid spamming repeated alerts: only alert once per window per payload
      const lastAlert = this._lastAlerted.get(payloadHash) || 0;
      const alertSuppression = this._windowMs; // suppress alerts for window length

      // Audit log suppression: configurable shorter interval (minutes) to avoid log DoS
      const auditSuppressionMs =
        (Number(AUDIT_SUPPRESSION_MINUTES) || 15) * 60 * 1000;
      const lastAudit = this._lastAuditLog.get(payloadHash) || 0;
      const allowAudit = now - lastAudit > auditSuppressionMs;

      if (count >= this._threshold && now - lastAlert > alertSuppression) {
        this._lastAlerted.set(payloadHash, now);
        // update lastAudit to avoid duplicate PROOF_VERIFY_FAILED near the alert
        this._lastAuditLog.set(payloadHash, now);

        const severity = reason === "numeric_oversize" ? "CRITICAL" : "HIGH";
        const event = {
          event_type: "PROOF_TAMPER_ALERT",
          payloadHash,
          reason,
          count,
          window_hours: WINDOW_HOURS,
          severity,
          timestamp: new Date(now).toISOString(),
        };
        try {
          auditLogger.log({
            action: "PROOF_TAMPER_ALERT",
            entity: "partial_share_proof",
            entityId: payloadHash,
            metadata: { reason, count, window_hours: WINDOW_HOURS, severity },
          });
        } catch (e) {}
        try {
          siem.enqueue(event);
        } catch (e) {}
        return { alerted: true, event, allowAudit };
      }
      // No alert emitted; indicate whether a PROOF_VERIFY_FAILED audit log is allowed
      if (allowAudit) this._lastAuditLog.set(payloadHash, now);
      return { alerted: false, count, allowAudit };
    } catch (e) {
      return { alerted: false };
    }
  }

  getStats(payloadHash) {
    const arr = this._map.get(payloadHash) || [];
    return { count: arr.length, timestamps: arr.slice() };
  }

  // for tests
  _debug_reset() {
    this._map.clear();
    this._lastAlerted.clear();
    this._lastAuditLog.clear();
  }
}

module.exports = new ProofTamperAlert();
