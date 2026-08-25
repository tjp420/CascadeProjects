"use strict";

/**
 * Track 18: Cryptographic double ratchet engine.
 *
 * Provides symmetric (per-message) and DH (asymmetric) ratcheting for
 * Perfect Forward Secrecy. Each message uses a fresh AES-256-GCM key
 * derived from a chain that advances with every step.
 *
 * @module hsm-adapter/cryptographic-ratchet
 */

const crypto = require("crypto");
const { HsmAdapterError } = require("./base-adapter.cjs");

const SESSION_INFO = "SimpleBeacon:Track18:Ratchet:v1";
const CHAIN_INFO = "SimpleBeacon:Track18:Ratchet:chain";
const DH_INFO = "SimpleBeacon:Track18:Ratchet:dh";

function _hkdf(ikm, salt, info, length) {
  return Buffer.from(crypto.hkdfSync("sha256", ikm, salt, info, length));
}

function _bytesToBigInt(buf) {
  let v = 0n;
  for (const b of buf) {
    v = (v << 8n) | BigInt(b);
  }
  return v;
}

function _secureZeroize(buf) {
  if (Buffer.isBuffer(buf)) buf.fill(0);
}

class CryptographicRatchet {
  /**
   * @param {Buffer} rootKey - 32-byte shared root key
   * @param {object} [options]
   * @param {boolean} [options.isInitiator=true]
   * @param {number} [options.sessionExpiryMs=86400000]
   * @param {number} [options.createdAt=Date.now()]
   * @param {object} [options.logger]
   */
  constructor(rootKey, options = {}) {
    if (!Buffer.isBuffer(rootKey) || rootKey.length !== 32) {
      throw new HsmAdapterError("INVALID_INPUT", "rootKey must be 32 bytes");
    }
    this._rootKey = Buffer.from(rootKey);
    this._isInitiator = options.isInitiator !== false;
    this._sessionExpiryMs = options.sessionExpiryMs || 86400000;
    this._createdAt = options.createdAt || Date.now();
    this._logger = options.logger || null;

    this._chainIndex = 0;
    this._sendingMessageIndex = 0;
    this._receivingMessageIndex = 0;

    const derived = _hkdf(this._rootKey, Buffer.alloc(0), SESSION_INFO, 128);
    const sendingChain = derived.subarray(0, 32);
    const receivingChain = derived.subarray(32, 64);
    const dhSeed = derived.subarray(64, 96);
    const remotePub = derived.subarray(96, 128);

    if (this._isInitiator) {
      this._sendingChainKey = sendingChain;
      this._receivingChainKey = receivingChain;
      this._receivingChainInitialKey = Buffer.from(receivingChain);
    } else {
      this._sendingChainKey = receivingChain;
      this._receivingChainKey = sendingChain;
      this._receivingChainInitialKey = Buffer.from(sendingChain);
    }

    this._dhKeyPair = crypto.createECDH("secp256k1");
    this._dhKeyPair.setPrivateKey(dhSeed);
    this._dhPublicKey = this._dhKeyPair.getPublicKey();
    this._remoteDhPublicKey = remotePub;
  }

  _ensureAlive() {
    if (Date.now() - this._createdAt > this._sessionExpiryMs) {
      this._audit("SESSION_EXPIRED", { ageMs: Date.now() - this._createdAt });
      throw new HsmAdapterError(
        "SESSION_EXPIRED",
        "Ratchet session has expired",
      );
    }
  }

  _audit(event, extra = {}) {
    if (!this._logger || !this._logger.info) return;
    this._logger.info(event, {
      sub: "hsm-adapter",
      provider: "ratchet",
      ...extra,
    });
  }

  _ratchetChain(chainKey) {
    const derived = _hkdf(chainKey, chainKey, CHAIN_INFO, 64);
    return {
      messageKey: derived.subarray(0, 32),
      nextChainKey: derived.subarray(32, 64),
    };
  }

