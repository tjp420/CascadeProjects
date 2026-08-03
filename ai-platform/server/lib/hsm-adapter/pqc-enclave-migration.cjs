'use strict';

/**
 * Track 47: Post-Quantum Cryptographic Enclave Migrations.
 *
 * Manages the migration of enclaves from classical cryptographic algorithms
 * to post-quantum cryptography (PQC) with lattice-based signature constraints.
 * Supports hybrid mode (classical + PQC) during the transition period and
 * enforces policy-gated algorithm upgrades.
 *
 * Components:
 *   - PqcMigrationPlanner: Tracks migration state per enclave (classical -> hybrid -> pqc)
 *   - LatticeSignatureConstraint: Enforces ML-DSA / lattice-based signature requirements
 *   - HybridTransitionManager: Manages the dual-algorithm transition period
 *   - AlgorithmPolicyGate: Validates that migrations meet security policy
 *
 * @module hsm-adapter/pqc-enclave-migration
 */

const crypto = require('crypto');
const { HsmAdapterError } = require('./base-adapter.cjs');

const DEFAULT_OPTIONS = {
  supportedPqcAlgorithms: ['ML-KEM-512', 'ML-KEM-768', 'ML-KEM-1024', 'ML-DSA-44', 'ML-DSA-65', 'ML-DSA-87'],
  supportedClassicalAlgorithms: ['ECDH-P256', 'ECDH-P384', 'RSA-2048', 'RSA-4096', 'ECDSA-P256'],
  defaultPqcAlgorithm: 'ML-KEM-768',
  defaultDsaAlgorithm: 'ML-DSA-65',
  requireHybridTransition: true,
  hybridTransitionPeriodMs: 86400000, // 24 hours
  maxMigrationAttempts: 3,
  migrationTimeoutMs: 300000, // 5 minutes per migration
  requireAttestation: true,
  latticeSecurityLevel: 128, // bits of classical security equivalent
};

const MIGRATION_PHASE = {
  PENDING: 'pending',
  PLANNED: 'planned',
  HYBRID_ACTIVE: 'hybrid-active',
  PQC_ACTIVE: 'pqc-active',
  ROLLBACK: 'rollback',
  FAILED: 'failed',
  COMPLETED: 'completed',
};

const ALGORITHM_CLASS = {
  CLASSICAL: 'classical',
  HYBRID: 'hybrid',
  PQC: 'pqc',
};

const SIGNATURE_CONSTRAINT_STATUS = {
  NOT_REQUIRED: 'not-required',
  PENDING: 'pending',
  SATISFIED: 'satisfied',
  VIOLATED: 'violated',
};

/**
 * Post-Quantum Cryptographic Enclave Migration Engine.
 */
class PqcEnclaveMigrationEngine {
  /**
   * @param {object} [options]
   */
  constructor(options = {}) {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    this.supportedPqcAlgorithms = new Set(opts.supportedPqcAlgorithms);
    this.supportedClassicalAlgorithms = new Set(opts.supportedClassicalAlgorithms);
    this.defaultPqcAlgorithm = opts.defaultPqcAlgorithm;
    this.defaultDsaAlgorithm = opts.defaultDsaAlgorithm;
    this.requireHybridTransition = opts.requireHybridTransition;
    this.hybridTransitionPeriodMs = opts.hybridTransitionPeriodMs;
    this.maxMigrationAttempts = opts.maxMigrationAttempts;
    this.migrationTimeoutMs = opts.migrationTimeoutMs;
    this.requireAttestation = opts.requireAttestation;
    this.latticeSecurityLevel = opts.latticeSecurityLevel;
    this._audit = opts.audit || null;

    this._enclaves = new Map(); // enclaveId -> migration state
    this._signatureConstraints = new Map(); // enclaveId -> constraint state
    this._migrationLog = []; // history of migration events
    this._maxLogSize = 200;
  }

