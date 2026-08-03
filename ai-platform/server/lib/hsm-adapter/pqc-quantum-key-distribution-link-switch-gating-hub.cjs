'use strict';

/**
 * Track 109: PQC Quantum Key Distribution Link-Switch Gating Hub.
 *
 * Quantum Key Distribution (QKD) fiber-mesh route switching gate that
 * instantiates multi-party QKD link verification pools using homomorphically
 * split Pedersen commitments over optical link path digests, quantum secret
 * sharing digests, and entangling channel attestation hashes. Parses
 * QKDSWITCHGATE packets, enforces maxQkdSwitchChainDepth, and tracks state
 * transitions alongside the minQkdQuorum boundary.
 *
 * @module hsm-adapter/pqc-quantum-key-distribution-link-switch-gating-hub
 */

const crypto = require('crypto');
const { HsmAdapterError } = require('./base-adapter.cjs');

class PqcQuantumKeyDistributionLinkSwitchGatingHub {
  constructor(options = {}) {
    this.policy = options.policy || {};
    this._attestationClient = options.attestationClient || null;
    this._audit = options.audit || null;
    this._pools = new Map();
  }

  initializePool(request) {
    _validateInitRequest(this.policy, request);
    if (this.policy.requireQkdLinkAuthorityInitializerAttestation && this._attestationClient) {
      try {
        const result = this._attestationClient.verify(request.qkdLinkAuthorityInitializerAttestation);
        if (!result.verified) {
          throw new HsmAdapterError('QKDSWITCHGATE_AUTHORITY_INITIALIZER_UNATTESTED', 'qkd link authority initializer attestation invalid');
        }
      } catch (err) {
        if (err instanceof HsmAdapterError) throw err;
        throw new HsmAdapterError('QKDSWITCHGATE_AUTHORITY_INITIALIZER_UNATTESTED', 'qkd link authority initializer attestation invalid');
      }
    }
    if (typeof request.attestationAuthority === 'string' && !this.policy.allowedAttestationAuthorities.includes(request.attestationAuthority)) {
      throw new HsmAdapterError('QKDSWITCHGATE_ATTESTATION_AUTHORITY_BLOCKED', `attestation authority ${request.attestationAuthority} is not allowed; permitted: ${this.policy.allowedAttestationAuthorities.join(', ')}`);
    }
    if (typeof request.pqcSignatureScheme === 'string' && !this.policy.allowedPqcSignatureSchemes.includes(request.pqcSignatureScheme)) {
      throw new HsmAdapterError('QKDSWITCHGATE_PQC_SCHEME_BLOCKED', `PQC signature scheme ${request.pqcSignatureScheme} is not permitted; allowed: ${this.policy.allowedPqcSignatureSchemes.join(', ')}`);
    }
    if (typeof request.entanglementWindowSeconds === 'number' && request.entanglementWindowSeconds > (this.policy.maxEntanglementWindowSeconds || 60)) {
      throw new HsmAdapterError('QKDSWITCHGATE_ENTANGLEMENT_WINDOW_EXCEEDED', `entanglement window seconds ${request.entanglementWindowSeconds} exceeds maximum ${this.policy.maxEntanglementWindowSeconds}`);
    }
    if (typeof request.qkdSwitchChainDepth === 'number' && request.qkdSwitchChainDepth > (this.policy.maxQkdSwitchChainDepth || 42)) {
      throw new HsmAdapterError('QKDSWITCHGATE_QKD_SWITCH_DEPTH_EXCEEDED', `qkd switch chain depth ${request.qkdSwitchChainDepth} exceeds maximum ${this.policy.maxQkdSwitchChainDepth}`);
    }
    const poolId = request.poolId || `pool-${crypto.randomBytes(4).toString('hex')}`;
    if (this._pools.has(poolId)) {
      throw new HsmAdapterError('QKDSWITCHGATE_DUPLICATE', `pool ${poolId} already exists`);
    }
    const now = Math.floor(Date.now() / 1000);
    const pool = {
      poolId,
      sourceTenantId: request.sourceTenantId,
      targetChainId: request.targetChainId,
      sourceOpticalNodeId: request.sourceOpticalNodeId,
      targetOpticalNodeId: request.targetOpticalNodeId,
      blindedOpticalLinkPathCommitment: request.blindedOpticalLinkPathCommitment,
      blindedQuantumSecretSharingCommitment: request.blindedQuantumSecretSharingCommitment,
      blindedEntanglingChannelCommitment: request.blindedEntanglingChannelCommitment,
      entanglementWindowSeconds: request.entanglementWindowSeconds,
      qkdSwitchChainDepth: request.qkdSwitchChainDepth,
      pqcSignatureScheme: request.pqcSignatureScheme,
      initializedAt: now,
      status: 'open',
      qkdLinkClaimVerified: false,
      entanglementAccreditationCompletedAt: null,
    };
    this._pools.set(poolId, pool);
    if (this._audit) {
      this._audit('QKD_LINK_POOL_INITIALIZED', { ...pool });
    }
    return pool;
  }

