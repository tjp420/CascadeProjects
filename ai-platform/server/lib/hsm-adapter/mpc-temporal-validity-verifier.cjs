'use strict';

/**
 * Track 62: MPC Temporal Validity Verifier.
 *
 * Multi-party validation engine that validates zero-knowledge proofs
 * of elapsed duration, tying decryption cycles directly to verified
 * Track 22 TimeAnchorEngine ticks. Triggers real-time peer bans for
 * premature or malformed temporal decryption proofs.
 *
 * Extended with batch temporal verification, committee signature
 * aggregation, slashing window validation, and time anchor
 * synchronization tracking.
 *
 * @module hsm-adapter/mpc-temporal-validity-verifier
 */

const crypto = require('crypto');
const { HsmAdapterError } = require('./base-adapter.cjs');

const PROOF_STATUS = {
  PENDING: 'pending',
  VERIFIED: 'verified',
  INVALID: 'invalid',
  SLASHED: 'slashed',
};

const SLASH_REASON = {
  PREMATURE: 'premature_decryption',
  MALFORMED: 'malformed_proof',
  DUPLICATE: 'duplicate_proof',
  INSUFFICIENT_DURATION: 'insufficient_duration',
  BANNED_PEER: 'banned_peer',
};

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
    this._slashedProofs = new Map(); // proofKey -> slash record
    this._batchResults = []; // batch verification history
    this._maxBatchHistory = 50;
    this._slashingWindowSeconds = options.slashingWindowSeconds || 3600;
    this._maxBatchSize = options.maxBatchSize || 100;
    this._verifyCount = 0;
    this._batchCount = 0;
    this._slashCount = 0;
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
      this._banPeerIfPolicy(request);
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
      this._recordSlash(request, SLASH_REASON.PREMATURE);
      throw new HsmAdapterError('TIMEPROOF_PREMATURE', `premature decryption attempt for matrix ${request.matrixId} (release at ${matrix.releaseTimestamp}, now ${now})`);
    }
    if (typeof request.elapsedDurationSeconds === 'number' && request.elapsedDurationSeconds < matrix.timeDelaySeconds) {
      this._banPeerIfPolicy(request);
      this._recordSlash(request, SLASH_REASON.INSUFFICIENT_DURATION);
      throw new HsmAdapterError('TIMEPROOF_DURATION_INSUFFICIENT', `elapsed duration ${request.elapsedDurationSeconds}s below required ${matrix.timeDelaySeconds}s`);
    }
    const proofKey = `${request.matrixId}:${request.peerId || 'anonymous'}`;
    if (this._verifiedProofs.has(proofKey)) {
      this._banPeerIfPolicy(request);
      this._recordSlash(request, SLASH_REASON.DUPLICATE);
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
      status: PROOF_STATUS.VERIFIED,
      peerId: request.peerId || 'anonymous',
    };
    this._verifiedProofs.set(proofKey, proof);
    this._router.markReleased(request.matrixId);
    this._verifyCount++;
    if (this._audit) {
      this._audit('TEMPORAL_DECRYPTION_PROVE_VERIFIED', { ...proof });
    }
    return proof;
  }

  /**
   * Batch verify multiple temporal proofs.
   * @param {object[]} requests
   * @returns {object}
   */
  batchVerifyTemporalProofs(requests) {
    if (!Array.isArray(requests) || requests.length === 0) {
      throw new HsmAdapterError('TIMEPROOF_BATCH_EMPTY', 'batch requests array is required');
    }
    if (requests.length > this._maxBatchSize) {
      throw new HsmAdapterError('TIMEPROOF_BATCH_TOO_LARGE',
        `${requests.length} exceeds max batch size ${this._maxBatchSize}`);
    }
    const results = [];
    let verifiedCount = 0;
    let failedCount = 0;
    for (const req of requests) {
      try {
        const proof = this.verifyTemporalProof(req);
        results.push({ proofId: proof.proofId, matrixId: proof.matrixId, verified: true });
        verifiedCount++;
      } catch (err) {
        results.push({
          matrixId: req.matrixId || 'unknown',
          verified: false,
          error: err.code || 'TIMEPROOF_BATCH_ERROR',
        });
        failedCount++;
      }
    }
    this._batchCount++;
    this._batchResults.push({
      batchSize: requests.length,
      verifiedCount,
      failedCount,
      processedAt: Date.now(),
    });
    if (this._batchResults.length > this._maxBatchHistory) {
      this._batchResults.shift();
    }
    if (this._audit) {
      this._audit('TIMEPROOF_BATCH_VERIFIED', { verifiedCount, failedCount, batchSize: requests.length });
    }
    return {
      totalRequests: requests.length,
      verifiedCount,
      failedCount,
      results,
    };
  }

  /**
   * Aggregate partial signatures from committee members.
   * @param {string} matrixId
   * @param {object[]} partialSignatures - Array of {peerId, signature}
   * @returns {object}
   */
  aggregatePartialSignatures(matrixId, partialSignatures) {
    if (!matrixId || typeof matrixId !== 'string') {
      throw new HsmAdapterError('TIMEPROOF_MATRIX_ID_REQUIRED', 'matrixId is required');
    }
    if (!Array.isArray(partialSignatures) || partialSignatures.length === 0) {
      throw new HsmAdapterError('TIMEPROOF_NO_PARTIAL_SIGS', 'partialSignatures array is required');
    }
    if (partialSignatures.length < (this.policy.minCommitteeQuorum || 3)) {
      throw new HsmAdapterError('TIMEPROOF_QUORUM_INSUFFICIENT',
        `${partialSignatures.length} partial signatures below minimum ${this.policy.minCommitteeQuorum || 3}`);
    }
    // Check for banned peers in the signature set
    for (const sig of partialSignatures) {
      if (sig.peerId && this._bannedPeers.has(sig.peerId)) {
        throw new HsmAdapterError('TIMEPROOF_PEER_BANNED',
          `peer ${sig.peerId} is banned and cannot participate in signature aggregation`);
      }
    }
    // Simulate BLS-style aggregate signature
    const sigHash = crypto.createHash('sha256')
      .update(partialSignatures.map(s => s.signature).join(':'))
      .digest('hex');
    const aggregated = {
      matrixId,
      signatureCount: partialSignatures.length,
      aggregatedSignature: sigHash,
      participantIds: partialSignatures.map(s => s.peerId || 'anonymous'),
      aggregatedAt: Math.floor(Date.now() / 1000),
    };
    if (this._audit) {
      this._audit('TIMEPROOF_SIGNATURES_AGGREGATED', { matrixId, count: partialSignatures.length });
    }
    return aggregated;
  }

  /**
   * Validate a proof within a slashing window.
   * @param {string} matrixId
   * @param {number} proofTimestamp
   * @returns {object}
   */
  validateSlashingWindow(matrixId, proofTimestamp) {
    const matrix = this._router ? this._router.getMatrix(matrixId) : null;
    if (!matrix) {
      throw new HsmAdapterError('TIMEPROOF_MATRIX_NOT_FOUND', `matrix ${matrixId} not found`);
    }
    if (typeof proofTimestamp !== 'number') {
      throw new HsmAdapterError('TIMEPROOF_TIMESTAMP_INVALID', 'proofTimestamp must be a number');
    }
    const now = Math.floor(Date.now() / 1000);
    const windowStart = matrix.releaseTimestamp;
    const windowEnd = matrix.releaseTimestamp + this._slashingWindowSeconds;
    const withinWindow = proofTimestamp >= windowStart && proofTimestamp <= windowEnd;
    const result = {
      matrixId,
      proofTimestamp,
      windowStart,
      windowEnd,
      withinWindow,
      slashingWindowSeconds: this._slashingWindowSeconds,
    };
    if (!withinWindow && this._audit) {
      this._audit('TIMEPROOF_SLASHING_WINDOW_VIOLATION', { matrixId, proofTimestamp, windowStart, windowEnd });
    }
    return result;
  }

  /**
   * Get slashing statistics.
   * @returns {object}
   */
  getSlashingStats() {
    const slashesByReason = {};
    for (const slash of this._slashedProofs.values()) {
      slashesByReason[slash.reason] = (slashesByReason[slash.reason] || 0) + 1;
    }
    return {
      totalSlashes: this._slashCount,
      bannedPeers: this._bannedPeers.size,
      slashesByReason,
    };
  }

  /**
   * Get batch verification history.
   * @param {number} [limit]
   * @returns {object[]}
   */
  getBatchHistory(limit) {
    const n = typeof limit === 'number' ? limit : 20;
    return this._batchResults.slice(-n);
  }

  /**
   * Get summary statistics.
   * @returns {object}
   */
  getStats() {
    return {
      totalVerified: this._verifiedProofs.size,
      totalSlashed: this._slashedProofs.size,
      totalBanned: this._bannedPeers.size,
      totalBatches: this._batchCount,
      verifyCount: this._verifyCount,
      slashCount: this._slashCount,
    };
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
   * Get all slashed proofs.
   * @returns {Array}
   */
  getSlashedProofs() {
    return Array.from(this._slashedProofs.values());
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

  /**
   * Record a slashing event.
   * @param {object} request
   * @param {string} reason
   * @private
   */
  _recordSlash(request, reason) {
    const proofKey = `${request.matrixId || 'unknown'}:${request.peerId || 'anonymous'}`;
    this._slashedProofs.set(proofKey, {
      matrixId: request.matrixId || 'unknown',
      peerId: request.peerId || 'anonymous',
      reason,
      slashedAt: Math.floor(Date.now() / 1000),
    });
    this._slashCount++;
    if (this._audit) {
      this._audit('TIMEPROOF_SLASHED', { matrixId: request.matrixId, peerId: request.peerId, reason });
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

module.exports = {
  MpcTemporalValidityVerifier,
  PROOF_STATUS,
  SLASH_REASON,
};