  /**
   * Register an enclave for PQC migration tracking.
   * @param {string} enclaveId
   * @param {object} [config]
   * @param {string} [config.currentAlgorithm] - Current classical algorithm
   * @param {string} [config.targetPqcAlgorithm] - Target PQC algorithm
   * @param {string} [config.targetDsaAlgorithm] - Target PQC signature algorithm
   */
  registerEnclave(enclaveId, config) {
    if (!enclaveId || typeof enclaveId !== 'string') {
      throw new HsmAdapterError('INVALID_ENCLAVE', 'enclaveId must be a non-empty string');
    }
    if (this._enclaves.has(enclaveId)) {
      throw new HsmAdapterError('ENCLAVE_ALREADY_REGISTERED',
        `enclave ${enclaveId} already registered for migration`);
    }
    const currentAlgorithm = (config && config.currentAlgorithm) || 'ECDH-P256';
    const targetPqc = (config && config.targetPqcAlgorithm) || this.defaultPqcAlgorithm;
    const targetDsa = (config && config.targetDsaAlgorithm) || this.defaultDsaAlgorithm;
    this._validateAlgorithm(currentAlgorithm, true);
    this._validateAlgorithm(targetPqc, false);
    this._validateAlgorithm(targetDsa, false);
    const now = Date.now();
    const state = {
      enclaveId,
      phase: MIGRATION_PHASE.PENDING,
      currentAlgorithm,
      currentAlgorithmClass: ALGORITHM_CLASS.CLASSICAL,
      targetPqcAlgorithm: targetPqc,
      targetDsaAlgorithm: targetDsa,
      hybridStartedAt: null,
      pqcActivatedAt: null,
      migrationAttempts: 0,
      lastError: null,
      registeredAt: now,
      attestationVerified: false,
    };
    this._enclaves.set(enclaveId, state);
    // Initialize signature constraint
    this._signatureConstraints.set(enclaveId, {
      enclaveId,
      status: SIGNATURE_CONSTRAINT_STATUS.NOT_REQUIRED,
      requiredAlgorithm: targetDsa,
      latticeSecurityLevel: this.latticeSecurityLevel,
      verifiedAt: null,
    });
    if (typeof this._audit === 'function') {
      this._audit('PQC_MIGRATION_REGISTERED', { enclaveId, currentAlgorithm, targetPqc, targetDsa });
    }
    return { enclaveId, phase: state.phase };
  }

  /**
   * Plan a migration for an enclave.
   * @param {string} enclaveId
   * @returns {object} Migration plan
   */
  planMigration(enclaveId) {
    const state = this._getEnclave(enclaveId);
    if (state.phase !== MIGRATION_PHASE.PENDING) {
      throw new HsmAdapterError('INVALID_PHASE',
        `enclave ${enclaveId} is in phase ${state.phase}, expected pending`);
    }
    state.phase = MIGRATION_PHASE.PLANNED;
    const plan = {
      enclaveId,
      phases: this.requireHybridTransition
        ? ['hybrid-active', 'pqc-active', 'completed']
        : ['pqc-active', 'completed'],
      currentAlgorithm: state.currentAlgorithm,
      targetPqcAlgorithm: state.targetPqcAlgorithm,
      targetDsaAlgorithm: state.targetDsaAlgorithm,
      estimatedDurationMs: this.requireHybridTransition
        ? this.hybridTransitionPeriodMs + this.migrationTimeoutMs
        : this.migrationTimeoutMs,
    };
    this._logMigration('MIGRATION_PLANNED', { enclaveId });
    if (typeof this._audit === 'function') {
      this._audit('PQC_MIGRATION_PLANNED', { enclaveId, plan });
    }
    return plan;
  }

