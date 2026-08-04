'use strict';

/**
 * Mock TPM 2.0 Quote Generator.
 *
 * Generates synthetic TPM 2.0 attestation quotes for testing hardware
 * attestation verification. Produces PCR-based quotes with HMAC signatures
 * that can be verified by HardwareAttestationVerifier.
 *
 * Also supports SEV-SNP and SGX quote profiles via the profile option.
 *
 * @module hsm-adapter/mock-tpm-quote-generator
 */

const crypto = require('crypto');

const MOCK_SIGNING_SECRET = 'mock-tpm-attestation-secret';

/**
 * Default expected PCR values for testing.
 * These represent a known-good boot chain:
 *   PCR 0:  Firmware
 *   PCR 1:  BIOS config
 *   PCR 7:  Secure Boot state
 */
const DEFAULT_EXPECTED_PCRS = {
  0: crypto.createHash('sha256').update('firmware-v1.0').digest('hex'),
  1: crypto.createHash('sha256').update('bios-config-v1.0').digest('hex'),
  7: crypto.createHash('sha256').update('secureboot-enabled').digest('hex'),
};

/**
 * Default expected MRENCLAVE values for SEV-SNP / SGX testing.
 * SEV-SNP MEASUREMENT is 48 bytes (SHA-384 hash).
 * SGX MRENCLAVE is 16 bytes (256-bit hash truncated).
 */
const DEFAULT_EXPECTED_MRENCLAVE = {
  'sev-snp': crypto.createHash('sha384').update('sev-snp-enclave-v1').digest('hex'),
  'sgx': crypto.createHash('sha256').update('sgx-enclave-v1').digest('hex').slice(0, 32), // 16 bytes = 32 hex chars
};

/**
 * Generate a canonical string from an attestation object (excluding signature).
 * @param {object} attestation
 * @returns {string}
 */
function _canonical(attestation) {
  const { signature, ...rest } = attestation;
  void signature;
  return Object.keys(rest).sort().map((k) => `${k}=${JSON.stringify(rest[k])}`).join('&');
}

/**
 * Sign an attestation object with the mock signing key.
 * @param {object} attestation
 * @returns {string} HMAC hex digest
 */
function _sign(attestation) {
  const canonical = _canonical(attestation);
  return crypto.createHmac('sha256', MOCK_SIGNING_SECRET).update(canonical).digest('hex');
}

class MockTpmQuoteGenerator {
  /**
   * @param {object} [options]
   * @param {object} [options.expectedPcrs] — PCR values to use (defaults to DEFAULT_EXPECTED_PCRS)
   * @param {string} [options.authority] — attestation authority (default: 'tpm2')
   */
  constructor(options = {}) {
    this._expectedPcrs = options.expectedPcrs || DEFAULT_EXPECTED_PCRS;
    this._authority = options.authority || 'tpm2';
  }

  /**
   * Get the default expected PCR values.
   * @returns {object}
   */
  getExpectedPcrs() {
    return { ...this._expectedPcrs };
  }

  /**
   * Generate a TPM 2.0 attestation quote.
   * @param {string} nonce — challenge nonce (hex string)
   * @param {object} [options]
   * @param {object} [options.pcrs] — override PCR values
   * @param {number} [options.timestamp] — override timestamp (default: Date.now())
   * @returns {object} attestation quote
   */
  generateQuote(nonce, options = {}) {
    const pcrs = options.pcrs || this._expectedPcrs;
    const timestamp = options.timestamp || Date.now();

    const attestation = {
      authority: this._authority,
      pcrs: { ...pcrs },
      nonce,
      timestamp,
    };

    attestation.signature = _sign(attestation);
    return attestation;
  }

  /**
   * Generate a SEV-SNP attestation quote.
   * @param {string} nonce
   * @param {object} [options]
   * @param {string} [options.mrenclave] — override MRENCLAVE
   * @param {number} [options.timestamp]
   * @returns {object}
   */
  generateSevSnpQuote(nonce, options = {}) {
    const mrenclave = options.mrenclave || DEFAULT_EXPECTED_MRENCLAVE['sev-snp'];
    const timestamp = options.timestamp || Date.now();

    const attestation = {
      authority: 'sev-snp',
      mrenclave,
      nonce,
      timestamp,
    };

    attestation.signature = _sign(attestation);
    return attestation;
  }

