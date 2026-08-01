'use strict';

/**
 * Track 11: AsymmetricHsmAdapter functional tests.
 */
const crypto = require('crypto');
const { AsymmetricHsmAdapter } = require('../asymmetric-adapter.cjs');
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