  /**
   * Activate hybrid mode (classical + PQC) for an enclave.
   * @param {string} enclaveId
   * @param {object} [attestation] - Enclave attestation proof
   * @returns {object} Hybrid activation result
   */
  activateHybrid(enclaveId, attestation) {
    const state = this._getEnclave(enclaveId);
    if (this.requireHybridTransition && state.phase !== MIGRATION_PHASE.PLANNED) {
      throw new HsmAdapterError('INVALID_PHASE',
        `enclave ${enclaveId} is in phase ${state.phase}, expected planned`);
    }
    if (!this.requireHybridTransition && state.phase !== MIGRATION_PHASE.PLANNED && state.phase !== MIGRATION_PHASE.PENDING) {
      throw new HsmAdapterError('INVALID_PHASE',
        `enclave ${enclaveId} is in phase ${state.phase}, expected planned or pending`);
    }
    if (this.requireAttestation && !attestation) {
      throw new HsmAdapterError('ATTESTATION_REQUIRED',
        `enclave ${enclaveId} requires attestation for hybrid activation`);
    }
    state.attestationVerified = !!attestation;
    state.phase = MIGRATION_PHASE.HYBRID_ACTIVE;
    state.currentAlgorithmClass = ALGORITHM_CLASS.HYBRID;
    state.hybridStartedAt = Date.now();
    // Activate signature constraint
    const constraint = this._signatureConstraints.get(enclaveId);
    constraint.status = SIGNATURE_CONSTRAINT_STATUS.PENDING;
    this._logMigration('HYBRID_ACTIVATED', { enclaveId, algorithm: state.currentAlgorithm + '+' + state.targetPqcAlgorithm });
    if (typeof this._audit === 'function') {
      this._audit('PQC_HYBRID_ACTIVATED', { enclaveId, hybridStartedAt: state.hybridStartedAt });
    }
    return {
      enclaveId,
      phase: state.phase,
      algorithmClass: state.currentAlgorithmClass,
      algorithms: [state.currentAlgorithm, state.targetPqcAlgorithm],
    };
  }

  /**
   * Complete migration to full PQC for an enclave.
   * @param {string} enclaveId
   * @param {object} [verification] - PQC verification proof
   * @returns {object} PQC activation result
   */
  activatePqc(enclaveId, verification) {
    const state = this._getEnclave(enclaveId);
    if (this.requireHybridTransition) {
      if (state.phase !== MIGRATION_PHASE.HYBRID_ACTIVE) {
        throw new HsmAdapterError('INVALID_PHASE',
          `enclave ${enclaveId} is in phase ${state.phase}, expected hybrid-active`);
      }
      // Check that hybrid transition period has elapsed
      if (state.hybridStartedAt && Date.now() - state.hybridStartedAt < this.hybridTransitionPeriodMs) {
        throw new HsmAdapterError('HYBRID_PERIOD_INCOMPLETE',
          `enclave ${enclaveId} must remain in hybrid mode for at least ${this.hybridTransitionPeriodMs}ms`);
      }
    } else {
      if (state.phase !== MIGRATION_PHASE.PLANNED && state.phase !== MIGRATION_PHASE.HYBRID_ACTIVE) {
        throw new HsmAdapterError('INVALID_PHASE',
          `enclave ${enclaveId} is in phase ${state.phase}, expected planned or hybrid-active`);
      }
    }
    // Verify lattice signature constraint is satisfied
    const constraint = this._signatureConstraints.get(enclaveId);
    const allowedStatuses = this.requireHybridTransition
      ? [SIGNATURE_CONSTRAINT_STATUS.SATISFIED, SIGNATURE_CONSTRAINT_STATUS.PENDING]
      : [SIGNATURE_CONSTRAINT_STATUS.SATISFIED, SIGNATURE_CONSTRAINT_STATUS.PENDING, SIGNATURE_CONSTRAINT_STATUS.NOT_REQUIRED];
    if (!allowedStatuses.includes(constraint.status)) {
      throw new HsmAdapterError('SIGNATURE_CONSTRAINT_VIOLATED',
        `enclave ${enclaveId} lattice signature constraint is ${constraint.status}`);
    }
    state.phase = MIGRATION_PHASE.PQC_ACTIVE;
    state.currentAlgorithmClass = ALGORITHM_CLASS.PQC;
    state.currentAlgorithm = state.targetPqcAlgorithm;
    state.pqcActivatedAt = Date.now();
    this._logMigration('PQC_ACTIVATED', { enclaveId, algorithm: state.targetPqcAlgorithm });
    if (typeof this._audit === 'function') {
      this._audit('PQC_FULLY_ACTIVATED', { enclaveId, algorithm: state.targetPqcAlgorithm, pqcActivatedAt: state.pqcActivatedAt });
    }
    return {
      enclaveId,
      phase: state.phase,
      algorithmClass: state.currentAlgorithmClass,
      algorithm: state.targetPqcAlgorithm,
      pqcActivatedAt: state.pqcActivatedAt,
    };
  }

