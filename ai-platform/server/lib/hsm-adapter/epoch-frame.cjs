"use strict";

/**
 * Track 22: Tamper-evident signed epoch frame.
 *
 * Each epoch is a signed, hash-linked structure. The signature and the
 * previous-hash chain make it possible to detect any modification to the
 * sequence of consensus timestamps.
 *
 * @module hsm-adapter/epoch-frame
 */

const crypto = require("crypto");
const { HsmAdapterError } = require("./base-adapter.cjs");

function _serialize(epochNumber, previousHash, consensusTimestamp, driftMs) {
  const parts = [
    Buffer.from(epochNumber.toString(10), "utf8"),
    previousHash,
    Buffer.from(consensusTimestamp.toString(10), "utf8"),
    Buffer.from(driftMs.toString(10), "utf8"),
  ];
  return Buffer.concat(parts);
}

class EpochFrame {
  /**
   * @param {object} fields
   * @param {number} fields.epochNumber
   * @param {Buffer} fields.previousHash
   * @param {number} fields.consensusTimestamp
   * @param {number} fields.driftMs
   * @param {string} [fields.signature] - base64
   */
  constructor(fields = {}) {
    this.epochNumber = fields.epochNumber || 0;
    this.previousHash = Buffer.isBuffer(fields.previousHash)
      ? fields.previousHash
      : Buffer.alloc(32, 0);
    this.consensusTimestamp = fields.consensusTimestamp || 0;
    this.driftMs = fields.driftMs || 0;
    this.signature = fields.signature || null;
  }

  /**
   * Compute the frame hash.
   * @returns {Buffer}
   */
  hash() {
    const payload = _serialize(
      this.epochNumber,
      this.previousHash,
      this.consensusTimestamp,
      this.driftMs,
    );
    return crypto.createHash("sha256").update(payload).digest();
  }

  /**
   * Sign this frame with the given private key.
   * @param {Buffer|string} privateKey - PEM or DER
   * @returns {EpochFrame}
   */
  sign(privateKey) {
    const payload = _serialize(
      this.epochNumber,
      this.previousHash,
      this.consensusTimestamp,
      this.driftMs,
    );
    const signer = crypto.createSign("sha256");
    signer.update(payload);
    this.signature = signer.sign(privateKey, "base64");
    return this;
  }

  /**
   * Verify the signature and, if provided, chain continuity with the previous frame.
   * @param {Buffer|string} publicKey
   * @param {object} [previousFrame]
   * @returns {boolean}
   */
  verify(publicKey, previousFrame) {
    if (!this.signature) {
      throw new HsmAdapterError(
        "EPOCH_SIGNATURE_INVALID",
        "frame has no signature",
      );
    }
    const payload = _serialize(
      this.epochNumber,
      this.previousHash,
      this.consensusTimestamp,
      this.driftMs,
    );
    const verifier = crypto.createVerify("sha256");
    verifier.update(payload);
    const sigOk = verifier.verify(publicKey, this.signature, "base64");
    if (!sigOk) return false;

    if (this.epochNumber > 0 && previousFrame) {
      const expected =
        previousFrame instanceof EpochFrame
          ? previousFrame.hash()
          : previousFrame;
      if (!this.previousHash.equals(expected)) {
        return false;
      }
      if (this.consensusTimestamp < previousFrame.consensusTimestamp) {
        return false;
      }
    }
    return true;
  }
}

module.exports = {
  EpochFrame,
};
