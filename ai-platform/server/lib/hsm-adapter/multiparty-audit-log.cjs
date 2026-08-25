"use strict";

/**
 * Track 43: Multiparty Auditing and Remote Attestation Logs.
 *
 * Append-only, cryptographically chained audit log of attestation events
 * with multiparty verifier signatures. Each entry is hash-chained to the
 * previous entry (tamper-evident), and a configurable set of verifiers
 * must sign each entry before it is considered committed.
 *
 * @module hsm-adapter/multiparty-audit-log
 */

const crypto = require("crypto");
const { HsmAdapterError } = require("./base-adapter.cjs");

const DEFAULT_OPTIONS = {
  maxEntries: 10000,
  minVerifiers: 2,
  maxVerifiers: 7,
  verifierTimeoutMs: 60000,
  hashAlgorithm: "sha256",
  allowedEventTypes: [
    "ENCLAVE_HARDWARE_BOOTSTRAPPED",
    "ATTESTATION_CHALLENGE_VERIFIED",
    "ENCLAVE_KEY_PROVISIONED",
    "SEALING_POLICY_VALIDATED",
    "UNSEAL_POLICY_VALIDATED",
    "ATTESTATION_CHALLENGE_ISSUED",
    "ATTESTATION_POLICY_VALIDATED",
    "KEY_PROVISIONING_POLICY_VALIDATED",
    "ATTESTATION_REPLAY_DETECTED",
    "ATTESTATION_EXPIRED",
    "ENCLAVE_ROOT_ROTATION_INITIATED",
    "ATTESTATION_CONTRACT_VERIFIED",
    "AUDIT_RECEIPT_CHAINED",
  ],
};

class MultipartyAuditLog {
  /**
   * @param {object} [options]
   * @param {number} [options.maxEntries] - Maximum log entries before oldest are pruned
   * @param {number} [options.minVerifiers] - Minimum signatures required for commit
   * @param {number} [options.maxVerifiers] - Maximum verifiers allowed
   * @param {number} [options.verifierTimeoutMs] - Timeout for pending verifications
   * @param {string} [options.hashAlgorithm] - Hash algorithm for chaining
   * @param {string[]} [options.allowedEventTypes] - Whitelist of event types
   * @param {Function} [options.audit] - Audit callback
   */
  constructor(options = {}) {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    this.maxEntries = opts.maxEntries;
    this.minVerifiers = opts.minVerifiers;
    this.maxVerifiers = opts.maxVerifiers;
    this.verifierTimeoutMs = opts.verifierTimeoutMs;
    this.hashAlgorithm = opts.hashAlgorithm;
    this.allowedEventTypes = new Set(opts.allowedEventTypes);
    this._audit = opts.audit || null;
    this._entries = [];
    this._pending = new Map(); // entryId -> { entry, signatures: Map(verifierId -> sig), createdAt }
    this._verifiers = new Set(); // registered verifier IDs
    this._lastHash = "0".repeat(64); // genesis hash
  }

  /**
   * Register a verifier who can sign audit entries.
   * @param {string} verifierId
   */
  registerVerifier(verifierId) {
    if (!verifierId || typeof verifierId !== "string") {
      throw new HsmAdapterError(
        "INVALID_VERIFIER",
        "verifierId must be a non-empty string",
      );
    }
    if (this._verifiers.size >= this.maxVerifiers) {
      throw new HsmAdapterError(
        "VERIFIER_LIMIT_REACHED",
        `maximum ${this.maxVerifiers} verifiers reached`,
      );
    }
    this._verifiers.add(verifierId);
  }

  /**
   * Unregister a verifier.
   * @param {string} verifierId
   */
  unregisterVerifier(verifierId) {
    this._verifiers.delete(verifierId);
  }

  /**
   * Get the set of registered verifier IDs.
   * @returns {string[]}
   */
  getVerifiers() {
    return Array.from(this._verifiers);
  }

