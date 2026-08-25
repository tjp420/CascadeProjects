"use strict";

/**
 * Track 47: Enclave key deriver.
 *
 * Regenerates the platform's root public/private master keys inside
 * protected memory pages from a freshly committed hardware seed.
 * Invokes Track 15 zeroization to clear legacy root states.
 *
 * @module hsm-adapter/enclave-key-deriver
 */

const crypto = require("crypto");
const { secureZeroize } = require("./secure-zeroize.cjs");

class EnclaveKeyDeriver {
  /**
   * @param {object} options
   * @param {Function} [options.audit]
   */
  constructor(options = {}) {
    this._audit = options.audit || null;
  }

  /**
   * Derive a new root key pair from a committed seed.
   * @param {Buffer|string} seed
   * @returns {object}
   */
  derive(seed) {
    const input = Buffer.isBuffer(seed) ? seed : Buffer.from(String(seed));
    const privateKey = crypto
      .createHmac("sha384", "enclave-master-key-derivation")
      .update(input)
      .digest();
    const publicKey = crypto
      .createHash("sha256")
      .update(privateKey)
      .digest("hex");
    const result = {
      public: `PK-${publicKey.slice(0, 32)}`,
      private: privateKey,
    };
    secureZeroize(input, { strategy: "both" });
    if (this._audit) {
      this._audit("ENCLAVE_KEY_DERIVED", {
        public: result.public,
        timestamp: Math.floor(Date.now() / 1000),
      });
    }
    return result;
  }

  /**
   * Clear the derived key material from memory.
   * @param {object} keyPair
   * @returns {void}
   */
  destroy(keyPair) {
    if (keyPair && keyPair.private) {
      secureZeroize(keyPair.private, { strategy: "both" });
    }
  }
}

module.exports = { EnclaveKeyDeriver };
