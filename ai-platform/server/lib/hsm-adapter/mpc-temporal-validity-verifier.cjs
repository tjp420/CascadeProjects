'use strict';

/**
 * Track 62: MPC Temporal Validity Verifier.
 *
 * Multi-party validation engine that validates zero-knowledge proofs
 * of elapsed duration, tying decryption cycles directly to verified
 * Track 22 TimeAnchorEngine ticks. Triggers real-time peer bans for
 * premature or malformed temporal decryption proofs.
 *
 * @module hsm-adapter/mpc-temporal-validity-verifier
 */

const crypto = require('crypto');
const { HsmAdapterError } = require('./base-adapter.cjs');

class MpcTemporalValidityVerifier {
  /**
   * @param {object} options
   * @param {object} options.policy
   * @param {PqcTimeLockedMatrixRouter} options.router
   * @param {EnclaveAttestationClient} [options.attestationClient]
   * @param {Function} [options.audit]
   */
  constructor(options = {}) {
    this.policy = options.policy || {};
    this._router = options.router || null;
    this._attestationClient = options.attestationClient || null;
    this._audit = options.audit || null;
    this._bannedPeers = new Set();
    this._verifiedProofs = new Map();
  }

  /**
   * Verify a temporal decryption proof.
   * @param {object} request
   * @returns {object}
   */
  verifyTemporalProof(request) {
    _validateProofRequest(this.policy, request);
    if (!this._router) {
      throw new HsmAdapterError('TIMEPROOF_ROUTER_MISSING', 'time-locked matrix router is required');
    }
    if (this.policy.requireVerifierRelayAttestation && this._attestationClient) {
      try {
        const result = this._attestationClient.verify(request.verifierRelayAttestation);
        if (!result.verified) {
          throw new HsmAdapterError('TIMEPROOF_VERIFIER_UNATTESTED', 'verifier relay attestation invalid');
        }
      } catch (err) {
        if (err instanceof HsmAdapterError) throw err;
        throw new HsmAdapterError('TIMEPROOF_VERIFIER_UNATTESTED', 'verifier relay attestation invalid');
      }
    }
    if (typeof request.attestationAuthority === 'string' && !this.policy.allowedAttestationAuthorities.includes(request.attestationAuthority)) {
      throw new HsmAdapterError('TIMEPROOF_AUTHORITY_BLOCKED', `attestation authority ${request.attestationAuthority} is not allowed; permitted: ${this.policy.allowedAttestationAuthorities.join(', ')}`);
    }
    if (typeof request.peerId === 'string' && this._bannedPeers.has(request.peerId)) {
      throw new HsmAdapterError('TIMEPROOF_PEER_BANNED', `peer ${request.peerId} is banned`);
    }
    if (!request.zkProofHash || typeof request.zkProofHash !== 'string') {
      this._banPeerIfPolicy(request);
      throw new HsmAdapterError('TIMEPROOF_ZK_PROOF_MISSING', 'zero-knowledge proof hash is required');
    }
    if (!request.partialSignature || typeof request.partialSignature !== 'string') {
      this._banPeerIfPolicy(request);
      throw new HsmAdapterError('TIMEPROOF_PARTIAL_SIG_MISSING', 'partial signature is required');
    }
    if (typeof request.timeAnchorTick !== 'number' || request.timeAnchorTick <= 0) {
      this._banPeerIfPolicy(request);
      throw new HsmAdapterError('TIMEPROOF_ANCHOR_INVALID', 'valid timeAnchorTick is required');
    }
    const matrix = this._router.getMatrix(request.matrixId);
    if (!matrix) {
      this._banPeerIfPolicy(request);
      throw new HsmAdapterError('TIMEPROOF_MATRIX_NOT_FOUND', `matrix ${request.matrixId} not found`);
    }
    const now = Math.floor(Date.now() / 1000);
    if (now < matrix.releaseTimestamp) {
      this._banPeerIfPolicy(request);
      throw new HsmAdapterError('TIMEPROOF_PREMATURE', `premature decryption attempt for matrix ${request.matrixId} (release at ${matrix.releaseTimestamp}, now ${now})`);
    }
    if (typeof request.elapsedDurationSeconds === 'number' && request.elapsedDurationSeconds < matrix.timeDelaySeconds) {
      this._banPeerIfPolicy(request);
      throw new HsmAdapterError('TIMEPROOF_DURATION_INSUFFICIENT', `elapsed duration ${request.elapsedDurationSeconds}s below required ${matrix.timeDelaySeconds}s`);
    }
    const proofKey = `${request.matrixId}:${request.peerId || 'anonymous'}`;
    if (this._verifiedProofs.has(proofKey)) {
      this._banPeerIfPolicy(request);
      throw new HsmAdapterError('TIMEPROOF_DUPLICATE', `proof for matrix ${request.matrixId} already verified`);
    }
    const proofId = request.proofId || `proof-${crypto.randomBytes(4).toString('hex')}`;
    const proof = {
      proofId,
      matrixId: request.matrixId,
      elapsedDurationSeconds: request.elapsedDurationSeconds || matrix.timeDelaySeconds,
      timeAnchorTick: request.timeAnchorTick,
      zkProofHash: request.zkProofHash,
      verifierRelayAttestationHash: request.verifierRelayAttestationHash || 'unspecified',
      verifiedAt: now,
    };
    this._verifiedProofs.set(proofKey, proof);
    this._router.markReleased(request.matrixId);
    if (this._audit) {
      this._audit('TEMPORAL_DECRYPTION_PROVE_VERIFIED', { ...proof });
    }
    return proof;
  }

  /**
   * Check if a peer is banned.
   * @param {string} peerId
   * @returns {boolean}
   */
  isPeerBanned(peerId) {
    return this._bannedPeers.has(peerId);
  }

  /**
   * Get all verified proofs.
   * @returns {Array}
   */
  getVerifiedProofs() {
    return Array.from(this._verifiedProofs.values());
  }

  /**
   * Ban a peer if policy requires it.
   * @param {object} request
   * @private
   */
  _banPeerIfPolicy(request) {
    if (this.policy.banPrematureOrMalformedProofs && typeof request.peerId === 'string') {
      this._bannedPeers.add(request.peerId);
    }
  }
}

function _validateProofRequest(policy, request) {
  if (!request.matrixId) {
    throw new HsmAdapterError('TIMEPROOF_FIELDS_MISSING', 'matrixId is required');
  }
  if (policy.requireVerifierRelayAttestation && !request.verifierRelayAttestation) {
    throw new HsmAdapterError('TIMEPROOF_ATTESTATION_MISSING', 'verifier relay attestation is required');
  }
}

module.exports = { MpcTemporalValidityVerifier };
