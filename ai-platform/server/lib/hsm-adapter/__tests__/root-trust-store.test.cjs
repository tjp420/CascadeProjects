'use strict';

const crypto = require('crypto');
const { RootTrustStore } = require('../root-trust-store.cjs');
const { getFingerprint, parseCertificate } = require('../cert-chain-validator.cjs');
const { generateSelfSigned } = require('./__fixtures__/attestation-certs.cjs');

function _genCert() {
  return generateSelfSigned('Test CA').cert;
}

describe('Root Trust Store', () => {
  test('ROOT-01: RootTrustStore can be instantiated', () => {
    const store = new RootTrustStore();
    expect(store).toBeInstanceOf(RootTrustStore);
    expect(store.isConfigured()).toBe(false);
  });

  test('ROOT-02: accepts amdArk in constructor', () => {
    const arkPem = _genCert();
    const store = new RootTrustStore({ amdArk: arkPem });
    expect(store.getAmdArk()).toBeInstanceOf(crypto.X509Certificate);
    expect(store.hasAMD()).toBe(true);
  });

  test('ROOT-03: accepts amdAsk in constructor', () => {
    const askPem = _genCert();
    const store = new RootTrustStore({ amdAsk: askPem });
    expect(store.getAmdAsk()).toBeInstanceOf(crypto.X509Certificate);
  });

  test('ROOT-04: accepts intelRootCA in constructor', () => {
    const rootPem = _genCert();
    const store = new RootTrustStore({ intelRootCA: rootPem });
    expect(store.getIntelRootCA()).toBeInstanceOf(crypto.X509Certificate);
    expect(store.hasIntel()).toBe(true);
  });

  test('ROOT-05: accepts intelPckCA in constructor', () => {
    const pckPem = _genCert();
    const store = new RootTrustStore({ intelPckCA: pckPem });
    expect(store.getIntelPckCA()).toBeInstanceOf(crypto.X509Certificate);
  });

  test('ROOT-06: isPinned returns true for pinned fingerprint', () => {
    const arkPem = _genCert();
    const store = new RootTrustStore({ amdArk: arkPem });
    const fp = getFingerprint(parseCertificate(arkPem));
    expect(store.isPinned(fp)).toBe(true);
  });

  test('ROOT-06b: isPinned returns false for unpinned fingerprint', () => {
    const store = new RootTrustStore();
    expect(store.isPinned('abc123')).toBe(false);
  });

  test('ROOT-07: pin adds a fingerprint (case insensitive)', () => {
    const store = new RootTrustStore();
    store.pin('ABCDEF123456');
    expect(store.isPinned('abcdef123456')).toBe(true);
  });

  test('ROOT-08: getSummary returns correct summary', () => {
    const arkPem = _genCert();
    const store = new RootTrustStore({ amdArk: arkPem });
    const summary = store.getSummary();
    expect(summary.amdArkLoaded).toBe(true);
    expect(summary.amdAskLoaded).toBe(false);
    expect(summary.pinnedFingerprintCount).toBeGreaterThan(0);
  });

  test('ROOT-09: loadAMD from env with file path', () => {
    const fs = require('fs');
    const path = require('path');
    const tmpDir = require('os').tmpdir();
    const arkPath = path.join(tmpDir, 'test-ark-' + Date.now() + '.pem');
    const arkPem = _genCert();
    fs.writeFileSync(arkPath, arkPem, 'utf8');
    const store = new RootTrustStore();
    store.loadAMD({ AMD_ARK_CERT_PATH: arkPath });
    expect(store.getAmdArk()).toBeInstanceOf(crypto.X509Certificate);
    fs.unlinkSync(arkPath);
  });

  test('ROOT-10: isConfigured returns true when AMD or Intel loaded', () => {
    const arkPem = _genCert();
    const store = new RootTrustStore({ amdArk: arkPem });
    expect(store.isConfigured()).toBe(true);
  });

  test('ROOT-11: getPinnedFingerprints returns array', () => {
    const arkPem = _genCert();
    const store = new RootTrustStore({ amdArk: arkPem });
    const fps = store.getPinnedFingerprints();
    expect(Array.isArray(fps)).toBe(true);
    expect(fps.length).toBeGreaterThan(0);
  });
});
