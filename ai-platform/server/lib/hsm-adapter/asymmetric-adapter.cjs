"use strict";

/**
 * Track 11 / 12 / 13 / 15: Asymmetric HSM adapter.
 *
 * Extends BaseHsmAdapter to support RSA-OAEP and ECDH (P-256/P-384) key
 * wrapping. Private keys are kept as Node crypto KeyObjects; public keys
 * are exported via SPKI. Wrap/unwrap use standard Node.js crypto.
 *
 * Track 12: ECDH ECIES binds an application-specific context string
 * into the HKDF key derivation, and the adapter can issue/verify mock
 * HSM attestation certificates when an `Attestation` engine is supplied.
 *
 * Track 13: All operations are scoped by `tenantId`. The tenant identifier
 * is concatenated into the HKDF context for ECDH wraps so derived keys
 * are unique per tenant and context.
 *
 * Track 15: Supports volatile key eviction and explicit secure zeroization
 * of native KeyObject references.
 *
 * @module hsm-adapter/asymmetric-adapter
 */

const crypto = require("crypto");
const { BaseHsmAdapter, HsmAdapterError } = require("./base-adapter.cjs");
const { Attestation } = require("./attestation.cjs");
const { secureZeroizeKeyObject } = require("./secure-zeroize.cjs");
const { VolatileEvictionEngine } = require("./volatile-eviction-engine.cjs");
const { ProvenanceTracker } = require("./provenance-tracker.cjs");

const SUPPORTED_ALGORITHMS = new Set(["rsa-oaep", "ecdh"]);
const RSA_KEY_SIZES = new Set([2048, 4096]);
const ECDH_KEY_SIZES = new Set([256, 384, 521]);
const DEFAULT_HKDF_CONTEXT = "AsymmetricHsmAdapter:default";

function _validateAlgorithmAndSize(algorithm, keySize) {
  if (!SUPPORTED_ALGORITHMS.has(algorithm)) {
    throw new HsmAdapterError(
      "INVALID_ALGORITHM",
      `Unsupported asymmetric algorithm: ${algorithm}`,
    );
  }
  if (algorithm === "rsa-oaep" && !RSA_KEY_SIZES.has(keySize)) {
    throw new HsmAdapterError(
      "INVALID_KEK_BITS",
      `RSA-OAEP keySize must be 2048 or 4096; got ${keySize}`,
    );
  }
  if (algorithm === "ecdh" && !ECDH_KEY_SIZES.has(keySize)) {
    throw new HsmAdapterError(
      "INVALID_KEK_BITS",
      `ECDH keySize must be 256, 384, or 521; got ${keySize}`,
    );
  }
}

function _namedCurveForEcdh(keySize) {
  return `P-${keySize}`;
}

function _generateKeyPair(algorithm, keySize) {
  return new Promise((resolve, reject) => {
    const options =
      algorithm === "rsa-oaep"
        ? { modulusLength: keySize }
        : { namedCurve: _namedCurveForEcdh(keySize) };

    crypto.generateKeyPair(
      algorithm === "rsa-oaep" ? "rsa" : "ec",
      options,
      (err, publicKey, privateKey) => {
        if (err)
          return reject(
            new HsmAdapterError("KEY_GENERATION_FAILED", err.message),
          );
        resolve({ publicKey, privateKey });
      },
    );
  });
}

function _deriveAesKey(sharedSecret, iv, context, tenantId) {
  // Bind the KDF to the IV (nonce), the caller-supplied context, and the
  // tenant so a re-used secret cannot be replayed across different contexts
  // or tenants.
  const fullContext = `${tenantId}:${context}`;
  return Buffer.from(
    crypto.hkdfSync("sha256", sharedSecret, iv, fullContext, 32),
  );
}

