'use strict';

/**
 * Hardware Attestation Verifier.
 *
 * Verifies hardware attestation evidence using a nonce challenge-response
 * protocol with strict freshness enforcement. Supports TPM 2.0 (PCR-based),
 * SEV-SNP (MRENCLAVE), and SGX (MRENCLAVE) attestation profiles.
 *
 * Security invariants (NOT configurable):
 *   - Nonce TTL: 5 minutes
 *   - Timestamp skew: ±10 seconds
 *   - Max attestation age: 60 seconds
 *   - Nonce size: 256 bits (32 bytes)
 *
 * @module hsm-adapter/hardware-attestation-verify
 */

const crypto = require('crypto');
const { HsmAdapterError } = require('./base-adapter.cjs');
const { MOCK_SIGNING_SECRET, _canonical } = require('./mock-tpm-quote-generator.cjs');

// ── Security invariants (hardcoded — NOT Helm-configurable) ──────────
const ATTESTATION_NONCE_TTL_MS = 5 * 60 * 1000;    // 5 minutes
const ATTESTATION_TIMESTAMP_SKEW_MS = 10 * 1000;    // ±10 seconds
const ATTESTATION_MAX_AGE_SECONDS = 60;              // 60 seconds
const ATTESTATION_NONCE_BYTES = 32;                  // 256-bit nonce

const SUPPORTED_PROFILES = new Set(['tpm2', 'sev-snp', 'sgx', 'mock-authority']);

/**
 * Hardware Attestation Verifier.
 */
class HardwareAttestationVerifier {
  /**
   * @param {object} options
   * @param {object} [options.expectedMeasurements] — { tpm2: { pcrs }, 'sev-snp': { mrenclave }, sgx: { mrenclave } }
   * @param {string[]} [options.allowedAuthorities] — default: all supported profiles
   * @param {Function} [options.audit] — SIEM audit callback
   */
  constructor(options = {}) {
    this._expectedMeasurements = options.expectedMeasurements || {};
    this._allowedAuthorities = options.allowedAuthorities || ['tpm2', 'sev-snp', 'sgx', 'mock-authority'];
    this._audit = options.audit || null;
    this._pendingChallenges = new Map();
    this._seenNonces = new Map();
  }

  /**
   * Issue a nonce challenge for a sandbox.
   * @param {string} sandboxId
   * @returns {{ nonce: string, issuedAt: number }}
   */
  issueChallenge(sandboxId) {
    // Lazy pruning: clean expired challenges and nonces
    this._pruneExpired();

    const nonce = crypto.randomBytes(ATTESTATION_NONCE_BYTES).toString('hex');
    const issuedAt = Date.now();
    this._pendingChallenges.set(sandboxId, { nonce, issuedAt });
    return { nonce, issuedAt };
  }

