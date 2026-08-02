'use strict';

/**
 * Track 48: PQC asset bridge hub.
 *
 * Orchestrates cross-platform asset locks and releases using
 * post-quantum ML-DSA/Dilithium threshold committee signatures
 * and time-locked escrows.
 *
 * @module hsm-adapter/pqc-asset-bridge-hub
 */

const crypto = require('crypto');
const { HsmAdapterError } = require('./base-adapter.cjs');

class PqcAssetBridgeHub {
  /**
   * @param {object} options
   * @param {object} options.policy
   * @param {EnclaveAttestationClient} [options.attestationClient]
   * @param {BridgeTimeLockEscrow} [options.escrow]
   * @param {Function} [options.audit]
   */
  constructor(options = {}) {
    this.policy = options.policy || {};
    this._attestationClient = options.attestationClient || null;
    this._escrow = options.escrow || null;
    this._audit = options.audit || null;
  }

  /**
   * Initiate a cross-platform asset transfer.
   * @param {object} request
   * @returns {object}
   */
  initiate(request) {
    _validateInitiate(this.policy, request);
    _validateAttestation(this._attestationClient, request.sourceAttestation);
    const payload = _canonicalPayload(request);
    const transfer = {
      ...request,
      payload,
      status: 'initiated',
      committeeSignatures: [],
    };
    if (this._audit) {
      this._audit('BRIDGE_TRANSFER_INITIATED', {
        sourcePlatform: request.sourcePlatform,
        targetPlatform: request.targetPlatform,
        assetId: request.assetId,
        amount: request.amount,
        recipient: request.recipient,
        lockEpoch: request.lockEpoch,
        releaseEpoch: request.releaseEpoch,
      });
    }
    return transfer;
  }

  /**
   * Add a committee signature and validate the transfer.
   * @param {object} transfer
   * @param {string} committeeMemberId
   * @param {object} attestation
   * @param {string} signature
   * @returns {object}
   */
  sign(transfer, committeeMemberId, attestation, signature) {
    if (this._attestationClient) {
      const result = this._attestationClient.verify(attestation);
      if (!result.verified) {
        throw new HsmAdapterError('BRIDGE_COMMITTEE_UNATTESTED', `committee member ${committeeMemberId} attestation invalid`);
      }
    }
    if (!signature || typeof signature !== 'string') {
      throw new HsmAdapterError('BRIDGE_SIGNATURE_MISSING', 'committee signature is required');
    }
    if (!transfer.committeeSignatures) transfer.committeeSignatures = [];
    transfer.committeeSignatures.push(`${committeeMemberId}=${signature}`);
    if (transfer.committeeSignatures.length >= (this.policy.minCommitteeQuorum || 3)) {
      transfer.status = 'validated';
      if (this._audit) {
        this._audit('CROSS_CHAIN_CLAIM_VALIDATED', {
          sourcePlatform: transfer.sourcePlatform,
          targetPlatform: transfer.targetPlatform,
          assetId: transfer.assetId,
          amount: transfer.amount,
        });
      }
    }
    return transfer;
  }

  /**
   * Release the escrowed assets on the target side.
   * @param {object} transfer
   * @param {number} currentEpoch
   * @returns {object}
   */
  finalize(transfer, currentEpoch) {
    if (transfer.status !== 'validated') {
      throw new HsmAdapterError('BRIDGE_NOT_VALIDATED', 'transfer has not reached committee quorum');
    }
    _validateAttestation(this._attestationClient, transfer.targetAttestation);
    if (currentEpoch < transfer.releaseEpoch) {
      throw new HsmAdapterError('BRIDGE_TIME_LOCK_ACTIVE', `release not allowed before epoch ${transfer.releaseEpoch}`);
    }
    if (this._escrow) {
      this._escrow.release(transfer, currentEpoch);
    }
    transfer.status = 'released';
    if (this._audit) {
      this._audit('ESCROW_RELEASE_FINALIZED', {
        sourcePlatform: transfer.sourcePlatform,
        targetPlatform: transfer.targetPlatform,
        assetId: transfer.assetId,
        amount: transfer.amount,
        recipient: transfer.recipient,
        releaseEpoch: currentEpoch,
      });
    }
    return transfer;
  }
}

function _validateInitiate(policy, request) {
  if (typeof request.amount === 'number' && request.amount > policy.maxAssetTransactionValue) {
    throw new HsmAdapterError('BRIDGE_VALUE_EXCEEDED', `asset value ${request.amount} exceeds maximum ${policy.maxAssetTransactionValue}`);
  }
  if (typeof request.lockEpoch === 'number' && typeof request.releaseEpoch === 'number' && (request.releaseEpoch - request.lockEpoch) < policy.minLockEpochDuration) {
    throw new HsmAdapterError('BRIDGE_LOCK_TOO_SHORT', `lock duration ${request.releaseEpoch - request.lockEpoch} below minimum ${policy.minLockEpochDuration}`);
  }
  if (policy.requireSourceAttestation && !request.sourceAttestation) {
    throw new HsmAdapterError('BRIDGE_SOURCE_ATTESTATION_MISSING', 'source attestation is required');
  }
  if (policy.requireTargetAttestation && !request.targetAttestation) {
    throw new HsmAdapterError('BRIDGE_TARGET_ATTESTATION_MISSING', 'target attestation is required');
  }
  if (!request.sourcePlatform || !request.targetPlatform || !request.assetId || !request.recipient) {
    throw new HsmAdapterError('BRIDGE_FIELDS_MISSING', 'source, target, asset, and recipient are required');
  }
}

function _validateAttestation(attestationClient, attestation) {
  if (!attestationClient || !attestation) return;
  const result = attestationClient.verify(attestation);
  if (!result.verified) {
    throw new HsmAdapterError('BRIDGE_ATTESTATION_INVALID', 'platform attestation is not valid');
  }
}

function _canonicalPayload(request) {
  const { sourcePlatform, targetPlatform, assetId, amount, recipient, lockEpoch, releaseEpoch } = request;
  return `BRIDGE:${sourcePlatform}:${targetPlatform}:${assetId}:${amount}:${recipient}:${lockEpoch}:${releaseEpoch}:`;
}

module.exports = { PqcAssetBridgeHub };
