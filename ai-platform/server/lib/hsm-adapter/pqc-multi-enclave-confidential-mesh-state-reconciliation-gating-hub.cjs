'use strict';

/**
 * Track 115: PQC Multi-Enclave Confidential Mesh State-Reconciliation Gating Hub.
 *
 * Multi-enclave confidential mesh state-reconciliation gate that instantiates
 * mesh pools using blinded commitments for state reconciliation digests,
 * epoch finality, and MPC secret shares. Enforces maxEpochFinalityWindowSeconds,
 * maxReconciliationChainDepth, and minMeshQuorum boundaries.
 *
 * @module hsm-adapter/pqc-multi-enclave-confidential-mesh-state-reconciliation-gating-hub
 */

const crypto = require('crypto');
const { HsmAdapterError } = require('./base-adapter.cjs');
const hsmMetrics = require('./hsm-metrics.cjs');

class PqcMultiEnclaveConfidentialMeshStateReconciliationGatingHub {
  constructor(options = {}) {
    this.policy = options.policy || {};
    this._attestationClient = options.attestationClient || null;
    this._audit = options.audit || null;
    this._pools = new Map();
  }

  initializePool(request) {
    _validateInitRequest(this.policy, request);
    if (typeof request.pqcSignatureScheme === 'string' && !this.policy.allowedPqcSignatureSchemes.includes(request.pqcSignatureScheme)) {
      throw new HsmAdapterError('MESHGATE_PQC_SCHEME_BLOCKED', `PQC signature scheme ${request.pqcSignatureScheme} is not permitted; allowed: ${this.policy.allowedPqcSignatureSchemes.join(', ')}`);
    }
    if (typeof request.epochFinalityWindowSeconds === 'number' && request.epochFinalityWindowSeconds > (this.policy.maxEpochFinalityWindowSeconds || 10)) {
      throw new HsmAdapterError('MESHGATE_EPOCH_FINALITY_WINDOW_EXCEEDED', `epoch finality window ${request.epochFinalityWindowSeconds} exceeds maximum ${this.policy.maxEpochFinalityWindowSeconds}`);
    }
    if (typeof request.reconciliationChainDepth === 'number' && request.reconciliationChainDepth > (this.policy.maxReconciliationChainDepth || 100)) {
      throw new HsmAdapterError('MESHGATE_RECONCILIATION_CHAIN_DEPTH_EXCEEDED', `reconciliation chain depth ${request.reconciliationChainDepth} exceeds maximum ${this.policy.maxReconciliationChainDepth}`);
    }
    if (typeof request.attestationAuthority === 'string' && !this.policy.allowedAttestationAuthorities.includes(request.attestationAuthority)) {
      throw new HsmAdapterError('MESHGATE_ATTESTATION_AUTHORITY_BLOCKED', `attestation authority ${request.attestationAuthority} is not allowed`);
    }
    const poolId = request.poolId || `pool-${crypto.randomBytes(4).toString('hex')}`;
    if (this._pools.has(poolId)) {
      throw new HsmAdapterError('MESHGATE_DUPLICATE', `pool ${poolId} already exists`);
    }
    const now = Math.floor(Date.now() / 1000);
    const pool = {
      poolId,
      blindedConfidentialStateReconciliationDigestCommitment: request.blindedConfidentialStateReconciliationDigestCommitment,
      blindedEpochFinalityCommitment: request.blindedEpochFinalityCommitment,
      blindedMpcSecretShareCommitment: request.blindedMpcSecretShareCommitment,
      pqcSignatureScheme: request.pqcSignatureScheme,
      attestationAuthority: request.attestationAuthority,
      meshQuorum: request.meshQuorum,
      epochFinalityWindowSeconds: request.epochFinalityWindowSeconds,
      reconciliationChainDepth: request.reconciliationChainDepth,
      initializedAt: now,
      status: 'open',
      meshStateReconciled: false,
      epochFinalityCompletedAt: null,
    };
    this._pools.set(poolId, pool);
    hsmMetrics.incrementCounter('hsm_meshgate_pool_initialized_total', 1);
    if (this._audit) {
      this._audit('MESHGATE_POOL_INITIALIZED', { ...pool });
    }
    return pool;
  }

  getPool(poolId) {
    return this._pools.get(poolId) || null;
  }

  reconcileMeshState(request) {
    if (!request || !request.poolId) {
      throw new HsmAdapterError('MESHGATE_FIELDS_MISSING', 'poolId is required');
    }
    const pool = this._pools.get(request.poolId);
    if (!pool) {
      throw new HsmAdapterError('MESHGATE_NOT_FOUND', `pool ${request.poolId} not found`);
    }
    if (request.proofValid === false) {
      throw new HsmAdapterError('MESHGATE_PROOF_INVALID', `mesh reconciliation proof invalid for pool ${request.poolId}`);
    }
    pool.meshStateReconciled = true;
    hsmMetrics.incrementCounter('hsm_zk_mesh_state_reconciled_total', 1);
    const result = {
      poolId: request.poolId,
      meshStateReconciled: true,
      reconciledAt: Math.floor(Date.now() / 1000),
    };
    if (this._audit) {
      this._audit('MESH_STATE_RECONCILED', { ...result });
    }
    return result;
  }

  completeEpochFinality(request) {
    if (!request || !request.poolId) {
      throw new HsmAdapterError('MESHGATE_FIELDS_MISSING', 'poolId is required');
    }
    const pool = this._pools.get(request.poolId);
    if (!pool) {
      throw new HsmAdapterError('MESHGATE_NOT_FOUND', `pool ${request.poolId} not found`);
    }
    if (!pool.meshStateReconciled) {
      throw new HsmAdapterError('MESHGATE_MESH_STATE_NOT_RECONCILED', `pool ${request.poolId} mesh state not reconciled`);
    }
    const signatures = request.meshSignatures || [];
    const minQuorum = this.policy.minMeshQuorum || 50;
    if (signatures.length < minQuorum) {
      throw new HsmAdapterError('MESHGATE_QUORUM_INSUFFICIENT', `mesh quorum signatures ${signatures.length} below minimum ${minQuorum}`);
    }
    const now = Math.floor(Date.now() / 1000);
    pool.status = 'finalized';
    pool.epochFinalityCompletedAt = now;
    hsmMetrics.incrementCounter('hsm_epoch_finality_completed_total', 1);
    const result = {
      poolId: request.poolId,
      status: 'finalized',
      signatureCount: signatures.length,
      completedAt: now,
    };
    if (this._audit) {
      this._audit('EPOCH_FINALITY_COMPLETED', { ...result });
    }
    return result;
  }

  getPoolCount() {
    return this._pools.size;
  }
}

function _validateInitRequest(policy, request) {
  if (!request.blindedConfidentialStateReconciliationDigestCommitment) {
    throw new HsmAdapterError('MESHGATE_FIELDS_MISSING', 'blindedConfidentialStateReconciliationDigestCommitment is required');
  }
  if (!request.blindedEpochFinalityCommitment) {
    throw new HsmAdapterError('MESHGATE_FIELDS_MISSING', 'blindedEpochFinalityCommitment is required');
  }
}

module.exports = { PqcMultiEnclaveConfidentialMeshStateReconciliationGatingHub };