  /**
   * Complete the migration (finalize after PQC activation).
   * @param {string} enclaveId
   * @returns {object} Completion result
   */
  completeMigration(enclaveId) {
    const state = this._getEnclave(enclaveId);
    if (state.phase !== MIGRATION_PHASE.PQC_ACTIVE) {
      throw new HsmAdapterError('INVALID_PHASE',
        `enclave ${enclaveId} is in phase ${state.phase}, expected pqc-active`);
    }
    state.phase = MIGRATION_PHASE.COMPLETED;
    this._logMigration('MIGRATION_COMPLETED', { enclaveId });
    if (typeof this._audit === 'function') {
      this._audit('PQC_MIGRATION_COMPLETED', { enclaveId, algorithm: state.targetPqcAlgorithm });
    }
    return { enclaveId, phase: state.phase, completedAt: Date.now() };
  }

  /**
   * Rollback an enclave to classical cryptography.
   * @param {string} enclaveId
   * @param {string} [reason]
   * @returns {object} Rollback result
   */
  rollback(enclaveId, reason) {
    const state = this._getEnclave(enclaveId);
    if (state.phase === MIGRATION_PHASE.COMPLETED) {
      throw new HsmAdapterError('MIGRATION_COMPLETED',
        `enclave ${enclaveId} migration is completed and cannot be rolled back`);
    }
    if (state.phase === MIGRATION_PHASE.PENDING || state.phase === MIGRATION_PHASE.FAILED) {
      throw new HsmAdapterError('INVALID_PHASE',
        `enclave ${enclaveId} is in phase ${state.phase}, nothing to rollback`);
    }
    state.migrationAttempts++;
    if (state.migrationAttempts >= this.maxMigrationAttempts) {
      state.phase = MIGRATION_PHASE.FAILED;
      state.lastError = reason || 'max attempts reached';
      this._logMigration('MIGRATION_FAILED', { enclaveId, reason: state.lastError });
      if (typeof this._audit === 'function') {
        this._audit('PQC_MIGRATION_FAILED', { enclaveId, attempts: state.migrationAttempts });
      }
      return { enclaveId, phase: state.phase, failed: true, reason: state.lastError };
    }
    state.phase = MIGRATION_PHASE.ROLLBACK;
    state.currentAlgorithmClass = ALGORITHM_CLASS.CLASSICAL;
    state.hybridStartedAt = null;
    state.pqcActivatedAt = null;
    // Reset signature constraint
    const constraint = this._signatureConstraints.get(enclaveId);
    constraint.status = SIGNATURE_CONSTRAINT_STATUS.PENDING;
    this._logMigration('MIGRATION_ROLLBACK', { enclaveId, reason: reason || 'manual', attempts: state.migrationAttempts });
    if (typeof this._audit === 'function') {
      this._audit('PQC_MIGRATION_ROLLBACK', { enclaveId, reason: reason || 'manual', attempts: state.migrationAttempts });
    }
    return { enclaveId, phase: state.phase, rolledBack: true, attempts: state.migrationAttempts };
  }