class AsymmetricHsmAdapter extends BaseHsmAdapter {
  /**
   * @param {object} [options]
   * @param {string} [options.algorithm='rsa-oaep'] - 'rsa-oaep' or 'ecdh'
   * @param {number} [options.keySize=2048] - RSA modulus or ECDH curve size
   * @param {Attestation} [options.attestation] - optional attestation engine
   * @param {number} [options.evictionIntervalMs] - inactivity scan interval
   * @param {string} [options.buildHash] - software build hash for provenance
   * @param {string} [options.hardwareRootToken] - root token for provenance
   */
  constructor(options = {}) {
    super({ providerName: "asymmetric", ...options });
    this.algorithm = options.algorithm || "rsa-oaep";
    this.keySize = options.keySize || 2048;
    _validateAlgorithmAndSize(this.algorithm, this.keySize);
    this._attestation = options.attestation || null;
    this._keks = new Map(); // kekId -> { publicKey, privateKey, algorithm, keySize, tenantId, meta, createdAt }
    if (this._policyEngine && !this._evictionEngine) {
      this._evictionEngine = new VolatileEvictionEngine(this._policyEngine, {
        intervalMs: options.evictionIntervalMs,
      });
    }
    if (!this._provenanceTracker) {
      this._provenanceTracker = new ProvenanceTracker({
        buildHash: options.buildHash,
        hardwareRootToken: options.hardwareRootToken,
      });
    }
  }

  async _initialize() {
    // No-op: in-process adapter
  }

  _getKek(tenantId, kekId) {
    const info = this._keks.get(kekId);
    if (!info) {
      throw new HsmAdapterError("UNKNOWN_KEK", `KEK not found: ${kekId}`);
    }
    if (info.tenantId !== tenantId) {
      throw new HsmAdapterError(
        "UNAUTHORIZED_KEY_ACCESS",
        `KEK ${kekId} does not belong to tenant ${tenantId}`,
      );
    }
    return info;
  }

  _validatePolicy(tenantId, operation, info) {
    if (!this._policyEngine) return;
    this._policyEngine.validate(tenantId, operation, {
      algorithm: info.algorithm,
      keySize: info.keySize,
      createdAt: info.createdAt,
    });
  }

  _validateProvenance(tenantId, kekId, info) {
    if (!this._provenanceTracker) return;
    this._provenanceTracker.validate(kekId, {
      tenantId,
      algorithm: info.algorithm,
      keySize: info.keySize,
      createdAt: info.createdAt,
    });
  }

  async _createKEK(tenantId, meta = {}) {
    if (this._policyEngine) {
      this._policyEngine.validate(tenantId, "createKEK", {
        algorithm: this.algorithm,
        keySize: this.keySize,
      });
    }
    const { publicKey, privateKey } = await _generateKeyPair(
      this.algorithm,
      this.keySize,
    );
    const kekId = crypto.randomBytes(16).toString("hex");
    const createdAt = Date.now();
    this._keks.set(kekId, {
      publicKey,
      privateKey,
      algorithm: this.algorithm,
      keySize: this.keySize,
      tenantId,
      meta,
      createdAt,
    });
    this._provenanceTracker.register(tenantId, kekId, {
      algorithm: this.algorithm,
      keySize: this.keySize,
      createdAt,
    });
    return kekId;
  }

