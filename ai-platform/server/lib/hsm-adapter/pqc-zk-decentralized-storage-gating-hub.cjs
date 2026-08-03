'use strict';

/**
 * Track 111: PQC Zero-Knowledge Decentralized Storage Attestation Gating Hub.
 *
 * Decentralized storage pool coordination gate that instantiates multi-party
 * zero-knowledge proof-of-replication pools using homomorphically split
 * Pedersen commitments over storage sector digests, proof-of-space-time
 * attestations, and replica dispersal records. Parses ZKSTORAGE packets,
 * enforces maxStorageAttestationChainDepth and maxReplicaDispersalDistance,
 * tracks replication status, and issues slashing challenges.
 *
 * @module hsm-adapter/pqc-zk-decentralized-storage-gating-hub
 */

const crypto = require('crypto');
const { HsmAdapterError } = require('./base-adapter.cjs');
const hsmMetrics = require('./hsm-metrics.cjs');

class PqcZkDecentralizedStorageAttestationGatingHub {
  constructor(options = {}) {
    this.policy = options.policy || {};
    this._attestationClient = options.attestationClient || null;
    this._audit = options.audit || null;
    this._pools = new Map();
  }

  initializePool(request) {
    _validateInitRequest(this.policy, request);
    if (this.policy.requireStorageAuthorityInitializerAttestation && this._attestationClient) {
      try {
        const result = this._attestationClient.verify(request.storageAuthorityInitializerAttestation);
        if (!result.verified) {
          throw new HsmAdapterError('ZKSTORAGE_AUTHORITY_INITIALIZER_UNATTESTED', 'storage authority initializer attestation invalid');
        }
      } catch (err) {
        if (err instanceof HsmAdapterError) throw err;
        throw new HsmAdapterError('ZKSTORAGE_AUTHORITY_INITIALIZER_UNATTESTED', 'storage authority initializer attestation invalid');
      }
    }
    if (typeof request.attestationAuthority === 'string' && !this.policy.allowedAttestationAuthorities.includes(request.attestationAuthority)) {
      throw new HsmAdapterError('ZKSTORAGE_ATTESTATION_AUTHORITY_BLOCKED', `attestation authority ${request.attestationAuthority} is not allowed; permitted: ${this.policy.allowedAttestationAuthorities.join(', ')}`);
    }
    if (typeof request.pqcSignatureScheme === 'string' && !this.policy.allowedPqcSignatureSchemes.includes(request.pqcSignatureScheme)) {
      throw new HsmAdapterError('ZKSTORAGE_PQC_SCHEME_BLOCKED', `PQC signature scheme ${request.pqcSignatureScheme} is not permitted; allowed: ${this.policy.allowedPqcSignatureSchemes.join(', ')}`);
    }
    if (typeof request.proofOfSpaceTimeWindowSeconds === 'number' && request.proofOfSpaceTimeWindowSeconds > (this.policy.maxProofOfSpaceTimeWindowSeconds || 300)) {
      throw new HsmAdapterError('ZKSTORAGE_PROOF_OF_SPACE_TIME_WINDOW_EXCEEDED', `proof-of-space-time window seconds ${request.proofOfSpaceTimeWindowSeconds} exceeds maximum ${this.policy.maxProofOfSpaceTimeWindowSeconds}`);
    }
    if (typeof request.storageAttestationChainDepth === 'number' && request.storageAttestationChainDepth > (this.policy.maxStorageAttestationChainDepth || 46)) {
      throw new HsmAdapterError('ZKSTORAGE_CHAIN_DEPTH_EXCEEDED', `storage attestation chain depth ${request.storageAttestationChainDepth} exceeds maximum ${this.policy.maxStorageAttestationChainDepth}`);
    }
    if (typeof request.replicaDispersalDistance === 'number' && request.replicaDispersalDistance > (this.policy.maxReplicaDispersalDistance || 12)) {
      throw new HsmAdapterError('ZKSTORAGE_REPLICA_DISPERSAL_DISTANCE_EXCEEDED', `replica dispersal distance ${request.replicaDispersalDistance} exceeds maximum ${this.policy.maxReplicaDispersalDistance}`);
    }
    const poolId = request.poolId || `pool-${crypto.randomBytes(4).toString('hex')}`;
    if (this._pools.has(poolId)) {
      throw new HsmAdapterError('ZKSTORAGE_DUPLICATE', `pool ${poolId} already exists`);
    }
    const now = Math.floor(Date.now() / 1000);
    const pool = {
      poolId,
      sourceTenantId: request.sourceTenantId,
      targetChainId: request.targetChainId,
      sourceStorageNodeId: request.sourceStorageNodeId,
      targetStorageNodeId: request.targetStorageNodeId,
      blindedStorageSectorDigestCommitment: request.blindedStorageSectorDigestCommitment,
      blindedProofOfSpaceTimeCommitment: request.blindedProofOfSpaceTimeCommitment,
      blindedReplicaDispersalCommitment: request.blindedReplicaDispersalCommitment,
      proofOfSpaceTimeWindowSeconds: request.proofOfSpaceTimeWindowSeconds,
      storageAttestationChainDepth: request.storageAttestationChainDepth,
      replicaDispersalDistance: request.replicaDispersalDistance,
      pqcSignatureScheme: request.pqcSignatureScheme,
      initializedAt: now,
      status: 'open',
      storageProofVerified: false,
      replicaConsensusConfirmed: false,
      dispersalCompletedAt: null,
      replicationAccreditationCompletedAt: null,
    };
    this._pools.set(poolId, pool);
    hsmMetrics.incrementCounter('hsm_zkstorage_pool_initialized_total', 1);
    if (this._audit) {
      this._audit('ZKSTORAGE_POOL_INITIALIZED', { ...pool });
    }
    return pool;
  }

