'use strict';

/**
 * Track 12: Mock HSM attestation engine tests.
 */
const crypto = require('crypto');
const { Attestation } = require('../attestation.cjs');
const { HsmAdapterError } = require('../base-adapter.cjs');

describe('Attestation', () => {
  let attestation;

  beforeEach(() => {
    attestation = new Attestation();
  });

  test('signs and verifies a public key certificate', () => {
    const keyPair = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
    const spki = keyPair.publicKey.export({ type: 'spki', format: 'der' });
    const cert = attestation.signPublicKey(spki, 'hw-001', { algorithm: 'rsa-oaep', keySize: 2048 });

    expect(cert.subject.CN).toBe('hw-001');
    expect(cert.issuer.CN).toBe('MockHSM-Root');
    expect(cert.subjectPublicKeyInfo).toBe(spki.toString('base64'));
    expect(attestation.verifyCertificate(cert)).toBe(true);
  });

  test('fails verification with a different root', () => {
    const keyPair = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
    const spki = keyPair.publicKey.export({ type: 'spki', format: 'der' });
    const cert = attestation.signPublicKey(spki, 'hw-001');

    const other = new Attestation();
    expect(other.verifyCertificate(cert)).toBe(false);
  });

  test('fails verification with a tampered certificate', () => {
    const keyPair = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
    const spki = keyPair.publicKey.export({ type: 'spki', format: 'der' });
    const cert = attestation.signPublicKey(spki, 'hw-001');

    cert.keySize = 4096;
    expect(attestation.verifyCertificate(cert)).toBe(false);
  });

  test('fails verification for missing signature', () => {
    expect(attestation.verifyCertificate({})).toBe(false);
    expect(attestation.verifyCertificate(null)).toBe(false);
  });

  test('rejects non-Buffer public key input', () => {
    expect(() => attestation.signPublicKey('not-a-buffer', 'hw-001')).toThrow(HsmAdapterError);
  });

  test('respects custom validity window', () => {
    const keyPair = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
    const spki = keyPair.publicKey.export({ type: 'spki', format: 'der' });
    const notBefore = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
    const notAfter = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);
    const cert = attestation.signPublicKey(spki, 'hw-001', { notBefore, notAfter });

    expect(new Date(cert.notBefore).getTime()).toBe(notBefore.getTime());
    expect(new Date(cert.notAfter).getTime()).toBe(notAfter.getTime());
    expect(attestation.verifyCertificate(cert)).toBe(true);
  });
});