  /**
   * Append a new audit entry to the log. The entry enters pending state
   * until enough verifiers sign it.
   * @param {object} event
   * @param {string} event.eventType - Type of attestation event
   * @param {object} event.data - Event payload
   * @param {number} [event.timestamp] - Event timestamp (ms), defaults to now
   * @returns {object} The created pending entry with its ID
   */
  append(event) {
    if (!event || typeof event !== "object") {
      throw new HsmAdapterError("INVALID_EVENT", "event is required");
    }
    if (
      typeof event.eventType !== "string" ||
      !this.allowedEventTypes.has(event.eventType)
    ) {
      throw new HsmAdapterError(
        "EVENT_TYPE_NOT_ALLOWED",
        `event type ${event.eventType} is not in the allowed list`,
      );
    }
    const timestamp = event.timestamp || Date.now();
    const entryId = _hashEntryId(
      this.hashAlgorithm,
      this._lastHash,
      event.eventType,
      timestamp,
    );
    const prevHash = this._lastHash;
    const entry = {
      id: entryId,
      eventType: event.eventType,
      data: event.data || {},
      timestamp,
      prevHash,
      entryHash: null, // computed after signatures are collected
      signatures: {},
      committed: false,
    };
    this._pending.set(entryId, {
      entry,
      signatures: new Map(),
      createdAt: Date.now(),
    });
    if (typeof this._audit === "function") {
      this._audit("AUDIT_ENTRY_APPENDED", {
        entryId,
        eventType: event.eventType,
      });
    }
    return { entryId, eventType: event.eventType, prevHash, pending: true };
  }

  /**
   * Sign a pending entry as a verifier.
   * @param {string} entryId
   * @param {string} verifierId
   * @param {string} signature - Cryptographic signature over the entry hash
   */
  signEntry(entryId, verifierId, signature) {
    if (!this._verifiers.has(verifierId)) {
      throw new HsmAdapterError(
        "VERIFIER_NOT_REGISTERED",
        `verifier ${verifierId} is not registered`,
      );
    }
    const pending = this._pending.get(entryId);
    if (!pending) {
      throw new HsmAdapterError(
        "ENTRY_NOT_FOUND",
        `entry ${entryId} is not in pending state`,
      );
    }
    if (Date.now() - pending.createdAt > this.verifierTimeoutMs) {
      this._pending.delete(entryId);
      throw new HsmAdapterError(
        "VERIFICATION_TIMEOUT",
        `entry ${entryId} verification window has expired`,
      );
    }
    if (pending.signatures.has(verifierId)) {
      throw new HsmAdapterError(
        "DUPLICATE_SIGNATURE",
        `verifier ${verifierId} has already signed entry ${entryId}`,
      );
    }
    pending.signatures.set(verifierId, signature);
    // Check if we have enough signatures to commit
    if (pending.signatures.size >= this.minVerifiers) {
      this._commitEntry(pending);
    }
  }

  /**
   * Commit a pending entry to the append-only log.
   * @param {object} pending
   * @private
   */
  _commitEntry(pending) {
    const entry = pending.entry;
    entry.signatures = Object.fromEntries(pending.signatures);
    entry.committed = true;
    // Compute the final entry hash (includes signatures)
    entry.entryHash = _computeEntryHash(this.hashAlgorithm, entry);
    this._lastHash = entry.entryHash;
    this._entries.push(entry);
    // Prune if over limit
    if (this._entries.length > this.maxEntries) {
      this._entries.shift();
    }
    this._pending.delete(entry.id);
    if (typeof this._audit === "function") {
      this._audit("AUDIT_ENTRY_COMMITTED", {
        entryId: entry.id,
        entryHash: entry.entryHash,
        verifierCount: pending.signatures.size,
      });
    }
  }

  /**
   * Get a committed entry by ID.
   * @param {string} entryId
   * @returns {object|null}
   */
  getEntry(entryId) {
    return this._entries.find((e) => e.id === entryId) || null;
  }