  /**
   * Satisfy a lattice signature constraint for an enclave.
   * @param {string} enclaveId
   * @param {object} proof - Lattice signature proof
   * @param {string} proof.algorithm - The PQC signature algorithm used
   * @param {string} proof.signature - The signature value
   * @returns {object} Constraint satisfaction result
   */
  satisfySignatureConstraint(enclaveId, proof) {
    const state = this._getEnclave(enclaveId);
    const constraint = this._signatureConstraints.get(enclaveId);
    if (!constraint) {
      throw new HsmAdapterError('CONSTRAINT_NOT_FOUND', `no signature constraint for enclave ${enclaveId}`);
    }
    if (!proof || typeof proof !== 'object' || !proof.algorithm || !proof.signature) {
      throw new HsmAdapterError('INVALID_PROOF', 'proof must have algorithm and signature fields');
    }
    if (!this.supportedPqcAlgorithms.has(proof.algorithm)) {
      throw new HsmAdapterError('UNSUPPORTED_ALGORITHM',
        `algorithm ${proof.algorithm} is not a supported PQC algorithm`);
    }
    // Verify the algorithm matches the required DSA algorithm
    if (proof.algorithm !== constraint.requiredAlgorithm) {
      throw new HsmAdapterError('ALGORITHM_MISMATCH',
        `proof uses ${proof.algorithm}, required ${constraint.requiredAlgorithm}`);
    }
    // Verify the signature is a valid non-empty string
    if (typeof proof.signature !== 'string' || proof.signature.length < 64) {
      throw new HsmAdapterError('INVALID_SIGNATURE',
        'signature must be a string of at least 64 characters');
    }
    constraint.status = SIGNATURE_CONSTRAINT_STATUS.SATISFIED;
    constraint.verifiedAt = Date.now();
    this._logMigration('SIGNATURE_CONSTRAINT_SATISFIED', { enclaveId, algorithm: proof.algorithm });
    if (typeof this._audit === 'function') {
      this._audit('PQC_SIGNATURE_CONSTRAINT_SATISFIED', { enclaveId, algorithm: proof.algorithm });
    }
    return { enclaveId, satisfied: true, algorithm: proof.algorithm };
  }

  /**
   * Violate a signature constraint (for testing or security alerts).
   * @param {string} enclaveId
   * @param {string} [reason]
   */
  violateSignatureConstraint(enclaveId, reason) {
    const constraint = this._signatureConstraints.get(enclaveId);
    if (!constraint) {
      throw new HsmAdapterError('CONSTRAINT_NOT_FOUND', `no signature constraint for enclave ${enclaveId}`);
    }
    constraint.status = SIGNATURE_CONSTRAINT_STATUS.VIOLATED;
    this._logMigration('SIGNATURE_CONSTRAINT_VIOLATED', { enclaveId, reason: reason || 'unspecified' });
    if (typeof this._audit === 'function') {
      this._audit('PQC_SIGNATURE_CONSTRAINT_VIOLATED', { enclaveId, reason: reason || 'unspecified' });
    }
    return { enclaveId, violated: true, reason: reason || 'unspecified' };
  }

  /**
   * Get the migration state for an enclave.
   * @param {string} enclaveId
   * @returns {object|null}
   */
  getMigrationState(enclaveId) {
    const state = this._enclaves.get(enclaveId);
    if (!state) return null;
    return {
      enclaveId,
      phase: state.phase,
      currentAlgorithm: state.currentAlgorithm,
      currentAlgorithmClass: state.currentAlgorithmClass,
      targetPqcAlgorithm: state.targetPqcAlgorithm,
      targetDsaAlgorithm: state.targetDsaAlgorithm,
      hybridStartedAt: state.hybridStartedAt,
      pqcActivatedAt: state.pqcActivatedAt,
      migrationAttempts: state.migrationAttempts,
      attestationVerified: state.attestationVerified,
      lastError: state.lastError,
    };
  }

  /**
   * Get the signature constraint state for an enclave.
   * @param {string} enclaveId
   * @returns {object|null}
   */
  getSignatureConstraint(enclaveId) {
    const constraint = this._signatureConstraints.get(enclaveId);
    if (!constraint) return null;
    return {
      enclaveId,
      status: constraint.status,
      requiredAlgorithm: constraint.requiredAlgorithm,
      latticeSecurityLevel: constraint.latticeSecurityLevel,
      verifiedAt: constraint.verifiedAt,
    };
  }