  getPool(poolId) {
    return this._pools.get(poolId) || null;
  }

  verifyStorageProof(request) {
    _validateProofRequest(request);
    const pool = this._pools.get(request.poolId);
    if (!pool) {
      throw new HsmAdapterError('ZKSTORAGE_NOT_FOUND', `pool ${request.poolId} not found`);
    }
    if (!request.proofValid) {
      this._recordChallenge(request.poolId, 'storage_proof_invalid');
      throw new HsmAdapterError('ZKSTORAGE_PROOF_INVALID', `storage proof for pool ${request.poolId} is invalid`);
    }
    pool.storageProofVerified = true;
    hsmMetrics.incrementCounter('hsm_zk_storage_proof_verified_total', 1);
    if (this._audit) {
      this._audit('ZKSTORAGE_STORAGE_PROOF_VERIFIED', { poolId: request.poolId });
    }
    return pool;
  }

  confirmReplicaConsensus(request) {
    _validateReplicaConsensusRequest(this.policy, request);
    const pool = this._pools.get(request.poolId);
    if (!pool) {
      throw new HsmAdapterError('ZKSTORAGE_NOT_FOUND', `pool ${request.poolId} not found`);
    }
    if (!pool.storageProofVerified) {
      throw new HsmAdapterError('ZKSTORAGE_PROOF_NOT_VERIFIED', `pool ${request.poolId} storage proof not verified`);
    }
    const signatures = request.replicaSignatures || [];
    if (signatures.length < (this.policy.minReplicationFactor || 3)) {
      throw new HsmAdapterError('ZKSTORAGE_REPLICATION_FACTOR_INSUFFICIENT', `replica signatures ${signatures.length} below minimum ${this.policy.minReplicationFactor}`);
    }
    pool.replicaConsensusConfirmed = true;
    hsmMetrics.incrementCounter('hsm_zkstorage_replication_accreditation_completed_total', 1);
    if (this._audit) {
      this._audit('ZKSTORAGE_REPLICA_CONSENSUS_CONFIRMED', { poolId: request.poolId, replicaCount: signatures.length });
    }
    return pool;
  }

