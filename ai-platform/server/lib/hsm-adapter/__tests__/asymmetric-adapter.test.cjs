'use strict';

/**
 * Track 11 / 12: AsymmetricHsmAdapter functional tests.
 */
const crypto = require('crypto');
const { AsymmetricHsmAdapter } = require('../asymmetric-adapter.cjs');
const { Attestation } = require('../attestation.cjs');
const { HsmAdapterError } = require('../base-adapter.cjs');

describe('AsymmetricHsmAdapter', () => {
  describe('RSA-OAEP', () => {
    let adapter;

    beforeEach(async () => {
      adapter = new AsymmetricHsmAdapter({ algorithm: 'rsa-oaep', keySize: 2048 });
      await adapter.initialize();
    });

    test('creates a KEK and exports the public key as SPKI', async () => {
      const kekId = await adapter.createKEK();
      const spki = await adapter.exportPublicKey(kekId);
      expect(Buffer.isBuffer(spki)).toBe(true);
      expect(spki.length).toBeGreaterThan(0);
    });

    test('wrap/unwrap round-trips a small plaintext', async () => {
      const kekId = await adapter.createKEK();
      const plaintext = crypto.randomBytes(32);
      const wrapped = await adapter.wrap(kekId, plaintext);
      const unwrapped = await adapter.unwrap(kekId, wrapped);
      expect(unwrapped.equals(plaintext)).toBe(true);
    });

    test('rejects plaintext larger than OAEP padding limit', async () => {
      const kekId = await adapter.createKEK();
      const tooLarge = crypto.randomBytes(256); // exceeds 190-byte 2048-bit OAEP max
      await expect(adapter.wrap(kekId, tooLarge)).rejects.toMatchObject({
        name: 'HsmAdapterError',
        code: 'INVALID_INPUT',
      });
    });

    test('rotateKEK creates a new key and preserves the old one', async () => {
      const oldId = await adapter.createKEK();
      const newId = await adapter.rotateKEK(oldId);
      expect(newId).not.toBe(oldId);
      const list = await adapter.listKEKs();
      expect(list).toHaveLength(2);
    });
  });

  describe('ECDH', () => {
    let adapter;

    beforeEach(async () => {
      adapter = new AsymmetricHsmAdapter({ algorithm: 'ecdh', keySize: 256 });
      await adapter.initialize();
    });

    test('creates a KEK and exports the public key as SPKI', async () => {
      const kekId = await adapter.createKEK();
      const spki = await adapter.exportPublicKey(kekId);
      expect(Buffer.isBuffer(spki)).toBe(true);
      expect(spki.length).toBeGreaterThan(0);
    });

    test('wrap/unwrap round-trips a plaintext', async () => {
      const kekId = await adapter.createKEK();
      const plaintext = crypto.randomBytes(100);
      const wrapped = await adapter.wrap(kekId, plaintext);
      const unwrapped = await adapter.unwrap(kekId, wrapped);
      expect(unwrapped.equals(plaintext)).toBe(true);
    });

    test('wrap/unwrap with matching context round-trips', async () => {
      const kekId = await adapter.createKEK();
      const plaintext = crypto.randomBytes(64);
      const context = 'user-123:epoch-1';
      const wrapped = await adapter.wrap(kekId, plaintext, context);
      const unwrapped = await adapter.unwrap(kekId, wrapped, context);
      expect(unwrapped.equals(plaintext)).toBe(true);
    });

    test('rejects context mismatch on unwrap', async () => {
      const kekId = await adapter.createKEK();
      const plaintext = crypto.randomBytes(64);
      const wrapped = await adapter.wrap(kekId, plaintext, 'context-a');
      await expect(adapter.unwrap(kekId, wrapped, 'context-b')).rejects.toMatchObject({
        name: 'HsmAdapterError',
        code: 'UNWRAP_FAILED',
      });
    });

    test('rejects corrupted wrapped payload', async () => {
      const kekId = await adapter.createKEK();
      const wrapped = await adapter.wrap(kekId, crypto.randomBytes(32));
      wrapped[wrapped.length - 1] ^= 0xFF;
      await expect(adapter.unwrap(kekId, wrapped)).rejects.toMatchObject({
        name: 'HsmAdapterError',
        code: 'UNWRAP_FAILED',
      });
    });
  });

  describe('attestation', () => {
    let attestation;
    let adapter;

    beforeEach(async () => {
      attestation = new Attestation();
      adapter = new AsymmetricHsmAdapter({
        algorithm: 'ecdh',
        keySize: 256,
        attestation,
      });
      await adapter.initialize();
    });

    test('attestPublicKey returns a signed certificate', async () => {
      const kekId = await adapter.createKEK();
      const cert = await adapter.attestPublicKey(kekId);
      expect(cert.subject.CN).toBe(kekId);
      expect(cert.issuer.CN).toBe('MockHSM-Root');
      expect(cert.algorithm).toBe('ecdh');
      expect(Buffer.from(cert.subjectPublicKeyInfo, 'base64').length).toBeGreaterThan(0);
    });

    test('verifyAttestation passes for a valid certificate', async () => {
      const kekId = await adapter.createKEK();
      const cert = await adapter.attestPublicKey(kekId);
      const result = await adapter.verifyAttestation(kekId, cert);
      expect(result).toBe(true);
    });

    test('verifyAttestation fails for expired certificate', async () => {
      const kekId = await adapter.createKEK();
      const cert = await adapter.attestPublicKey(kekId);
      cert.notAfter = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      await expect(adapter.verifyAttestation(kekId, cert)).rejects.toMatchObject({
        name: 'HsmAdapterError',
        code: 'ATTESTATION_INVALID',
      });
    });

    test('verifyAttestation fails for certificate with mismatched public key', async () => {
      const kekId = await adapter.createKEK();
      const otherKekId = await adapter.createKEK();
      const cert = await adapter.attestPublicKey(otherKekId);
      await expect(adapter.verifyAttestation(kekId, cert)).rejects.toMatchObject({
        name: 'HsmAdapterError',
        code: 'ATTESTATION_MISMATCH',
      });
    });

    test('attestPublicKey requires an attestation engine', async () => {
      const noAttestation = new AsymmetricHsmAdapter({ algorithm: 'ecdh', keySize: 256 });
      await noAttestation.initialize();
      const kekId = await noAttestation.createKEK();
      await expect(noAttestation.attestPublicKey(kekId)).rejects.toMatchObject({
        name: 'HsmAdapterError',
        code: 'ATTESTATION_NOT_CONFIGURED',
      });
    });
  });

  describe('validation', () => {
    test('rejects unsupported algorithm', () => {
      expect(() => new AsymmetricHsmAdapter({ algorithm: 'rsa-pkcs1' })).toThrow(HsmAdapterError);
    });

    test('rejects invalid key size', () => {
      expect(() => new AsymmetricHsmAdapter({ algorithm: 'rsa-oaep', keySize: 1024 })).toThrow(HsmAdapterError);
    });

    test('rejects unknown KEK', async () => {
      const adapter = new AsymmetricHsmAdapter();
      await adapter.initialize();
      await expect(adapter.wrap('missing', Buffer.alloc(16))).rejects.toMatchObject({
        name: 'HsmAdapterError',
        code: 'UNKNOWN_KEK',
      });
    });
  });
});
