'use strict';

/**
 * Track 10: Abstract HSM adapter base class.
 *
 * Defines the pluggable interface for HSM/KMS providers. Concrete adapters
 * (SoftwareHsmAdapter, SoftHSM, vendor) extend this class and implement
 * the KEK lifecycle and low-level wrap/unwrap operations.
 *
 * The high-level exportKeyring/importKeyring methods use the consolidated
 * keyring-serializer.cjs pipeline with AES-KWP protection. Integrity is
 * provided by the KWP auth tag, so checksumSerialized is no longer required.
 *
 * @module hsm-adapter/base-adapter
 */

const { serialize, deserialize } = require('../keyring-serializer.cjs');

const WRAPPED_BLOB_VERSION = 1;

/**
 * Error class for HSM adapter failures.
 */
class HsmAdapterError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'HsmAdapterError';
    this.code = code;
  }
}

/**
 * Abstract base class for HSM adapters.
 *
 * Concrete subclasses MUST implement: _initialize, _createKEK, _wrap, _unwrap,
 * _rotateKEK, _listKEKs. The high-level exportKeyring/importKeyring methods are
 * provided here and should not be overridden.
 */
class BaseHsmAdapter {
  /**
   * @param {object} options
   * @param {string} options.providerName - human-readable provider name
   * @param {object} [options.logger] - logger with info/warn/error methods
   */
  constructor(options = {}) {
    if (this.constructor === BaseHsmAdapter) {
      throw new HsmAdapterError('ABSTRACT_INSTANTIATION', 'BaseHsmAdapter is abstract; instantiate a concrete subclass');
    }
    this.providerName = options.providerName || 'base';
    this.logger = options.logger || null;
    this._initialized = false;
  }

  // ── Lifecycle ──────────────────────────────────────────────────────

  /**
   * Initialize the provider connection. Must be called before any operation.
   * Subclasses MUST implement _initialize().
   * @returns {Promise<void>}
   */
  async initialize() {
    if (this._initialized) return;
    await this._initialize();
    this._initialized = true;
    this._log('info', `HSM adapter initialized: ${this.providerName}`);
  }

  /**
   * Subclass hook for provider-specific initialization.
   * @returns {Promise<void>}
   */
  async _initialize() {
    throw new HsmAdapterError('NOT_IMPLEMENTED', `${this.providerName}._initialize() not implemented`);
  }

  /**
   * Ensure the adapter is initialized before operations.
   * @private
   */
  _ensureInitialized() {
    if (!this._initialized) {
      throw new HsmAdapterError('NOT_INITIALIZED', `${this.providerName} adapter not initialized; call initialize() first`);
    }
  }

  // ── Low-level KEK lifecycle (subclasses MUST implement) ───────────

  /**
   * Create a new key-encrypting key.
   * @param {object} [meta] - optional metadata for the KEK
   * @returns {Promise<string>} kekId
   */
  async createKEK(meta = {}) {
    this._ensureInitialized();
    return this._createKEK(meta);
  }

  async _createKEK(_meta) {
    throw new HsmAdapterError('NOT_IMPLEMENTED', `${this.providerName}._createKEK() not implemented`);
  }

  /**
   * Wrap a plaintext buffer using the named KEK.
   * @param {string} kekId
   * @param {Buffer} plaintext
   * @returns {Promise<Buffer>} wrapped ciphertext
   */
  async wrap(kekId, plaintext) {
    this._ensureInitialized();
    return this._wrap(kekId, plaintext);
  }

  async _wrap(_kekId, _plaintext) {
    throw new HsmAdapterError('NOT_IMPLEMENTED', `${this.providerName}._wrap() not implemented`);
  }

  /**
   * Unwrap a wrapped buffer using the named KEK.
   * @param {string} kekId
   * @param {Buffer} wrapped
   * @returns {Promise<Buffer>} plaintext
   */
  async unwrap(kekId, wrapped) {
    this._ensureInitialized();
    return this._unwrap(kekId, wrapped);
  }

  async _unwrap(_kekId, _wrapped) {
    throw new HsmAdapterError('NOT_IMPLEMENTED', `${this.providerName}._unwrap() not implemented`);
  }

  /**
   * Rotate an existing KEK by creating a new one.
   * @param {string} oldKekId
   * @returns {Promise<string>} newKekId
   */
  async rotateKEK(oldKekId) {
    this._ensureInitialized();
    return this._rotateKEK(oldKekId);
  }

  async _rotateKEK(_oldKekId) {
    throw new HsmAdapterError('NOT_IMPLEMENTED', `${this.providerName}._rotateKEK() not implemented`);
  }

  /**
   * List all known KEKs with metadata.
   * @returns {Promise<Array<{kekId, meta, createdAt}>>}
   */
  async listKEKs() {
    this._ensureInitialized();
    return this._listKEKs();
  }

  async _listKEKs() {
    throw new HsmAdapterError('NOT_IMPLEMENTED', `${this.providerName}._listKEKs() not implemented`);
  }

  // ── High-level keyring export / import ─────────────────────────────

  /**
   * Dispatches and serializes internal keyrings via a Master KEK context.
   * @param {object} keyringData - keyring object for serialize()
   * @param {Buffer} masterKek - Key Encryption Key (16, 24, or 32 bytes)
   * @returns {Promise<Buffer>} T10K binary envelope
   */
  async exportKeyring(keyringData, masterKek) {
    this._ensureInitialized();
    try {
      // Direct pass-through to the unified binary pipeline
      return serialize(keyringData, masterKek);
    } catch (error) {
      throw new Error(`HSM Export pipeline failure: ${error.message}`);
    }
  }

  /**
   * Ingests, strips headers, and decrypts an incoming T10K stream.
   * @param {Buffer} binaryEnvelope - output from exportKeyring
   * @param {Buffer} masterKek - Key Encryption Key (16, 24, or 32 bytes)
   * @returns {Promise<object>} reconstituted keyring object
   */
  async importKeyring(binaryEnvelope, masterKek) {
    this._ensureInitialized();
    try {
      // Integrity check is handled implicitly inside unwrapPad
      return deserialize(binaryEnvelope, masterKek);
    } catch (error) {
      throw new Error(`HSM Import pipeline failure: ${error.message}`);
    }
  }

  // ── Helpers ────────────────────────────────────────────────────────

  _log(level, message, extra = {}) {
    if (!this.logger || !this.logger[level]) return;
    this.logger[level](message, { sub: 'hsm-adapter', provider: this.providerName, ...extra });
  }
}

module.exports = {
  BaseHsmAdapter,
  HsmAdapterError,
  WRAPPED_BLOB_VERSION,
};
