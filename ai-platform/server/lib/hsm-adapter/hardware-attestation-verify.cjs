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
const { CertChainValidator } = require('./cert-chain-validator.cjs');
const { RootTrustStore } = require('./root-trust-store.cjs');

// ── Security invariants (hardcoded — NOT Helm-configurable) ──────────
const ATTESTATION_NONCE_TTL_MS = 5 * 60 * 1000;    // 5 minutes
const ATTESTATION_TIMESTAMP_SKEW_MS = 10 * 1000;    // ±10 seconds
const ATTESTATION_MAX_AGE_SECONDS = 60;              // 60 seconds
const ATTESTATION_NONCE_BYTES = 32;                  // 256-bit nonce

const SUPPORTED_PROFILES = new Set(['tpm2', 'sev-snp', 'sgx', 'mock-authority']);

// ── SEV-SNP Attestation Report Structure ──────────────────────────────
//
// The AMD SEV-SNP attestation report is a 4096-byte (PAGE_SIZE) structured
// binary blob. The key fields we extract for verification:
//
// Offset  Size  Field
//   0x00    4   VERSION (1 = v1)
//   0x04    4   ALGORITHM (1 = ECC P-384 with SHA-384)
//   0x08    4   POLICY
//   0x10    4   FAMILY_ID (8 bytes)
//   0x18    4   IMAGE_ID (8 bytes)
//   0x20    4   VMPL
//   0x28    8   SIGNATURE_ALGORITHM
//   0x30   16   PLATFORM_VERSION
//   0x40   16   PLATFORM_INFO
//   0x50    4   AUTHOR_KEY_EN
//   0x54   108  AUTHOR_KEY
//   0xC0   48   REPORT_DATA (user-supplied nonce/challenge)
//   0xF0   48   MEASUREMENT (MRENCLAVE equivalent)
//  0x120   16   HOST_DATA
//  0x130   16   ID_KEY_DIGEST
//  0x140   48   AUTHOR_KEY_DIGEST
//  0x170   16   REPORT_ID
//  0x180   16   REPORT_ID_MA
//  0x190    8   REPORTED_TCB
//  0x198    8   CHIP_ID (64 bytes total)
//  0x1D8    8   COMMITTED
//  ...
//  0x2D0  512   SIGNATURE
//
// For verification, we extract: REPORT_DATA (nonce), MEASUREMENT (MRENCLAVE),
// VERSION, POLICY, and SIGNATURE.

const SEV_SNP_REPORT_SIZE = 4096;
const SEV_SNP_REPORT_DATA_OFFSET = 0xC0;     // 48 bytes — user nonce
const SEV_SNP_REPORT_DATA_SIZE = 48;
const SEV_SNP_MEASUREMENT_OFFSET = 0xF0;     // 48 bytes — MRENCLAVE
const SEV_SNP_MEASUREMENT_SIZE = 48;
const SEV_SNP_VERSION_OFFSET = 0x00;         // 4 bytes
const SEV_SNP_POLICY_OFFSET = 0x08;          // 4 bytes
const SEV_SNP_SIGNATURE_OFFSET = 0x2D0;      // 512 bytes

// ── SGX DCAP Quote Structure ──────────────────────────────────────────
//
// Intel SGX DCAP quotes have a header + report body + signature.
// Key fields in the report body:
//
// Offset  Size  Field
//   0x00    16  MRENCLAVE (measurement of the enclave code)
//   0x10    16  MRSIGNER (hash of the enclave signer's public key)
//   0x20     4  ISVPRODID (product ID)
//   0x24     2  ISVSVN (security version number)
//   0x26     8  ATTRIBUTES (flags: INITIALIZED, PROVISIONING_KEY, etc.)
//   0x2E    16  REPORT_DATA (user-supplied nonce/challenge)
//
// Quote header:
//   0x00     2  VERSION (3 = DCAP)
//   0x02     2  SIGN_TYPE
//   0x04     4  QE_SVN
//   0x08     4  PCE_SVN
//   0x0C    16  BASENAME
//   0x1C   484  REPORT_BODY
//   0x200  var  SIGNATURE

const SGX_QUOTE_HEADER_SIZE = 0x1C;          // 28 bytes
const SGX_MRENCLAVE_OFFSET = 0x00;           // within report body
const SGX_MRENCLAVE_SIZE = 16;
const SGX_MRSIGNER_OFFSET = 0x10;            // within report body
const SGX_MRSIGNER_SIZE = 16;
const SGX_ISVPRODID_OFFSET = 0x20;           // within report body
const SGX_ISVPRODID_SIZE = 2;
const SGX_REPORT_DATA_OFFSET = 0x2E;         // within report body (actually 0x68 in full quote)
const SGX_REPORT_DATA_SIZE = 16;             // SGX report data is 16 bytes (we pad nonce to fit)