  /**
   * Get all committed entries.
   * @param {object} [filter] - Optional filter
   * @param {string} [filter.eventType] - Filter by event type
   * @param {number} [filter.since] - Filter by timestamp (inclusive)
   * @param {number} [filter.limit] - Limit number of results
   * @returns {object[]}
   */
  queryEntries(filter) {
    let results = this._entries;
    if (filter) {
      if (filter.eventType) {
        results = results.filter((e) => e.eventType === filter.eventType);
      }
      if (typeof filter.since === "number") {
        results = results.filter((e) => e.timestamp >= filter.since);
      }
      if (typeof filter.limit === "number") {
        results = results.slice(-filter.limit);
      }
    }
    return results.slice();
  }

  /**
   * Get pending entries awaiting verification.
   * @returns {object[]}
   */
  getPendingEntries() {
    return Array.from(this._pending.values()).map((p) => ({
      ...p.entry,
      signatureCount: p.signatures.size,
      requiredSignatures: this.minVerifiers,
      age: Date.now() - p.createdAt,
    }));
  }

  /**
   * Verify the integrity of the entire log chain.
   * @returns {object} Verification result
   */
  verifyChain() {
    let prevHash = "0".repeat(64);
    for (let i = 0; i < this._entries.length; i++) {
      const entry = this._entries[i];
      if (entry.prevHash !== prevHash) {
        return {
          valid: false,
          brokenAtIndex: i,
          entryId: entry.id,
          reason: "prevHash mismatch",
        };
      }
      const recomputed = _computeEntryHash(this.hashAlgorithm, entry);
      if (entry.entryHash !== recomputed) {
        return {
          valid: false,
          brokenAtIndex: i,
          entryId: entry.id,
          reason: "entryHash mismatch",
        };
      }
      if (Object.keys(entry.signatures).length < this.minVerifiers) {
        return {
          valid: false,
          brokenAtIndex: i,
          entryId: entry.id,
          reason: "insufficient signatures",
        };
      }
      prevHash = entry.entryHash;
    }
    return { valid: true, entryCount: this._entries.length };
  }

  /**
   * Export the log for external verification.
   * @returns {object}
   */
  exportLog() {
    return {
      entries: this._entries.slice(),
      lastHash: this._lastHash,
      verifiers: this.getVerifiers(),
      entryCount: this._entries.length,
      pendingCount: this._pending.size,
    };
  }

  /**
   * Get summary statistics.
   * @returns {object}
   */
  getStats() {
    const byType = {};
    for (const entry of this._entries) {
      byType[entry.eventType] = (byType[entry.eventType] || 0) + 1;
    }
    return {
      totalEntries: this._entries.length,
      pendingEntries: this._pending.size,
      committedEntries: this._entries.length,
      verifierCount: this._verifiers.size,
      minVerifiers: this.minVerifiers,
      byType,
      lastHash: this._lastHash,
    };
  }

  /**
   * Clear all entries and reset state (for testing).
   */
  reset() {
    this._entries = [];
    this._pending.clear();
    this._verifiers.clear();
    this._lastHash = "0".repeat(64);
  }
}

function _hashEntryId(algo, prevHash, eventType, timestamp) {
  return crypto
    .createHash(algo)
    .update(prevHash + ":" + eventType + ":" + timestamp + ":" + Date.now())
    .digest("hex");
}

function _computeEntryHash(algo, entry) {
  const sigPart = JSON.stringify(
    entry.signatures,
    Object.keys(entry.signatures).sort(),
  );
  const data = [
    entry.id,
    entry.eventType,
    entry.timestamp,
    entry.prevHash,
    JSON.stringify(entry.data),
    sigPart,
  ].join("|");
  return crypto.createHash(algo).update(data).digest("hex");
}

module.exports = { MultipartyAuditLog, DEFAULT_OPTIONS };
