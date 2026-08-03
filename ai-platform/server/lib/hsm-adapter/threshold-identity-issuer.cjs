'use strict';

/**
 * Track 51: Threshold identity issuer.
 *
 * Validates identity packages and aggregates M-of-N threshold
 * committee signature approvals before committing an identity
 * status change.
 *
 * @module hsm-adapter/threshold-identity-issuer
 */

const { HsmAdapterError } = require('./base-adapter.cjs');

class ThresholdIdentityIssuer {
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
    this._pending = new Map();
  }

  /**
   * Initiate a threshold identity issuance.
   * @param {object} request
   * @returns {object}
   */
  initiate(request) {
    if (!request.entityId || !request.identityHash) {
      throw new HsmAdapterError('ISSUANCE_FIELDS_MISSING', 'entityId and identityHash are required');
    }
    if (this.policy.requireCommitteeAttestation && this._attestationClient) {
      const result = this._attestationClient.verify(request.hostAttestation);
      if (!result.verified) {
        throw new HsmAdapterError('ISSUANCE_HOST_UNATTESTED', `host attestation invalid for entity ${request.entityId}`);
      }
    }
    const issuance = {
      entityId: request.entityId,
      identityHash: request.identityHash,
      committeeSignatures: [],
      status: 'pending',
    };
    this._pending.set(request.entityId, issuance);
    return issuance;
  }

  /**
   * Add a committee signature.
   * @param {string} entityId
   * @param {string} committeeMemberId
   * @param {object} attestation
   * @param {string} signature
   * @returns {object}
   */
  sign(entityId, committeeMemberId, attestation, signature) {
    const issuance = this._pending.get(entityId);
    if (!issuance) {
      throw new HsmAdapterError('ISSUANCE_NOT_FOUND', `no pending issuance for entity ${entityId}`);
    }
    if (issuance.committeeSignatures.length >= (this.policy.maxCommitteeSize || 10)) {
      throw new HsmAdapterError('ISSUANCE_COMMITTEE_FULL', `committee size exceeds maximum ${this.policy.maxCommitteeSize}`);
    }
    if (this.policy.requireCommitteeAttestation && this._attestationClient) {
      const result = this._attestationClient.verify(attestation);
      if (!result.verified) {
        throw new HsmAdapterError('ISSUANCE_COMMITTEE_UNATTESTED', `committee member ${committeeMemberId} attestation invalid`);
      }
    }
    if (!signature || typeof signature !== 'string') {
      throw new HsmAdapterError('ISSUANCE_SIGNATURE_MISSING', 'committee signature is required');
    }
    issuance.committeeSignatures.push({ committeeMemberId, signature });
    if (issuance.committeeSignatures.length >= (this.policy.minIssuanceQuorum || 3)) {
      issuance.status = 'committed';
      if (this._audit) {
        this._audit('IDENTITY_ISSUANCE_QUORUM_COMMITTED', {
          entityId,
          identityHash: issuance.identityHash,
          signatures: issuance.committeeSignatures.length,
        });
      }
      this._pending.delete(entityId);
    }
    return { signed: true, status: issuance.status, signatures: issuance.committeeSignatures.length };
  }

  /**
   * Get pending issuance status.
   * @param {string} entityId
   * @returns {object|null}
   */
  getStatus(entityId) {
    return this._pending.get(entityId) || null;
  }
}

module.exports = { ThresholdIdentityIssuer };
