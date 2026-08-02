'use strict';

/**
 * Track 10 / 13 / 15: Abstract HSM adapter base class.
 *
 * Defines the pluggable interface for HSM/KMS providers. Concrete adapters
 * (SoftwareHsmAdapter, SoftHSM, vendor) extend this class and implement
 * the KEK lifecycle and low-level wrap/unwrap operations.
 *
 * Track 13: All key operations are scoped by an explicit `tenantId`. Cross-
 * tenant or missing-tenant access throws `UNAUTHORIZED_KEY_ACCESS`.
 *
 * Track 15: Adapters support optional volatile key eviction and explicit
 * secure zeroization, including audit logging of `KEY_ZEROIZED` and
 * `KEY_EVICTED` events.
 *
 * The high-level exportKeyring/importKeyring methods use the consolidated
 * keyring-serializer.cjs pipeline with AES-KWP protection. Integrity is
 * provided by the KWP auth tag, so checksumSerialized is no longer required.
 *
 * @module hsm-adapter/base-adapter
 */

const {
  serialize,
  deserialize,
  KeyringValidationError,
} = require('../keyring-serializer.cjs');
const { FipsSelfTestRunner } = require('./fips-self-test-runner.cjs');

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
 * _rotateKEK, _listKEKs, _zeroize. The high-level exportKeyring/importKeyring
 * methods are provided here and should not be overridden.
 */