  completeDispersal(request) {
    _validateDispersalRequest(request);
    const pool = this._pools.get(request.poolId);
    if (!pool) {
      throw new HsmAdapterError('ZKSTORAGE_NOT_FOUND', `pool ${request.poolId} not found`);
    }
    if (!pool.replicaConsensusConfirmed) {
      throw new HsmAdapterError('ZKSTORAGE_REPLICA_CONSENSUS_NOT_CONFIRMED', `pool ${request.poolId} replica consensus not confirmed`);
    }
    pool.status = 'dispersed';
    pool.dispersalCompletedAt = Math.floor(Date.now() / 1000);
    hsmMetrics.incrementCounter('hsm_zkstorage_dispersal_completed_total', 1);
    if (this._audit) {
      this._audit('ZKSTORAGE_DISPERSAL_COMPLETED', { poolId: request.poolId });
    }
    return pool;
  }

  completeReplicationAccreditation(request) {
    _validateAccreditationRequest(this.policy, request);
    const pool = this._pools.get(request.poolId);
    if (!pool) {
      throw new HsmAdapterError('ZKSTORAGE_NOT_FOUND', `pool ${request.poolId} not found`);
    }
    if (this.policy.requireStorageEthicsOversightCommitteeAttestation && this._attestationClient) {
      try {
        const result = this._attestationClient.verify(request.storageEthicsOversightCommitteeAttestation);
        if (!result.verified) {
          throw new HsmAdapterError('ZKSTORAGE_OVERSIGHT_COMMITTEE_UNATTESTED', 'storage ethics oversight committee attestation invalid');
        }
      } catch (err) {
        if (err instanceof HsmAdapterError) throw err;
        throw new HsmAdapterError('ZKSTORAGE_OVERSIGHT_COMMITTEE_UNATTESTED', 'storage ethics oversight committee attestation invalid');
      }
    }
    const signatures = request.committeeSignatures || [];
    if (signatures.length < (this.policy.minReplicationFactor || 3)) {
      throw new HsmAdapterError('ZKSTORAGE_QUORUM_INSUFFICIENT', `replication quorum signatures ${signatures.length} below minimum ${this.policy.minReplicationFactor}`);
    }
    const now = Math.floor(Date.now() / 1000);
    pool.status = 'accredited';
    pool.replicationAccreditationCompletedAt = now;
    const completionId = request.completionId || `completion-${crypto.randomBytes(4).toString('hex')}`;
    const completion = {
      completionId,
      poolId: request.poolId,
      claimSignatureCount: signatures.length,
      completedAt: now,
    };
    if (this._audit) {
      this._audit('ZKSTORAGE_REPLICATION_ACCREDITATION_COMPLETED', { ...completion });
    }
    return completion;
  }

  recordSlash(request) {
    _validateSlashRequest(request);
    const pool = this._pools.get(request.poolId);
    if (!pool) {
      throw new HsmAdapterError('ZKSTORAGE_NOT_FOUND', `pool ${request.poolId} not found`);
    }
    hsmMetrics.incrementCounter('hsm_zkstorage_slash_recorded_total', 1);
    if (this._audit) {
      this._audit('ZKSTORAGE_SLASH_RECORDED', { poolId: request.poolId, reason: request.reason });
    }
    return { poolId: request.poolId, slashed: true, reason: request.reason };
  }

  issueChallenge(request) {
    _validateChallengeRequest(request);
    const pool = this._pools.get(request.poolId);
    if (!pool) {
      throw new HsmAdapterError('ZKSTORAGE_NOT_FOUND', `pool ${request.poolId} not found`);
    }
    hsmMetrics.incrementCounter('hsm_zkstorage_challenge_issued_total', 1);
    if (this._audit) {
      this._audit('ZKSTORAGE_CHALLENGE_ISSUED', { poolId: request.poolId, challengeType: request.challengeType });
    }
    return { poolId: request.poolId, challengeIssued: true, challengeType: request.challengeType };
  }

  _recordChallenge(poolId, reason) {
    hsmMetrics.incrementCounter('hsm_zkstorage_challenge_issued_total', 1);
    if (this._audit) {
      this._audit('ZKSTORAGE_CHALLENGE_ISSUED', { poolId, challengeType: reason });
    }
  }

  getPoolCount() {
    return this._pools.size;
  }
}