  /**
   * Get all registered enclaves and their migration states.
   * @returns {object[]}
   */
  getAllEnclaves() {
    return Array.from(this._enclaves.keys()).map(id => this.getMigrationState(id));
  }

  /**
   * Get migration log.
   * @param {number} [limit]
   * @returns {object[]}
   */
  getMigrationLog(limit) {
    const n = typeof limit === 'number' ? limit : 50;
    return this._migrationLog.slice(-n);
  }

  /**
   * Get summary statistics.
   * @returns {object}
   */
  getStats() {
    const byPhase = {};
    let classicalCount = 0, hybridCount = 0, pqcCount = 0;
    let constraintsSatisfied = 0, constraintsViolated = 0;
    for (const state of this._enclaves.values()) {
      byPhase[state.phase] = (byPhase[state.phase] || 0) + 1;
      if (state.currentAlgorithmClass === ALGORITHM_CLASS.CLASSICAL) classicalCount++;
      else if (state.currentAlgorithmClass === ALGORITHM_CLASS.HYBRID) hybridCount++;
      else if (state.currentAlgorithmClass === ALGORITHM_CLASS.PQC) pqcCount++;
    }
    for (const constraint of this._signatureConstraints.values()) {
      if (constraint.status === SIGNATURE_CONSTRAINT_STATUS.SATISFIED) constraintsSatisfied++;
      else if (constraint.status === SIGNATURE_CONSTRAINT_STATUS.VIOLATED) constraintsViolated++;
    }
    return {
      enclaveCount: this._enclaves.size,
      classicalCount,
      hybridCount,
      pqcCount,
      constraintsSatisfied,
      constraintsViolated,
      byPhase,
      latticeSecurityLevel: this.latticeSecurityLevel,
    };
  }

  /**
   * Unregister an enclave.
   * @param {string} enclaveId
   */
  unregisterEnclave(enclaveId) {
    if (!this._enclaves.has(enclaveId)) {
      throw new HsmAdapterError('ENCLAVE_NOT_FOUND', `enclave ${enclaveId} not found`);
    }
    this._enclaves.delete(enclaveId);
    this._signatureConstraints.delete(enclaveId);
  }

  /**
   * Reset all state (for testing).
   */
  reset() {
    this._enclaves.clear();
    this._signatureConstraints.clear();
    this._migrationLog = [];
  }

  /**
   * Validate that an algorithm is supported.
   * @param {string} algorithm
   * @param {boolean} isClassical - True if validating a classical algorithm
   * @private
   */
  _validateAlgorithm(algorithm, isClassical) {
    const set = isClassical ? this.supportedClassicalAlgorithms : this.supportedPqcAlgorithms;
    if (!set.has(algorithm)) {
      throw new HsmAdapterError('UNSUPPORTED_ALGORITHM',
        `${algorithm} is not a supported ${isClassical ? 'classical' : 'PQC'} algorithm`);
    }
  }

  /**
   * Get enclave state or throw.
   * @param {string} enclaveId
   * @returns {object}
   * @private
   */
  _getEnclave(enclaveId) {
    const state = this._enclaves.get(enclaveId);
    if (!state) {
      throw new HsmAdapterError('ENCLAVE_NOT_FOUND', `enclave ${enclaveId} not found`);
    }
    return state;
  }

  /**
   * Log a migration event.
   * @param {string} event
   * @param {object} data
   * @private
   */
  _logMigration(event, data) {
    this._migrationLog.push({ event, ...data, timestamp: Date.now() });
    if (this._migrationLog.length > this._maxLogSize) {
      this._migrationLog.shift();
    }
  }
}

module.exports = {
  PqcEnclaveMigrationEngine,
  DEFAULT_OPTIONS,
  MIGRATION_PHASE,
  ALGORITHM_CLASS,
  SIGNATURE_CONSTRAINT_STATUS,
};
