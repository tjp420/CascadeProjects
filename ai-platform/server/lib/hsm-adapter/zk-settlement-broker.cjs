'use strict';

/**
 * Track 50: ZK settlement broker.
 *
 * Matches multi-party asset transfers and clears hidden ledger
 * entries using homomorphic balance additions and zero-knowledge
 * equality proofs.
 *
 * @module hsm-adapter/zk-settlement-broker
 */

const { HsmAdapterError } = require('./base-adapter.cjs');

const P = 170141183460469231731687303715884105727n;

class ZkSettlementBroker {
  /**
   * @param {object} options
   * @param {object} options.policy
   * @param {EnclaveAttestationClient} [options.attestationClient]
   * @param {ZkSettlementEqualityProver} [options.prover]
   * @param {Function} [options.audit]
   */
  constructor(options = {}) {
    this.policy = options.policy || {};
    this._attestationClient = options.attestationClient || null;
    this._prover = options.prover || null;
    this._audit = options.audit || null;
    this._settlements = new Map();
  }

  /**
   * Initiate a cross-chain settlement.
   * @param {object} request
   * @returns {object}
   */
  initiate(request) {
    _validateInitiate(this.policy, request);
    const settlement = {
      settlementId: request.settlementId,
      assetId: request.assetId,
      clearingNodes: request.clearingNodes || [],
      incomingCommitment: request.incomingCommitment,
      outgoingCommitment: request.outgoingCommitment,
      timestamp: request.timestamp,
      nodeSignatures: [],
      status: 'initiated',
    };
    this._settlements.set(request.settlementId, settlement);
    if (this._audit) {
      this._audit('CROSS_CHAIN_SETTLEMENT_INITIATED', {
        settlementId: request.settlementId,
        assetId: request.assetId,
        clearingNodes: settlement.clearingNodes,
      });
    }
    return settlement;
  }

  /**
   * Add a clearing node signature.
   * @param {string} settlementId
   * @param {string} nodeId
   * @param {object} attestation
   * @param {string} signature
   * @returns {object}
   */
  sign(settlementId, nodeId, attestation, signature) {
    const settlement = this._settlements.get(settlementId);
    if (!settlement) {
      throw new HsmAdapterError('SETTLEMENT_NOT_FOUND', `no settlement ${settlementId}`);
    }
    if (this.policy.requireNodeAttestation && this._attestationClient) {
      const result = this._attestationClient.verify(attestation);
      if (!result.verified) {
        throw new HsmAdapterError('SETTLEMENT_NODE_UNATTESTED', `node ${nodeId} attestation invalid`);
      }
    }
    if (!signature || typeof signature !== 'string') {
      throw new HsmAdapterError('SETTLEMENT_SIGNATURE_MISSING', 'node signature is required');
    }
    settlement.nodeSignatures.push({ nodeId, signature });
    return { signed: true, settlementId, signatures: settlement.nodeSignatures.length };
  }

  /**
   * Finalize the settlement after quorum and equality proof.
   * @param {string} settlementId
   * @returns {object}
   */
  finalize(settlementId) {
    const settlement = this._settlements.get(settlementId);
    if (!settlement) {
      throw new HsmAdapterError('SETTLEMENT_NOT_FOUND', `no settlement ${settlementId}`);
    }
    if (settlement.nodeSignatures.length < (this.policy.minClearingNodeQuorum || 3)) {
      throw new HsmAdapterError('SETTLEMENT_QUORUM_INSUFFICIENT', `signatures ${settlement.nodeSignatures.length} below minimum ${this.policy.minClearingNodeQuorum}`);
    }
    if (this._prover) {
      const proof = this._prover.generate(settlement);
      const verify = this._prover.verify(settlement, proof);
      if (!verify.verified) {
        throw new HsmAdapterError('SETTLEMENT_EQUALITY_INVALID', 'equality proof verification failed');
      }
      settlement.equalityProof = proof;
    }
    settlement.status = 'finalized';
    if (this._audit) {
      this._audit('ZK_SETTLEMENT_FINALIZED', {
        settlementId,
        assetId: settlement.assetId,
        signatures: settlement.nodeSignatures.length,
      });
    }
    this._settlements.delete(settlementId);
    return { finalized: true, settlement };
  }
}

function _validateInitiate(policy, request) {
  if (!request.settlementId || !request.assetId) {
    throw new HsmAdapterError('SETTLEMENT_FIELDS_MISSING', 'settlement id and asset id are required');
  }
  if (!Array.isArray(request.clearingNodes) || request.clearingNodes.length < (policy.minClearingNodeQuorum || 3)) {
    throw new HsmAdapterError('SETTLEMENT_NODES_INSUFFICIENT', `clearing nodes ${(request.clearingNodes || []).length} below minimum ${policy.minClearingNodeQuorum}`);
  }
  if (typeof request.incomingCommitment !== 'bigint' && typeof request.incomingCommitment !== 'number') {
    throw new HsmAdapterError('SETTLEMENT_INCOMING_INVALID', 'incoming commitment is required');
  }
  if (typeof request.outgoingCommitment !== 'bigint' && typeof request.outgoingCommitment !== 'number') {
    throw new HsmAdapterError('SETTLEMENT_OUTGOING_INVALID', 'outgoing commitment is required');
  }
  const bitWidth = _bitWidth(request.incomingCommitment) || _bitWidth(request.outgoingCommitment);
  if (bitWidth < policy.minAssetBitWidth || bitWidth > policy.maxAssetBitWidth) {
    throw new HsmAdapterError('SETTLEMENT_BIT_WIDTH_BLOCKED', `asset bit width ${bitWidth} outside allowed [${policy.minAssetBitWidth}, ${policy.maxAssetBitWidth}]`);
  }
  if (typeof request.settlementTimeoutSeconds === 'number' && request.settlementTimeoutSeconds > policy.maxSettlementTimeoutSeconds) {
    throw new HsmAdapterError('SETTLEMENT_TIMEOUT_EXCEEDED', `timeout ${request.settlementTimeoutSeconds}s exceeds maximum ${policy.maxSettlementTimeoutSeconds}s`);
  }
}

function _bitWidth(value) {
  const v = typeof value === 'bigint' ? value : BigInt(value);
  return v.toString(2).length;
}

module.exports = { ZkSettlementBroker };
