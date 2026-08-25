"use strict";

/**
 * Track 24: Chaum RSA blind signature issuer.
 *
 * The HSM (or signing authority) receives a blinded message m' and produces a
 * signature s' without ever seeing the original message. The client unblinds s'
 * with the per-message random factor r, yielding a standard RSA signature s
 * that verifies against the HSM's public key.
 *
 * @module hsm-adapter/blind-signature-issuer
 */

const crypto = require("crypto");
const { HsmAdapterError } = require("./base-adapter.cjs");

function _bufToBigInt(buf) {
  return BigInt("0x" + buf.toString("hex"));
}

function _bigIntToBuf(bn, length) {
  let hex = bn.toString(16);
  if (hex.length % 2) {
    hex = "0" + hex;
  }
  const raw = Buffer.from(hex, "hex");
  if (raw.length > length) {
    throw new HsmAdapterError(
      "INVALID_INPUT",
      `integer is larger than ${length} bytes`,
    );
  }
  const buf = Buffer.alloc(length);
  raw.copy(buf, length - raw.length);
  return buf;
}

function _gcd(a, b) {
  while (b) {
    [a, b] = [b, a % b];
  }
  return a;
}

function _modInverse(a, n) {
  let [old_r, r] = [a % n, n];
  let [old_s, s] = [1n, 0n];
  while (r) {
    const q = old_r / r;
    [old_r, r] = [r, old_r - q * r];
    [old_s, s] = [s, old_s - q * s];
  }
  if (old_r < 0n) {
    old_r = -old_r;
  }
  let inv = old_s % n;
  if (inv < 0n) {
    inv += n;
  }
  return inv;
}

function _keyThumbprint(publicKey) {
  const pem = publicKey.export({ format: "pem", type: "pkcs1" });
  return crypto.createHash("sha256").update(pem).digest("base64url");
}

function _hash(message) {
  return crypto
    .createHash("sha256")
    .update(Buffer.from(message, "utf8"))
    .digest();
}

class BlindSignatureIssuer {
  /**
   * @param {object} options
   * @param {string|crypto.KeyObject} options.publicKey
   * @param {string|crypto.KeyObject} [options.privateKey]
   * @param {string} [options.tenantId]
   * @param {CryptoPolicyEngine} [options.policyEngine]
   * @param {Function} [options.audit] - (event, info) => void
   */
  constructor(options = {}) {
    const isPublicKey =
      options.publicKey &&
      typeof options.publicKey === "object" &&
      options.publicKey.type === "public";
    this._publicKey = isPublicKey
      ? options.publicKey
      : crypto.createPublicKey(options.publicKey);
    const isPrivateKey =
      options.privateKey &&
      typeof options.privateKey === "object" &&
      options.privateKey.type === "private";
    this._privateKey = options.privateKey
      ? isPrivateKey
        ? options.privateKey
        : crypto.createPrivateKey(options.privateKey)
      : null;
    this._publicKeyPem = this._publicKey.export({
      format: "pem",
      type: "pkcs1",
    });
    this._jwk = this._publicKey.export({ format: "jwk" });
    this._n = _bufToBigInt(Buffer.from(this._jwk.n, "base64url"));
    this._e = _bufToBigInt(Buffer.from(this._jwk.e, "base64url"));
    this._keySizeBytes = Buffer.from(this._jwk.n, "base64url").length;
    this._tenantId = options.tenantId || null;
    this._policyEngine = options.policyEngine || null;
    this._audit = options.audit || null;
  }

  _emitAudit(extra = {}) {
    if (this._audit) {
      this._audit("TOKEN_BLIND_SIGNED", {
        tenantId: this._tenantId,
        keyThumbprint: _keyThumbprint(this._publicKey),
        timestamp: Date.now(),
        ...extra,
      });
    }
  }

  _validateBlindPolicy(modulusBits) {
    if (!this._policyEngine || !this._tenantId) {
      return;
    }
    this._policyEngine.validate(this._tenantId, "blind", {
      modulusBits,
      publicExponent: Number(this._e),
      hashFunction: "sha256",
    });
  }

  _randomR() {
    const limit = this._n - 1n;
    for (let attempts = 0; attempts < 128; attempts += 1) {
      const bytes = crypto.randomBytes(this._keySizeBytes);
      const r = _bufToBigInt(bytes) % this._n;
      if (r > 0n && r < this._n && _gcd(r, this._n) === 1n) {
        return r;
      }
    }
    throw new HsmAdapterError(
      "INTERNAL_ERROR",
      "failed to sample a valid blinding factor",
    );
  }

  /**
   * Blind a message for signing.
   * @param {string|Buffer} message
   * @param {BigInt} [r] - optional pre-selected blinding factor
   * @returns {{blindedMessage: Buffer, r: BigInt}}
   */
  blind(message, r) {
    this._validateBlindPolicy(this._keySizeBytes * 8);

    const h = _bufToBigInt(_hash(message)) % this._n;
    const factor = r || this._randomR();

    const rBuf = _bigIntToBuf(factor, this._keySizeBytes);
    const rE = _bufToBigInt(
      crypto.publicEncrypt(
        {
          key: this._publicKey,
          padding: crypto.constants.RSA_NO_PADDING,
        },
        rBuf,
      ),
    );

    const mBlind = (h * rE) % this._n;
    const blindedMessage = _bigIntToBuf(mBlind, this._keySizeBytes);

    return { blindedMessage, r: factor };
  }

  /**
   * Sign a blinded message using the HSM private key.
   * @param {Buffer} blindedMessage
   * @returns {Buffer} blindSignature
   */
  sign(blindedMessage) {
    if (!this._privateKey) {
      throw new HsmAdapterError(
        "NOT_IMPLEMENTED",
        "signing requires a private key",
      );
    }
    if (
      !Buffer.isBuffer(blindedMessage) ||
      blindedMessage.length !== this._keySizeBytes
    ) {
      throw new HsmAdapterError(
        "INVALID_INPUT",
        `blindedMessage must be a ${this._keySizeBytes}-byte Buffer`,
      );
    }

    const sBlind = crypto.privateDecrypt(
      {
        key: this._privateKey,
        padding: crypto.constants.RSA_NO_PADDING,
      },
      blindedMessage,
    );

    this._emitAudit();
    return sBlind;
  }

  /**
   * Unblind a signature with the per-message factor r.
   * @param {Buffer} blindSignature
   * @param {BigInt} r
   * @returns {Buffer}
   */
  unblind(blindSignature, r) {
    if (!Buffer.isBuffer(blindSignature)) {
      throw new HsmAdapterError(
        "INVALID_INPUT",
        "blindSignature must be a Buffer",
      );
    }
    const sBlind = _bufToBigInt(blindSignature);
    const invR = _modInverse(r, this._n);
    const s = (sBlind * invR) % this._n;
    return _bigIntToBuf(s, this._keySizeBytes);
  }

  /**
   * Verify an unblinded signature against the original message.
   * @param {string|Buffer} message
   * @param {Buffer} signature
   * @returns {boolean}
   */
  verify(message, signature) {
    if (!Buffer.isBuffer(signature)) {
      throw new HsmAdapterError("INVALID_INPUT", "signature must be a Buffer");
    }
    const h = _bufToBigInt(_hash(message)) % this._n;
    const sE = _bufToBigInt(
      crypto.publicEncrypt(
        {
          key: this._publicKey,
          padding: crypto.constants.RSA_NO_PADDING,
        },
        signature,
      ),
    );
    return sE === h;
  }
}

module.exports = {
  BlindSignatureIssuer,
};