  /**
   * Generate an SGX attestation quote.
   * @param {string} nonce
   * @param {object} [options]
   * @param {string} [options.mrenclave] — override MRENCLAVE
   * @param {number} [options.timestamp]
   * @returns {object}
   */
  generateSgxQuote(nonce, options = {}) {
    const mrenclave = options.mrenclave || DEFAULT_EXPECTED_MRENCLAVE['sgx'];
    const timestamp = options.timestamp || Date.now();

    const attestation = {
      authority: 'sgx',
      mrenclave,
      nonce,
      timestamp,
    };

    attestation.signature = _sign(attestation);
    return attestation;
  }

  /**
   * Generate a quote with a tampered signature (for testing rejection).
   * @param {string} nonce
   * @returns {object}
   */
  generateTamperedQuote(nonce) {
    const quote = this.generateQuote(nonce);
    quote.signature = 'tampered-' + quote.signature.slice(8);
    return quote;
  }

  /**
   * Generate a quote with wrong PCR values (for testing measurement mismatch).
   * @param {string} nonce
   * @returns {object}
   */
  generateWrongMeasurementQuote(nonce) {
    const wrongPcrs = {
      0: crypto.createHash('sha256').update('malicious-firmware').digest('hex'),
      1: crypto.createHash('sha256').update('tampered-bios').digest('hex'),
      7: crypto.createHash('sha256').update('secureboot-disabled').digest('hex'),
    };
    return this.generateQuote(nonce, { pcrs: wrongPcrs });
  }

  /**
   * Generate a raw SEV-SNP attestation report (4096-byte binary blob).
   * @param {string} nonce — challenge nonce (hex string)
   * @param {object} [options]
   * @param {string} [options.mrenclave] — override MEASUREMENT (hex, 48 bytes)
   * @param {number} [options.version] — report version (default: 1)
   * @param {number} [options.policy] — policy flags (default: 0x1F = SMT-enforced, AB-excluded)
   * @param {number} [options.timestamp]
   * @returns {object} attestation with rawReport (Buffer), nonce, timestamp, authority, signature
   */
  generateSevSnpRawReport(nonce, options = {}) {
    const measurement = options.mrenclave || DEFAULT_EXPECTED_MRENCLAVE['sev-snp'];
    const version = options.version || 1;
    const policy = options.policy !== undefined ? options.policy : 0x1F;
    const timestamp = options.timestamp || Date.now();

    const buf = Buffer.alloc(4096, 0);

    // VERSION (offset 0x00, 4 bytes LE)
    buf.writeUInt32LE(version, 0x00);
    // ALGORITHM (offset 0x04, 4 bytes) — 1 = ECC P-384 with SHA-384
    buf.writeUInt32LE(1, 0x04);
    // POLICY (offset 0x08, 4 bytes)
    buf.writeUInt32LE(policy, 0x08);

    // REPORT_DATA (offset 0xC0, 48 bytes) — pad nonce to 48 bytes
    const nonceBytes = Buffer.from(nonce, 'hex');
    nonceBytes.copy(buf, 0xC0);

    // MEASUREMENT (offset 0xF0, 48 bytes) — MRENCLAVE
    const measBytes = Buffer.from(measurement, 'hex');
    measBytes.copy(buf, 0xF0);

    // SIGNATURE (offset 0x2D0, 512 bytes) — mock signature (zeros, real would be ECC P-384)
    // For testing, we fill with a deterministic pattern
    const sigFill = crypto.createHash('sha384').update(measurement + nonce).digest();
    sigFill.copy(buf, 0x2D0);
    // Pad the rest of the signature area
    for (let i = sigFill.length; i < 512; i += sigFill.length) {
      sigFill.copy(buf, 0x2D0 + i);
    }

    const attestation = {
      authority: 'sev-snp',
      rawReport: buf,
      nonce,
      timestamp,
    };

    attestation.signature = _sign(attestation);
    return attestation;
  }

