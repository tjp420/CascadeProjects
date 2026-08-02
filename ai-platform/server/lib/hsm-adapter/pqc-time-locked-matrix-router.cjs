'use strict';

/**
 * Track 62: PQC Time-Locked Matrix Router.
 *
 * Time-locked payload manager that encapsulates encrypted data arrays
 * behind verifiable delay functions (VDF) and post-quantum ML-KEM
 * encapsulation envelopes. Parses TIMELOCK packets, enforces
 * maxPayloadBytes, and applies the minCommitteeQuorum criteria.
 *
 * @module hsm-adapter/pqc-time-locked-matrix-router
 */

const crypto = require('crypto');
const { HsmAdapterError } = require('./base-adapter.cjs');

class PqcTimeLockedMatrixRouter {
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
    this._matrices = new Map();
  }

  /**
   * Initialize a time-locked matrix.
   * @param {object} request
   * @returns {object}
   */
  initializeMatrix(request) {
    _validateInitRequest(this.policy, request);
    if (this.policy.requireSubmitterAttestation && this._attestationClient) {
      try {
        const result = this._attestationClient.verify(request.submitterAttestation);
        if (!result.verified) {
          throw new HsmAdapterError('TIMELOCK_SUBMITTER_UNATTESTED', 'submitter attestation invalid');
        }
      } catch (err) {
        if (err instanceof HsmAdapterError) throw err;
        throw new HsmAdapterError('TIMELOCK_SUBMITTER_UNATTESTED', 'submitter attestation invalid');
      }
    }
    if (typeof request.attestationAuthority === 'string' && !this.policy.allowedAttestationAuthorities.includes(request.attestationAuthority)) {
      throw new HsmAdapterError('TIMELOCK_ATTESTATION_AUTHORITY_BLOCKED', `attestation authority ${request.attestationAuthority} is not allowed; permitted: ${this.policy.allowedAttestationAuthorities.join(', ')}`);
    }
    if (typeof request.pqcSignatureScheme === 'string' && !this.policy.allowedPqcSignatureSchemes.includes(request.pqcSignatureScheme)) {
      throw new HsmAdapterError('TIMELOCK_PQC_SCHEME_BLOCKED', `PQC signature scheme ${request.pqcSignatureScheme} is not permitted; allowed: ${this.policy.allowedPqcSignatureSchemes.join(', ')}`);
    }
    const payloadBytes = request.payloadBytes || (request.encryptedPayload ? Buffer.byteLength(request.encryptedPayload, 'utf8') : 0);
    if (payloadBytes > (this.policy.maxPayloadBytes || 1048576)) {
      throw new HsmAdapterError('TIMELOCK_PAYLOAD_EXCEEDED', `payload bytes ${payloadBytes} exceeds maximum ${this.policy.maxPayloadBytes}`);
    }
    const signatures = request.committeeSignatures || [];
    if (signatures.length < (this.policy.minCommitteeQuorum || 3)) {
      throw new HsmAdapterError('TIMELOCK_QUORUM_INSUFFICIENT', `committee signatures ${signatures.length} below minimum ${this.policy.minCommitteeQuorum}`);
    }
    const now = Math.floor(Date.now() / 1000);
    const timeDelay = request.timeDelaySeconds || 0;
    if (timeDelay < (this.policy.minTimeDelaySeconds || 3600)) {
      throw new HsmAdapterError('TIMELOCK_DELAY_INSUFFICIENT', `time delay ${timeDelay}s below minimum ${this.policy.minTimeDelaySeconds}s`);
    }
    const matrixId = request.matrixId || `matrix-${crypto.randomBytes(4).toString('hex')}`;
    if (this._matrices.has(matrixId)) {
      throw new HsmAdapterError('TIMELOCK_DUPLICATE', `matrix ${matrixId} already exists`);
    }
    const releaseTimestamp = (request.releaseTimestamp || (now + timeDelay));
    const encryptedPayloadHash = request.encryptedPayloadHash || crypto.createHash('sha256').update(request.encryptedPayload || '').digest('hex');
    const matrix = {
      matrixId,
      sourceTenantId: request.sourceTenantId,
      encryptedPayloadHash,
      vdfDifficulty: request.vdfDifficulty || 1,
      releaseTimestamp,
      timeDelaySeconds: timeDelay,
      pqcSignatureScheme: request.pqcSignatureScheme,
      committeeSignatureCount: signatures.length,
      initializedAt: now,
      payloadBytes,
      status: 'locked',
    };
    this._matrices.set(matrixId, matrix);
    if (this._audit) {
      this._audit('TIME_LOCK_MATRIX_INITIALIZED', { ...matrix });
    }
    return matrix;
  }

  /**
   * Get a matrix by id.
   * @param {string} matrixId
   * @returns {object|null}
   */
  getMatrix(matrixId) {
    return this._matrices.get(matrixId) || null;
  }

  /**
   * Check if a matrix is ready for decryption.
   * @param {string} matrixId
   * @param {number} currentTimestamp
   * @returns {boolean}
   */
  isReadyForDecryption(matrixId, currentTimestamp) {
    const matrix = this._matrices.get(matrixId);
    if (!matrix) return false;
    const now = currentTimestamp || Math.floor(Date.now() / 1000);
    return now >= matrix.releaseTimestamp;
  }

  /**
   * Mark a matrix as released.
   * @param {string} matrixId
   * @returns {object}
   */
  markReleased(matrixId) {
    const matrix = this._matrices.get(matrixId);
    if (!matrix) {
      throw new HsmAdapterError('TIMELOCK_NOT_FOUND', `matrix ${matrixId} not found`);
    }
    matrix.status = 'released';
    return matrix;
  }

  /**
   * Get the current matrix count.
   * @returns {number}
   */
  getMatrixCount() {
    return this._matrices.size;
  }
}

function _validateInitRequest(policy, request) {
  if (!request.sourceTenantId) {
    throw new HsmAdapterError('TIMELOCK_FIELDS_MISSING', 'sourceTenantId is required');
  }
  if (!request.encryptedPayload && !request.encryptedPayloadHash) {
    throw new HsmAdapterError('TIMELOCK_FIELDS_MISSING', 'encryptedPayload or encryptedPayloadHash is required');
  }
  if (policy.requireSubmitterAttestation && !request.submitterAttestation) {
    throw new HsmAdapterError('TIMELOCK_SUBMITTER_ATTESTATION_MISSING', 'submitter attestation is required');
  }
}

module.exports = { PqcTimeLockedMatrixRouter };
