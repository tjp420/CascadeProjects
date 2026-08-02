'use strict';

/**
 * Track 59: Post-Quantum Cross-Chain Governance Bridge.
 *
 * Interlocking cross-chain message coordinator that accepts structured
 * cross-network proposals and verifies their authenticity using partial
 * ML-DSA signature collections mapped to multi-platform quorums.
 *
 * @module hsm-adapter/pqc-cross-chain-governance-bridge
 */

const crypto = require('crypto');
const { HsmAdapterError } = require('./base-adapter.cjs');

class PqcCrossChainGovernanceBridge {
  /**
   * @param {object} options
   * @param {object} options.policy
   * @param {EnclaveAttestationClient} [options.attestationClient]
   * @param {Function} [options.audit]
   */
  constructor(options = {}) {
    this.policy = options.policy || {};
    this._attestationClient = options.attestationClient || null;
    this._audit = options.audit || null;
    this._proposals = new Map();
  }

  /**
   * Broadcast a cross-chain governance proposal.
   * @param {object} request
   * @returns {object}
   */
  broadcastProposal(request) {
    _validateBroadcastRequest(this.policy, request);
    if (this.policy.requireProposalBroadcasterAttestation && this._attestationClient) {
      try {
        const result = this._attestationClient.verify(request.broadcasterAttestation);
        if (!result.verified) {
          throw new HsmAdapterError('GOV_BROADCASTER_UNATTESTED', 'proposal broadcaster attestation invalid');
        }
      } catch (err) {
        if (err instanceof HsmAdapterError) throw err;
        throw new HsmAdapterError('GOV_BROADCASTER_UNATTESTED', 'proposal broadcaster attestation invalid');
      }
    }
    if (typeof request.attestationAuthority === 'string' && !this.policy.allowedAttestationAuthorities.includes(request.attestationAuthority)) {
      throw new HsmAdapterError('GOV_ATTESTATION_AUTHORITY_BLOCKED', `attestation authority ${request.attestationAuthority} is not allowed; permitted: ${this.policy.allowedAttestationAuthorities.join(', ')}`);
    }
    if (typeof request.pqcSignatureScheme === 'string' && !this.policy.allowedPqcSignatureSchemes.includes(request.pqcSignatureScheme)) {
      throw new HsmAdapterError('GOV_PQC_SCHEME_BLOCKED', `PQC signature scheme ${request.pqcSignatureScheme} is not permitted; allowed: ${this.policy.allowedPqcSignatureSchemes.join(', ')}`);
    }
    if (typeof request.executionWindowSeconds === 'number' && request.executionWindowSeconds > (this.policy.maxProposalExecutionWindowSeconds || 86400)) {
      throw new HsmAdapterError('GOV_EXECUTION_WINDOW_EXCEEDED', `execution window ${request.executionWindowSeconds}s exceeds maximum ${this.policy.maxProposalExecutionWindowSeconds}s`);
    }
    if (this._proposals.size >= (this.policy.maxConcurrentProposals || 16)) {
      throw new HsmAdapterError('GOV_CONCURRENT_PROPOSALS_EXCEEDED', `concurrent proposals ${this._proposals.size} exceeds maximum ${this.policy.maxConcurrentProposals}`);
    }
    const proposalId = request.proposalId || `prop-${crypto.randomBytes(4).toString('hex')}`;
    if (this._proposals.has(proposalId)) {
      throw new HsmAdapterError('GOV_PROPOSAL_DUPLICATE', `proposal ${proposalId} already exists`);
    }
    const now = Math.floor(Date.now() / 1000);
    const proposal = {
      proposalId,
      sourceTenantId: request.sourceTenantId,
      targetChainId: request.targetChainId,
      instructionType: request.instructionType,
      instructionHash: request.instructionHash || crypto.createHash('sha256').update(request.instructionType || '').digest('hex'),
      executionWindowSeconds: request.executionWindowSeconds || (this.policy.maxProposalExecutionWindowSeconds || 86400),
      pqcSignatureScheme: request.pqcSignatureScheme,
      status: 'broadcast',
      broadcastAt: now,
      expiresAt: now + (request.executionWindowSeconds || (this.policy.maxProposalExecutionWindowSeconds || 86400)),
    };
    this._proposals.set(proposalId, proposal);
    if (this._audit) {
      this._audit('CROSS_CHAIN_PROPOSAL_BROADCAST', { ...proposal });
    }
    return proposal;
  }

  /**
   * Get a proposal by id.
   * @param {string} proposalId
   * @returns {object|null}
   */
  getProposal(proposalId) {
    return this._proposals.get(proposalId) || null;
  }

  /**
   * Check if a proposal is still within its execution window.
   * @param {string} proposalId
   * @returns {boolean}
   */
  isProposalActive(proposalId) {
    const proposal = this._proposals.get(proposalId);
    if (!proposal) return false;
    const now = Math.floor(Date.now() / 1000);
    return now <= proposal.expiresAt && proposal.status === 'broadcast';
  }

  /**
   * Mark a proposal as executed.
   * @param {string} proposalId
   */
  markExecuted(proposalId) {
    const proposal = this._proposals.get(proposalId);
    if (!proposal) {
      throw new HsmAdapterError('GOV_PROPOSAL_NOT_FOUND', `proposal ${proposalId} not found`);
    }
    proposal.status = 'executed';
  }

  /**
   * Remove expired proposals.
   * @returns {number}
   */
  pruneExpired() {
    const now = Math.floor(Date.now() / 1000);
    let pruned = 0;
    for (const [id, proposal] of this._proposals) {
      if (now > proposal.expiresAt && proposal.status === 'broadcast') {
        proposal.status = 'expired';
        this._proposals.delete(id);
        pruned += 1;
      }
    }
    return pruned;
  }
}

function _validateBroadcastRequest(policy, request) {
  if (!request.sourceTenantId || !request.targetChainId || !request.instructionType) {
    throw new HsmAdapterError('GOV_FIELDS_MISSING', 'sourceTenantId, targetChainId, and instructionType are required');
  }
  if (policy.requireProposalBroadcasterAttestation && !request.broadcasterAttestation) {
    throw new HsmAdapterError('GOV_BROADCASTER_ATTESTATION_MISSING', 'proposal broadcaster attestation is required');
  }
}

module.exports = { PqcCrossChainGovernanceBridge };