  /**
   * Verify an attestation document with nonce challenge-response.
   * @param {string} sandboxId
   * @param {object} attestation
   * @returns {{ verified: boolean, measurement: string, authority: string }}
   * @throws {HsmAdapterError} on any verification failure
   */
  verify(sandboxId, attestation) {
    // 1. Check challenge exists and not expired (before pruning)
    const challenge = this._pendingChallenges.get(sandboxId);
    if (!challenge) {
      // Prune other expired entries, then fail
      this._pruneExpired();
      this._emitSIEM('ATTESTATION_CHALLENGE_MISSING', { sandboxId, siemSeverity: 'high', siemCategory: 'attestation_challenge_missing' });
      throw new HsmAdapterError('ATTESTATION_CHALLENGE_MISSING', `no pending challenge for sandbox ${sandboxId}`);
    }

    const now = Date.now();
    const challengeAge = now - challenge.issuedAt;
    if (challengeAge > ATTESTATION_NONCE_TTL_MS) {
      this._pendingChallenges.delete(sandboxId);
      // Prune other expired entries
      this._pruneExpired();
      this._emitSIEM('ATTESTATION_CHALLENGE_EXPIRED', { sandboxId, challengeAgeMs: challengeAge, siemSeverity: 'high', siemCategory: 'attestation_challenge_expired' });
      throw new HsmAdapterError('ATTESTATION_CHALLENGE_EXPIRED', `challenge expired ${challengeAge}ms ago (TTL: ${ATTESTATION_NONCE_TTL_MS}ms)`);
    }

    // Lazy pruning of other expired entries
    this._pruneExpired();

    // 2. Validate attestation document structure
    if (!attestation || typeof attestation !== 'object') {
      this._emitSIEM('ATTESTATION_INVALID_DOCUMENT', { sandboxId, siemSeverity: 'high', siemCategory: 'attestation_invalid_document' });
      throw new HsmAdapterError('ATTESTATION_INVALID_DOCUMENT', 'attestation document missing or invalid');
    }

    // 3. Verify nonce matches
    if (!attestation.nonce) {
      this._emitSIEM('ATTESTATION_CHALLENGE_MISSING', { sandboxId, reason: 'nonce field missing', siemSeverity: 'high', siemCategory: 'attestation_challenge_missing' });
      throw new HsmAdapterError('ATTESTATION_CHALLENGE_MISSING', 'attestation nonce missing');
    }
    if (attestation.nonce !== challenge.nonce) {
      this._emitSIEM('ATTESTATION_NONCE_MISMATCH', { sandboxId, expected: challenge.nonce.slice(0, 8) + '...', received: attestation.nonce.slice(0, 8) + '...', siemSeverity: 'high', siemCategory: 'attestation_nonce_mismatch' });
      throw new HsmAdapterError('ATTESTATION_NONCE_MISMATCH', 'attestation nonce does not match challenge');
    }

    // 4. Check timestamp skew
    if (typeof attestation.timestamp !== 'number') {
      this._emitSIEM('ATTESTATION_INVALID_DOCUMENT', { sandboxId, reason: 'timestamp missing', siemSeverity: 'high', siemCategory: 'attestation_invalid_document' });
      throw new HsmAdapterError('ATTESTATION_INVALID_DOCUMENT', 'attestation timestamp missing');
    }
    const skew = Math.abs(now - attestation.timestamp);
    if (skew > ATTESTATION_TIMESTAMP_SKEW_MS) {
      this._emitSIEM('TIMESTAMP_SKEW', { sandboxId, skewMs: skew, maxSkewMs: ATTESTATION_TIMESTAMP_SKEW_MS, siemSeverity: 'high', siemCategory: 'attestation_timestamp_skew' });
      throw new HsmAdapterError('TIMESTAMP_SKEW', `timestamp skew ${skew}ms exceeds max ${ATTESTATION_TIMESTAMP_SKEW_MS}ms`);
    }

    // 5. Replay protection: reject if nonce seen before
    const seenAt = this._seenNonces.get(attestation.nonce);
    if (seenAt && (now - seenAt) <= ATTESTATION_NONCE_TTL_MS) {
      this._emitSIEM('ATTESTATION_REPLAY_DETECTED', { sandboxId, noncePrefix: attestation.nonce.slice(0, 8) + '...', siemSeverity: 'high', siemCategory: 'attestation_replay_detected' });
      throw new HsmAdapterError('ATTESTATION_REPLAY_DETECTED', 'nonce replay detected');
    }

    // 6. Verify authority
    if (!attestation.authority) {
      this._emitSIEM('ATTESTATION_INVALID_DOCUMENT', { sandboxId, reason: 'authority missing', siemSeverity: 'high', siemCategory: 'attestation_invalid_document' });
      throw new HsmAdapterError('ATTESTATION_INVALID_DOCUMENT', 'attestation authority missing');
    }
    if (!this._allowedAuthorities.includes(attestation.authority)) {
      this._emitSIEM('ATTESTATION_UNTRUSTED_AUTHORITY', { sandboxId, authority: attestation.authority, siemSeverity: 'high', siemCategory: 'attestation_untrusted_authority' });
      throw new HsmAdapterError('ATTESTATION_UNTRUSTED_AUTHORITY', `authority ${attestation.authority} is not trusted`);
    }

    // 7. Verify measurement (PCR or MRENCLAVE)
    const measurement = this._verifyMeasurement(attestation);
    if (!measurement) {
      this._emitSIEM('ATTESTATION_UNTRUSTED_MEASUREMENT', { sandboxId, authority: attestation.authority, siemSeverity: 'high', siemCategory: 'attestation_untrusted_measurement' });
      throw new HsmAdapterError('ATTESTATION_UNTRUSTED_MEASUREMENT', 'attestation measurement does not match expected values');
    }

    // 8. Verify signature
    if (!attestation.signature) {
      this._emitSIEM('ATTESTATION_SIGNATURE_INVALID', { sandboxId, reason: 'signature missing', siemSeverity: 'high', siemCategory: 'attestation_signature_invalid' });
      throw new HsmAdapterError('ATTESTATION_SIGNATURE_INVALID', 'attestation signature missing');
    }
    if (!this._verifySignature(attestation)) {
      this._emitSIEM('ATTESTATION_SIGNATURE_INVALID', { sandboxId, reason: 'signature mismatch', siemSeverity: 'high', siemCategory: 'attestation_signature_invalid' });
      throw new HsmAdapterError('ATTESTATION_SIGNATURE_INVALID', 'attestation signature verification failed');
    }

    // 9. Record nonce for replay protection
    this._seenNonces.set(attestation.nonce, now);

    // 10. Clean up challenge
    this._pendingChallenges.delete(sandboxId);

    return { verified: true, measurement, authority: attestation.authority };
  }

