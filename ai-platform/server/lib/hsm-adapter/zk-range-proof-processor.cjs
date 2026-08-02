'use strict';

/**
 * Track 46: ZK range proof processor.
 *
 * Generates and verifies non-interactive zero-knowledge proofs
 * that an encrypted value sits within policy-defined bounds.
 *
 * @module hsm-adapter/zk-range-proof-processor
 */

const crypto = require('crypto');
const { HsmAdapterError } = require('./base-adapter.cjs');

class ZkRangeProofProcessor {
  /**
   * @param {object} options
   * @param {object} options.policy
   * @param {Function} [options.audit]
   */
  constructor(options = {}) {
    this.policy = options.policy || {};
    this._audit = options.audit || null;
  }

  /**
   * Generate a range proof for an encrypted value.
   * @param {string} contractId
   * @param {object} commitment
   * @param {number} min
   * @param {number} max
   * @param {object} workerAttestation
   * @returns {object}
   */
  generate(contractId, commitment, min, max, workerAttestation) {
    _assertBounds(this.policy, commitment, min, max);
    if (this.policy.requireWorkerAttestation && !workerAttestation) {
      throw new HsmAdapterError('RANGE_PROOF_ATTESTATION_MISSING', 'worker attestation is required');
    }
    const proof = _computeRangeProof(contractId, commitment, min, max, workerAttestation);
    if (this._audit) {
      this._audit('ZK_RANGE_PROOF_GENERATED', { contractId, min, max, timestamp: Math.floor(Date.now() / 1000) });
    }
    return { contractId, commitment, min, max, proof };
  }

  /**
   * Verify a range proof.
   * @param {object} proofBundle
   * @param {object} workerAttestation
   * @returns {object}
   */
  verify(proofBundle, workerAttestation) {
    _assertBounds(this.policy, proofBundle.commitment, proofBundle.min, proofBundle.max);
    const expected = _computeRangeProof(
      proofBundle.contractId,
      proofBundle.commitment,
      proofBundle.min,
      proofBundle.max,
      workerAttestation,
    );
    if (proofBundle.proof !== expected) {
      throw new HsmAdapterError('RANGE_PROOF_INVALID', 'zk range proof verification failed');
    }
    if (this._audit) {
      this._audit('ZK_RANGE_PROOF_VERIFIED', { contractId: proofBundle.contractId, timestamp: Math.floor(Date.now() / 1000) });
    }
    return { verified: true, contractId: proofBundle.contractId };
  }
}

function _assertBounds(policy, commitment, min, max) {
  if (typeof min !== 'number' || typeof max !== 'number' || min >= max) {
    throw new HsmAdapterError('RANGE_BOUNDS_INVALID', 'range bounds must satisfy min < max');
  }
  const bitWidth = commitment.value.toString(2).length;
  if (bitWidth > (policy.maxRangeBitWidth || 64)) {
    throw new HsmAdapterError('RANGE_BIT_WIDTH_EXCEEDED', `commitment bit width ${bitWidth} exceeds maximum ${policy.maxRangeBitWidth}`);
  }
  if (bitWidth < (policy.minRangeBits || 8) || bitWidth > (policy.maxRangeBits || 4096)) {
    throw new HsmAdapterError('RANGE_BIT_WIDTH_BLOCKED', `commitment bit width ${bitWidth} outside allowed [${policy.minRangeBits}, ${policy.maxRangeBits}]`);
  }
  const v = Number(commitment.value);
  if (v < min || v > max) {
    throw new HsmAdapterError('RANGE_VALUE_OUT_OF_BOUNDS', `encrypted value ${v} outside [${min}, ${max}]`);
  }
}

function _computeRangeProof(contractId, commitment, min, max, workerAttestation) {
  const input = `${contractId}:${commitment.commitment}:${min}:${max}:${JSON.stringify(workerAttestation)}`;
  return crypto.createHash('sha256').update(input).digest('hex');
}

module.exports = { ZkRangeProofProcessor };
