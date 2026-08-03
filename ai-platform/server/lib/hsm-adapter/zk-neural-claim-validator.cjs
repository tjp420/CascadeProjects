'use strict';

/**
 * Track 112: Zero-Knowledge Neural Claim Validator.
 *
 * Validates zero-knowledge neural telemetry claims for bio-digital interface
 * attestation pools. Enforces the strict 2-second maxNeuralTelemetryWindowSeconds
 * boundary using high-resolution millisecond offsets against the current system
 * time, synapse chain depth, neural quorum, and PQC signature allow-lists.
 *
 * @module hsm-adapter/zk-neural-claim-validator
 */

const { HsmAdapterError } = require('./base-adapter.cjs');
const hsmMetrics = require('./hsm-metrics.cjs');

class ZkNeuralClaimValidator {
  constructor(options = {}) {
    this.policy = options.policy || {};
    this._attestationClient = options.attestationClient || null;
  }

  /**
   * Validate a zero-knowledge neural telemetry claim.
   * @param {object} claim
   * @param {string} claim.poolId
   * @param {string} claim.neuralSynapseStateDigest
   * @param {number} claim.timestampMs — high-resolution claim timestamp in milliseconds
   * @param {number} claim.neuralTelemetryWindowSeconds
   * @param {number} claim.synapseChainDepth
   * @param {number} [claim.neuralQuorum]
   * @param {string} [claim.pqcSignatureScheme]
   * @param {string} [claim.attestationAuthority]
   * @param {boolean} [claim.proofValid]
   * @returns {object} validation result
   */
  validateClaim(claim) {
    _validateClaimShape(claim);

    const nowMs = Date.now();
    const maxWindowMs = (this.policy.maxNeuralTelemetryWindowSeconds || 2) * 1000;
    const elapsedMs = nowMs - claim.timestampMs;

    if (elapsedMs > maxWindowMs) {
      this._issueChallenge(claim.poolId, 'inference_window_out_of_bounds');
      throw new HsmAdapterError('NEUROCLAIM_INFERENCE_WINDOW_OUT_OF_BOUNDS', `neural telemetry timestamp is ${elapsedMs}ms old; maximum window is ${maxWindowMs}ms`);
    }

    if (typeof claim.neuralTelemetryWindowSeconds === 'number' && this.policy.maxNeuralTelemetryWindowSeconds !== undefined && claim.neuralTelemetryWindowSeconds > this.policy.maxNeuralTelemetryWindowSeconds) {
      this._issueChallenge(claim.poolId, 'neural_telemetry_window_exceeded');
      throw new HsmAdapterError('NEUROCLAIM_INFERENCE_WINDOW_OUT_OF_BOUNDS', `neural telemetry window seconds ${claim.neuralTelemetryWindowSeconds} exceeds maximum ${this.policy.maxNeuralTelemetryWindowSeconds}`);
    }

    if (typeof claim.synapseChainDepth === 'number' && this.policy.maxSynapseChainDepth !== undefined && claim.synapseChainDepth > this.policy.maxSynapseChainDepth) {
      this._issueChallenge(claim.poolId, 'synapse_chain_depth_exceeded');
      throw new HsmAdapterError('NEUROCLAIM_SYNAPSE_CHAIN_DEPTH_EXCEEDED', `synapse chain depth ${claim.synapseChainDepth} exceeds maximum ${this.policy.maxSynapseChainDepth}`);
    }

    if (typeof claim.neuralQuorum === 'number' && this.policy.minNeuralQuorum !== undefined && claim.neuralQuorum < this.policy.minNeuralQuorum) {
      this._issueChallenge(claim.poolId, 'neural_quorum_insufficient');
      throw new HsmAdapterError('NEUROCLAIM_QUORUM_INSUFFICIENT', `neural quorum ${claim.neuralQuorum} below minimum ${this.policy.minNeuralQuorum}`);
    }

    if (typeof claim.pqcSignatureScheme === 'string' && this.policy.allowedPqcSignatureSchemes && !this.policy.allowedPqcSignatureSchemes.includes(claim.pqcSignatureScheme)) {
      this._issueChallenge(claim.poolId, 'pqc_signature_scheme_blocked');
      throw new HsmAdapterError('NEUROCLAIM_PQC_SCHEME_BLOCKED', `PQC signature scheme ${claim.pqcSignatureScheme} is not permitted; allowed: ${this.policy.allowedPqcSignatureSchemes.join(', ')}`);
    }

    if (typeof claim.attestationAuthority === 'string' && this.policy.allowedAttestationAuthorities && !this.policy.allowedAttestationAuthorities.includes(claim.attestationAuthority)) {
      this._issueChallenge(claim.poolId, 'attestation_authority_blocked');
      throw new HsmAdapterError('NEUROCLAIM_ATTESTATION_AUTHORITY_BLOCKED', `attestation authority ${claim.attestationAuthority} is not allowed; permitted: ${this.policy.allowedAttestationAuthorities.join(', ')}`);
    }

    if (claim.proofValid === false) {
      this._issueChallenge(claim.poolId, 'proof_invalid');
      throw new HsmAdapterError('NEUROCLAIM_PROOF_INVALID', `neural telemetry proof for pool ${claim.poolId} is invalid`);
    }

    hsmMetrics.incrementCounter('hsm_zk_neural_telemetry_verified_total', 1);
    return {
      poolId: claim.poolId,
      valid: true,
      verifiedAt: nowMs,
      elapsedMs,
    };
  }

  _issueChallenge(poolId, challengeType) {
    hsmMetrics.incrementCounter('hsm_neurogate_challenge_issued_total', 1);
  }
}

function _validateClaimShape(claim) {
  if (!claim || typeof claim !== 'object') {
    throw new HsmAdapterError('NEUROCLAIM_CLAIM_SHAPE_INVALID', 'claim must be an object');
  }
  if (!claim.poolId) {
    throw new HsmAdapterError('NEUROCLAIM_CLAIM_SHAPE_INVALID', 'poolId is required');
  }
  if (!claim.neuralSynapseStateDigest) {
    throw new HsmAdapterError('NEUROCLAIM_CLAIM_SHAPE_INVALID', 'neuralSynapseStateDigest is required');
  }
  if (typeof claim.timestampMs !== 'number') {
    throw new HsmAdapterError('NEUROCLAIM_CLAIM_SHAPE_INVALID', 'timestampMs must be a number');
  }
}

module.exports = { ZkNeuralClaimValidator };
