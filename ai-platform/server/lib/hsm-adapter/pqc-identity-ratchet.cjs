"use strict";

/**
 * Track 30: Post-Quantum Identity Ratchet.
 *
 * Simulates a PQC hybrid KEM identity ratchet that rotates a chain key using
 * an ML-KEM-style shared secret combined with the previous chain key.
 *
 * @module hsm-adapter/pqc-identity-ratchet
 */

const crypto = require("crypto");
const { HsmAdapterError } = require("./base-adapter.cjs");

function _hashHex(inputs) {
  const h = crypto.createHash("sha256");
  for (const item of inputs) {
    h.update(typeof item === "string" ? item : JSON.stringify(item));
  }
  return h.digest("hex");
}

class PqcIdentityRatchet {
  /**
   * @param {object} options
   * @param {string} options.deviceId
   * @param {string} [options.scheme='ml-kem-768']
   * @param {number} [options.kemLevel=768]
   * @param {string} [options.chainKey]
   * @param {number} [options.skipped=0]
   * @param {Function} [options.audit]
   */
  constructor(options = {}) {
    this.deviceId = options.deviceId;
    this.scheme = options.scheme || "ml-kem-768";
    this.kemLevel = options.kemLevel || 768;
    this._chainKey =
      options.chainKey || _hashHex([this.deviceId, this.scheme, "seed"]);
    this._skipped = options.skipped || 0;
    this._audit = options.audit || null;
  }

  /**
   * Step the ratchet with a new KEM shared secret.
   * @param {Buffer|string} sharedSecret
   * @returns {{chainKey: string, skipped: number}}
   */
  step(sharedSecret) {
    if (!sharedSecret) {
      throw new HsmAdapterError("INVALID_INPUT", "sharedSecret is required");
    }
    const secret =
      typeof sharedSecret === "string"
        ? sharedSecret
        : sharedSecret.toString("hex");
    this._chainKey = _hashHex([
      this._chainKey,
      secret,
      this.scheme,
      this.kemLevel,
      this._skipped,
    ]);
    this._skipped += 1;
    this._emitAudit("IDENTITY_RATCHET_STEPPED", {
      deviceId: this.deviceId,
      scheme: this.scheme,
      kemLevel: this.kemLevel,
      skipped: this._skipped,
      chainKeyHash: _hashHex([this._chainKey]),
    });
    return { chainKey: this._chainKey, skipped: this._skipped };
  }

  /**
   * Get the current chain key.
   * @returns {string}
   */
  getChainKey() {
    return this._chainKey;
  }

  _emitAudit(event, info) {
    if (this._audit) this._audit(event, { timestamp: Date.now(), ...info });
  }
}

module.exports = { PqcIdentityRatchet };