  /**
   * Generate a raw SGX DCAP quote (binary blob).
   * @param {string} nonce — challenge nonce (hex string)
   * @param {object} [options]
   * @param {string} [options.mrenclave] — override MRENCLAVE (hex, 16 bytes)
   * @param {string} [options.mrsigner] — MRSIGNER (hex, 16 bytes)
   * @param {number} [options.isvProdId] — ISV product ID (default: 1)
   * @param {number} [options.timestamp]
   * @returns {object} attestation with rawQuote (Buffer), nonce, timestamp, authority, signature
   */
  generateSgxRawQuote(nonce, options = {}) {
    const mrenclave = options.mrenclave || DEFAULT_EXPECTED_MRENCLAVE['sgx'].slice(0, 32); // 16 bytes = 32 hex chars
    const mrsigner = options.mrsigner || crypto.createHash('sha256').update('intel-signing-key').digest('hex').slice(0, 32);
    const isvProdId = options.isvProdId || 1;
    const timestamp = options.timestamp || Date.now();

    // Header (28 bytes) + Report Body (384 bytes) + Signature (variable, we use 64 bytes)
    const totalSize = 28 + 384 + 64;
    const buf = Buffer.alloc(totalSize, 0);

    // Quote header
    buf.writeUInt16LE(3, 0x00); // VERSION = 3 (DCAP)
    buf.writeUInt16LE(0, 0x02); // SIGN_TYPE = 0 (ECDSA-256-with-P-256)
    buf.writeUInt32LE(0, 0x04); // QE_SVN
    buf.writeUInt32LE(0, 0x08); // PCE_SVN

    // Report body starts at offset 28 (0x1C)
    const rb = 28;

    // MRENCLAVE (offset 0x00 in report body, 16 bytes)
    Buffer.from(mrenclave, 'hex').copy(buf, rb + 0x00);

    // MRSIGNER (offset 0x10 in report body, 16 bytes)
    Buffer.from(mrsigner, 'hex').copy(buf, rb + 0x10);

    // ISVPRODID (offset 0x20 in report body, 2 bytes LE)
    buf.writeUInt16LE(isvProdId, rb + 0x20);

    // ISVSVN (offset 0x22 in report body, 2 bytes LE)
    buf.writeUInt16LE(1, rb + 0x22);

    // ATTRIBUTES (offset 0x24 in report body, 8 bytes) — set INITIALIZED flag
    buf.writeUInt8(0x01, rb + 0x24); // INITIALIZED flag

    // REPORT_DATA (offset 0x68 in report body, 16 bytes) — first 16 bytes of nonce
    const nonceBytes = Buffer.from(nonce, 'hex');
    nonceBytes.subarray(0, 16).copy(buf, rb + 0x68);

    const attestation = {
      authority: 'sgx',
      rawQuote: buf,
      nonce,
      timestamp,
    };

    attestation.signature = _sign(attestation);
    return attestation;
  }

  /**
   * Generate a SEV-SNP raw report with wrong MEASUREMENT (for testing mismatch).
   * @param {string} nonce
   * @returns {object}
   */
  generateSevSnpWrongMeasurementReport(nonce) {
    const wrongMrenclave = crypto.createHash('sha384').update('malicious-enclave').digest('hex');
    return this.generateSevSnpRawReport(nonce, { mrenclave: wrongMrenclave });
  }

  /**
   * Generate an SGX raw quote with wrong MRENCLAVE (for testing mismatch).
   * @param {string} nonce
   * @returns {object}
   */
  generateSgxWrongMeasurementQuote(nonce) {
    const wrongMrenclave = crypto.createHash('sha256').update('malicious-sgx-enclave').digest('hex').slice(0, 32);
    return this.generateSgxRawQuote(nonce, { mrenclave: wrongMrenclave });
  }
}

module.exports = {
  MockTpmQuoteGenerator,
  DEFAULT_EXPECTED_PCRS,
  DEFAULT_EXPECTED_MRENCLAVE,
  MOCK_SIGNING_SECRET,
  _sign,
  _canonical,
};