  _deriveMessageKeyFromInitial(messageIndex) {
    let chainKey = Buffer.from(this._receivingChainInitialKey);
    for (let i = 0; i < messageIndex; i++) {
      const { nextChainKey } = this._ratchetChain(chainKey);
      _secureZeroize(chainKey);
      chainKey = nextChainKey;
    }
    const { messageKey, nextChainKey } = this._ratchetChain(chainKey);
    _secureZeroize(chainKey);
    _secureZeroize(nextChainKey);
    return messageKey;
  }

  /**
   * Perform a Diffie-Hellman ratchet step.
   * @param {Buffer} [remotePublicKey]
   * @param {string} [direction='send']
   * @returns {object} new public key and info
   */
  dhStep(remotePublicKey, direction = "send") {
    this._ensureAlive();
    if (remotePublicKey) {
      this._remoteDhPublicKey = Buffer.from(remotePublicKey);
    }
    const sharedSecret = this._dhKeyPair.computeSecret(this._remoteDhPublicKey);
    const dhData = _hkdf(sharedSecret, this._rootKey, DH_INFO, 128);
    _secureZeroize(this._rootKey);
    this._rootKey = dhData.subarray(0, 32);

    const sendingChain = dhData.subarray(32, 64);
    const receivingChain = dhData.subarray(64, 96);
    const dhSeed = dhData.subarray(96, 128);

    if (direction === "send") {
      this._sendingChainKey = sendingChain;
      this._receivingChainKey = receivingChain;
      this._receivingChainInitialKey = Buffer.from(receivingChain);
    } else {
      this._sendingChainKey = receivingChain;
      this._receivingChainKey = sendingChain;
      this._receivingChainInitialKey = Buffer.from(sendingChain);
    }

    this._dhKeyPair = crypto.createECDH("secp256k1");
    this._dhKeyPair.setPrivateKey(dhSeed);
    this._dhPublicKey = this._dhKeyPair.getPublicKey();

    this._chainIndex++;
    this._sendingMessageIndex = 0;
    this._receivingMessageIndex = 0;

    this._audit("RATCHET_STEPPED", {
      chainIndex: this._chainIndex,
      dh: true,
      direction,
    });
    return { chainIndex: this._chainIndex, publicKey: this._dhPublicKey };
  }

  /**
   * Advance the receiving chain to a target message index without
   * consuming a message. Used by the message handler for out-of-order
   * processing.
   * @param {number} targetIndex
   */
  advanceReceivingTo(targetIndex) {
    this._ensureAlive();
    if (targetIndex < this._receivingMessageIndex) {
      return;
    }
    let chainKey = Buffer.from(this._receivingChainInitialKey);
    for (let i = 0; i < targetIndex; i++) {
      const { nextChainKey } = this._ratchetChain(chainKey);
      _secureZeroize(chainKey);
      chainKey = nextChainKey;
    }
    _secureZeroize(this._receivingChainKey);
    this._receivingChainKey = chainKey;
    this._receivingMessageIndex = targetIndex;
  }

  /**
   * Derive a receiving message key for an arbitrary index without
   * advancing the ratchet state.
   * @param {number} messageIndex
   * @returns {Buffer}
   */
  deriveMessageKey(messageIndex) {
    return this._deriveMessageKeyFromInitial(messageIndex);
  }

  get chainIndex() {
    return this._chainIndex;
  }

  get receivingMessageIndex() {
    return this._receivingMessageIndex;
  }

  get dhPublicKey() {
    return this._dhPublicKey;
  }

