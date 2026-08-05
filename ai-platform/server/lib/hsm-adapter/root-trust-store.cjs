'use strict';

/**
 * Root Trust Store
 *
 * Manages pinned vendor root-of-trust certificates for hardware attestation.
 * Loads AMD ARK/ASK and Intel Root CA/PCK CA certificates from filesystem
 * paths configured via environment variables.
 *
 * Environment variables:
 *   AMD_ARK_CERT_PATH    - Path to AMD ARK (AMD Root Key) root certificate
 *   AMD_ASK_CERT_PATH    - Path to AMD ASK (AMD SEV Key) intermediate certificate
 *   INTEL_ROOT_CA_PATH  - Path to Intel Root CA certificate
 *   INTEL_PCK_CA_PATH   - Path to Intel PCK CA intermediate certificate
 *
 * @module hsm-adapter/root-trust-store
 */

const fs = require('fs');
const crypto = require('crypto');
const { parseCertificate, getFingerprint } = require('./cert-chain-validator.cjs');

class RootTrustStore {
  constructor(options = {}) {
    this._amdArk = null;       // X509Certificate
    this._amdAsk = null;       // X509Certificate
    this._intelRootCA = null;  // X509Certificate
    this._intelPckCA = null;   // X509Certificate
    this._pinnedFingerprints = new Set();
    this._loaded = false;

    // Allow pre-loaded certificates
    if (options.amdArk) {
      this._amdArk = this._loadCert(options.amdArk);
      if (this._amdArk) {
        this._pinnedFingerprints.add(getFingerprint(this._amdArk));
      }
    }
    if (options.amdAsk) this._amdAsk = this._loadCert(options.amdAsk);
    if (options.intelRootCA) {
      this._intelRootCA = this._loadCert(options.intelRootCA);
      if (this._intelRootCA) {
        this._pinnedFingerprints.add(getFingerprint(this._intelRootCA));
      }
    }
    if (options.intelPckCA) this._intelPckCA = this._loadCert(options.intelPckCA);

    // Allow pre-pinned fingerprints
    if (options.pinnedFingerprints) {
      for (const fp of options.pinnedFingerprints) {
        this._pinnedFingerprints.add(fp.toLowerCase());
      }
    }

    this._loaded = true;
  }

  /**
   * Load a certificate from a file path, PEM string, or X509Certificate.
   * @param {string|Buffer|X509Certificate} input
   * @returns {X509Certificate|null}
   * @private
   */
  _loadCert(input) {
    if (input instanceof crypto.X509Certificate) return input;
    if (typeof input === 'string') {
      // Check if it's a file path or PEM content
      if (input.includes('-----BEGIN CERTIFICATE-----')) {
        return parseCertificate(input);
      }
      // Try reading as file path
      try {
        const content = fs.readFileSync(input, 'utf8');
        return parseCertificate(content);
      } catch {
        return parseCertificate(input); // Try as hex
      }
    }
    if (Buffer.isBuffer(input)) {
      return parseCertificate(input);
    }
    return null;
  }

  /**
   * Load AMD root-of-trust certificates from environment variables.
   * @param {object} [env] - Environment variables (defaults to process.env)
   */
  loadAMD(env) {
    const e = env || process.env;
    if (e.AMD_ARK_CERT_PATH) {
      this._amdArk = this._loadCert(e.AMD_ARK_CERT_PATH);
      if (this._amdArk) {
        this._pinnedFingerprints.add(getFingerprint(this._amdArk));
      }
    }
    if (e.AMD_ASK_CERT_PATH) {
      this._amdAsk = this._loadCert(e.AMD_ASK_CERT_PATH);
    }
  }

  /**
   * Load Intel root-of-trust certificates from environment variables.
   * @param {object} [env] - Environment variables (defaults to process.env)
   */
  loadIntel(env) {
    const e = env || process.env;
    if (e.INTEL_ROOT_CA_PATH) {
      this._intelRootCA = this._loadCert(e.INTEL_ROOT_CA_PATH);
      if (this._intelRootCA) {
        this._pinnedFingerprints.add(getFingerprint(this._intelRootCA));
      }
    }
    if (e.INTEL_PCK_CA_PATH) {
      this._intelPckCA = this._loadCert(e.INTEL_PCK_CA_PATH);
    }
  }

  /**
   * Load all configured root-of-trust certificates from environment.
   */
  loadAll(env) {
    this.loadAMD(env);
    this.loadIntel(env);
  }

  /**
   * Get the AMD ARK root certificate.
   * @returns {X509Certificate|null}
   */
  getAmdArk() { return this._amdArk; }

  /**
   * Get the AMD ASK intermediate certificate.
   * @returns {X509Certificate|null}
   */
  getAmdAsk() { return this._amdAsk; }

  /**
   * Get the Intel Root CA certificate.
   * @returns {X509Certificate|null}
   */
  getIntelRootCA() { return this._intelRootCA; }

  /**
   * Get the Intel PCK CA intermediate certificate.
   * @returns {X509Certificate|null}
   */
  getIntelPckCA() { return this._intelPckCA; }

  /**
   * Check if a fingerprint is pinned.
   * @param {string} fingerprint
   * @returns {boolean}
   */
  isPinned(fingerprint) {
    return this._pinnedFingerprints.has(fingerprint.toLowerCase());
  }

  /**
   * Pin a fingerprint manually.
   * @param {string} fingerprint
   */
  pin(fingerprint) {
    this._pinnedFingerprints.add(fingerprint.toLowerCase());
  }

  /**
   * Get all pinned fingerprints.
   * @returns {string[]}
   */
  getPinnedFingerprints() {
    return Array.from(this._pinnedFingerprints);
  }

  /**
   * Check if AMD root-of-trust is configured.
   * @returns {boolean}
   */
  hasAMD() { return this._amdArk !== null; }

  /**
   * Check if Intel root-of-trust is configured.
   * @returns {boolean}
   */
  hasIntel() { return this._intelRootCA !== null; }

  /**
   * Check if any root-of-trust is configured.
   * @returns {boolean}
   */
  isConfigured() { return this.hasAMD() || this.hasIntel(); }

  /**
   * Get a summary of the trust store (no sensitive data).
   * @returns {object}
   */
  getSummary() {
    return {
      amdArkLoaded: this._amdArk !== null,
      amdAskLoaded: this._amdAsk !== null,
      intelRootCALoaded: this._intelRootCA !== null,
      intelPckCALoaded: this._intelPckCA !== null,
      pinnedFingerprintCount: this._pinnedFingerprints.size,
    };
  }
}

module.exports = { RootTrustStore };