  async _wrap(tenantId, kekId, plaintext, context = DEFAULT_HKDF_CONTEXT) {
    if (!Buffer.isBuffer(plaintext)) {
      throw new HsmAdapterError("INVALID_INPUT", "plaintext must be a Buffer");
    }

    const info = this._getKek(tenantId, kekId);
    this._validatePolicy(tenantId, "wrap", info);
    this._validateProvenance(tenantId, kekId, info);

    if (info.algorithm === "rsa-oaep") {
      const maxPlaintextLength = info.keySize / 8 - 2 * 32 - 2; // SHA-256 OAEP
      if (plaintext.length > maxPlaintextLength) {
        throw new HsmAdapterError(
          "INVALID_INPUT",
          `Plaintext too large for RSA-OAEP-${info.keySize}; max ${maxPlaintextLength} bytes`,
        );
      }
      return crypto.publicEncrypt(
        {
          key: info.publicKey,
          padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
          oaepHash: "sha256",
        },
        plaintext,
      );
    }

    // ECDH ECIES-style wrap
    const ephemeral = await _generateKeyPair("ecdh", this.keySize);
    const sharedSecret = crypto.diffieHellman({
      privateKey: ephemeral.privateKey,
      publicKey: info.publicKey,
    });
    const iv = crypto.randomBytes(12);
    const key = _deriveAesKey(sharedSecret, iv, context, tenantId);
    const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
    const ciphertext = Buffer.concat([
      cipher.update(plaintext),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();

    const ephemeralSpki = ephemeral.publicKey.export({
      type: "spki",
      format: "der",
    });
    const header = Buffer.alloc(4);
    header.writeUInt32BE(ephemeralSpki.length, 0);

    return Buffer.concat([header, ephemeralSpki, iv, tag, ciphertext]);
  }

  async _unwrap(tenantId, kekId, wrapped, context = DEFAULT_HKDF_CONTEXT) {
    if (!Buffer.isBuffer(wrapped)) {
      throw new HsmAdapterError("INVALID_INPUT", "wrapped must be a Buffer");
    }

    const info = this._getKek(tenantId, kekId);
    this._validatePolicy(tenantId, "unwrap", info);
    this._validateProvenance(tenantId, kekId, info);

    if (info.algorithm === "rsa-oaep") {
      try {
        return crypto.privateDecrypt(
          {
            key: info.privateKey,
            padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
            oaepHash: "sha256",
          },
          wrapped,
        );
      } catch (err) {
        throw new HsmAdapterError("UNWRAP_FAILED", err.message);
      }
    }

    // ECDH ECIES-style unwrap
    if (wrapped.length < 4) {
      throw new HsmAdapterError(
        "UNWRAP_FAILED",
        "Malformed ECDH wrapped payload",
      );
    }
    const spkiLen = wrapped.readUInt32BE(0);
    const offsetAfterHeader = 4;
    if (wrapped.length < offsetAfterHeader + spkiLen + 12 + 16) {
      throw new HsmAdapterError(
        "UNWRAP_FAILED",
        "Malformed ECDH wrapped payload",
      );
    }

    const ephemeralSpki = wrapped.subarray(
      offsetAfterHeader,
      offsetAfterHeader + spkiLen,
    );
    const iv = wrapped.subarray(
      offsetAfterHeader + spkiLen,
      offsetAfterHeader + spkiLen + 12,
    );
    const tag = wrapped.subarray(
      offsetAfterHeader + spkiLen + 12,
      offsetAfterHeader + spkiLen + 12 + 16,
    );
    const ciphertext = wrapped.subarray(offsetAfterHeader + spkiLen + 12 + 16);

    let ephemeralPublic;
    try {
      ephemeralPublic = crypto.createPublicKey({
        key: ephemeralSpki,
        format: "der",
        type: "spki",
      });
    } catch (err) {
      throw new HsmAdapterError(
        "UNWRAP_FAILED",
        `Invalid ephemeral public key: ${err.message}`,
      );
    }

    const sharedSecret = crypto.diffieHellman({
      privateKey: info.privateKey,
      publicKey: ephemeralPublic,
    });
    const key = _deriveAesKey(sharedSecret, iv, context, tenantId);
    try {
      const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
      decipher.setAuthTag(tag);
      return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    } catch (err) {
      throw new HsmAdapterError("UNWRAP_FAILED", err.message);
    }
  }

  async _rotateKEK(tenantId, oldKekId) {
    const info = this._getKek(tenantId, oldKekId);
    this._validatePolicy(tenantId, "rotateKEK", info);
    this._validateProvenance(tenantId, oldKekId, info);
    const newKekId = await this._createKEK(tenantId, {
      rotatedFrom: oldKekId,
      ...info.meta,
    });
    return newKekId;
  }

  async _zeroize(tenantId, kekId) {
    const info = this._getKek(tenantId, kekId);
    secureZeroizeKeyObject(info.privateKey);
    secureZeroizeKeyObject(info.publicKey);
    this._keks.delete(kekId);
    return { algorithm: info.algorithm, keySize: info.keySize };
  }

  async _listKEKs(tenantId) {
    return Array.from(this._keks.entries())
      .filter(([, info]) => info.tenantId === tenantId)
      .map(([kekId, info]) => ({
        kekId,
        algorithm: info.algorithm,
        keySize: info.keySize,
        meta: info.meta,
        createdAt: info.createdAt,
      }));
  }

  /**
   * Wrap a plaintext buffer using the named KEK. ECDH supports an optional
   * context string that is bound into the HKDF derivation.
   * @param {string} tenantId
   * @param {string} kekId
   * @param {Buffer} plaintext
   * @param {string} [context='AsymmetricHsmAdapter:default']
   * @returns {Promise<Buffer>}
   */
  async wrap(tenantId, kekId, plaintext, context = DEFAULT_HKDF_CONTEXT) {
    this._ensureInitialized();
    this._ensureTenant(tenantId);
    if (!Buffer.isBuffer(plaintext)) {
      throw new HsmAdapterError("INVALID_INPUT", "plaintext must be a Buffer");
    }
    return this._wrap(tenantId, kekId, plaintext, context);
  }

  /**
   * Unwrap a wrapped buffer using the named KEK. For ECDH, the same context
   * and tenant supplied to `wrap` must be provided.
   * @param {string} tenantId
   * @param {string} kekId
   * @param {Buffer} wrapped
   * @param {string} [context='AsymmetricHsmAdapter:default']
   * @returns {Promise<Buffer>}
   */
  async unwrap(tenantId, kekId, wrapped, context = DEFAULT_HKDF_CONTEXT) {
    this._ensureInitialized();
    this._ensureTenant(tenantId);
    if (!Buffer.isBuffer(wrapped)) {
      throw new HsmAdapterError("INVALID_INPUT", "wrapped must be a Buffer");
    }
    return this._unwrap(tenantId, kekId, wrapped, context);
  }

  /**
   * Export the public key for a given key pair as SPKI.
   * @param {string} tenantId
   * @param {string} kekId
   * @returns {Promise<Buffer>}
   */
  async exportPublicKey(tenantId, kekId) {
    this._ensureInitialized();
    this._ensureTenant(tenantId);
    const info = this._getKek(tenantId, kekId);
    return info.publicKey.export({ type: "spki", format: "der" });
  }

  /**
   * Issue a mock HSM attestation certificate for a public key.
   * @param {string} tenantId
   * @param {string} kekId
   * @returns {Promise<object>}
   */
  async attestPublicKey(tenantId, kekId) {
    this._ensureInitialized();
    this._ensureTenant(tenantId);
    if (!this._attestation) {
      throw new HsmAdapterError(
        "ATTESTATION_NOT_CONFIGURED",
        "No attestation engine configured",
      );
    }
    const info = this._getKek(tenantId, kekId);
    const spki = info.publicKey.export({ type: "spki", format: "der" });
    return this._attestation.signPublicKey(spki, kekId, {
      algorithm: info.algorithm,
      keySize: info.keySize,
    });
  }

  /**
   * Verify that a certificate is a valid attestation for the named KEK.
   * @param {string} tenantId
   * @param {string} kekId
   * @param {object} certificate
   * @returns {Promise<boolean>}
   */
  async verifyAttestation(tenantId, kekId, certificate) {
    this._ensureInitialized();
    this._ensureTenant(tenantId);
    if (!this._attestation) {
      throw new HsmAdapterError(
        "ATTESTATION_NOT_CONFIGURED",
        "No attestation engine configured",
      );
    }
    const info = this._getKek(tenantId, kekId);

    const expectedSpki = info.publicKey
      .export({ type: "spki", format: "der" })
      .toString("base64");
    if (certificate.subjectPublicKeyInfo !== expectedSpki) {
      throw new HsmAdapterError(
        "ATTESTATION_MISMATCH",
        "Certificate public key does not match kekId",
      );
    }

    const now = new Date();
    if (
      now < new Date(certificate.notBefore) ||
      now > new Date(certificate.notAfter)
    ) {
      throw new HsmAdapterError(
        "ATTESTATION_INVALID",
        "Certificate outside validity window",
      );
    }

    if (!this._attestation.verifyCertificate(certificate)) {
      throw new HsmAdapterError(
        "ATTESTATION_INVALID",
        "Certificate signature verification failed",
      );
    }

    return true;
  }
}

module.exports = {
  AsymmetricHsmAdapter,
};
