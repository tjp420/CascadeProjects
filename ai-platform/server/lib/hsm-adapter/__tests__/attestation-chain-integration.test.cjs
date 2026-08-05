'use strict';

const crypto = require('crypto');
const {
  HardwareAttestationVerifier,
  CertChainValidator,
  RootTrustStore,
} = require('../hardware-attestation-verify.cjs');
const { getFingerprint, parseCertificate } = require('../cert-chain-validator.cjs');
const { generateChain, generateSelfSigned } = require('./__fixtures__/attestation-certs.cjs');

describe('Attestation Chain Validation Integration', () => {
  let verifier, chain;

  beforeEach(() => {
    chain = generateChain();
    verifier = new HardwareAttestationVerifier({
      expectedMeasurements: { 'sev-snp': { mrenclave: 'a'.repeat(96) } },
      allowedAuthorities: ['sev-snp', 'sgx', 'mock-authority'],
    });
  });

  test('INTEG-01: verifier accepts certChainValidator option', () => {
    const v = new HardwareAttestationVerifier({ certChainValidator: new CertChainValidator() });
    expect(v._certChainValidator).toBeInstanceOf(CertChainValidator);
  });

  test('INTEG-02: verifier accepts rootTrustStore option', () => {
    const v = new HardwareAttestationVerifier({ rootTrustStore: new RootTrustStore() });
    expect(v._rootTrustStore).toBeInstanceOf(RootTrustStore);
  });

  test('INTEG-03: _validateCertificateChain validates a valid chain', () => {
    const store = new RootTrustStore({ amdArk: chain.rootCert, amdAsk: chain.interCert });
    verifier._rootTrustStore = store;
    const result = verifier._validateCertificateChain({ authority: 'sev-snp', leafCertificate: chain.leafCert });
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.publicKey).toBeInstanceOf(crypto.KeyObject);
  });

  test('INTEG-04: _validateCertificateChain rejects invalid chain', () => {
    const store = new RootTrustStore({ amdArk: chain.rootCert, amdAsk: chain.interCert });
    verifier._rootTrustStore = store;
    const otherLeaf = generateSelfSigned('Other VCEK').cert;
    const result = verifier._validateCertificateChain({ authority: 'sev-snp', leafCertificate: otherLeaf });
    expect(result.valid).toBe(false);
  });

  test('INTEG-05: _validateCertificateChain handles missing leaf cert', () => {
    const result = verifier._validateCertificateChain({ authority: 'sev-snp' });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('no leaf certificate provided');
  });

  test('INTEG-06: _verifyEcdsaSignature verifies valid signature', () => {
    const data = Buffer.from('test data');
    const keyObj = crypto.createPrivateKey(chain.leafKey);
    const signature = crypto.sign('sha384', data, keyObj);
    const pubKey = crypto.createPublicKey(keyObj);
    const result = verifier._verifyEcdsaSignature(
      { authority: 'sev-snp', rawSignature: signature.toString('hex'), signedData: data.toString('hex') },
      pubKey
    );
    expect(result).toBe(true);
  });

  test('INTEG-07: _verifyEcdsaSignature rejects invalid signature', () => {
    const data = Buffer.from('test data');
    const keyObj = crypto.createPrivateKey(chain.leafKey);
    const wrongSig = crypto.sign('sha384', Buffer.from('wrong'), keyObj);
    const pubKey = crypto.createPublicKey(keyObj);
    const result = verifier._verifyEcdsaSignature(
      { authority: 'sev-snp', rawSignature: wrongSig.toString('hex'), signedData: data.toString('hex') },
      pubKey
    );
    expect(result).toBe(false);
  });

  test('INTEG-08: _verifyEcdsaSignature uses SHA-256 for SGX', () => {
    const sgxKp = crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' });
    const data = Buffer.from('sgx test');
    const sig = crypto.sign('sha256', data, sgxKp.privateKey);
    expect(verifier._verifyEcdsaSignature(
      { authority: 'sgx', rawSignature: sig.toString('hex'), signedData: data.toString('hex') },
      sgxKp.publicKey
    )).toBe(true);
  });

  test('INTEG-09: backward compatible — existing verify() works without chain config', () => {
    const { MOCK_SIGNING_SECRET, _canonical } = require('../mock-tpm-quote-generator.cjs');
    const v = new HardwareAttestationVerifier({
      expectedMeasurements: { 'mock-authority': { pcrs: { '0': 'abc' } } },
      allowedAuthorities: ['mock-authority'],
    });
    const challenge = v.issueChallenge('sbx-test');
    const attestation = { authority: 'mock-authority', nonce: challenge.nonce, timestamp: Date.now(), pcrs: { '0': 'abc' } };
    attestation.signature = crypto.createHmac('sha256', MOCK_SIGNING_SECRET).update(_canonical(attestation)).digest('hex');
    const result = v.verify('sbx-test', attestation);
    expect(result.verified).toBe(true);
  });

  test('INTEG-10: CertChainValidator and RootTrustStore are exported', () => {
    expect(CertChainValidator).toBeDefined();
    expect(RootTrustStore).toBeDefined();
  });

  test('INTEG-11: _validateCertificateChain works with pre-configured validator', () => {
    const validator = new CertChainValidator();
    validator.addRootCA(chain.rootCert);
    validator.addIntermediateCA(chain.interCert);
    validator.pinRoot(getFingerprint(parseCertificate(chain.rootCert)));
    verifier._certChainValidator = validator;
    const result = verifier._validateCertificateChain({ authority: 'sev-snp', leafCertificate: chain.leafCert });
    expect(result.valid).toBe(true);
  });

  test('INTEG-12: _validateCertificateChain handles certificateChain array', () => {
    const validator = new CertChainValidator();
    validator.addRootCA(chain.rootCert);
    verifier._certChainValidator = validator;
    const result = verifier._validateCertificateChain({ authority: 'sev-snp', certificateChain: [chain.leafCert, chain.interCert] });
    expect(result.valid).toBe(true);
  });
});