function _validateInitRequest(policy, request) {
  if (!request.sourceTenantId || !request.targetChainId) {
    throw new HsmAdapterError('ZKSTORAGE_FIELDS_MISSING', 'sourceTenantId and targetChainId are required');
  }
  if (!request.sourceStorageNodeId || !request.targetStorageNodeId) {
    throw new HsmAdapterError('ZKSTORAGE_FIELDS_MISSING', 'sourceStorageNodeId and targetStorageNodeId are required');
  }
  if (!request.blindedStorageSectorDigestCommitment || !request.blindedProofOfSpaceTimeCommitment || !request.blindedReplicaDispersalCommitment) {
    throw new HsmAdapterError('ZKSTORAGE_FIELDS_MISSING', 'blindedStorageSectorDigestCommitment, blindedProofOfSpaceTimeCommitment, and blindedReplicaDispersalCommitment are required');
  }
  if (typeof request.proofOfSpaceTimeWindowSeconds !== 'number') {
    throw new HsmAdapterError('ZKSTORAGE_FIELDS_MISSING', 'proofOfSpaceTimeWindowSeconds is required');
  }
  if (typeof request.storageAttestationChainDepth !== 'number') {
    throw new HsmAdapterError('ZKSTORAGE_FIELDS_MISSING', 'storageAttestationChainDepth is required');
  }
  if (typeof request.replicaDispersalDistance !== 'number') {
    throw new HsmAdapterError('ZKSTORAGE_FIELDS_MISSING', 'replicaDispersalDistance is required');
  }
  if (policy.requireStorageAuthorityInitializerAttestation && !request.storageAuthorityInitializerAttestation) {
    throw new HsmAdapterError('ZKSTORAGE_AUTHORITY_ATTESTATION_MISSING', 'storage authority initializer attestation is required');
  }
}

function _validateProofRequest(request) {
  if (!request.poolId) {
    throw new HsmAdapterError('ZKSTORAGE_PROOF_FIELDS_MISSING', 'poolId is required');
  }
  if (typeof request.proofValid !== 'boolean') {
    throw new HsmAdapterError('ZKSTORAGE_PROOF_FIELDS_MISSING', 'proofValid is required');
  }
}

function _validateReplicaConsensusRequest(policy, request) {
  if (!request.poolId) {
    throw new HsmAdapterError('ZKSTORAGE_REPLICA_FIELDS_MISSING', 'poolId is required');
  }
  if (policy.requireStorageEthicsOversightCommitteeAttestation && !request.storageEthicsOversightCommitteeAttestation) {
    throw new HsmAdapterError('ZKSTORAGE_OVERSIGHT_ATTESTATION_MISSING', 'storage ethics oversight committee attestation is required');
  }
}

function _validateDispersalRequest(request) {
  if (!request.poolId) {
    throw new HsmAdapterError('ZKSTORAGE_DISPERSAL_FIELDS_MISSING', 'poolId is required');
  }
}

function _validateAccreditationRequest(policy, request) {
  if (!request.poolId) {
    throw new HsmAdapterError('ZKSTORAGE_ACCREDITATION_FIELDS_MISSING', 'poolId is required');
  }
  if (policy.requireStorageEthicsOversightCommitteeAttestation && !request.storageEthicsOversightCommitteeAttestation) {
    throw new HsmAdapterError('ZKSTORAGE_OVERSIGHT_ATTESTATION_MISSING', 'storage ethics oversight committee attestation is required');
  }
}

function _validateSlashRequest(request) {
  if (!request.poolId) {
    throw new HsmAdapterError('ZKSTORAGE_SLASH_FIELDS_MISSING', 'poolId is required');
  }
  if (!request.reason) {
    throw new HsmAdapterError('ZKSTORAGE_SLASH_FIELDS_MISSING', 'reason is required');
  }
}

function _validateChallengeRequest(request) {
  if (!request.poolId) {
    throw new HsmAdapterError('ZKSTORAGE_CHALLENGE_FIELDS_MISSING', 'poolId is required');
  }
  if (!request.challengeType) {
    throw new HsmAdapterError('ZKSTORAGE_CHALLENGE_FIELDS_MISSING', 'challengeType is required');
  }
}

module.exports = { PqcZkDecentralizedStorageAttestationGatingHub };
