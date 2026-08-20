"use strict";

/**
 * Track 20: Post-quantum hybrid KEM adapter.
 *
 * Combines a classical ECDH exchange with a simulated ML-KEM encapsulation
 * to derive a unified root key for wrapping operations.
 *
 * @module hsm-adapter/pqc-hybrid-adapter
 */

const crypto = require("crypto");
const { HsmAdapterError } = require("./base-adapter.cjs");
const { PqcEncapsulationEngine } = require("./pqc-encapsulation-engine.cjs");

function _hkdf(ikm, salt, info, length) {
  return Buffer.from(crypto.hkdfSync("sha256", ikm, salt, info, length));
}

function _secureZeroize(buf) {
  if (Buffer.isBuffer(buf)) buf.fill(0);
}

class PqcHybridAdapter {
  /**
   * @param {string} tenantId
   * @param {object} [options]
   * @param {number} [options.kemLevel=768]
   * @param {object} [options.recipient]
   * @param {object} [options.policyEngine]
   * @param {object} [options.logger]
   */
  constructor(tenantId, options = {}) {
    if (typeof tenantId !== "string" || tenantId.length === 0) {
      throw new HsmAdapterError(
        "UNAUTHORIZED_KEY_ACCESS",
        "tenantId must be a non-empty string",
      );
    }
    this._tenantId = tenantId;
    this._kemLevel = options.kemLevel || 768;
    this._recipient = options.recipient || null;
    this._policyEngine = options.policyEngine || null;
    this._logger = options.logger || null;
    this._pqcEngine = new PqcEncapsulationEngine(this._kemLevel);

    if (this._recipient && this._recipient.pqc) {
      this._pqcEngine = new PqcEncapsulationEngine(
        this._recipient.pqc.kemLevel,
      );
    }
  }

  _audit(event, extra = {}) {
    if (!this._logger || !this._logger.info) return;
    this._logger.info(event, {
      sub: "hsm-adapter",
      provider: "pqc-hybrid",
      tenantId: this._tenantId,
      ...extra,
    });
  }

  _validatePqc(kemLevel, hybridMode = true) {
    if (this._policyEngine) {
      this._policyEngine.validate(this._tenantId, "pqc", {
        kemLevel,
        hybridMode,
      });
    }
  }

  _combineRootKey(classicSecret, quantumSecret) {
    const ikm = Buffer.concat([classicSecret, quantumSecret]);
    const salt = Buffer.alloc(0);
    const info = `SimpleBeacon:Track20:HybridKEM:${this._tenantId}:${this._kemLevel}`;
    const rootKey = _hkdf(ikm, salt, info, 64);
    _secureZeroize(ikm);
    return rootKey;
  }

  /**
   * Generate a recipient keypair for this hybrid adapter.
   * @returns {{classic: {privateKey: Buffer, publicKey: Buffer}, pqc: {publicKey: object, secretKey: object}}}
   */
  generateRecipientKeypair() {
    const ecdh = crypto.createECDH("prime256v1");
    ecdh.generateKeys();
    const { publicKey, secretKey } = this._pqcEngine.generateKeypair();
    return {
      classic: {
        privateKey: ecdh.getPrivateKey(),
        publicKey: ecdh.getPublicKey(),
      },
      pqc: { publicKey, secretKey },
      kemLevel: this._kemLevel,
    };
  }

  /**
   * Encapsulate a shared root key against a recipient public key bundle.
   * @param {object} recipient
   * @returns {{rootKey: Buffer, payload: object}}
   */
  encapsulate(recipient) {
    this._validatePqc(recipient.kemLevel || this._kemLevel);

    const ecdh = crypto.createECDH("prime256v1");
    ecdh.generateKeys();
    const classicSecret = ecdh.computeSecret(recipient.classic.publicKey);

    const pqc = new PqcEncapsulationEngine(
      recipient.kemLevel || this._kemLevel,
    );
    const { ciphertext, sharedSecret: quantumSecret } = pqc.encapsulate(
      recipient.pqc.publicKey,
    );

    this._kemLevel = recipient.kemLevel || this._kemLevel;
    const rootKey = this._combineRootKey(classicSecret, quantumSecret);

    const publicKeyHash = crypto
      .createHash("sha256")
      .update(recipient.pqc.publicKey.seed)
      .digest();
    const combinedKeyHash = crypto
      .createHash("sha256")
      .update(rootKey)
      .digest();

    _secureZeroize(classicSecret);
    _secureZeroize(quantumSecret);

    const payload = {
      version: "1.0.0",
      tenantId: this._tenantId,
      kemLevel: this._kemLevel,
      classic: { publicKey: ecdh.getPublicKey().toString("base64") },
      pqc: {
        publicKeyHash: publicKeyHash.toString("base64"),
        ciphertext: {
          c1: ciphertext.c1.toString("base64"),
          c2: ciphertext.c2.toString("base64"),
          r: ciphertext.r.toString("base64"),
        },
      },
      combinedKeyHash: combinedKeyHash.toString("base64"),
    };

    this._audit("PQC_KEY_ENCAPSULATED", { kemLevel: this._kemLevel });
    return { rootKey, payload };
  }

  /**
   * Decapsulate a payload using the recipient private keys.
   * @param {object} payload
   * @returns {Buffer}
   */
  decapsulate(payload) {
    if (!this._recipient || !this._recipient.classic || !this._recipient.pqc) {
      throw new HsmAdapterError(
        "PQC_KEY_INTEGRITY",
        "recipient private keys are required to decapsulate",
      );
    }

    this._validatePqc(payload.kemLevel);
    this._kemLevel = payload.kemLevel;

    const ecdh = crypto.createECDH("prime256v1");
    ecdh.setPrivateKey(this._recipient.classic.privateKey);
    const classicPublicKey = Buffer.from(payload.classic.publicKey, "base64");
    const classicSecret = ecdh.computeSecret(classicPublicKey);

    const pqc = new PqcEncapsulationEngine(payload.kemLevel);
    const ciphertext = {
      c1: Buffer.from(payload.pqc.ciphertext.c1, "base64"),
      c2: Buffer.from(payload.pqc.ciphertext.c2, "base64"),
      r: Buffer.from(payload.pqc.ciphertext.r, "base64"),
    };
    const quantumSecret = pqc.decapsulate(
      ciphertext,
      this._recipient.pqc.secretKey,
    );

    const rootKey = this._combineRootKey(classicSecret, quantumSecret);
    const combinedKeyHash = crypto
      .createHash("sha256")
      .update(rootKey)
      .digest();
    const expectedHash = Buffer.from(payload.combinedKeyHash, "base64");

    _secureZeroize(classicSecret);
    _secureZeroize(quantumSecret);

    if (!combinedKeyHash.equals(expectedHash)) {
      _secureZeroize(rootKey);
      throw new HsmAdapterError(
        "HYBRID_TRANSITION_FAILED",
        "combined key hash mismatch",
      );
    }

    this._audit("HYBRID_TRANSITION_VERIFIED", { kemLevel: this._kemLevel });
    return rootKey;
  }
}

module.exports = {
  PqcHybridAdapter,
};
