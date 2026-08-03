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

// Track 40: Module-level registry for the active DistributedConsensusCoordinator.
// Follows the same pattern as the consensus engine registry above.
let _activeConsensusCoordinator = null;

/**
 * Register the active DistributedConsensusCoordinator instance for REST introspection.
 * @param {object} coordinator - DistributedConsensusCoordinator instance (or null to clear)
 */
function registerConsensusCoordinator(coordinator) {
  _activeConsensusCoordinator = coordinator;
}

/**
 * Get the registered DistributedConsensusCoordinator instance (if any).
 * @returns {object|null}
 */
function getConsensusCoordinator() {
  return _activeConsensusCoordinator;
}

// Track 41: Module-level registry for the active HardwareEnclaveAdapter.
// Follows the same pattern as the consensus engine/coordinator registries above.
let _activeHardwareEnclaveAdapter = null;

/**
 * Register the active HardwareEnclaveAdapter instance for REST introspection.
 * @param {object} adapter - HardwareEnclaveAdapter instance (or null to clear)
 */
function registerHardwareEnclaveAdapter(adapter) {
  _activeHardwareEnclaveAdapter = adapter;
}

/**
 * Get the registered HardwareEnclaveAdapter instance (if any).
 * @returns {object|null}
 */
function getHardwareEnclaveAdapter() {
  return _activeHardwareEnclaveAdapter;
}

// Track 49: Module-level registry for the active EnclaveRescaler instance.
let _activeEnclaveRescaler = null;

function registerEnclaveRescaler(enclaveRescaler) {
  _activeEnclaveRescaler = enclaveRescaler;
}

function getEnclaveRescaler() {
  return _activeEnclaveRescaler;
}

// Track 51: Module-level registry for the active HeMeshTopology instance.
let _activeHeMeshTopology = null;

function registerHeMeshTopology(heMeshTopology) {
  _activeHeMeshTopology = heMeshTopology;
}

function getHeMeshTopology() {
  return _activeHeMeshTopology;
}

// Track 52: Module-level registry for the active SecureInnerProductSearch instance.
let _activeSecureInnerProductSearch = null;

function registerSecureInnerProductSearch(secureInnerProductSearch) {
  _activeSecureInnerProductSearch = secureInnerProductSearch;
}

function getSecureInnerProductSearch() {
  return _activeSecureInnerProductSearch;
}

// Track 53: Module-level registry for the active ZkRangeProofSolvency instance.
let _activeZkRangeProofSolvency = null;

function registerZkRangeProofSolvency(zkRangeProofSolvency) {
  _activeZkRangeProofSolvency = zkRangeProofSolvency;
}

function getZkRangeProofSolvency() {
  return _activeZkRangeProofSolvency;
}

// Track 54: Module-level registry for the active ThresholdDecryptionCircuit instance.
let _activeThresholdDecryptionCircuit = null;

function registerThresholdDecryptionCircuit(thresholdDecryptionCircuit) {
  _activeThresholdDecryptionCircuit = thresholdDecryptionCircuit;
}

function getThresholdDecryptionCircuit() {
  return _activeThresholdDecryptionCircuit;
}

// Track 55: Module-level registry for the active VssPssEngine instance.
let _activeVssPssEngine = null;

function registerVssPssEngine(vssPssEngine) {
  _activeVssPssEngine = vssPssEngine;
}

function getVssPssEngine() {
  return _activeVssPssEngine;
}

// Track 56: Module-level registry for the active OramEngine instance.
let _activeOramEngine = null;

function registerOramEngine(oramEngine) {
  _activeOramEngine = oramEngine;
}

function getOramEngine() {
  return _activeOramEngine;
}

// Track 57: Module-level registry for the active ZkSnarkVerifierEngine instance.
let _activeZkSnarkVerifierEngine = null;

function registerZkSnarkVerifierEngine(zkSnarkVerifierEngine) {
  _activeZkSnarkVerifierEngine = zkSnarkVerifierEngine;
}

function getZkSnarkVerifierEngine() {
  return _activeZkSnarkVerifierEngine;
}

// Track 58: Module-level registry for the active MultiKeyFheRelinearizationEngine instance.
let _activeMultiKeyFheRelinearizationEngine = null;

function registerMultiKeyFheRelinearizationEngine(multiKeyFheRelinearizationEngine) {
  _activeMultiKeyFheRelinearizationEngine = multiKeyFheRelinearizationEngine;
}

function getMultiKeyFheRelinearizationEngine() {
  return _activeMultiKeyFheRelinearizationEngine;
}

// Track 59: Module-level registry for the active VdfTimeLockEngine instance.
let _activeVdfTimeLockEngine = null;

function registerVdfTimeLockEngine(vdfTimeLockEngine) {
  _activeVdfTimeLockEngine = vdfTimeLockEngine;
}

function getVdfTimeLockEngine() {
  return _activeVdfTimeLockEngine;
}

// Track 60: Module-level registry for the active MixnetBlindTransactionEngine instance.
let _activeMixnetBlindTransactionEngine = null;

function registerMixnetBlindTransactionEngine(mixnetBlindTransactionEngine) {
  _activeMixnetBlindTransactionEngine = mixnetBlindTransactionEngine;
}

function getMixnetBlindTransactionEngine() {
  return _activeMixnetBlindTransactionEngine;
}

// Track 61: Module-level registry for the active RecursiveProofAggregationEngine instance.
let _activeRecursiveProofAggregationEngine = null;

function registerRecursiveProofAggregationEngine(recursiveProofAggregationEngine) {
  _activeRecursiveProofAggregationEngine = recursiveProofAggregationEngine;
}