  /**
   * Encrypt a message using the current sending chain key.
   * @param {Buffer} plaintext
   * @param {string|Buffer} [aad='']
   * @returns {object} envelope
   */
  encrypt(plaintext, aad = "") {
    this._ensureAlive();
    const aadBuf = Buffer.isBuffer(aad) ? aad : Buffer.from(aad, "utf8");
    const { messageKey, nextChainKey } = this._ratchetChain(
      this._sendingChainKey,
    );
    _secureZeroize(this._sendingChainKey);
    this._sendingChainKey = nextChainKey;

    const messageIndex = this._sendingMessageIndex++;
    const iv = Buffer.alloc(12);
    iv.writeUInt32BE(this._chainIndex, 0);
    iv.writeUInt32BE(messageIndex, 8);

    const fullAad = Buffer.concat([
      aadBuf,
      Buffer.from(`:${this._chainIndex}:${messageIndex}`),
    ]);
    const cipher = crypto.createCipheriv("aes-256-gcm", messageKey, iv);
    cipher.setAAD(fullAad);
    const ciphertext = Buffer.concat([
      cipher.update(plaintext),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();

    const envelope = {
      chainIndex: this._chainIndex,
      messageIndex,
      iv: iv.toString("base64"),
      ciphertext: ciphertext.toString("base64"),
      tag: tag.toString("base64"),
      aad: aadBuf.toString("base64"),
    };
    _secureZeroize(messageKey);
    return envelope;
  }

  /**
   * Decrypt the next in-order message using the current receiving chain.
   * @param {object} envelope
   * @param {string|Buffer} [aad='']
   * @returns {Buffer}
   */
  decrypt(envelope, aad = "") {
    this._ensureAlive();
    const aadBuf = Buffer.isBuffer(aad) ? aad : Buffer.from(aad, "utf8");
    if (envelope.chainIndex !== this._chainIndex) {
      throw new HsmAdapterError(
        "RATCHET_DESYNCHRONIZED",
        `chainIndex mismatch: ${envelope.chainIndex} != ${this._chainIndex}`,
      );
    }
    if (envelope.messageIndex !== this._receivingMessageIndex) {
      throw new HsmAdapterError(
        "RATCHET_DESYNCHRONIZED",
        `messageIndex ${envelope.messageIndex} != expected ${this._receivingMessageIndex}; use message handler for out-of-order`,
      );
    }
    const { messageKey, nextChainKey } = this._ratchetChain(
      this._receivingChainKey,
    );
    _secureZeroize(this._receivingChainKey);
    this._receivingChainKey = nextChainKey;
    this._receivingMessageIndex++;

    return this._decryptWithKey(envelope, aadBuf, messageKey);
  }

  /**
   * Decrypt a message with an explicit message key (used by the handler).
   * @param {object} envelope
   * @param {string|Buffer} [aad='']
   * @param {Buffer} messageKey
   * @returns {Buffer}
   */
  decryptWithKey(envelope, aad = "", messageKey) {
    const aadBuf = Buffer.isBuffer(aad) ? aad : Buffer.from(aad, "utf8");
    return this._decryptWithKey(envelope, aadBuf, messageKey);
  }

  _decryptWithKey(envelope, aadBuf, messageKey) {
    const iv = Buffer.from(envelope.iv, "base64");
    const ciphertext = Buffer.from(envelope.ciphertext, "base64");
    const tag = Buffer.from(envelope.tag, "base64");
    const aad = Buffer.concat([
      aadBuf,
      Buffer.from(`:${envelope.chainIndex}:${envelope.messageIndex}`),
    ]);

    const decipher = crypto.createDecipheriv("aes-256-gcm", messageKey, iv);
    decipher.setAAD(aad);
    decipher.setAuthTag(tag);
    try {
      const plaintext = Buffer.concat([
        decipher.update(ciphertext),
        decipher.final(),
      ]);
      _secureZeroize(messageKey);
      return plaintext;
    } catch (err) {
      _secureZeroize(messageKey);
      throw new HsmAdapterError(
        "RATCHET_DESYNCHRONIZED",
        `decryption failed: ${err.message}`,
      );
    }
  }
}

module.exports = {
  CryptographicRatchet,
};
