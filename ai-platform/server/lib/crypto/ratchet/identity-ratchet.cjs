'use strict';

/**
 * Track 113: IdentityRatchet service — hybrid PQC + classical ratchet.
 *
 * Wraps the hybrid KEM bootstrap with the deterministic KDF chain in
 * crypto/ratchet/index.cjs. Two IdentityRatchet instances that process the same
 * shared secret converge to the same root/chain key.
 *
 * @module crypto/ratchet/identity-ratchet
 */

const crypto = require('node:crypto');
const bootstrap = require('./hybrid-bootstrap.cjs');
const { initializeFromShared, kdfRoot, kdfChain } = require('./index.cjs');
const { RotationScheduler } = require('./rotation-scheduler.cjs');

class IdentityRatchet {
  /**
   * @param {object} options
   * @param {string} options.deviceId
   * @param {object} [options.secretKey] — if not provided, `generate()` must be called
   * @param {Buffer} [options.publicKey] — if not provided, `generate()` must be called
   * @param {string} [options.scheme='hybrid-mlkem768-x25519-ed25519']
   * @param {Function} [options.audit]
   */
  constructor(options = {}) {
    this.deviceId = options.deviceId;
    this.scheme = options.scheme || 'hybrid-mlkem768-x25519-ed25519';
    this.secretKey = options.secretKey || null;
    this.publicKey = options.publicKey || null;
    this._audit = options.audit || null;
    this._root = null;
    this._ck = null;
    this._mkIndex = 0;
    this._rotationEpoch = 0;
    this._scheduler = new RotationScheduler(options.rotation || {});
    this._wireScheduler();
  }

  /**
   * Generate a new hybrid identity for this device.
   * @returns {Promise<IdentityRatchet>} — returns `this` for chaining
   */
  async generate() {
    const { secretKey, publicKey } = await bootstrap.generateKeypair(this.deviceId);
    this.secretKey = secretKey;
    this.publicKey = publicKey;
    this._emitAudit('IDENTITY_RATCHET_GENERATED', {
      deviceId: this.deviceId,
      scheme: this.scheme,
      publicKeyHash: crypto.createHash('sha256').update(this.publicKey).digest('hex'),
    });
    return this;
  }

  _wireScheduler() {
    this._scheduler.on('QUANTUM_ROTATE_PENDING', (info) => {
      this._emitAudit('QUANTUM_ROTATE_PENDING', { deviceId: this.deviceId, ...info });
    });
    this._scheduler.on('QUANTUM_ROTATE_REQUIRED', (info) => {
      this._emitAudit('QUANTUM_ROTATE_REQUIRED', { deviceId: this.deviceId, ...info });
      try { this.rotateNow(); } catch {}
    });
  }

  /**
   * Initialize the root/chain from a shared secret.
   * @param {Buffer} sharedSecret
   * @private
   */
  _initChain(sharedSecret) {
    const { root, ck } = initializeFromShared(sharedSecret);
    this._root = root;
    this._ck = ck;
    this._mkIndex = 0;
    this._rotationEpoch = 0;
    this._scheduler.reset();
    this._scheduler.start();
  }

  /**
   * Step the chain for the next message key.
   * @returns {Buffer}
   */
  step() {
    if (!this._ck) {
      throw new Error('IDENTITY_RATCHET_NOT_INITIALIZED');
    }
    this._scheduler.recordStep();
    const { messageKey, nextCk } = kdfChain(this._ck);
    this._ck = nextCk;
    this._mkIndex += 1;
    return messageKey;
  }

  /**
   * Rotate the root/chain key deterministically.
   * @returns {{chainKey: string, rotationEpoch: number}}
   */
  rotateNow() {
    if (!this._ck) {
      throw new Error('IDENTITY_RATCHET_NOT_INITIALIZED');
    }
    this._rotationEpoch += 1;
    const dhOut = crypto.createHmac('sha256', this._root)
      .update(Buffer.from('track113-rotation'))
      .update(Buffer.from([this._rotationEpoch]))
      .digest();
    const { root, ck } = kdfRoot(this._root, dhOut);
    this._root = root;
    this._ck = ck;
    this._mkIndex = 0;
    this._scheduler.reset();
    this._emitAudit('IDENTITY_RATCHET_ROTATED', {
      deviceId: this.deviceId,
      rotationEpoch: this._rotationEpoch,
      chainKeyHash: crypto.createHash('sha256').update(this._ck).digest('hex'),
    });
    return { chainKey: this._ck.toString('hex'), rotationEpoch: this._rotationEpoch };
  }

  /**
   * Clean up the scheduler.
   */
  close() {
    this._scheduler.close();
  }

  /**
   * Encapsulate a shared secret against another identity's public key.
   * @param {Buffer} publicKey
   * @returns {Promise<{cipherText: Buffer, chainKey: string}>}
   */
  async encapsulateFor(publicKey) {
    const { cipherText, sharedSecret } = await bootstrap.encapsulate(publicKey);
    this._initChain(sharedSecret);
    const counterpartyPublicHash = crypto.createHash('sha256').update(publicKey).digest('hex');
    this._emitAudit('IDENTITY_RATCHET_ENCAPSULATED', {
      deviceId: this.deviceId,
      counterpartyPublicHash,
      chainKeyHash: crypto.createHash('sha256').update(this._ck).digest('hex'),
    });
    return { cipherText, chainKey: this._ck.toString('hex') };
  }

  /**
   * Decapsulate an incoming cipher text and step the local ratchet.
   * @param {Buffer} cipherText
   * @returns {Promise<{chainKey: string}>}
   */
  async decapsulateFrom(cipherText) {
    if (!this.secretKey) {
      throw new Error('IDENTITY_RATCHET_NOT_INITIALIZED');
    }
    const sharedSecret = await bootstrap.decapsulate(cipherText, this.secretKey);
    this._initChain(sharedSecret);
    this._emitAudit('IDENTITY_RATCHET_DECAPSULATED', {
      deviceId: this.deviceId,
      chainKeyHash: crypto.createHash('sha256').update(this._ck).digest('hex'),
    });
    return { chainKey: this._ck.toString('hex') };
  }

  /**
   * Sign a handshake transcript with the identity's Ed25519 key.
   * @param {Buffer} transcript
   * @returns {Buffer}
   */
  signHandshake(transcript) {
    if (!this.secretKey) {
      throw new Error('IDENTITY_RATCHET_NOT_INITIALIZED');
    }
    return bootstrap.sign(transcript, this.secretKey);
  }

  /**
   * Verify a handshake signature from a remote identity.
   * @param {Buffer} signature
   * @param {Buffer} transcript
   * @param {Buffer} publicKey
   * @returns {boolean}
   */
  verifyHandshake(signature, transcript, publicKey) {
    return bootstrap.verify(signature, transcript, publicKey);
  }

  /**
   * Get the current chain key.
   * @returns {string}
   */
  getChainKey() {
    if (!this._ck) return null;
    return this._ck.toString('hex');
  }

  _emitAudit(event, info) {
    if (this._audit) this._audit(event, { timestamp: Date.now(), ...info });
  }
}

module.exports = { IdentityRatchet };
