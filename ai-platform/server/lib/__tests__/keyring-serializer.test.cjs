'use strict';

/**
 * keyring-serializer.test.cjs
 * Consolidated Track 10 envelope round-trip and integrity tests.
 */
const { serialize, deserialize, KeyringValidationError } = require('../keyring-serializer.cjs');
const crypto = require('crypto');

describe('keyring-serializer', () => {
  const makeValidKeyring = (overrides = {}) => ({
    algorithm: 'X25519+ML-KEM-768',
    keyringId: 'rt-123',
    createdAt: new Date().toISOString(),
    keyCount: 2,
    keys: [
      { id: 'key-active', alg: 'X25519', data: crypto.randomBytes(32).toString('base64') },
      { id: 'key-previous', alg: 'X25519', data: crypto.randomBytes(32).toString('base64') },
    ],
    ...overrides,
  });

  describe('serialize', () => {
    test('produces a Buffer with the T10K magic and version header', () => {
      const kek = Buffer.alloc(32);
      const keyring = makeValidKeyring();
      const blob = serialize(keyring, kek);

      expect(Buffer.isBuffer(blob)).toBe(true);
      expect(blob.length).toBeGreaterThan(12);
      expect(blob.subarray(0, 4).toString('ascii')).toBe('T10K');
      expect(blob.readUInt16BE(4)).toBe(1); // schema version
    });

    test('rejects non-object input', () => {
      const kek = Buffer.alloc(32);
      expect(() => serialize(null, kek)).toThrow(KeyringValidationError);
      expect(() => serialize('string', kek)).toThrow(KeyringValidationError);
      expect(() => serialize(42, kek)).toThrow(KeyringValidationError);
    });

    test('rejects missing or non-Buffer KEK', () => {
      const keyring = makeValidKeyring();
      expect(() => serialize(keyring, null)).toThrow(KeyringValidationError);
      expect(() => serialize(keyring, 'not-a-buffer')).toThrow(KeyringValidationError);
    });

    test('rejects invalid KEK bit lengths', () => {
      const keyring = makeValidKeyring();
      expect(() => serialize(keyring, Buffer.alloc(15))).toThrow(/Invalid KEK length/);
      expect(() => serialize(keyring, Buffer.alloc(17))).toThrow(/Invalid KEK length/);
      expect(() => serialize(keyring, Buffer.alloc(33))).toThrow(/Invalid KEK length/);
    });

    test('accepts 128, 192, and 256-bit KEKs', () => {
      const keyring = makeValidKeyring();
      [16, 24, 32].forEach((len) => {
        const kek = Buffer.alloc(len);
        const blob = serialize(keyring, kek);
        expect(Buffer.isBuffer(blob)).toBe(true);
      });
    });
  });

  describe('deserialize', () => {
    test('round-trips a valid keyring', () => {
      const kek = Buffer.alloc(32);
      const original = makeValidKeyring({ keyringId: 'round-trip-1' });
      const blob = serialize(original, kek);
      const restored = deserialize(blob, kek);

      expect(restored).toEqual(original);
    });

    test('round-trips with 128 and 192-bit KEKs', () => {
      const original = makeValidKeyring();
      [16, 24].forEach((len) => {
        const kek = Buffer.alloc(len);
        const blob = serialize(original, kek);
        const restored = deserialize(blob, kek);
        expect(restored).toEqual(original);
      });
    });

    test('rejects non-Buffer input', () => {
      const kek = Buffer.alloc(32);
      expect(() => deserialize('not-a-buffer', kek)).toThrow(KeyringValidationError);
      expect(() => deserialize(null, kek)).toThrow(KeyringValidationError);
    });

    test('rejects invalid KEK lengths for decryption', () => {
      const blob = serialize(makeValidKeyring(), Buffer.alloc(32));
      expect(() => deserialize(blob, Buffer.alloc(15))).toThrow(/Invalid KEK length/);
    });

    test('rejects a truncated buffer', () => {
      const kek = Buffer.alloc(32);
      const blob = serialize(makeValidKeyring(), kek);
      const truncated = blob.subarray(0, 11);
      expect(() => deserialize(truncated, kek)).toThrow(/Header chunk length is under threshold/);
    });

    test('rejects a buffer with the wrong magic', () => {
      const kek = Buffer.alloc(32);
      const blob = serialize(makeValidKeyring(), kek);
      const tampered = Buffer.from(blob);
      tampered[0] = 0x00;
      expect(() => deserialize(tampered, kek)).toThrow(/Unrecognized signature magic/);
    });

    test('rejects an unsupported schema version', () => {
      const kek = Buffer.alloc(32);
      const blob = serialize(makeValidKeyring(), kek);
      const tampered = Buffer.from(blob);
      tampered.writeUInt16BE(999, 4);
      expect(() => deserialize(tampered, kek)).toThrow(/Unsupported envelope version/);
    });

    test('rejects a buffer with a smaller-than-declared payload size', () => {
      const kek = Buffer.alloc(32);
      const blob = serialize(makeValidKeyring(), kek);
      const truncated = blob.subarray(0, blob.length - 1);
      // Force payload size to claim the original full size while truncating the body
      expect(() => deserialize(truncated, kek)).toThrow(/size alignment mismatch/);
    });

    test('rejects a buffer with a larger-than-actual payload size', () => {
      const kek = Buffer.alloc(32);
      const blob = serialize(makeValidKeyring(), kek);
      const padded = Buffer.concat([blob, Buffer.alloc(8)]);
      // Header still claims original size, but extra bytes are present
      expect(() => deserialize(padded, kek)).toThrow(/size alignment mismatch/);
    });

    test('rejects a corrupted ciphertext', () => {
      const kek = Buffer.alloc(32);
      const blob = serialize(makeValidKeyring(), kek);
      const tampered = Buffer.from(blob);
      tampered[tampered.length - 1] ^= 0xFF;
      expect(() => deserialize(tampered, kek)).toThrow(/Cryptographic envelope unpacking failed/);
    });

    test('rejects decryption with the wrong KEK', () => {
      const kek = Buffer.alloc(32);
      const wrongKek = Buffer.alloc(32);
      wrongKek[0] = 0x01;
      const blob = serialize(makeValidKeyring(), kek);
      expect(() => deserialize(blob, wrongKek)).toThrow(/Cryptographic envelope unpacking failed/);
    });
  });
});