function getRecursiveProofAggregationEngine() {
  return _activeRecursiveProofAggregationEngine;
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
   * @param {EnclaveRescaler} [options.enclaveRescaler] - optional EnclaveRescaler for predictive load balancing (Track 49)
   * @param {HeMeshTopology} [options.heMeshTopology] - optional HeMeshTopology for encrypted query routing (Track 51)
   * @param {SecureInnerProductSearch} [options.secureInnerProductSearch] - optional SecureInnerProductSearch for secure inner product search (Track 52)
   * @param {ZkRangeProofSolvency} [options.zkRangeProofSolvency] - optional ZkRangeProofSolvency for ZK range proof and solvency audit (Track 53)
   * @param {ThresholdDecryptionCircuit} [options.thresholdDecryptionCircuit] - optional ThresholdDecryptionCircuit for threshold decryption circuit (Track 54)
   * @param {VssPssEngine} [options.vssPssEngine] - optional VssPssEngine for verifiable and proactive secret sharing (Track 55)
   * @param {OramEngine} [options.oramEngine] - optional OramEngine for oblivious memory access (Track 56)
   * @param {ZkSnarkVerifierEngine} [options.zkSnarkVerifierEngine] - optional ZkSnarkVerifierEngine for succinct proof verification (Track 57)
   * @param {MultiKeyFheRelinearizationEngine} [options.multiKeyFheRelinearizationEngine] - optional MultiKeyFheRelinearizationEngine for multi-key FHE relinearization (Track 58)
   * @param {VdfTimeLockEngine} [options.vdfTimeLockEngine] - optional VdfTimeLockEngine for VDF and time-lock puzzle (Track 59)
   * @param {MixnetBlindTransactionEngine} [options.mixnetBlindTransactionEngine] - optional MixnetBlindTransactionEngine for mixnet blind transaction (Track 60)
   * @param {RecursiveProofAggregationEngine} [options.recursiveProofAggregationEngine] - optional RecursiveProofAggregationEngine for recursive proof aggregation (Track 61)
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
    this._enclaveRescaler = options.enclaveRescaler || null;
    if (this._enclaveRescaler) {
      registerEnclaveRescaler(this._enclaveRescaler);
    }
    this._heMeshTopology = options.heMeshTopology || null;
    if (this._heMeshTopology) {
      registerHeMeshTopology(this._heMeshTopology);
    }
    this._secureInnerProductSearch = options.secureInnerProductSearch || null;
    if (this._secureInnerProductSearch) {
      registerSecureInnerProductSearch(this._secureInnerProductSearch);
    }
    this._zkRangeProofSolvency = options.zkRangeProofSolvency || null;
    if (this._zkRangeProofSolvency) {
      registerZkRangeProofSolvency(this._zkRangeProofSolvency);
    }
    this._thresholdDecryptionCircuit = options.thresholdDecryptionCircuit || null;
    if (this._thresholdDecryptionCircuit) {
      registerThresholdDecryptionCircuit(this._thresholdDecryptionCircuit);
    }
    this._vssPssEngine = options.vssPssEngine || null;
    if (this._vssPssEngine) {
      registerVssPssEngine(this._vssPssEngine);
    }
    this._oramEngine = options.oramEngine || null;
    if (this._oramEngine) {
      registerOramEngine(this._oramEngine);
    }
    this._zkSnarkVerifierEngine = options.zkSnarkVerifierEngine || null;
    if (this._zkSnarkVerifierEngine) {
      registerZkSnarkVerifierEngine(this._zkSnarkVerifierEngine);
    }
    this._multiKeyFheRelinearizationEngine = options.multiKeyFheRelinearizationEngine || null;
    if (this._multiKeyFheRelinearizationEngine) {
      registerMultiKeyFheRelinearizationEngine(this._multiKeyFheRelinearizationEngine);
    }
    this._vdfTimeLockEngine = options.vdfTimeLockEngine || null;
    if (this._vdfTimeLockEngine) {
      registerVdfTimeLockEngine(this._vdfTimeLockEngine);
    }
    this._mixnetBlindTransactionEngine = options.mixnetBlindTransactionEngine || null;
    if (this._mixnetBlindTransactionEngine) {
      registerMixnetBlindTransactionEngine(this._mixnetBlindTransactionEngine);
    }
    this._recursiveProofAggregationEngine = options.recursiveProofAggregationEngine || null;
    if (this._recursiveProofAggregationEngine) {
      registerRecursiveProofAggregationEngine(this._recursiveProofAggregationEngine);
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

  // ── Track 65 PQ fractional custody telemetry hooks ──────────────

  /**
   * Emit a fractional vault initialized event into the audit pipeline.
   * @param {object} info
   */
  emitFractionalVaultInitialized(info = {}) {
    this._ensureInitialized();
    this._audit('FRACTIONAL_VAULT_INITIALIZED', info);
  }

  /**
   * Emit a fractional release signed event into the audit pipeline.
   * @param {object} info
   */
  emitFractionalReleaseSigned(info = {}) {
    this._ensureInitialized();
    this._audit('FRACTIONAL_RELEASE_SIGNED', info);
  }

  /**
   * Emit a custody vault liquidated event into the audit pipeline.
   * @param {object} info
   */
  emitCustodyVaultLiquidated(info = {}) {
    this._ensureInitialized();
    this._audit('CUSTODY_VAULT_LIQUIDATED', info);
  }

  // ── Track 66 PQ lending pools telemetry hooks ──────────────

  /**
   * Emit a lending pool initialized event into the audit pipeline.
   * @param {object} info
   */
  emitLendingPoolInitialized(info = {}) {
    this._ensureInitialized();
    this._audit('LENDING_POOL_INITIALIZED', info);
  }

  /**
   * Emit a ZK solvency proof verified event into the audit pipeline.
   * @param {object} info
   */
  emitZkSolvencyProofVerified(info = {}) {
    this._ensureInitialized();
    this._audit('ZK_SOLVENCY_PROOF_VERIFIED', info);
  }

  /**
   * Emit a collateral pool liquidated event into the audit pipeline.
   * @param {object} info
   */
  emitCollateralPoolLiquidated(info = {}) {
    this._ensureInitialized();
    this._audit('COLLATERAL_POOL_LIQUIDATED', info);
  }

  // ── Track 67 PQ insurance underwriting telemetry hooks ──────────────

  /**
   * Emit an insurance pool initialized event into the audit pipeline.
   * @param {object} info
   */
  emitInsurancePoolInitialized(info = {}) {
    this._ensureInitialized();
    this._audit('INSURANCE_POOL_INITIALIZED', info);
  }

  /**
   * Emit a ZK claim eligibility verified event into the audit pipeline.
   * @param {object} info
   */
  emitZkClaimEligibilityVerified(info = {}) {
    this._ensureInitialized();
    this._audit('ZK_CLAIM_ELIGIBILITY_VERIFIED', info);
  }

  /**
   * Emit an underwriting pool liquidated event into the audit pipeline.
   * @param {object} info
   */
  emitUnderwritingPoolLiquidated(info = {}) {
    this._ensureInitialized();
    this._audit('UNDERWRITING_POOL_LIQUIDATED', info);
  }

  // ── Track 68 PQ supply chain escrow telemetry hooks ──────────────

  /**
   * Emit a supply chain order initialized event into the audit pipeline.
   * @param {object} info
   */
  emitSupplyChainOrderInitialized(info = {}) {
    this._ensureInitialized();
    this._audit('SUPPLY_CHAIN_ORDER_INITIALIZED', info);
  }

  /**
   * Emit a ZK delivery milestone verified event into the audit pipeline.
   * @param {object} info
   */
  emitZkDeliveryMilestoneVerified(info = {}) {
    this._ensureInitialized();
    this._audit('ZK_DELIVERY_MILESTONE_VERIFIED', info);
  }

  /**
   * Emit a procurement escrow released event into the audit pipeline.
   * @param {object} info
   */
  emitProcurementEscrowReleased(info = {}) {
    this._ensureInitialized();
    this._audit('PROCUREMENT_ESCROW_RELEASED', info);
  }

  // ── Track 69 PQ real estate tokenization telemetry hooks ──────────────

  /**
   * Emit a real estate pool initialized event into the audit pipeline.
   * @param {object} info
   */
  emitRealEstatePoolInitialized(info = {}) {
    this._ensureInitialized();
    this._audit('REAL_ESTATE_POOL_INITIALIZED', info);
  }

  /**
   * Emit a ZK encumbrance clearance verified event into the audit pipeline.
   * @param {object} info
   */
  emitZkEncumbranceClearanceVerified(info = {}) {
    this._ensureInitialized();
    this._audit('ZK_ENCUMBRANCE_CLEARANCE_VERIFIED', info);
  }

  /**
   * Emit a title deed transfer finalized event into the audit pipeline.
   * @param {object} info
   */
  emitTitleDeedTransferFinalized(info = {}) {
    this._ensureInitialized();
    this._audit('TITLE_DEED_TRANSFER_FINALIZED', info);
  }

  // ── Track 70 PQ carbon credit tokenization telemetry hooks ──────────────

  /**
   * Emit a carbon pool initialized event into the audit pipeline.
   * @param {object} info
   */
  emitCarbonPoolInitialized(info = {}) {
    this._ensureInitialized();
    this._audit('CARBON_POOL_INITIALIZED', info);
  }

  /**
   * Emit a ZK retirement proof verified event into the audit pipeline.
   * @param {object} info
   */
  emitZkRetirementProofVerified(info = {}) {
    this._ensureInitialized();
    this._audit('ZK_RETIREMENT_PROOF_VERIFIED', info);
  }

  /**
   * Emit a carbon credit retirement finalized event into the audit pipeline.
   * @param {object} info
   */
  emitCarbonCreditRetirementFinalized(info = {}) {
    this._ensureInitialized();
    this._audit('CARBON_CREDIT_RETIREMENT_FINALIZED', info);
  }

  // ── Track 71 PQ identity gating telemetry hooks ──────────────

  /**
   * Emit an identity gating pool initialized event into the audit pipeline.
   * @param {object} info
   */
  emitIdentityGatingPoolInitialized(info = {}) {
    this._ensureInitialized();
    this._audit('IDENTITY_GATING_POOL_INITIALIZED', info);
  }

  /**
   * Emit a ZK attribute claim verified event into the audit pipeline.
   * @param {object} info
   */
  emitZkAttributeClaimVerified(info = {}) {
    this._ensureInitialized();
    this._audit('ZK_ATTRIBUTE_CLAIM_VERIFIED', info);
  }

  /**
   * Emit a sovereign identity gating completed event into the audit pipeline.
   * @param {object} info
   */
  emitSovereignIdentityGatingCompleted(info = {}) {
    this._ensureInitialized();
    this._audit('SOVEREIGN_IDENTITY_GATING_COMPLETED', info);
  }

  // ── Track 72 PQ health data gating telemetry hooks ──────────────

  /**
   * Emit a health gating pool initialized event into the audit pipeline.
   * @param {object} info
   */
  emitHealthGatingPoolInitialized(info = {}) {
    this._ensureInitialized();
    this._audit('HEALTH_GATING_POOL_INITIALIZED', info);
  }

  /**
   * Emit a ZK health claim verified event into the audit pipeline.
   * @param {object} info
   */
  emitZkHealthClaimVerified(info = {}) {
    this._ensureInitialized();
    this._audit('ZK_HEALTH_CLAIM_VERIFIED', info);
  }

  /**
   * Emit a health record gating completed event into the audit pipeline.
   * @param {object} info
   */
  emitHealthRecordGatingCompleted(info = {}) {
    this._ensureInitialized();
    this._audit('HEALTH_RECORD_GATING_COMPLETED', info);
  }

  // ── Track 73 PQ education credential gating telemetry hooks ──────────────

  /**
   * Emit an education gating pool initialized event into the audit pipeline.
   * @param {object} info
   */
  emitEducationGatingPoolInitialized(info = {}) {
    this._ensureInitialized();
    this._audit('EDUCATION_GATING_POOL_INITIALIZED', info);
  }

  /**
   * Emit a ZK academic claim verified event into the audit pipeline.
   * @param {object} info
   */
  emitZkAcademicClaimVerified(info = {}) {
    this._ensureInitialized();
    this._audit('ZK_ACADEMIC_CLAIM_VERIFIED', info);
  }

  /**
   * Emit a credential accreditation completed event into the audit pipeline.
   * @param {object} info
   */
  emitCredentialAccreditationCompleted(info = {}) {
    this._ensureInitialized();
    this._audit('CREDENTIAL_ACCREDITATION_COMPLETED', info);
  }

  // ── Track 74 PQ patent verification gating telemetry hooks ──────────────

  /**
   * Emit a patent gating pool initialized event into the audit pipeline.
   * @param {object} info
   */
  emitPatentGatingPoolInitialized(info = {}) {
    this._ensureInitialized();
    this._audit('PATENT_GATING_POOL_INITIALIZED', info);
  }

  /**
   * Emit a ZK patent claim verified event into the audit pipeline.
   * @param {object} info
   */
  emitZkPatentClaimVerified(info = {}) {
    this._ensureInitialized();
    this._audit('ZK_PATENT_CLAIM_VERIFIED', info);
  }

  /**
   * Emit a patent license accreditation completed event into the audit pipeline.
   * @param {object} info
   */
  emitPatentLicenseAccreditationCompleted(info = {}) {
    this._ensureInitialized();
    this._audit('PATENT_LICENSE_ACCREDITATION_COMPLETED', info);
  }

  // ── Track 75 PQ energy certificate gating telemetry hooks ──────────────

  /**
   * Emit an energy gating pool initialized event into the audit pipeline.
   * @param {object} info
   */
  emitEnergyGatingPoolInitialized(info = {}) {
    this._ensureInitialized();
    this._audit('ENERGY_GATING_POOL_INITIALIZED', info);
  }

  /**
   * Emit a ZK energy claim verified event into the audit pipeline.
   * @param {object} info
   */
  emitZkEnergyClaimVerified(info = {}) {
    this._ensureInitialized();
    this._audit('ZK_ENERGY_CLAIM_VERIFIED', info);
  }

  /**
   * Emit a certificate trading accreditation completed event into the audit pipeline.
   * @param {object} info
   */
  emitCertificateTradingAccreditationCompleted(info = {}) {
    this._ensureInitialized();
    this._audit('CERTIFICATE_TRADING_ACCREDITATION_COMPLETED', info);
  }

  // ── Track 76 PQ supply chain provenance gating telemetry hooks ──────────────

  /**
   * Emit a supply chain gating pool initialized event into the audit pipeline.
   * @param {object} info
   */
  emitSupplyChainGatingPoolInitialized(info = {}) {
    this._ensureInitialized();
    this._audit('SUPPLY_CHAIN_GATING_POOL_INITIALIZED', info);
  }

  /**
   * Emit a ZK provenance claim verified event into the audit pipeline.
   * @param {object} info
   */
  emitZkProvenanceClaimVerified(info = {}) {
    this._ensureInitialized();
    this._audit('ZK_PROVENANCE_CLAIM_VERIFIED', info);
  }

  /**
   * Emit a component lineage accreditation completed event into the audit pipeline.
   * @param {object} info
   */
  emitComponentLineageAccreditationCompleted(info = {}) {
    this._ensureInitialized();
    this._audit('COMPONENT_LINEAGE_ACCREDITATION_COMPLETED', info);
  }

  // ── Track 77 PQ biometric verification gating telemetry hooks ──────────────

  /**
   * Emit a biometric gating pool initialized event into the audit pipeline.
   * @param {object} info
   */
  emitBiometricGatingPoolInitialized(info = {}) {
    this._ensureInitialized();
    this._audit('BIOMETRIC_GATING_POOL_INITIALIZED', info);
  }

  /**
   * Emit a ZK biometric claim verified event into the audit pipeline.
   * @param {object} info
   */
  emitZkBiometricClaimVerified(info = {}) {
    this._ensureInitialized();
    this._audit('ZK_BIOMETRIC_CLAIM_VERIFIED', info);
  }

  /**
   * Emit a liveness attestation accreditation completed event into the audit pipeline.
   * @param {object} info
   */
  emitLivenessAttestationAccreditationCompleted(info = {}) {
    this._ensureInitialized();
    this._audit('LIVENESS_ATTESTATION_ACCREDITATION_COMPLETED', info);
  }

  // ── Track 78 PQ financial derivatives gating telemetry hooks ──────────────

  /**
   * Emit a derivative gating pool initialized event into the audit pipeline.
   * @param {object} info
   */
  emitDerivativeGatingPoolInitialized(info = {}) {
    this._ensureInitialized();
    this._audit('DERIVATIVE_GATING_POOL_INITIALIZED', info);
  }

  /**
   * Emit a ZK derivative claim verified event into the audit pipeline.
   * @param {object} info
   */
  emitZkDerivativeClaimVerified(info = {}) {
    this._ensureInitialized();
    this._audit('ZK_DERIVATIVE_CLAIM_VERIFIED', info);
  }

  /**
   * Emit a counterparty risk accreditation completed event into the audit pipeline.
   * @param {object} info
   */
  emitCounterpartyRiskAccreditationCompleted(info = {}) {
    this._ensureInitialized();
    this._audit('COUNTERPARTY_RISK_ACCREDITATION_COMPLETED', info);
  }

  // ── Track 79 PQ clinical trial verification gating telemetry hooks ──────────────

  /**
   * Emit a clinical trial gating pool initialized event into the audit pipeline.
   * @param {object} info
   */
  emitClinicalTrialGatingPoolInitialized(info = {}) {
    this._ensureInitialized();
    this._audit('CLINICAL_TRIAL_GATING_POOL_INITIALIZED', info);
  }

  /**
   * Emit a ZK trial claim verified event into the audit pipeline.
   * @param {object} info
   */
  emitZkTrialClaimVerified(info = {}) {
    this._ensureInitialized();
    this._audit('ZK_TRIAL_CLAIM_VERIFIED', info);
  }

  /**
   * Emit a cohort accreditation completed event into the audit pipeline.
   * @param {object} info
   */
  emitCohortAccreditationCompleted(info = {}) {
    this._ensureInitialized();
    this._audit('COHORT_ACCREDITATION_COMPLETED', info);
  }

  // ── Track 80 PQ VRF audit sortition gating telemetry hooks ──────────────

  /**
   * Emit a sortition gating pool initialized event into the audit pipeline.
   * @param {object} info
   */
  emitSortitionGatingPoolInitialized(info = {}) {
    this._ensureInitialized();
    this._audit('SORTITION_GATING_POOL_INITIALIZED', info);
  }

  /**
   * Emit a ZK sortition claim verified event into the audit pipeline.
   * @param {object} info
   */
  emitZkSortitionClaimVerified(info = {}) {
    this._ensureInitialized();
    this._audit('ZK_SORTITION_CLAIM_VERIFIED', info);
  }

  /**
   * Emit a validator accreditation completed event into the audit pipeline.
   * @param {object} info
   */
  emitValidatorAccreditationCompleted(info = {}) {
    this._ensureInitialized();
    this._audit('VALIDATOR_ACCREDITATION_COMPLETED', info);
  }

  // ── Track 81 PQ cross-border logistics gating telemetry hooks ──────────────

  /**
   * Emit a logistics gating pool initialized event into the audit pipeline.
   * @param {object} info
   */
  emitLogisticsGatingPoolInitialized(info = {}) {
    this._ensureInitialized();
    this._audit('LOGISTICS_GATING_POOL_INITIALIZED', info);
  }

  /**
   * Emit a ZK manifest claim verified event into the audit pipeline.
   * @param {object} info
   */
  emitZkManifestClaimVerified(info = {}) {
    this._ensureInitialized();
    this._audit('ZK_MANIFEST_CLAIM_VERIFIED', info);
  }

  /**
   * Emit a carrier accreditation completed event into the audit pipeline.
   * @param {object} info
   */
  emitCarrierAccreditationCompleted(info = {}) {
    this._ensureInitialized();
    this._audit('CARRIER_ACCREDITATION_COMPLETED', info);
  }

  // ── Track 82 PQ AI model training gating telemetry hooks ──────────────

  /**
   * Emit a training gating pool initialized event into the audit pipeline.
   * @param {object} info
   */
  emitTrainingGatingPoolInitialized(info = {}) {
    this._ensureInitialized();
    this._audit('TRAINING_GATING_POOL_INITIALIZED', info);
  }

  /**
   * Emit a ZK training claim verified event into the audit pipeline.
   * @param {object} info
   */
  emitZkTrainingClaimVerified(info = {}) {
    this._ensureInitialized();
    this._audit('ZK_TRAINING_CLAIM_VERIFIED', info);
  }

  /**
   * Emit a model accreditation completed event into the audit pipeline.
   * @param {object} info
   */
  emitModelAccreditationCompleted(info = {}) {
    this._ensureInitialized();
    this._audit('MODEL_ACCREDITATION_COMPLETED', info);
  }

  // ── Track 83 PQ scientific reproducibility gating telemetry hooks ──────────────

  /**
   * Emit a research gating pool initialized event into the audit pipeline.
   * @param {object} info
   */
  emitResearchGatingPoolInitialized(info = {}) {
    this._ensureInitialized();
    this._audit('RESEARCH_GATING_POOL_INITIALIZED', info);
  }

  /**
   * Emit a ZK replication claim verified event into the audit pipeline.
   * @param {object} info
   */
  emitZkReplicationClaimVerified(info = {}) {
    this._ensureInitialized();
    this._audit('ZK_REPLICATION_CLAIM_VERIFIED', info);
  }

  /**
   * Emit a peer review accreditation completed event into the audit pipeline.
   * @param {object} info
   */
  emitPeerReviewAccreditationCompleted(info = {}) {
    this._ensureInitialized();
    this._audit('PEER_REVIEW_ACCREDITATION_COMPLETED', info);
  }

  // ── Track 84 PQ DAO treasury management gating telemetry hooks ──────────────

  /**
   * Emit a treasury gating pool initialized event into the audit pipeline.
   * @param {object} info
   */
  emitTreasuryGatingPoolInitialized(info = {}) {
    this._ensureInitialized();
    this._audit('TREASURY_GATING_POOL_INITIALIZED', info);
  }

  /**
   * Emit a ZK proposal claim verified event into the audit pipeline.
   * @param {object} info
   */
  emitZkProposalClaimVerified(info = {}) {
    this._ensureInitialized();
    this._audit('ZK_PROPOSAL_CLAIM_VERIFIED', info);
  }

  /**
   * Emit a voter accreditation completed event into the audit pipeline.
   * @param {object} info
   */
  emitVoterAccreditationCompleted(info = {}) {
    this._ensureInitialized();
    this._audit('VOTER_ACCREDITATION_COMPLETED', info);
  }

  // ── Track 85 PQ telecom routing gating telemetry hooks ──────────────

  /**
   * Emit a telecom routing pool initialized event into the audit pipeline.
   * @param {object} info
   */
  emitTelecomRoutingPoolInitialized(info = {}) {
    this._ensureInitialized();
    this._audit('TELECOM_ROUTING_POOL_INITIALIZED', info);
  }

  /**
   * Emit a ZK bandwidth claim verified event into the audit pipeline.
   * @param {object} info
   */
  emitZkBandwidthClaimVerified(info = {}) {
    this._ensureInitialized();
    this._audit('ZK_BANDWIDTH_CLAIM_VERIFIED', info);
  }

  /**
   * Emit a routing accreditation completed event into the audit pipeline.
   * @param {object} info
   */
  emitRoutingAccreditationCompleted(info = {}) {
    this._ensureInitialized();
    this._audit('ROUTING_ACCREDITATION_COMPLETED', info);
  }

  // ── Track 86 PQ health insurance claim auditing gating telemetry hooks ──

  /**
   * Emit an insurance gating pool initialized event into the audit pipeline.
   * @param {object} info
   */
  emitInsuranceGatingPoolInitialized(info = {}) {
    this._ensureInitialized();
    this._audit('INSURANCE_GATING_POOL_INITIALIZED', info);
  }

  /**
   * Emit a ZK claim audit verified event into the audit pipeline.
   * @param {object} info
   */
  emitZkClaimAuditVerified(info = {}) {
    this._ensureInitialized();
    this._audit('ZK_CLAIM_AUDIT_VERIFIED', info);
  }

  /**
   * Emit an actuarial accreditation completed event into the audit pipeline.
   * @param {object} info
   */
  emitActuarialAccreditationCompleted(info = {}) {
    this._ensureInitialized();
    this._audit('ACTUARIAL_ACCREDITATION_COMPLETED', info);
  }

  // ── Track 87 PQ space-asset telemetry gating telemetry hooks ─────────

  /**
   * Emit an orbital gating pool initialized event into the audit pipeline.
   * @param {object} info
   */
  emitOrbitalGatingPoolInitialized(info = {}) {
    this._ensureInitialized();
    this._audit('ORBITAL_GATING_POOL_INITIALIZED', info);
  }

  /**
   * Emit a ZK telemetry claim verified event into the audit pipeline.
   * @param {object} info
   */
  emitZkTelemetryClaimVerified(info = {}) {
    this._ensureInitialized();
    this._audit('ZK_TELEMETRY_CLAIM_VERIFIED', info);
  }

  /**
   * Emit an orbital accreditation completed event into the audit pipeline.
   * @param {object} info
   */
  emitOrbitalAccreditationCompleted(info = {}) {
    this._ensureInitialized();
    this._audit('ORBITAL_ACCREDITATION_COMPLETED', info);
  }

  // ── Track 88 PQ water rights allocation gating telemetry hooks ───────

  /**
   * Emit a water gating pool initialized event into the audit pipeline.
   * @param {object} info
   */
  emitWaterGatingPoolInitialized(info = {}) {
    this._ensureInitialized();
    this._audit('WATER_GATING_POOL_INITIALIZED', info);
  }

  /**
   * Emit a ZK water claim verified event into the audit pipeline.
   * @param {object} info
   */
  emitZkWaterClaimVerified(info = {}) {
    this._ensureInitialized();
    this._audit('ZK_WATER_CLAIM_VERIFIED', info);
  }

  /**
   * Emit a watershed accreditation completed event into the audit pipeline.
   * @param {object} info
   */
  emitWatershedAccreditationCompleted(info = {}) {
    this._ensureInitialized();
    this._audit('WATERSHED_ACCREDITATION_COMPLETED', info);
  }

  // ── Track 89 PQ nuclear safeguards monitoring gating telemetry hooks ─

  /**
   * Emit a nuclear gating pool initialized event into the audit pipeline.
   * @param {object} info
   */
  emitNuclearGatingPoolInitialized(info = {}) {
    this._ensureInitialized();
    this._audit('NUCLEAR_GATING_POOL_INITIALIZED', info);
  }

  /**
   * Emit a ZK safeguards claim verified event into the audit pipeline.
   * @param {object} info
   */
  emitZkSafeguardsClaimVerified(info = {}) {
    this._ensureInitialized();
    this._audit('ZK_SAFEGUARDS_CLAIM_VERIFIED', info);
  }

  /**
   * Emit a nuclear accreditation completed event into the audit pipeline.
   * @param {object} info
   */
  emitNuclearAccreditationCompleted(info = {}) {
    this._ensureInitialized();
    this._audit('NUCLEAR_ACCREDITATION_COMPLETED', info);
  }

  // ── Track 90 PQ wildlife conservation tracking gating telemetry hooks ─

  /**
   * Emit a wildlife gating pool initialized event into the audit pipeline.
   * @param {object} info
   */
  emitWildlifeGatingPoolInitialized(info = {}) {
    this._ensureInitialized();
    this._audit('WILDLIFE_GATING_POOL_INITIALIZED', info);
  }

  /**
   * Emit a ZK conservation claim verified event into the audit pipeline.
   * @param {object} info
   */
  emitZkConservationClaimVerified(info = {}) {
    this._ensureInitialized();
    this._audit('ZK_CONSERVATION_CLAIM_VERIFIED', info);
  }

  /**
   * Emit a biodiversity accreditation completed event into the audit pipeline.
   * @param {object} info
   */
  emitBiodiversityAccreditationCompleted(info = {}) {
    this._ensureInitialized();
    this._audit('BIODIVERSITY_ACCREDITATION_COMPLETED', info);
  }

  // ── Track 91 PQ smart-grid micro-transaction gating telemetry hooks ─

  /**
   * Emit a smart-grid gating pool initialized event into the audit pipeline.
   * @param {object} info
   */
  emitSmartGridGatingPoolInitialized(info = {}) {
    this._ensureInitialized();
    this._audit('SMARTGRID_GATING_POOL_INITIALIZED', info);
  }

  /**
   * Emit a ZK micro-transaction claim verified event into the audit pipeline.
   * @param {object} info
   */
  emitZkMicroTransactionClaimVerified(info = {}) {
    this._ensureInitialized();
    this._audit('ZK_MICRO_TRANSACTION_CLAIM_VERIFIED', info);
  }

  /**
   * Emit a load balance accreditation completed event into the audit pipeline.
   * @param {object} info
   */
  emitLoadBalanceAccreditationCompleted(info = {}) {
    this._ensureInitialized();
    this._audit('LOAD_BALANCE_ACCREDITATION_COMPLETED', info);
  }

  // ── Track 92 PQ global health epidemiological surveillance hooks ────

  /**
   * Emit an epidemiology gating pool initialized event into the audit pipeline.
   * @param {object} info
   */
  emitEpidemiologyGatingPoolInitialized(info = {}) {
    this._ensureInitialized();
    this._audit('EPIDEMIOLOGY_GATING_POOL_INITIALIZED', info);
  }

  /**
   * Emit a ZK epidemiological claim verified event into the audit pipeline.
   * @param {object} info
   */
  emitZkEpidemiologicalClaimVerified(info = {}) {
    this._ensureInitialized();
    this._audit('ZK_EPIDEMIOLOGICAL_CLAIM_VERIFIED', info);
  }

  /**
   * Emit an outbreak accreditation completed event into the audit pipeline.
   * @param {object} info
   */
  emitOutbreakAccreditationCompleted(info = {}) {
    this._ensureInitialized();
    this._audit('OUTBREAK_ACCREDITATION_COMPLETED', info);
  }

  // ── Track 93 PQ cultural heritage provenance gating telemetry hooks ─

  /**
   * Emit a heritage gating pool initialized event into the audit pipeline.
   * @param {object} info
   */
  emitHeritageGatingPoolInitialized(info = {}) {
    this._ensureInitialized();
    this._audit('HERITAGE_GATING_POOL_INITIALIZED', info);
  }

  /**
   * Emit a ZK authentication claim verified event into the audit pipeline.
   * @param {object} info
   */
  emitZkAuthenticationClaimVerified(info = {}) {
    this._ensureInitialized();
    this._audit('ZK_AUTHENTICATION_CLAIM_VERIFIED', info);
  }

  /**
   * Emit a provenance accreditation completed event into the audit pipeline.
   * @param {object} info
   */
  emitProvenanceAccreditationCompleted(info = {}) {
    this._ensureInitialized();
    this._audit('PROVENANCE_ACCREDITATION_COMPLETED', info);
  }

  // ── Track 94 PQ ocean fisheries allocation gating telemetry hooks ──

  /**
   * Emit a fisheries gating pool initialized event into the audit pipeline.
   * @param {object} info
   */
  emitFisheriesGatingPoolInitialized(info = {}) {
    this._ensureInitialized();
    this._audit('FISHERIES_GATING_POOL_INITIALIZED', info);
  }

  /**
   * Emit a ZK catch claim verified event into the audit pipeline.
   * @param {object} info
   */
  emitZkCatchClaimVerified(info = {}) {
    this._ensureInitialized();
    this._audit('ZK_CATCH_CLAIM_VERIFIED', info);
  }

  /**
   * Emit a quota accreditation completed event into the audit pipeline.
   * @param {object} info
   */
  emitQuotaAccreditationCompleted(info = {}) {
    this._ensureInitialized();
    this._audit('QUOTA_ACCREDITATION_COMPLETED', info);
  }

  // ── Track 95 PQ deep-sea mineral rights gating telemetry hooks ──

  /**
   * Emit a seabed gating pool initialized event into the audit pipeline.
   * @param {object} info
   */
  emitSeabedGatingPoolInitialized(info = {}) {
    this._ensureInitialized();
    this._audit('SEABED_GATING_POOL_INITIALIZED', info);
    try { require('./hsm-metrics.cjs').incrementCounter('hsm_seabed_gating_pool_initialized_total'); } catch { }
  }

  /**
   * Emit a ZK extraction claim verified event into the audit pipeline.
   * @param {object} info
   */
  emitZkExtractionClaimVerified(info = {}) {
    this._ensureInitialized();
    this._audit('ZK_EXTRACTION_CLAIM_VERIFIED', info);
    try { require('./hsm-metrics.cjs').incrementCounter('hsm_zk_extraction_claim_verified_total'); } catch { }
  }

  /**
   * Emit a lease accreditation completed event into the audit pipeline.
   * @param {object} info
   */
  emitLeaseAccreditationCompleted(info = {}) {
    this._ensureInitialized();
    this._audit('LEASE_ACCREDITATION_COMPLETED', info);
    try { require('./hsm-metrics.cjs').incrementCounter('hsm_lease_accreditation_completed_total'); } catch { }
  }

  // ── Track 96 PQ polar research data gating telemetry hooks ──

  /**
   * Emit a polar research pool initialized event into the audit pipeline.
   * @param {object} info
   */
  emitPolarResearchPoolInitialized(info = {}) {
    this._ensureInitialized();
    this._audit('POLAR_RESEARCH_POOL_INITIALIZED', info);
    try { require('./hsm-metrics.cjs').incrementCounter('hsm_polar_research_pool_initialized_total'); } catch { }
  }

  /**
   * Emit a ZK research claim verified event into the audit pipeline.
   * @param {object} info
   */
  emitZkResearchClaimVerified(info = {}) {
    this._ensureInitialized();
    this._audit('ZK_RESEARCH_CLAIM_VERIFIED', info);
    try { require('./hsm-metrics.cjs').incrementCounter('hsm_zk_research_claim_verified_total'); } catch { }
  }

  /**
   * Emit a data accreditation completed event into the audit pipeline.
   * @param {object} info
   */
  emitDataAccreditationCompleted(info = {}) {
    this._ensureInitialized();
    this._audit('DATA_ACCREDITATION_COMPLETED', info);
    try { require('./hsm-metrics.cjs').incrementCounter('hsm_data_accreditation_completed_total'); } catch { }
  }

  // ── Track 97 stratospheric aerosol monitoring gating telemetry hooks ──

  /**
   * Emit a stratospheric monitoring pool initialized event into the audit pipeline.
   * @param {object} info
   */
  emitStratosphericMonitoringPoolInitialized(info = {}) {
    this._ensureInitialized();
    this._audit('STRATOSPHERIC_MONITORING_POOL_INITIALIZED', info);
    try { require('./hsm-metrics.cjs').incrementCounter('hsm_strato_pool_initialized_total'); } catch { }
  }

  /**
   * Emit a ZK aerosol claim verified event into the audit pipeline.
   * @param {object} info
   */
  emitZkAerosolClaimVerified(info = {}) {
    this._ensureInitialized();
    this._audit('ZK_AEROSOL_CLAIM_VERIFIED', info);
    try { require('./hsm-metrics.cjs').incrementCounter('hsm_zk_aerosol_claim_verified_total'); } catch { }
  }

  /**
   * Emit a deployment accreditation completed event into the audit pipeline.
   * @param {object} info
   */
  emitDeploymentAccreditationCompleted(info = {}) {
    this._ensureInitialized();
    this._audit('DEPLOYMENT_ACCREDITATION_COMPLETED', info);
    try { require('./hsm-metrics.cjs').incrementCounter('hsm_deployment_accreditation_completed_total'); } catch { }
  }

  // ── Track 98 orbital debris tracking gating telemetry hooks ────────

  /**
   * Emit an orbital debris pool initialized event into the audit pipeline.
   * @param {object} info
   */
  emitOrbitalDebrisPoolInitialized(info = {}) {
    this._ensureInitialized();
    this._audit('ORBITAL_DEBRIS_POOL_INITIALIZED', info);
    try { require('./hsm-metrics.cjs').incrementCounter('hsm_orbigo_pool_initialized_total'); } catch { }
  }

  /**
   * Emit a ZK debris claim verified event into the audit pipeline.
   * @param {object} info
   */
  emitZkDebrisClaimVerified(info = {}) {
    this._ensureInitialized();
    this._audit('ZK_DEBRIS_CLAIM_VERIFIED', info);
    try { require('./hsm-metrics.cjs').incrementCounter('hsm_zk_debris_claim_verified_total'); } catch { }
  }

  /**
   * Emit a collision accreditation completed event into the audit pipeline.
   * @param {object} info
   */
  emitCollisionAccreditationCompleted(info = {}) {
    this._ensureInitialized();
    this._audit('COLLISION_ACCREDITATION_COMPLETED', info);
    try { require('./hsm-metrics.cjs').incrementCounter('hsm_collision_accreditation_completed_total'); } catch { }
  }

  // ── Track 99 genomic privacy compliance gating telemetry hooks ────

  /**
   * Emit a genomic compliance pool initialized event into the audit pipeline.
   * @param {object} info
   */
  emitGenomicCompliancePoolInitialized(info = {}) {
    this._ensureInitialized();
    this._audit('GENOMIC_COMPLIANCE_POOL_INITIALIZED', info);
    try { require('./hsm-metrics.cjs').incrementCounter('hsm_genogo_pool_initialized_total'); } catch { }
  }

  /**
   * Emit a ZK genomic claim verified event into the audit pipeline.
   * @param {object} info
   */
  emitZkGenomicClaimVerified(info = {}) {
    this._ensureInitialized();
    this._audit('ZK_GENOMIC_CLAIM_VERIFIED', info);
    try { require('./hsm-metrics.cjs').incrementCounter('hsm_zk_genomic_claim_verified_total'); } catch { }
  }

  /**
   * Emit a consent accreditation completed event into the audit pipeline.
   * @param {object} info
   */
  emitConsentAccreditationCompleted(info = {}) {
    this._ensureInitialized();
    this._audit('CONSENT_ACCREDITATION_COMPLETED', info);
    try { require('./hsm-metrics.cjs').incrementCounter('hsm_consent_accreditation_completed_total'); } catch { }
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
  registerConsensusCoordinator,
  getConsensusCoordinator,
  registerHardwareEnclaveAdapter,
  getHardwareEnclaveAdapter,
  registerEnclaveRescaler,
  getEnclaveRescaler,
  registerHeMeshTopology,
  getHeMeshTopology,
  registerSecureInnerProductSearch,
  getSecureInnerProductSearch,
  registerZkRangeProofSolvency,
  getZkRangeProofSolvency,
  registerThresholdDecryptionCircuit,
  getThresholdDecryptionCircuit,
  registerVssPssEngine,
  getVssPssEngine,
  registerOramEngine,
  getOramEngine,
  registerZkSnarkVerifierEngine,
  getZkSnarkVerifierEngine,
  registerMultiKeyFheRelinearizationEngine,
  getMultiKeyFheRelinearizationEngine,
  registerVdfTimeLockEngine,
  getVdfTimeLockEngine,
  registerMixnetBlindTransactionEngine,
  getMixnetBlindTransactionEngine,
  registerRecursiveProofAggregationEngine,
  getRecursiveProofAggregationEngine,
};
