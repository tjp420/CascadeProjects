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
 */
const DEFAULT_EXPECTED_MRENCLAVE = {
  'sev-snp': crypto.createHash('sha256').update('sev-snp-enclave-v1').digest('hex'),
  'sgx': crypto.createHash('sha256').update('sgx-enclave-v1').digest('hex'),
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
}

module.exports = {
  MockTpmQuoteGenerator,
  DEFAULT_EXPECTED_PCRS,
  DEFAULT_EXPECTED_MRENCLAVE,
  MOCK_SIGNING_SECRET,
  _sign,
  _canonical,
};
