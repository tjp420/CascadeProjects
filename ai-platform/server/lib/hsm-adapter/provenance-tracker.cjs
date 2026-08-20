"use strict";

/**
 * Track 16: Key provenance ledger.
 *
 * Generates, signs, and verifies immutable provenance records for HSM keys.
 * Each record binds a KEK identifier to its tenant, algorithm, build hash,
 * hardware root token, and timestamp. Third-party nodes can verify records
 * using only the root public key.
 *
 * @module hsm-adapter/provenance-tracker
 */

const crypto = require("crypto");
const { HsmAdapterError } = require("./base-adapter.cjs");

const DEFAULT_HASH = "sha256";

function _canonicalJson(obj) {
  const sorted = {};
  for (const key of Object.keys(obj).sort()) {
    sorted[key] = obj[key];
  }
  return JSON.stringify(sorted);
}

function _normalizeKeySize(info) {
  if (typeof info.keySize === "number") return info.keySize;
  if (typeof info.kekBits === "number") return info.kekBits;
  return null;
}

function _createRootKeyPair() {
  return crypto.generateKeyPairSync("ec", { namedCurve: "P-256" });
}

class ProvenanceTracker {
  /**
   * @param {object} [options]
   * @param {crypto.KeyObject} [options.privateKey] - root signing key
   * @param {crypto.KeyObject} [options.publicKey] - root verification key
   * @param {string} [options.buildHash] - software build identifier
   * @param {string} [options.hardwareRootToken] - hardware root anchor
   */
  constructor(options = {}) {
    this._buildHash =
      options.buildHash || process.env.SB_BUILD_HASH || "unknown-build";
    this._hardwareRootToken =
      options.hardwareRootToken || crypto.randomBytes(16).toString("hex");
    if (options.privateKey && options.publicKey) {
      this._privateKey = options.privateKey;
      this._publicKey = options.publicKey;
    } else {
      const { publicKey, privateKey } = _createRootKeyPair();
      this._privateKey = privateKey;
      this._publicKey = publicKey;
    }
    this._records = new Map();
    this._lastRecordHash = null;
  }

  get publicKey() {
    return this._publicKey;
  }

  _hash(data) {
    return crypto.createHash(DEFAULT_HASH).update(data).digest("hex");
  }

  _sign(record) {
    const payload = _canonicalJson(record);
    return crypto.sign(
      DEFAULT_HASH,
      Buffer.from(payload, "utf8"),
      this._privateKey,
    );
  }

  /**
   * Register a new key provenance record.
   * @param {string} tenantId
   * @param {string} kekId
   * @param {object} info - { algorithm, keySize or kekBits, createdAt }
   * @returns {object} signed provenance record
   */
  register(tenantId, kekId, info) {
    if (typeof tenantId !== "string" || tenantId.length === 0) {
      throw new HsmAdapterError(
        "UNAUTHORIZED_KEY_ACCESS",
        "tenantId must be a non-empty string",
      );
    }
    if (typeof kekId !== "string" || kekId.length === 0) {
      throw new HsmAdapterError(
        "INVALID_INPUT",
        "kekId must be a non-empty string",
      );
    }
    const keySize = _normalizeKeySize(info);
    const createdAt = info.createdAt || Date.now();

    const unsigned = {
      kekId,
      tenantId,
      algorithm: info.algorithm,
      keySize,
      createdAt,
      buildHash: this._buildHash,
      hardwareRootToken: this._hardwareRootToken,
      previousHash: this._lastRecordHash,
    };

    const signature = this._sign(unsigned);
    const record = { ...unsigned, signature: signature.toString("base64") };
    this._records.set(kekId, record);
    this._lastRecordHash = this._hash(_canonicalJson(record));
    return record;
  }

  /**
   * Retrieve a stored provenance record.
   * @param {string} kekId
   * @returns {object|null}
   */
  getRecord(kekId) {
    return this._records.get(kekId) || null;
  }

  /**
   * Verify the cryptographic signature of a record.
   * @param {object} record
   * @returns {boolean}
   */
  verify(record) {
    if (!_isRecord(record)) {
      throw new HsmAdapterError(
        "KEY_PROVENANCE_CORRUPTED",
        "Invalid provenance record structure",
      );
    }
    if (record.hardwareRootToken !== this._hardwareRootToken) {
      throw new HsmAdapterError(
        "KEY_PROVENANCE_CORRUPTED",
        "Provenance hardware root token mismatch",
      );
    }
    const { signature, ...unsigned } = record;
    const payload = _canonicalJson(unsigned);
    const valid = crypto.verify(
      DEFAULT_HASH,
      Buffer.from(payload, "utf8"),
      this._publicKey,
      Buffer.from(signature, "base64"),
    );
    if (!valid) {
      throw new HsmAdapterError(
        "KEY_PROVENANCE_CORRUPTED",
        "Provenance record signature verification failed",
      );
    }
    return true;
  }

  /**
   * Validate an in-memory key info object against the stored provenance record.
   * @param {string} kekId
   * @param {object} info - in-memory key metadata
   * @returns {boolean}
   */
  validate(kekId, info) {
    const record = this.getRecord(kekId);
    if (!record) {
      throw new HsmAdapterError(
        "KEY_PROVENANCE_CORRUPTED",
        `No provenance record found for ${kekId}`,
      );
    }
    this.verify(record);

    if (record.tenantId !== info.tenantId) {
      throw new HsmAdapterError(
        "KEY_PROVENANCE_CORRUPTED",
        "Provenance tenantId mismatch",
      );
    }
    if (record.algorithm !== info.algorithm) {
      throw new HsmAdapterError(
        "KEY_PROVENANCE_CORRUPTED",
        "Provenance algorithm mismatch",
      );
    }
    const keySize = _normalizeKeySize(info);
    if (record.keySize !== keySize) {
      throw new HsmAdapterError(
        "KEY_PROVENANCE_CORRUPTED",
        "Provenance keySize mismatch",
      );
    }
    return true;
  }
}

function _isRecord(record) {
  return (
    record && typeof record === "object" && typeof record.kekId === "string"
  );
}

module.exports = {
  ProvenanceTracker,
};
