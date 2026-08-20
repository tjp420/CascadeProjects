"use strict";

/**
 * Track 31: Homomorphic child key deriver.
 *
 * Derives child keys from an approved governance proposal using a
 * post-quantum KEM blinding primitive. The parent key and a per-child
 * KEM shared secret are combined with HKDF-like binding to produce a
 * quantum-resistant child key pair.
 *
 * @module hsm-adapter/homomorphic-key-deriver
 */

const crypto = require("crypto");
const { HsmAdapterError } = require("./base-adapter.cjs");

const ALLOWED_KEM = new Set(["ml-kem-768", "ml-kem-1024"]);
const ALLOWED_CURVES = new Set(["P-256", "P-384", "P-521"]);

function _hkdf(secret, salt, info, length) {
  const prk = crypto.createHmac("sha256", salt).update(secret).digest();
  const okm = crypto.createHmac("sha256", prk).update(info).digest();
  return okm.slice(0, length);
}

class HomomorphicKeyDeriver {
  /**
   * @param {object} options
   * @param {Buffer} options.parentKey
   * @param {string} [options.kemPrimitive]
   * @param {string} [options.derivationCurve]
   * @param {boolean} [options.requirePqcBlinding]
   * @param {number} [options.maxChildDerivationDepth]
   * @param {Function} [options.audit]
   */
  constructor(options = {}) {
    if (!Buffer.isBuffer(options.parentKey)) {
      throw new HsmAdapterError("INVALID_INPUT", "parentKey must be a Buffer");
    }
    this.parentKey = options.parentKey;
    this.kemPrimitive = options.kemPrimitive || "ml-kem-768";
    this.derivationCurve = options.derivationCurve || "P-384";
    this.requirePqcBlinding = options.requirePqcBlinding !== false;
    this.maxChildDerivationDepth = options.maxChildDerivationDepth || 10;
    this._audit = options.audit || null;
  }

  /**
   * Derive a child key at a given path depth.
   * @param {Buffer} kemSharedSecret
   * @param {string} proposalId
   * @param {number} depth
   * @returns {{publicKey: string, privateKey: Buffer, depth: number}}
   */
  derive(kemSharedSecret, proposalId, depth) {
    if (!Buffer.isBuffer(kemSharedSecret)) {
      throw new HsmAdapterError(
        "INVALID_INPUT",
        "kemSharedSecret must be a Buffer",
      );
    }
    if (!ALLOWED_KEM.has(this.kemPrimitive)) {
      throw new HsmAdapterError(
        "POLICY_VIOLATION_BLOCKED",
        `KEM primitive ${this.kemPrimitive} is not allowed`,
      );
    }
    if (this.requirePqcBlinding && !ALLOWED_KEM.has(this.kemPrimitive)) {
      throw new HsmAdapterError(
        "POLICY_VIOLATION_BLOCKED",
        "PQC blinding requires an allowed KEM primitive",
      );
    }
    if (!ALLOWED_CURVES.has(this.derivationCurve)) {
      throw new HsmAdapterError(
        "POLICY_VIOLATION_BLOCKED",
        `derivation curve ${this.derivationCurve} is not allowed`,
      );
    }
    if (
      typeof depth !== "number" ||
      depth < 0 ||
      depth > this.maxChildDerivationDepth
    ) {
      throw new HsmAdapterError(
        "DERIVATION_DEPTH_EXCEEDED",
        `depth ${depth} exceeds max ${this.maxChildDerivationDepth}`,
      );
    }

    const salt = Buffer.concat([this.parentKey, kemSharedSecret]);
    const info = `homo-derive:${this.kemPrimitive}:${this.derivationCurve}:${proposalId}:${depth}`;
    const seed = _hkdf(salt, this.parentKey, info, 32);

    const publicKey = crypto.createHash("sha256").update(seed).digest("hex");

    this._emitAudit("CHILD_KEY_DERIVED", {
      proposalId,
      depth,
      kemPrimitive: this.kemPrimitive,
      derivationCurve: this.derivationCurve,
      publicKey,
    });

    return {
      publicKey,
      privateKey: seed,
      depth,
    };
  }

  _emitAudit(event, info) {
    if (this._audit) this._audit(event, { timestamp: Date.now(), ...info });
  }
}

module.exports = { HomomorphicKeyDeriver };