  getPool(poolId) {
    return this._pools.get(poolId) || null;
  }

  markQkdLinkClaimVerified(poolId) {
    const pool = this._pools.get(poolId);
    if (!pool) {
      throw new HsmAdapterError('QKDSWITCHGATE_NOT_FOUND', `pool ${poolId} not found`);
    }
    pool.qkdLinkClaimVerified = true;
    return pool;
  }

  completeAccreditation(request) {
    _validateCompleteRequest(this.policy, request);
    const pool = this._pools.get(request.poolId);
    if (!pool) {
      throw new HsmAdapterError('QKDSWITCHGATE_NOT_FOUND', `pool ${request.poolId} not found`);
    }
    if (!pool.qkdLinkClaimVerified) {
      throw new HsmAdapterError('QKDSWITCHGATE_QKD_LINK_CLAIM_NOT_VERIFIED', `pool ${request.poolId} qkd link claim not verified`);
    }
    if (this.policy.requireQkdEthicsOversightCommitteeAttestation && this._attestationClient) {
      try {
        const result = this._attestationClient.verify(request.qkdEthicsOversightCommitteeAttestation);
        if (!result.verified) {
          throw new HsmAdapterError('QKDSWITCHGATE_OVERSIGHT_COMMITTEE_UNATTESTED', 'qkd ethics oversight committee attestation invalid');
        }
      } catch (err) {
        if (err instanceof HsmAdapterError) throw err;
        throw new HsmAdapterError('QKDSWITCHGATE_OVERSIGHT_COMMITTEE_UNATTESTED', 'qkd ethics oversight committee attestation invalid');
      }
    }
    const signatures = request.committeeSignatures || [];
    if (signatures.length < (this.policy.minQkdQuorum || 18)) {
      throw new HsmAdapterError('QKDSWITCHGATE_QUORUM_INSUFFICIENT', `qkd quorum signatures ${signatures.length} below minimum ${this.policy.minQkdQuorum}`);
    }
    const now = Math.floor(Date.now() / 1000);
    pool.status = 'accredited';
    pool.entanglementAccreditationCompletedAt = now;
    const completionId = request.completionId || `completion-${crypto.randomBytes(4).toString('hex')}`;
    const completion = {
      completionId,
      poolId: request.poolId,
      claimSignatureCount: signatures.length,
      completedAt: now,
    };
    if (this._audit) {
      this._audit('ENTANGLEMENT_ACCREDITATION_COMPLETED', { ...completion });
    }
    return completion;
  }

  getPoolCount() {
    return this._pools.size;
  }
}

function _validateInitRequest(policy, request) {
  if (!request.sourceTenantId || !request.targetChainId) {
    throw new HsmAdapterError('QKDSWITCHGATE_FIELDS_MISSING', 'sourceTenantId and targetChainId are required');
  }
  if (!request.sourceOpticalNodeId || !request.targetOpticalNodeId) {
    throw new HsmAdapterError('QKDSWITCHGATE_FIELDS_MISSING', 'sourceOpticalNodeId and targetOpticalNodeId are required');
  }
  if (!request.blindedOpticalLinkPathCommitment || !request.blindedQuantumSecretSharingCommitment || !request.blindedEntanglingChannelCommitment) {
    throw new HsmAdapterError('QKDSWITCHGATE_FIELDS_MISSING', 'blindedOpticalLinkPathCommitment, blindedQuantumSecretSharingCommitment, and blindedEntanglingChannelCommitment are required');
  }
  if (typeof request.entanglementWindowSeconds !== 'number') {
    throw new HsmAdapterError('QKDSWITCHGATE_FIELDS_MISSING', 'entanglementWindowSeconds is required');
  }
  if (typeof request.qkdSwitchChainDepth !== 'number') {
    throw new HsmAdapterError('QKDSWITCHGATE_FIELDS_MISSING', 'qkdSwitchChainDepth is required');
  }
  if (policy.requireQkdLinkAuthorityInitializerAttestation && !request.qkdLinkAuthorityInitializerAttestation) {
    throw new HsmAdapterError('QKDSWITCHGATE_AUTHORITY_ATTESTATION_MISSING', 'qkd link authority initializer attestation is required');
  }
}

function _validateCompleteRequest(policy, request) {
  if (!request.poolId) {
    throw new HsmAdapterError('QKDSWITCHGATE_COMPLETE_FIELDS_MISSING', 'poolId is required');
  }
  if (policy.requireQkdEthicsOversightCommitteeAttestation && !request.qkdEthicsOversightCommitteeAttestation) {
    throw new HsmAdapterError('QKDSWITCHGATE_OVERSIGHT_ATTESTATION_MISSING', 'qkd ethics oversight committee attestation is required');
  }
}

module.exports = { PqcQuantumKeyDistributionLinkSwitchGatingHub };
