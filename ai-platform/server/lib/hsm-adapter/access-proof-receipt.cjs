"use strict";

/**
 * Track 45: Access proof receipt.
 *
 * Formats, signs, and serializes a canonical dual-linked token
 * receipt for cross-tenant access auditing.
 *
 * @module hsm-adapter/access-proof-receipt
 */

const crypto = require("crypto");

class AccessProofReceipt {
  /**
   * @param {object} options
   * @param {string} options.requestingTenant
   * @param {string} options.resourceOwnerTenant
   * @param {string} options.operation
   * @param {string} options.resourceId
   * @param {string[]} options.requesterSignatures
   * @param {string[]} options.ownerSignatures
   * @param {number} options.timestamp
   */
  constructor(options = {}) {
    this.requestingTenant = options.requestingTenant || "";
    this.resourceOwnerTenant = options.resourceOwnerTenant || "";
    this.operation = options.operation || "";
    this.resourceId = options.resourceId || "";
    this.requesterSignatures = options.requesterSignatures || [];
    this.ownerSignatures = options.ownerSignatures || [];
    this.timestamp = options.timestamp || 0;
    this.leafHash = this._computeLeafHash();
  }

  /**
   * Serialize the receipt to the canonical string layout.
   * @returns {string}
   */
  serialize() {
    const requesterSig = (this.requesterSignatures || []).join("|");
    const ownerSig = (this.ownerSignatures || []).join("|");
    return `AUDIT:${this.requestingTenant}:${this.resourceOwnerTenant}:${this.operation}:${this.resourceId}:${this.timestamp}:${requesterSig}:${ownerSig}:${this.leafHash}`;
  }

  /**
   * Parse and verify a serialized receipt.
   * @param {string} serialized
   * @returns {object}
   */
  static parse(serialized) {
    const parts = serialized.split(":");
    if (parts.length !== 9 || parts[0] !== "AUDIT") {
      throw new Error("receipt does not follow canonical layout");
    }
    const [
      ,
      requestingTenant,
      resourceOwnerTenant,
      operation,
      resourceId,
      timestamp,
      requesterSig,
      ownerSig,
      leafHash,
    ] = parts;
    const requesterSignatures = requesterSig ? requesterSig.split("|") : [];
    const ownerSignatures = ownerSig ? ownerSig.split("|") : [];
    const receipt = new AccessProofReceipt({
      requestingTenant,
      resourceOwnerTenant,
      operation,
      resourceId,
      requesterSignatures,
      ownerSignatures,
      timestamp: Number(timestamp),
    });
    if (receipt.leafHash !== leafHash) {
      throw new Error("receipt leaf hash mismatch");
    }
    return receipt;
  }

  _computeLeafHash() {
    const canonical = `${this.requestingTenant}:${this.resourceOwnerTenant}:${this.operation}:${this.resourceId}:${this.timestamp}:${this.requesterSignatures.join(",")}:${this.ownerSignatures.join(",")}`;
    return crypto.createHash("sha256").update(canonical).digest("hex");
  }
}

module.exports = { AccessProofReceipt };
