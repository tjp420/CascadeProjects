'use strict';

/**
 * Track 104: PQC Smart-Contract Verifiable Execution Gating Hub.
 *
 * Interlocking execution authority endpoint coordinator that
 * instantiates multi-party smart-contract verifiable execution
 * verification pools using homomorphically split Pedersen commitments
 * over execution state hashes, computation trace digests, and execution
 * authority identity hashes. Parses EXECGATE packets, enforces
 * maxExecutionChainDepth, and tracks state transitions alongside the
 * minExecutionQuorum boundary.
 *
 * @module hsm-adapter/pqc-smart-contract-verifiable-execution-gating-hub
 */

const crypto = require('crypto');
const { HsmAdapterError } = require('./base-adapter.cjs');

class PqcSmartContractVerifiableExecutionGatingHub {
  constructor(options = {}) {
    this.policy = options.policy || {};
    this._attestationClient = options.attestationClient || null;
    this._audit = options.audit || null;
    this._pools = new Map();
  }

  initializePool(request) {
    _validateInitRequest(this.policy, request);
    if (this.policy.requireExecutionAuthorityInitializerAttestation && this._attestationClient) {
      try {
        const result = this._attestationClient.verify(request.executionAuthorityInitializerAttestation);
        if (!result.verified) {
          throw new HsmAdapterError('EXECGATE_AUTHORITY_INITIALIZER_UNATTESTED', 'execution authority initializer attestation invalid');
        }
      } catch (err) {
        if (err instanceof HsmAdapterError) throw err;
        throw new HsmAdapterError('EXECGATE_AUTHORITY_INITIALIZER_UNATTESTED', 'execution authority initializer attestation invalid');
      }
    }
    if (typeof request.attestationAuthority === 'string' && !this.policy.allowedAttestationAuthorities.includes(request.attestationAuthority)) {
      throw new HsmAdapterError('EXECGATE_ATTESTATION_AUTHORITY_BLOCKED', `attestation authority ${request.attestationAuthority} is not allowed; permitted: ${this.policy.allowedAttestationAuthorities.join(', ')}`);
    }
    if (typeof request.pqcSignatureScheme === 'string' && !this.policy.allowedPqcSignatureSchemes.includes(request.pqcSignatureScheme)) {
      throw new HsmAdapterError('EXECGATE_PQC_SCHEME_BLOCKED', `PQC signature scheme ${request.pqcSignatureScheme} is not permitted; allowed: ${this.policy.allowedPqcSignatureSchemes.join(', ')}`);
    }
    if (typeof request.executionWindowSeconds === 'number' && request.executionWindowSeconds > (this.policy.maxExecutionWindowSeconds || 172800)) {
      throw new HsmAdapterError('EXECGATE_EXECUTION_WINDOW_EXCEEDED', `execution window seconds ${request.executionWindowSeconds} exceeds maximum ${this.policy.maxExecutionWindowSeconds}`);
    }
    if (typeof request.executionChainDepth === 'number' && request.executionChainDepth > (this.policy.maxExecutionChainDepth || 30)) {
      throw new HsmAdapterError('EXECGATE_EXECUTION_DEPTH_EXCEEDED', `execution chain depth ${request.executionChainDepth} exceeds maximum ${this.policy.maxExecutionChainDepth}`);
    }
    const poolId = request.poolId || `pool-${crypto.randomBytes(4).toString('hex')}`;
    if (this._pools.has(poolId)) {
      throw new HsmAdapterError('EXECGATE_DUPLICATE', `pool ${poolId} already exists`);
    }
    const now = Math.floor(Date.now() / 1000);
    const pool = {
      poolId,
      sourceTenantId: request.sourceTenantId,
      targetChainId: request.targetChainId,
      blindedExecutionStateCommitment: request.blindedExecutionStateCommitment,
      blindedComputationTraceCommitment: request.blindedComputationTraceCommitment,
      blindedExecutionAuthorityIdentityCommitment: request.blindedExecutionAuthorityIdentityCommitment,
      executionWindowSeconds: request.executionWindowSeconds,
      executionChainDepth: request.executionChainDepth,
      pqcSignatureScheme: request.pqcSignatureScheme,
      initializedAt: now,
      status: 'open',
      executionClaimVerified: false,
      executionAccreditationCompletedAt: null,
    };
    this._pools.set(poolId, pool);
    if (this._audit) {
      this._audit('EXECUTION_POOL_INITIALIZED', { ...pool });
    }
    return pool;
  }