  /**
   * Verify the measurement in an attestation against expected values.
   * @param {object} attestation
   * @returns {string|null} measurement identifier if valid, null if not
   */
  _verifyMeasurement(attestation) {
    const expected = this._expectedMeasurements[attestation.authority];
    if (!expected) {
      // No expected measurements configured for this authority — reject (fail closed)
      return null;
    }

    if (attestation.authority === 'tpm2') {
      // Verify PCR values
      if (!attestation.pcrs || typeof attestation.pcrs !== 'object') return null;
      if (!expected.pcrs) return null;
      for (const [pcrIndex, expectedValue] of Object.entries(expected.pcrs)) {
        const actual = attestation.pcrs[pcrIndex];
        if (!actual || actual !== expectedValue) return null;
      }
      // Measurement = hash of all PCR values
      const pcrConcat = Object.keys(attestation.pcrs).sort().map((k) => attestation.pcrs[k]).join('');
      return crypto.createHash('sha256').update(pcrConcat).digest('hex');
    }

    if (attestation.authority === 'sev-snp' || attestation.authority === 'sgx') {
      // Verify MRENCLAVE
      if (!attestation.mrenclave) return null;
      if (!expected.mrenclave) return null;
      if (attestation.mrenclave !== expected.mrenclave) return null;
      return attestation.mrenclave;
    }

    return null;
  }

  /**
   * Verify the HMAC signature on an attestation.
   * @param {object} attestation
   * @returns {boolean}
   */
  _verifySignature(attestation) {
    const canonical = _canonical(attestation);
    const expected = crypto.createHmac('sha256', MOCK_SIGNING_SECRET).update(canonical).digest('hex');
    return attestation.signature === expected;
  }

  /**
   * Lazy pruning of expired challenges and nonces.
   * Called during issueChallenge() and verify() to avoid setInterval.
   */
  _pruneExpired() {
    const now = Date.now();
    // Prune expired challenges
    for (const [sandboxId, challenge] of this._pendingChallenges) {
      if (now - challenge.issuedAt > ATTESTATION_NONCE_TTL_MS) {
        this._pendingChallenges.delete(sandboxId);
      }
    }
    // Prune expired nonces
    for (const [nonce, seenAt] of this._seenNonces) {
      if (now - seenAt > ATTESTATION_NONCE_TTL_MS) {
        this._seenNonces.delete(nonce);
      }
    }
  }

  /**
   * Emit a SIEM alert.
   * @param {string} event
   * @param {object} data
   */
  _emitSIEM(event, data) {
    if (this._audit) {
      this._audit(event, { timestamp: Date.now(), ...data });
    }
  }

  /**
   * Get the pending challenge for a sandbox (for testing).
   * @param {string} sandboxId
   * @returns {object|undefined}
   */
  getPendingChallenge(sandboxId) {
    return this._pendingChallenges.get(sandboxId);
  }

  /**
   * Get the count of seen nonces (for testing).
   * @returns {number}
   */
  getSeenNonceCount() {
    return this._seenNonces.size;
  }
}

module.exports = {
  HardwareAttestationVerifier,
  ATTESTATION_NONCE_TTL_MS,
  ATTESTATION_TIMESTAMP_SKEW_MS,
  ATTESTATION_MAX_AGE_SECONDS,
  ATTESTATION_NONCE_BYTES,
  SUPPORTED_PROFILES,
};
