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

// Track 34 Phase 8: Module-level registry for the active consensus engine instance.
// Set by adapters that receive a consensusEngine option, so the REST endpoint
// can introspect engine state without holding a direct reference.
let _activeConsensusEngine = null;

/**
 * Register the active consensus engine instance for telemetry introspection.
 * @param {object} engine - ClusterConsensusEngine instance (or null to clear)
 */
function registerConsensusEngine(engine) {
  _activeConsensusEngine = engine;
}

/**
 * Get the registered consensus engine instance (if any).
 * @returns {object|null}
 */
function getConsensusEngine() {
  return _activeConsensusEngine;
}

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
    // Track 34 Phase 8: Auto-register consensus engine for telemetry
    if (this._consensusEngine) {
      registerConsensusEngine(this._consensusEngine);
    }
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

  // ── Track 41 hardware enclave telemetry hooks ─────────────────────

  /**
   * Emit a hardware enclave bootstrapped event into the audit pipeline.
   * @param {object} info
   */
  emitEnclaveHardwareBootstrapped(info = {}) {
    this._ensureInitialized();
    this._audit('ENCLAVE_HARDWARE_BOOTSTRAPPED', info);
  }

  /**
   * Emit an attestation challenge verified event into the audit pipeline.
   * @param {object} info
   */
  emitAttestationChallengeVerified(info = {}) {
    this._ensureInitialized();
    this._audit('ATTESTATION_CHALLENGE_VERIFIED', info);
  }

  /**
   * Emit an enclave key provisioned event into the audit pipeline.
   * @param {object} info
   */
  emitEnclaveKeyProvisioned(info = {}) {
    this._ensureInitialized();
    this._audit('ENCLAVE_KEY_PROVISIONED', info);
  }

  // ── Track 42 resharding telemetry hooks ────────────────────────────

  /**
   * Emit a committee resharding initiated event into the audit pipeline.
   * @param {object} info
   */
  emitCommitteeReshardingInitiated(info = {}) {
    this._ensureInitialized();
    this._audit('COMMITTEE_RESHARDING_INITIATED', info);
  }

  /**
   * Emit an ephemeral share ratcheted event into the audit pipeline.
   * @param {object} info
   */
  emitEphemeralShareRatcheted(info = {}) {
    this._ensureInitialized();
    this._audit('EPHEMERAL_SHARE_RATCHETED', info);
  }

  // ── Track 43 disaster recovery telemetry hooks ────────────────────

  /**
   * Emit a regional failover initiated event into the audit pipeline.
   * @param {object} info
   */
  emitRegionalFailoverInitiated(info = {}) {
    this._ensureInitialized();
    this._audit('REGIONAL_FAILOVER_INITIATED', info);
  }

  /**
   * Emit a standby cluster provisioned event into the audit pipeline.
   * @param {object} info
   */
  emitStandbyClusterProvisioned(info = {}) {
    this._ensureInitialized();
    this._audit('STANDBY_CLUSTER_PROVISIONED', info);
  }

  // ── Track 44 confidential issuance telemetry hooks ─────────────────

  /**
   * Emit a confidential token minted event into the audit pipeline.
   * @param {object} info
   */
  emitConfidentialTokenMinted(info = {}) {
    this._ensureInitialized();
    this._audit('CONFIDENTIAL_TOKEN_MINTED', info);
  }

  /**
   * Emit an issuance proof validated event into the audit pipeline.
   * @param {object} info
   */
  emitIssuanceProofValidated(info = {}) {
    this._ensureInitialized();
    this._audit('ISSUANCE_PROOF_VALIDATED', info);
  }

  // ── Track 45 cross-tenant audit telemetry hooks ────────────────────

  /**
   * Emit a cross-tenant access recognized event into the audit pipeline.
   * @param {object} info
   */
  emitCrossTenantAccessRecognized(info = {}) {
    this._ensureInitialized();
    this._audit('CROSS_TENANT_ACCESS_RECOGNIZED', info);
  }

  /**
   * Emit an audit receipt chained event into the audit pipeline.
   * @param {object} info
   */
  emitAuditReceiptChained(info = {}) {
    this._ensureInitialized();
    this._audit('AUDIT_RECEIPT_CHAINED', info);
  }

  // ── Track 46 homomorphic computation telemetry hooks ───────────────

  /**
   * Emit a homomorphic contract executed event into the audit pipeline.
   * @param {object} info
   */
  emitHomomorphicContractExecuted(info = {}) {
    this._ensureInitialized();
    this._audit('HOMOMORPHIC_CONTRACT_EXECUTED', info);
  }

  /**
   * Emit a zk range proof verified event into the audit pipeline.
   * @param {object} info
   */
  emitZkRangeProofVerified(info = {}) {
    this._ensureInitialized();
    this._audit('ZK_RANGE_PROOF_VERIFIED', info);
  }

  // ── Track 47 hardware root rotation telemetry hooks ────────────────

  /**
   * Emit an enclave root rotation initiated event into the audit pipeline.
   * @param {object} info
   */
  emitEnclaveRootRotationInitiated(info = {}) {
    this._ensureInitialized();
    this._audit('ENCLAVE_ROOT_ROTATION_INITIATED', info);
  }

  /**
   * Emit a hardware seed committed event into the audit pipeline.
   * @param {object} info
   */
  emitHardwareSeedCommitted(info = {}) {
    this._ensureInitialized();
    this._audit('HARDWARE_SEED_COMMITTED', info);
  }

  // ── Track 48 PQC asset bridge telemetry hooks ─────────────────────

  /**
   * Emit a bridge transfer initiated event into the audit pipeline.
   * @param {object} info
   */
  emitBridgeTransferInitiated(info = {}) {
    this._ensureInitialized();
    this._audit('BRIDGE_TRANSFER_INITIATED', info);
  }

  /**
   * Emit a cross-chain claim validated event into the audit pipeline.
   * @param {object} info
   */
  emitCrossChainClaimValidated(info = {}) {
    this._ensureInitialized();
    this._audit('CROSS_CHAIN_CLAIM_VALIDATED', info);
  }

  /**
   * Emit an escrow release finalized event into the audit pipeline.
   * @param {object} info
   */
  emitEscrowReleaseFinalized(info = {}) {
    this._ensureInitialized();
    this._audit('ESCROW_RELEASE_FINALIZED', info);
  }

  // ── Track 49 homomorphic DB lookup telemetry hooks ─────────────────

  /**
   * Emit a homomorphic DB query initiated event into the audit pipeline.
   * @param {object} info
   */
  emitHomomorphicDbQueryInitiated(info = {}) {
    this._ensureInitialized();
    this._audit('HOMOMORPHIC_DB_QUERY_INITIATED', info);
  }

  /**
   * Emit a zk lookup match verified event into the audit pipeline.
   * @param {object} info
   */
  emitZkLookupMatchVerified(info = {}) {
    this._ensureInitialized();
    this._audit('ZK_LOOKUP_MATCH_VERIFIED', info);
  }

  // ── Track 50 ZK cross-chain settlement telemetry hooks ─────────────

  /**
   * Emit a cross-chain settlement initiated event into the audit pipeline.
   * @param {object} info
   */
  emitCrossChainSettlementInitiated(info = {}) {
    this._ensureInitialized();
    this._audit('CROSS_CHAIN_SETTLEMENT_INITIATED', info);
  }

  /**
   * Emit a zk settlement finalized event into the audit pipeline.
   * @param {object} info
   */
  emitZkSettlementFinalized(info = {}) {
    this._ensureInitialized();
    this._audit('ZK_SETTLEMENT_FINALIZED', info);
  }

  // ── Track 51 PQC identity hub telemetry hooks ──────────────────────

  /**
   * Emit a PQC identity hub registered event into the audit pipeline.
   * @param {object} info
   */
  emitPqcIdentityHubRegistered(info = {}) {
    this._ensureInitialized();
    this._audit('PQC_IDENTITY_HUB_REGISTERED', info);
  }

  /**
   * Emit an identity issuance quorum committed event into the audit pipeline.
   * @param {object} info
   */
  emitIdentityIssuanceQuorumCommitted(info = {}) {
    this._ensureInitialized();
    this._audit('IDENTITY_ISSUANCE_QUORUM_COMMITTED', info);
  }

  // ── Track 52 ZK access token attestation telemetry hooks ───────────

  /**
   * Emit a ZK access token issued event into the audit pipeline.
   * @param {object} info
   */
  emitZkAccessTokenIssued(info = {}) {
    this._ensureInitialized();
    this._audit('ZK_ACCESS_TOKEN_ISSUED', info);
  }

  /**
   * Emit an attestation contract verified event into the audit pipeline.
   * @param {object} info
   */
  emitAttestationContractVerified(info = {}) {
    this._ensureInitialized();
    this._audit('ATTESTATION_CONTRACT_VERIFIED', info);
  }

  // ── Track 53 Homomorphic key sharding telemetry hooks ─────────────

  /**
   * Emit a homomorphic shard dispersed event into the audit pipeline.
   * @param {object} info
   */
  emitHomomorphicShardDispersed(info = {}) {
    this._ensureInitialized();
    this._audit('HOMOMORPHIC_SHARD_DISPERSED', info);
  }

  /**
   * Emit a cross-platform combiner verified event into the audit pipeline.
   * @param {object} info
   */
  emitCrossPlatformCombinerVerified(info = {}) {
    this._ensureInitialized();
    this._audit('CROSS_PLATFORM_COMBINER_VERIFIED', info);
  }

  // ── Track 54 MPC gated decryption telemetry hooks ─────────────────

  /**
   * Emit an MPC circuit evaluation initiated event into the audit pipeline.
   * @param {object} info
   */
  emitMpcCircuitEvaluationInitiated(info = {}) {
    this._ensureInitialized();
    this._audit('MPC_CIRCUIT_EVALUATION_INITIATED', info);
  }

  /**
   * Emit an MPC decryption gate unlocked event into the audit pipeline.
   * @param {object} info
   */
  emitMpcDecryptionGateUnlocked(info = {}) {
    this._ensureInitialized();
    this._audit('MPC_DECRYPTION_GATE_UNLOCKED', info);
  }

  // ── Track 55 Encrypted storage deduplication telemetry hooks ──────

  /**
   * Emit a ciphertext tag matched event into the audit pipeline.
   * @param {object} info
   */
  emitCiphertextTagMatched(info = {}) {
    this._ensureInitialized();
    this._audit('CIPHERTEXT_TAG_MATCHED', info);
  }

  /**
   * Emit a duplicate block reconciled event into the audit pipeline.
   * @param {object} info
   */
  emitDuplicateBlockReconciled(info = {}) {
    this._ensureInitialized();
    this._audit('DUPLICATE_BLOCK_RECONCILED', info);
  }

  // ── Track 56 Encrypted search routing telemetry hooks ────────────

  /**
   * Emit an encrypted search routed event into the audit pipeline.
   * @param {object} info
   */
  emitEncryptedSearchRouted(info = {}) {
    this._ensureInitialized();
    this._audit('ENCRYPTED_SEARCH_ROUTED', info);
  }

  /**
   * Emit an MPC index match verified event into the audit pipeline.
   * @param {object} info
   */
  emitMpcIndexMatchVerified(info = {}) {
    this._ensureInitialized();
    this._audit('MPC_INDEX_MATCH_VERIFIED', info);
  }

  // ── Track 57 PQ identity accumulator telemetry hooks ─────────────

  /**
   * Emit an identity accumulator updated event into the audit pipeline.
   * @param {object} info
   */
  emitIdentityAccumulatorUpdated(info = {}) {
    this._ensureInitialized();
    this._audit('IDENTITY_ACCUMULATOR_UPDATED', info);
  }

  /**
   * Emit a ZK membership claim validated event into the audit pipeline.
   * @param {object} info
   */
  emitZkMembershipClaimValidated(info = {}) {
    this._ensureInitialized();
    this._audit('ZK_MEMBERSHIP_CLAIM_VALIDATED', info);
  }

  // ── Track 58 PQC vesting locks telemetry hooks ───────────────────

  /**
   * Emit a vesting lock initialized event into the audit pipeline.
   * @param {object} info
   */
  emitVestingLockInitialized(info = {}) {
    this._ensureInitialized();
    this._audit('VESTING_LOCK_INITIALIZED', info);
  }

  /**
   * Emit a vesting epoch release claimed event into the audit pipeline.
   * @param {object} info
   */
  emitVestingEpochReleaseClaimed(info = {}) {
    this._ensureInitialized();
    this._audit('VESTING_EPOCH_RELEASE_CLAIMED', info);
  }

  /**
   * Emit a vesting escrow completed event into the audit pipeline.
   * @param {object} info
   */
  emitVestingEscrowCompleted(info = {}) {
    this._ensureInitialized();
    this._audit('VESTING_ESCROW_COMPLETED', info);
  }

  // ── Track 59 PQC cross-chain governance telemetry hooks ──────────

  /**
   * Emit a cross-chain proposal broadcast event into the audit pipeline.
   * @param {object} info
   */
  emitCrossChainProposalBroadcast(info = {}) {
    this._ensureInitialized();
    this._audit('CROSS_CHAIN_PROPOSAL_BROADCAST', info);
  }

  /**
   * Emit a governance vote recorded event into the audit pipeline.
   * @param {object} info
   */
  emitGovernanceVoteRecorded(info = {}) {
    this._ensureInitialized();
    this._audit('GOVERNANCE_VOTE_RECORDED', info);
  }

  /**
   * Emit a cross-chain proposal executed event into the audit pipeline.
   * @param {object} info
   */
  emitCrossChainProposalExecuted(info = {}) {
    this._ensureInitialized();
    this._audit('CROSS_CHAIN_PROPOSAL_EXECUTED', info);
  }

  // ── Track 60 PQC homomorphic identity bridge telemetry hooks ─────

  /**
   * Emit a homomorphic identity bridge initialized event into the audit pipeline.
   * @param {object} info
   */
  emitHomomorphicIdentityBridgeInitialized(info = {}) {
    this._ensureInitialized();
    this._audit('HOMOMORPHIC_IDENTITY_BRIDGE_INITIALIZED', info);
  }

  /**
   * Emit an MPC cross-chain consensus finalized event into the audit pipeline.
   * @param {object} info
   */
  emitMpcCrossChainConsensusFinalized(info = {}) {
    this._ensureInitialized();
    this._audit('MPC_CROSS_CHAIN_CONSENSUS_FINALIZED', info);
  }

  // ── Track 61 PQ identity revocation telemetry hooks ──────────────

  /**
   * Emit an identity revocation published event into the audit pipeline.
   * @param {object} info
   */
  emitIdentityRevocationPublished(info = {}) {
    this._ensureInitialized();
    this._audit('IDENTITY_REVOCATION_PUBLISHED', info);
  }

  /**
   * Emit a ZK revocation proof authenticated event into the audit pipeline.
   * @param {object} info
   */
  emitZkRevocationProofAuthenticated(info = {}) {
    this._ensureInitialized();
    this._audit('ZK_REVOCATION_PROOF_AUTHENTICATED', info);
  }

  // ── Track 62 PQ time-locked matrix telemetry hooks ──────────────

  /**
   * Emit a time-lock matrix initialized event into the audit pipeline.
   * @param {object} info
   */
  emitTimeLockMatrixInitialized(info = {}) {
    this._ensureInitialized();
    this._audit('TIME_LOCK_MATRIX_INITIALIZED', info);
  }

  /**
   * Emit a temporal decryption proof verified event into the audit pipeline.
   * @param {object} info
   */
  emitTemporalDecryptionProveVerified(info = {}) {
    this._ensureInitialized();
    this._audit('TEMPORAL_DECRYPTION_PROVE_VERIFIED', info);
  }

  // ── Track 63 PQ blind option pools telemetry hooks ──────────────

  /**
   * Emit a blind option pool initialized event into the audit pipeline.
   * @param {object} info
   */
  emitBlindOptionPoolInitialized(info = {}) {
    this._ensureInitialized();
    this._audit('BLIND_OPTION_POOL_INITIALIZED', info);
  }

  /**
   * Emit a ZK margin adequacy verified event into the audit pipeline.
   * @param {object} info
   */
  emitZkMarginAdequacyVerified(info = {}) {
    this._ensureInitialized();
    this._audit('ZK_MARGIN_ADEQUACY_VERIFIED', info);
  }

  /**
   * Emit a blind option contract executed event into the audit pipeline.
   * @param {object} info
   */
  emitBlindOptionContractExecuted(info = {}) {
    this._ensureInitialized();
    this._audit('BLIND_OPTION_CONTRACT_EXECUTED', info);
  }

  // ── Track 64 PQ prediction markets telemetry hooks ──────────────

  /**
   * Emit a prediction market initialized event into the audit pipeline.
   * @param {object} info
   */
  emitPredictionMarketInitialized(info = {}) {
    this._ensureInitialized();
    this._audit('PREDICTION_MARKET_INITIALIZED', info);
  }

  /**
   * Emit a ZK resolution vote recorded event into the audit pipeline.
   * @param {object} info
   */
  emitZkResolutionVoteRecorded(info = {}) {
    this._ensureInitialized();
    this._audit('ZK_RESOLUTION_VOTE_RECORDED', info);
  }

  /**
   * Emit a prediction market finalized event into the audit pipeline.
   * @param {object} info
   */
  emitPredictionMarketFinalized(info = {}) {
    this._ensureInitialized();
    this._audit('PREDICTION_MARKET_FINALIZED', info);
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
  registerConsensusEngine,
  getConsensusEngine,
};