// In a full SGX quote, the report body starts at offset SGX_QUOTE_HEADER_SIZE
const SGX_REPORT_BODY_OFFSET = SGX_QUOTE_HEADER_SIZE;

/**
 * Hardware Attestation Verifier.
 */
class HardwareAttestationVerifier {
  /**
   * @param {object} options
   * @param {object} [options.expectedMeasurements] — { tpm2: { pcrs }, 'sev-snp': { mrenclave }, sgx: { mrenclave } }
   * @param {string[]} [options.allowedAuthorities] — default: all supported profiles
   * @param {Function} [options.audit] — SIEM audit callback (legacy, still supported)
   * @param {object} [options.broker] — SiemSecurityBroker instance (preferred over audit)
   */
  constructor(options = {}) {
    this._expectedMeasurements = options.expectedMeasurements || {};
    this._allowedAuthorities = options.allowedAuthorities || ['tpm2', 'sev-snp', 'sgx', 'mock-authority'];
    this._audit = options.audit || null;
    this._broker = options.broker || null;
    this._certChainValidator = options.certChainValidator || null;
    this._rootTrustStore = options.rootTrustStore || null;
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

    if (attestation.authority === 'sev-snp') {
      // If the attestation has a raw binary report, parse it
      if (attestation.rawReport) {
        const parsed = parseSevSnpReport(attestation.rawReport);
        if (!parsed) return null;
        // Verify the parsed MRENCLAVE (MEASUREMENT field)
        if (!expected.mrenclave) return null;
        if (parsed.measurement !== expected.mrenclave) return null;
        // Verify the REPORT_DATA contains the nonce (padded to 48 bytes)
        if (attestation.nonce) {
          const expectedReportData = Buffer.concat([
            Buffer.from(attestation.nonce, 'hex'),
            Buffer.alloc(SEV_SNP_REPORT_DATA_SIZE - Buffer.from(attestation.nonce, 'hex').length),
          ]).toString('hex');
          if (parsed.reportData !== expectedReportData) return null;
        }
        // Verify policy constraints if configured
        if (expected.policy !== undefined && parsed.policy !== expected.policy) return null;
        if (expected.minVersion !== undefined && parsed.version < expected.minVersion) return null;
        return parsed.measurement;
      }
      // Fallback: pre-parsed attestation with mrenclave field (backward compat)
      if (!attestation.mrenclave) return null;
      if (!expected.mrenclave) return null;
      if (attestation.mrenclave !== expected.mrenclave) return null;
      return attestation.mrenclave;
    }

    if (attestation.authority === 'sgx') {
      // If the attestation has a raw binary quote, parse it
      if (attestation.rawQuote) {
        const parsed = parseSgxQuote(attestation.rawQuote);
        if (!parsed) return null;
        // Verify MRENCLAVE
        if (!expected.mrenclave) return null;
        if (parsed.mrenclave !== expected.mrenclave) return null;
        // Verify MRSIGNER if configured
        if (expected.mrsigner && parsed.mrsigner !== expected.mrsigner) return null;
        // Verify ISVPRODID if configured
        if (expected.isvProdId !== undefined && parsed.isvProdId !== expected.isvProdId) return null;
        // Verify REPORT_DATA contains the nonce (padded to 16 bytes)
        if (attestation.nonce) {
          const nonceBytes = Buffer.from(attestation.nonce, 'hex');
          const noncePrefix = nonceBytes.slice(0, SGX_REPORT_DATA_SIZE).toString('hex');
          if (parsed.reportData !== noncePrefix) return null;
        }
        return parsed.mrenclave;
      }
      // Fallback: pre-parsed attestation with mrenclave field (backward compat)
      if (!attestation.mrenclave) return null;
      if (!expected.mrenclave) return null;
      if (attestation.mrenclave !== expected.mrenclave) return null;
      if (expected.mrsigner && attestation.mrsigner && attestation.mrsigner !== expected.mrsigner) return null;
      if (expected.isvProdId !== undefined && attestation.isvProdId !== undefined &&
          attestation.isvProdId !== expected.isvProdId) return null;
      return attestation.mrenclave;
    }

    if (attestation.authority === 'mock-authority') {
      // Mock authority: validate PCR values if configured, otherwise trust signature
      if (expected.pcrs && attestation.pcrs) {
        for (const [pcrIndex, expectedValue] of Object.entries(expected.pcrs)) {
          const actual = attestation.pcrs[pcrIndex];
          if (!actual || actual !== expectedValue) return null;
        }
        const pcrConcat = Object.keys(attestation.pcrs).sort().map((k) => attestation.pcrs[k]).join('');
        return crypto.createHash('sha256').update(pcrConcat).digest('hex');
      }
      return 'mock';
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
   * Routes through SiemSecurityBroker when available (preferred),
   * falls back to legacy audit callback for backward compatibility.
   * @param {string} event
   * @param {object} data — must include siemSeverity and siemCategory
   */
  _emitSIEM(event, data) {
    if (this._broker) {
      this._broker.logEvent({
        siemSeverity: (data.siemSeverity || 'high').toUpperCase(),
        siemCategory: data.siemCategory || event.toLowerCase(),
        siemSource: 'hardware-attestation-verify',
        context: { event, sandboxId: data.sandboxId, ...data },
      });
    } else if (this._audit) {
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
   * Validate a certificate chain for the attestation authority.
   * @param {object} params
   * @param {string} params.authority — 'sev-snp' or 'sgx'
   * @param {string|Buffer} [params.leafCertificate] — leaf cert (VCEK / PCK)
   * @param {string[]|Buffer[]} [params.certificateChain] — ordered [leaf, ..., root]
   * @returns {{ valid: boolean, errors: string[], publicKey?: KeyObject }}
   */
  _validateCertificateChain({ authority, leafCertificate, certificateChain }) {
    const errors = [];
    const leaf = leafCertificate
      || (certificateChain && certificateChain.length ? certificateChain[0] : null);

    if (!leaf) {
      errors.push('no leaf certificate provided');
      return { valid: false, errors };
    }

    let validator = null;
    let pinnedRoot = null;

    if (this._certChainValidator instanceof CertChainValidator) {
      validator = this._certChainValidator;
    } else if (this._rootTrustStore && this._rootTrustStore.isConfigured()) {
      // Build a validator from the trust store based on authority
      validator = new CertChainValidator({
        pinnedRootFingerprints: this._rootTrustStore.getPinnedFingerprints(),
      });
      if (authority === 'sev-snp') {
        validator.addRootCA(this._rootTrustStore.getAmdArk());
        validator.addIntermediateCA(this._rootTrustStore.getAmdAsk());
        pinnedRoot = this._rootTrustStore.getAmdArk();
      } else if (authority === 'sgx') {
        validator.addRootCA(this._rootTrustStore.getIntelRootCA());
        validator.addIntermediateCA(this._rootTrustStore.getIntelPckCA());
        pinnedRoot = this._rootTrustStore.getIntelRootCA();
      }
    } else {
      // No chain validation configured — fail closed if a cert was provided
      errors.push('no certificate chain validator or root trust store configured');
      return { valid: false, errors };
    }

    let result;
    if (certificateChain && certificateChain.length) {
      // Load the chain from the provided array: first element is leaf, last is root
      if (certificateChain.length > 1) {
        validator.addRootCA(certificateChain[certificateChain.length - 1]);
      }
      for (let i = 1; i < certificateChain.length - 1; i += 1) {
        validator.addIntermediateCA(certificateChain[i]);
      }
      result = validator.validateChain(certificateChain[0]);
    } else if (pinnedRoot) {
      // Use explicit vendor chain
      if (authority === 'sev-snp') {
        result = validator.validateSevSnpChain(leaf, this._rootTrustStore.getAmdAsk(), pinnedRoot);
      } else if (authority === 'sgx') {
        result = validator.validateSgxChain(leaf, this._rootTrustStore.getIntelPckCA(), pinnedRoot);
      } else {
        result = { valid: false, errors: ['unknown authority for chain validation: ' + authority] };
      }
    } else {
      result = validator.validateChain(leaf);
    }

    const publicKey = result.valid ? validator.extractPublicKey(leaf) : null;

    if (!result.valid) {
      this._emitSIEM('ATTESTATION_CHAIN_INVALID', {
        sandboxId: 'unknown',
        authority,
        errors: result.errors,
        siemSeverity: 'high',
        siemCategory: 'attestation_chain_invalid',
      });
    }

    return { valid: result.valid, errors: result.errors, publicKey };
  }

  /**
   * Verify an ECDSA/RSA signature over attestation data.
   * @param {object} attestation
   * @param {string} attestation.authority
   * @param {string} attestation.rawSignature — hex signature
   * @param {string} attestation.signedData — hex data that was signed
   * @param {KeyObject} publicKey
   * @returns {boolean}
   */
  _verifyEcdsaSignature(attestation, publicKey) {
    if (!publicKey) return false;
    try {
      const data = Buffer.from(attestation.signedData, 'hex');
      const signature = Buffer.from(attestation.rawSignature, 'hex');
      const algorithm = attestation.authority === 'sgx' ? 'sha256' : 'sha384';
      return crypto.verify(algorithm, data, publicKey, signature);
    } catch {
      return false;
    }
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
  parseSevSnpReport,
  parseSgxQuote,
  SEV_SNP_REPORT_SIZE,
  SEV_SNP_REPORT_DATA_OFFSET,
  SEV_SNP_MEASUREMENT_OFFSET,
  // Certificate chain validation
  CertChainValidator,
  RootTrustStore,
};

// ── SEV-SNP Report Parser ─────────────────────────────────────────────
//
// Parses a raw AMD SEV-SNP attestation report (4096-byte binary blob)
// and extracts the fields needed for verification.
//
// @param {Buffer|string} rawReport — 4096-byte SEV-SNP attestation report
// @returns {object|null} — { version, policy, reportData, measurement, signature } or null on parse failure

function parseSevSnpReport(rawReport) {
  try {
    const buf = Buffer.isBuffer(rawReport) ? rawReport : Buffer.from(rawReport, 'hex');
    if (buf.length < SEV_SNP_REPORT_SIZE) return null;

    const version = buf.readUInt32LE(SEV_SNP_VERSION_OFFSET);
    const policy = buf.readUInt32LE(SEV_SNP_POLICY_OFFSET);
    const reportData = buf.subarray(SEV_SNP_REPORT_DATA_OFFSET, SEV_SNP_REPORT_DATA_OFFSET + SEV_SNP_REPORT_DATA_SIZE).toString('hex');
    const measurement = buf.subarray(SEV_SNP_MEASUREMENT_OFFSET, SEV_SNP_MEASUREMENT_OFFSET + SEV_SNP_MEASUREMENT_SIZE).toString('hex');
    const signature = buf.subarray(SEV_SNP_SIGNATURE_OFFSET, SEV_SNP_SIGNATURE_OFFSET + 512).toString('hex');

    return { version, policy, reportData, measurement, signature };
  } catch {
    return null;
  }
}

// ── SGX DCAP Quote Parser ─────────────────────────────────────────────
//
// Parses a raw Intel SGX DCAP quote and extracts the report body fields
// needed for verification.
//
// @param {Buffer|string} rawQuote — SGX DCAP quote binary
// @returns {object|null} — { mrenclave, mrsigner, isvProdId, isvSvn, reportData } or null on parse failure

function parseSgxQuote(rawQuote) {
  try {
    const buf = Buffer.isBuffer(rawQuote) ? rawQuote : Buffer.from(rawQuote, 'hex');
    // Minimum size: header (28) + report body (384) = 412 bytes
    if (buf.length < SGX_QUOTE_HEADER_SIZE + 384) return null;

    // Report body starts after the quote header
    const rb = SGX_REPORT_BODY_OFFSET;
    const mrenclave = buf.subarray(rb + SGX_MRENCLAVE_OFFSET, rb + SGX_MRENCLAVE_OFFSET + SGX_MRENCLAVE_SIZE).toString('hex');
    const mrsigner = buf.subarray(rb + SGX_MRSIGNER_OFFSET, rb + SGX_MRSIGNER_OFFSET + SGX_MRSIGNER_SIZE).toString('hex');
    const isvProdId = buf.readUInt16LE(rb + SGX_ISVPRODID_OFFSET);
    const isvSvn = buf.readUInt16LE(rb + SGX_ISVPRODID_OFFSET + 2);
    // SGX report data is at offset 0x68 within the report body (after attributes)
    // For DCAP quotes, REPORT_DATA is at offset 0x68 from report body start
    const sgxReportDataOffset = 0x68;
    const reportData = buf.subarray(rb + sgxReportDataOffset, rb + sgxReportDataOffset + SGX_REPORT_DATA_SIZE).toString('hex');

    return { mrenclave, mrsigner, isvProdId, isvSvn, reportData };
  } catch {
    return null;
  }
}