  getPool(poolId) {
    return this._pools.get(poolId) || null;
  }

  markExecutionClaimVerified(poolId) {
    const pool = this._pools.get(poolId);
    if (!pool) {
      throw new HsmAdapterError('EXECGATE_NOT_FOUND', `pool ${poolId} not found`);
    }
    pool.executionClaimVerified = true;
    return pool;
  }

  completeAccreditation(request) {
    _validateCompleteRequest(this.policy, request);
    const pool = this._pools.get(request.poolId);
    if (!pool) {
      throw new HsmAdapterError('EXECGATE_NOT_FOUND', `pool ${request.poolId} not found`);
    }
    if (!pool.executionClaimVerified) {
      throw new HsmAdapterError('EXECGATE_EXECUTION_CLAIM_NOT_VERIFIED', `pool ${request.poolId} execution claim not verified`);
    }
    if (this.policy.requireExecutionEthicsOversightCommitteeAttestation && this._attestationClient) {
      try {
        const result = this._attestationClient.verify(request.executionEthicsOversightCommitteeAttestation);
        if (!result.verified) {
          throw new HsmAdapterError('EXECGATE_OVERSIGHT_COMMITTEE_UNATTESTED', 'execution ethics oversight committee attestation invalid');
        }
      } catch (err) {
        if (err instanceof HsmAdapterError) throw err;
        throw new HsmAdapterError('EXECGATE_OVERSIGHT_COMMITTEE_UNATTESTED', 'execution ethics oversight committee attestation invalid');
      }
    }
    const signatures = request.committeeSignatures || [];
    if (signatures.length < (this.policy.minExecutionQuorum || 10)) {
      throw new HsmAdapterError('EXECGATE_QUORUM_INSUFFICIENT', `execution quorum signatures ${signatures.length} below minimum ${this.policy.minExecutionQuorum}`);
    }
    const now = Math.floor(Date.now() / 1000);
    pool.status = 'accredited';
    pool.executionAccreditationCompletedAt = now;
    const completionId = request.completionId || `completion-${crypto.randomBytes(4).toString('hex')}`;
    const completion = {
      completionId,
      poolId: request.poolId,
      claimSignatureCount: signatures.length,
      completedAt: now,
    };
    if (this._audit) {
      this._audit('EXECUTION_ACCREDITATION_COMPLETED', { ...completion });
    }
    return completion;
  }

  getPoolCount() {
    return this._pools.size;
  }
}

function _validateInitRequest(policy, request) {
  if (!request.sourceTenantId || !request.targetChainId) {
    throw new HsmAdapterError('EXECGATE_FIELDS_MISSING', 'sourceTenantId and targetChainId are required');
  }
  if (!request.blindedExecutionStateCommitment || !request.blindedComputationTraceCommitment || !request.blindedExecutionAuthorityIdentityCommitment) {
    throw new HsmAdapterError('EXECGATE_FIELDS_MISSING', 'blindedExecutionStateCommitment, blindedComputationTraceCommitment, and blindedExecutionAuthorityIdentityCommitment are required');
  }
  if (typeof request.executionWindowSeconds !== 'number') {
    throw new HsmAdapterError('EXECGATE_FIELDS_MISSING', 'executionWindowSeconds is required');
  }
  if (typeof request.executionChainDepth !== 'number') {
    throw new HsmAdapterError('EXECGATE_FIELDS_MISSING', 'executionChainDepth is required');
  }
  if (policy.requireExecutionAuthorityInitializerAttestation && !request.executionAuthorityInitializerAttestation) {
    throw new HsmAdapterError('EXECGATE_AUTHORITY_ATTESTATION_MISSING', 'execution authority initializer attestation is required');
  }
}

function _validateCompleteRequest(policy, request) {
  if (!request.poolId) {
    throw new HsmAdapterError('EXECGATE_COMPLETE_FIELDS_MISSING', 'poolId is required');
  }
  if (policy.requireExecutionEthicsOversightCommitteeAttestation && !request.executionEthicsOversightCommitteeAttestation) {
    throw new HsmAdapterError('EXECGATE_OVERSIGHT_ATTESTATION_MISSING', 'execution ethics oversight committee attestation is required');
  }
}

module.exports = { PqcSmartContractVerifiableExecutionGatingHub };