class BaseHsmAdapter {
  /**
   * @param {object} options
   * @param {string} options.providerName - human-readable provider name
   * @param {object} [options.logger] - logger with info/warn/error methods
   * @param {CryptoPolicyEngine} [options.policyEngine] - optional policy enforcement engine
   * @param {VolatileEvictionEngine} [options.volatileEvictionEngine] - optional eviction engine
   * @param {ProvenanceTracker} [options.provenanceTracker] - optional provenance ledger
   * @param {EscrowBroker} [options.escrowBroker] - optional cross-tenant key escrow broker
   * @param {ClusterConsensusEngine} [options.consensusEngine] - optional consensus engine for distributed commit gating
   */
  constructor(options = {}) {
    if (this.constructor === BaseHsmAdapter) {
      throw new HsmAdapterError('ABSTRACT_INSTANTIATION', 'BaseHsmAdapter is abstract; instantiate a concrete subclass');
    }
    this.providerName = options.providerName || 'base';
    this.logger = options.logger || null;
    this._policyEngine = options.policyEngine || null;
    this._evictionEngine = options.volatileEvictionEngine || null;
    this._provenanceTracker = options.provenanceTracker || null;
    this._timeAnchor = options.timeAnchor || null;
    this._escrowBroker = options.escrowBroker || null;
    this._consensusEngine = options.consensusEngine || null;
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
    if (this._policyEngine && this._policyEngine.getPolicy('default').fips && this._policyEngine.getPolicy('default').fips.enabled) {
      FipsSelfTestRunner.executePowerOnSelfTests();
    }
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

  /**
   * Validate a tenant identifier.
   * @param {string} tenantId
   * @private
   */
  _ensureTenant(tenantId) {
    if (typeof tenantId !== 'string' || tenantId.length === 0) {
      throw new HsmAdapterError('UNAUTHORIZED_KEY_ACCESS', 'tenantId must be a non-empty string');
    }
  }

  // ── Low-level KEK lifecycle (subclasses MUST implement) ───────────

  /**
   * Create a new key-encrypting key for the given tenant.
   * @param {string} tenantId
   * @param {object} [meta] - optional metadata for the KEK
   * @returns {Promise<string>} kekId
   */
  async createKEK(tenantId, meta = {}) {
    this._ensureInitialized();
    this._ensureTenant(tenantId);
    this._checkTemporalGuard();
    await this._requireConsensus('createKEK', { tenantId, meta });
    const kekId = await this._createKEK(tenantId, meta);
    this._evictionEngine?.register(tenantId, kekId, async (id, reason) => {
      try {
        await this.zeroize(tenantId, id, reason);
      } catch (err) {
        this._log('warn', 'eviction zeroize failed', { error: err.message });
      }
    });
    return kekId;
  }

  async _createKEK(_tenantId, _meta) {
    throw new HsmAdapterError('NOT_IMPLEMENTED', `${this.providerName}._createKEK() not implemented`);
  }

  /**
   * Wrap a plaintext buffer using the named KEK.
   * @param {string} tenantId
   * @param {string} kekId
   * @param {Buffer} plaintext
   * @returns {Promise<Buffer>} wrapped ciphertext
   */
  async wrap(tenantId, kekId, plaintext) {
    this._ensureInitialized();
    this._ensureTenant(tenantId);
    if (!Buffer.isBuffer(plaintext)) {
      throw new HsmAdapterError('INVALID_INPUT', 'plaintext must be a Buffer');
    }
    this._checkTemporalGuard();
    this._evictionEngine?.touch(tenantId, kekId);
    return this._wrap(tenantId, kekId, plaintext);
  }

  async _wrap(_tenantId, _kekId, _plaintext) {
    throw new HsmAdapterError('NOT_IMPLEMENTED', `${this.providerName}._wrap() not implemented`);
  }

  /**
   * Unwrap a wrapped buffer using the named KEK.
   * @param {string} tenantId
   * @param {string} kekId
   * @param {Buffer} wrapped
   * @returns {Promise<Buffer>} plaintext
   */
  async unwrap(tenantId, kekId, wrapped, token = null) {
    this._ensureInitialized();
    this._ensureTenant(tenantId);
    if (!Buffer.isBuffer(wrapped)) {
      throw new HsmAdapterError('INVALID_INPUT', 'wrapped must be a Buffer');
    }
    this._checkTemporalGuard();

    const escrow = this._escrowBroker ? this._escrowBroker.requireToken(kekId, tenantId, token) : null;
    const effectiveTenantId = escrow ? escrow.sourceTenantId : tenantId;

    this._evictionEngine?.touch(effectiveTenantId, kekId);
    return this._unwrap(effectiveTenantId, kekId, wrapped);
  }

  async _unwrap(_tenantId, _kekId, _wrapped) {
    throw new HsmAdapterError('NOT_IMPLEMENTED', `${this.providerName}._unwrap() not implemented`);
  }

  /**
   * Rotate an existing KEK by creating a new one for the same tenant.
   * @param {string} tenantId
   * @param {string} oldKekId
   * @returns {Promise<string>} newKekId
   */
  async rotateKEK(tenantId, oldKekId) {
    this._ensureInitialized();
    this._ensureTenant(tenantId);
    this._checkTemporalGuard();
    this._evictionEngine?.touch(tenantId, oldKekId);
    await this._requireConsensus('rotateKEK', { tenantId, oldKekId });
    const newKekId = await this._rotateKEK(tenantId, oldKekId);
    this._evictionEngine?.register(tenantId, newKekId, async (id, reason) => {
      try {
        await this.zeroize(tenantId, id, reason);
      } catch (err) {
        this._log('warn', 'eviction zeroize failed', { error: err.message });
      }
    });
    return newKekId;
  }

  async _rotateKEK(_tenantId, _oldKekId) {
    throw new HsmAdapterError('NOT_IMPLEMENTED', `${this.providerName}._rotateKEK() not implemented`);
  }

  /**
   * List all known KEKs for a tenant with metadata.
   * @param {string} tenantId
   * @returns {Promise<Array<{kekId, meta, createdAt}>>}
   */
  async listKEKs(tenantId) {
    this._ensureInitialized();
    this._ensureTenant(tenantId);
    return this._listKEKs(tenantId);
  }

  async _listKEKs(_tenantId) {
    throw new HsmAdapterError('NOT_IMPLEMENTED', `${this.providerName}._listKEKs() not implemented`);
  }

  // ── Zeroization & eviction ─────────────────────────────────────────

  /**
   * Securely zeroize and remove a key from the adapter.
   * @param {string} tenantId
   * @param {string} kekId
   * @param {string} [reason='explicit']
   * @returns {Promise<boolean>}
   */
  async zeroize(tenantId, kekId, reason = 'explicit') {
    this._ensureInitialized();
    this._ensureTenant(tenantId);
    const info = await this._zeroize(tenantId, kekId);
    this._evictionEngine?.unregister(tenantId, kekId);
    this._audit('KEY_ZEROIZED', { tenantId, kekId, reason, ...info });
    return true;
  }

  async _zeroize(_tenantId, _kekId) {
    throw new HsmAdapterError('NOT_IMPLEMENTED', `${this.providerName}._zeroize() not implemented`);
  }

  /**
   * Manually trigger eviction of all idle keys.
   * @param {string} [reason='explicit']
   * @returns {Promise<void>}
   */
  async evictInactive(reason = 'explicit') {
    this._ensureInitialized();
    await this._evictionEngine?.evictAll(reason);
    this._audit('KEY_EVICTED', { reason });
  }

  // ── Threshold cryptography ─────────────────────────────────────────

  /**
   * Split a secret into N shards requiring M for reconstruction.
   * @param {string} tenantId
   * @param {Buffer} secret
   * @param {number} total - N
   * @param {number} threshold - M
   * @param {string[]} custodianIds
   * @returns {Promise<Array<object>>}
   */
  async splitKey(tenantId, secret, total, threshold, custodianIds) {
    this._ensureInitialized();
    this._ensureTenant(tenantId);
    this._policyEngine?.validate(tenantId, 'threshold', { threshold, total });
    const { ThresholdSecretSplitter } = require('./threshold-secret-splitter.cjs');
    const splitter = new ThresholdSecretSplitter();
    const shards = splitter.split(secret, total, threshold, custodianIds);
    this._audit('KEY_SHARD_GENERATED', { tenantId, total, threshold, custodians: custodianIds });
    return shards;
  }

  /**
   * Reconstruct a secret from at least M shards.
   * @param {string} tenantId
   * @param {Array<object>} shards
   * @param {number} threshold - M
   * @returns {Promise<Buffer>}
   */
  async recoverKey(tenantId, shards, threshold) {
    this._ensureInitialized();
    this._ensureTenant(tenantId);
    const { ThresholdKeyRecoverer } = require('./threshold-key-recoverer.cjs');
    const recoverer = new ThresholdKeyRecoverer();
    const secret = recoverer.recover(shards, threshold);
    this._audit('KEY_RECONSTRUCTION_SUCCESS', { tenantId, threshold, shardCount: shards.length });
    return secret;
  }

  /**
   * Create a cryptographic ratchet for the tenant.
   * @param {Buffer} rootKey - 32-byte shared root key
   * @param {object} [options]
   * @returns {CryptographicRatchet}
   */
  createRatchet(rootKey, options = {}) {
    this._ensureInitialized();
    const { CryptographicRatchet } = require('./cryptographic-ratchet.cjs');
    return new CryptographicRatchet(rootKey, { logger: this.logger, ...options });
  }

  /**
   * Create a homomorphic masker.
   * @param {object} [options]
   * @returns {HomomorphicMasker}
   */
  createHomomorphicMasker(options = {}) {
    this._ensureInitialized();
    const { HomomorphicMasker } = require('./homomorphic-masker.cjs');
    return new HomomorphicMasker({ logger: this.logger, ...options });
  }

  /**
   * Create an encrypted search token generator.
   * @param {object} [options]
   * @returns {EncryptedSearchToken}
   */
  createSearchTokenizer(options = {}) {
    this._ensureInitialized();
    const { EncryptedSearchToken } = require('./encrypted-search-token.cjs');
    return new EncryptedSearchToken({ logger: this.logger, ...options });
  }

  /**
   * Generate a PQC hybrid recipient keypair.
   * @param {string} tenantId
   * @param {object} [options]
   * @returns {object}
   */
  createPqcHybridKeypair(tenantId, options = {}) {
    this._ensureInitialized();
    this._ensureTenant(tenantId);
    const { PqcHybridAdapter } = require('./pqc-hybrid-adapter.cjs');
    const adapter = new PqcHybridAdapter(tenantId, { logger: this.logger, ...options });
    return adapter.generateRecipientKeypair();
  }

  /**
   * Perform a PQC hybrid encapsulation.
   * @param {string} tenantId
   * @param {object} recipient
   * @param {object} [options]
   * @returns {object}
   */
  hybridEncapsulate(tenantId, recipient, options = {}) {
    this._ensureInitialized();
    this._ensureTenant(tenantId);
    const { PqcHybridAdapter } = require('./pqc-hybrid-adapter.cjs');
    const adapter = new PqcHybridAdapter(tenantId, {
      logger: this.logger,
      policyEngine: this._policyEngine,
      ...options,
    });
    return adapter.encapsulate(recipient);
  }

  /**
   * Perform a PQC hybrid decapsulation.
   * @param {string} tenantId
   * @param {object} payload
   * @param {object} [options]
   * @returns {Buffer}
   */
  hybridDecapsulate(tenantId, payload, options = {}) {
    this._ensureInitialized();
    this._ensureTenant(tenantId);
    const { PqcHybridAdapter } = require('./pqc-hybrid-adapter.cjs');
    const adapter = new PqcHybridAdapter(tenantId, {
      logger: this.logger,
      policyEngine: this._policyEngine,
      recipient: options.recipient,
    });
    return adapter.decapsulate(payload);
  }


  /**
   * Create a zero-knowledge identity verifier.
   * @param {string} tenantId
   * @param {object} [options]
   * @returns {ZkIdentityVerifier}
   */
  createZkpVerifier(tenantId, options = {}) {
    this._ensureInitialized();
    this._ensureTenant(tenantId);
    this._policyEngine?.validate(tenantId, 'zkp', options);
    const { ZkIdentityVerifier } = require('./zk-identity-verifier.cjs');
    return new ZkIdentityVerifier({ logger: this.logger, ...options });
  }

  /**
   * Create an ephemeral hardware token splitter.
   * @param {string} tenantId
   * @param {Buffer} attestationRoot
   * @param {object} [options]
   * @returns {EphemeralHardwareTokenSplitter}
   */
  createHardwareTokenSplitter(tenantId, attestationRoot, options = {}) {
    this._ensureInitialized();
    this._ensureTenant(tenantId);
    this._policyEngine?.validate(tenantId, 'zkp', { tokenExpiryMs: options.tokenExpiryMs });
    const { EphemeralHardwareTokenSplitter } = require('./ephemeral-hardware-token-splitter.cjs');
    return new EphemeralHardwareTokenSplitter(attestationRoot, { logger: this.logger, ...options });
  }
  // ── High-level keyring export / import ─────────────────────────────

  // ── Temporal guard (Track 22) ───────────────────────────────────

  /**
   * Check that the local clock is within the time anchor's drift window.
   * No-op when no time anchor is configured.
   * @private
   */
  _checkTemporalGuard() {
    if (!this._timeAnchor) return;
    const consensus = this._timeAnchor.consensusTimestamp();
    const local = Date.now();
    const drift = Math.abs(local - consensus);
    if (drift > this._timeAnchor.maxDriftMs) {
      this._audit('TEMPORAL_DRIFT_BLOCKED', { drift, maxDriftMs: this._timeAnchor.maxDriftMs, consensus, local });
      throw new HsmAdapterError('TEMPORAL_DRIFT_BLOCKED', `local clock drift ${drift}ms exceeds ${this._timeAnchor.maxDriftMs}ms`);
    }
  }

  /**
   * Return the current anchored epoch timestamp.
   * @returns {number|null}
   */
  currentEpoch() {
    return this._timeAnchor ? this._timeAnchor.currentEpoch() : null;
  }

  /**
   * Verify that a local timestamp is within the temporal guard's tolerance.
   * @param {string} tenantId
   * @param {number} localTimestamp
   * @param {number} [toleranceMs] - override the anchor's maxDriftMs
   */
  verifyTemporalGuard(tenantId, localTimestamp, toleranceMs) {
    this._ensureTenant(tenantId);
    if (!this._timeAnchor) return;
    const consensus = this._timeAnchor.consensusTimestamp();
    const max = typeof toleranceMs === 'number' ? toleranceMs : this._timeAnchor.maxDriftMs;
    const drift = Math.abs(localTimestamp - consensus);
    this._audit('TEMPORAL_DRIFT_BLOCKED', { tenantId, drift, max, consensus, localTimestamp, ok: drift <= max });
    if (drift > max) {
      throw new HsmAdapterError('TEMPORAL_DRIFT_BLOCKED', `temporal drift ${drift}ms exceeds ${max}ms`);
    }
  }

  /**
   * Dispatches and serializes internal keyrings via a Master KEK context.
   * @param {object} keyringData - keyring object for serialize()
   * @param {Buffer} masterKek - Key Encryption Key (16, 24, or 32 bytes)
   * @returns {Promise<Buffer>} T10K binary envelope
   */
  async exportKeyring(keyringData, masterKek) {
    this._ensureInitialized();
    this._checkTemporalGuard();
    try {
      // Direct pass-through to the unified binary pipeline
      return serialize(keyringData, masterKek);
    } catch (error) {
      const code = error instanceof KeyringValidationError ? error.code : 'EXPORT_FAILED';
      throw new HsmAdapterError(code, `HSM Export pipeline failure: ${error.message}`);
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
    await this._requireConsensus('importKeyring', { envelopeSize: binaryEnvelope?.length || 0 });
    try {
      // Integrity check is handled implicitly inside unwrapPad
      return deserialize(binaryEnvelope, masterKek);
    } catch (error) {
      const code = error instanceof KeyringValidationError ? error.code : 'IMPORT_FAILED';
      throw new HsmAdapterError(code, `HSM Import pipeline failure: ${error.message}`);
    }
  }

  // ── Track 34 consensus-gated commit helper ─────────────────────────

  /**
   * Require consensus quorum approval before a keyring mutation.
   * If a consensus engine is bound, replicate the command and require
   * majority commit. If the node is not leader or quorum is lost,
   * fail closed with HsmAdapterError.
   * @param {string} operation - the keyring operation (createKEK, rotateKEK, importKeyring)
   * @param {object} command - the command payload to replicate
   * @returns {Promise<void>}
   * @private
   */
  async _requireConsensus(operation, command) {
    if (!this._consensusEngine) return; // no consensus engine — local mode
    const state = this._consensusEngine.getState();
    if (state.state !== 'leader') {
      throw new HsmAdapterError('CONSENSUS_NOT_LEADER',
        `keyring ${operation} blocked: node ${this._consensusEngine.nodeId} is not leader (state: ${state.state})`);
    }
    const result = await this._consensusEngine.appendAndReplicate({ operation, ...command });
    if (!result.committed) {
      throw new HsmAdapterError('CONSENSUS_COMMIT_FAILED',
        `keyring ${operation} blocked: quorum not reached (${result.replicas} replicas, need ${state.quorumNodes})`);
    }
    this._audit('CONSENSUS_GATED_COMMIT', { operation, index: result.index, replicas: result.replicas });
  }

  // ── Track 30 identity ratchet telemetry hooks ──────────────────────

  /**
   * Emit an identity ratchet step event into the audit pipeline.
   * @param {object} info
   */
  emitIdentityRatchetStepped(info = {}) {
    this._ensureInitialized();
    this._audit('IDENTITY_RATCHET_STEPPED', info);
  }

  /**
   * Emit an MFA token authenticated event into the audit pipeline.
   * @param {object} info
   */
  emitMfaTokenAuthenticated(info = {}) {
    this._ensureInitialized();
    this._audit('MFA_TOKEN_AUTHENTICATED', info);
  }

  // ── Track 31 governance telemetry hooks ────────────────────────────

  /**
   * Emit a governance proposal initiated event into the audit pipeline.
   * @param {object} info
   */
  emitGovernanceProposalInitiated(info = {}) {
    this._ensureInitialized();
    this._audit('GOVERNANCE_PROPOSAL_INITIATED', info);
  }

  /**
   * Emit a policy consensus committed event into the audit pipeline.
   * @param {object} info
   */
  emitPolicyConsensusCommitted(info = {}) {
    this._ensureInitialized();
    this._audit('POLICY_CONSENSUS_COMMITTED', info);
  }

  // ── Track 33 recovery sync telemetry hooks ─────────────────────────

  /**
   * Emit a node recovery started event into the audit pipeline.
   * @param {object} info
   */
  emitNodeRecoveryStarted(info = {}) {
    this._ensureInitialized();
    this._audit('NODE_RECOVERY_STARTED', info);
    try {
      const metrics = require('./hsm-metrics.cjs');
      metrics.incrementCounter('hsm_recovery_started_total');
    } catch { /* metrics module optional */ }
  }

  /**
   * Emit a node recovery synced event into the audit pipeline.
   * @param {object} info
   */
  emitNodeRecoverySynced(info = {}) {
    this._ensureInitialized();
    this._audit('NODE_RECOVERY_SYNCED', info);
    try {
      const metrics = require('./hsm-metrics.cjs');
      metrics.incrementCounter('hsm_recovery_synced_total');
      if (typeof info.batchesApplied === 'number') {
        metrics.incrementCounter('hsm_recovery_catchup_batches_total', info.batchesApplied);
      }
    } catch { /* metrics module optional */ }
  }

  // ── Helpers ────────────────────────────────────────────────────────

  _log(level, message, extra = {}) {
    if (!this.logger || !this.logger[level]) return;
    this.logger[level](message, { sub: 'hsm-adapter', provider: this.providerName, ...extra });
  }

  _audit(event, extra = {}) {
    if (!this.logger || !this.logger.info) return;
    this.logger.info(event, { sub: 'hsm-adapter', provider: this.providerName, ...extra });
  }
}

module.exports = {
  BaseHsmAdapter,
  HsmAdapterError,
  WRAPPED_BLOB_VERSION,
};
