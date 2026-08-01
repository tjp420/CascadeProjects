const assert = require('assert');
const { validateKeyringStructure, KeyringValidationError } = require('../keyring-serializer.cjs');

function buildValidEnvelope() {
  const header = Buffer.alloc(16);
  header.writeUInt32BE(0x53424B52, 0); // magic SBKR
  header.writeUInt8(0x01, 4); // schemaVersion
  header.writeUInt8(0x01, 5); // algorithm
  header.writeUInt8(0x00, 6); // flags
  header.writeUInt8(0x00, 7); // reserved
  // timestamp
  const now = BigInt(Date.now());
  header.writeBigUInt64BE(now, 8);

  const wrappedCEK = Buffer.alloc(40, 0x5a); // dummy 40-byte wrapped CEK
  const wrappedCEKLen = Buffer.alloc(8);
  wrappedCEKLen.writeBigUInt64BE(BigInt(wrappedCEK.length), 0);

  const iv = Buffer.alloc(12, 0x01);
  const tag = Buffer.alloc(16, 0x02);
  const ciphertext = Buffer.from('hello-world');

  return Buffer.concat([header, wrappedCEKLen, wrappedCEK, iv, tag, ciphertext]);
}

test('validateKeyringStructure accepts a valid envelope', () => {
  const env = buildValidEnvelope();
  const info = validateKeyringStructure(env);
  assert(info.slices.wrappedCEK.length === 40);
  assert(info.slices.iv.length === 12);
  assert(info.slices.tag.length === 16);
  assert(info.slices.ciphertext.toString() === 'hello-world');
});

test('validateKeyringStructure rejects non-buffer input', () => {
  assert.throws(() => validateKeyringStructure('nope'), KeyringValidationError);
});

test('validateKeyringStructure rejects wrong magic', () => {
  const env = buildValidEnvelope();
  env.writeUInt32BE(0x11223344, 0);
  assert.throws(() => validateKeyringStructure(env), KeyringValidationError);
});

test('validateKeyringStructure rejects truncated envelope', () => {
  const env = buildValidEnvelope();
  // Compute offsets matching validator expectations: wrappedCEKOffset=24, iv=12, tag=16 => ciphertextOffset=24+40+12+16=92
  const truncated = env.slice(0, 92); // remove ciphertext entirely
  assert.throws(() => validateKeyringStructure(truncated), KeyringValidationError);
});

test('validateKeyringStructure rejects oversized envelope', () => {
  const env = buildValidEnvelope();
  const big = Buffer.concat([env, Buffer.alloc(70000)]);
  assert.throws(() => validateKeyringStructure(big), KeyringValidationError);
});
/**
 * Track 10: Keyring serializer tests.
 *
 * Validates serialize/deserialize round-trip, structural validation,
 * error handling for malformed inputs, and size limit enforcement.
 */

const crypto = require('crypto');
const {
  serializeKeyring,
  deserializeKeyring,
  checksumSerialized,
  SerializerError,
  SERIALIZER_VERSION,
  MAX_SERIALIZED_BYTES,
} = require('../keyring-serializer.cjs');

describe('keyring-serializer', () => {
  function makeValidKeyring(overrides = {}) {
    return {
      algorithm: 'X25519+ML-KEM-768',
      keys: [
        { id: 'key-active', alg: 'X25519', data: crypto.randomBytes(32) },
        { id: 'key-previous', alg: 'X25519', data: crypto.randomBytes(32) },
      ],
      ...overrides,
    };
  }

  // ── Serialization ──────────────────────────────────────────────────────

  describe('serializeKeyring', () => {
    test('produces a Buffer containing valid JSON with correct envelope fields', () => {
      const keyring = makeValidKeyring();
      const serialized = serializeKeyring(keyring);

      expect(Buffer.isBuffer(serialized)).toBe(true);
      const parsed = JSON.parse(serialized.toString('utf8'));
      expect(parsed.version).toBe(SERIALIZER_VERSION);
      expect(parsed.keyringId).toBeDefined();
      expect(typeof parsed.keyringId).toBe('string');
      expect(parsed.createdAt).toBeDefined();
      expect(parsed.algorithm).toBe('X25519+ML-KEM-768');
      expect(parsed.keyCount).toBe(2);
      expect(parsed.keys).toHaveLength(2);
      expect(parsed.keys[0].id).toBe('key-active');
      expect(parsed.keys[0].alg).toBe('X25519');
      expect(typeof parsed.keys[0].data).toBe('string');
    });

    test('generates a keyringId if not provided', () => {
      const keyring = makeValidKeyring();
      delete keyring.keyringId;
      const serialized = serializeKeyring(keyring);
      const parsed = JSON.parse(serialized.toString('utf8'));
      expect(parsed.keyringId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    });

    test('preserves provided keyringId', () => {
      const keyring = makeValidKeyring({ keyringId: 'custom-id-123' });
      const serialized = serializeKeyring(keyring);
      const parsed = JSON.parse(serialized.toString('utf8'));
      expect(parsed.keyringId).toBe('custom-id-123');
    });

    test('generates createdAt if not provided', () => {
      const keyring = makeValidKeyring();
      delete keyring.createdAt;
      const serialized = serializeKeyring(keyring);
      const parsed = JSON.parse(serialized.toString('utf8'));
      expect(parsed.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    test('encodes key data as base64', () => {
      const keyData = crypto.randomBytes(32);
      const keyring = makeValidKeyring({ keys: [{ id: 'k1', alg: 'X25519', data: keyData }] });
      const serialized = serializeKeyring(keyring);
      const parsed = JSON.parse(serialized.toString('utf8'));
      expect(Buffer.from(parsed.keys[0].data, 'base64').equals(keyData)).toBe(true);
    });
  });

  // ── Validation ─────────────────────────────────────────────────────────

  describe('serializeKeyring validation', () => {
    function expectCode(fn, code) {
      let caught;
      try { fn(); } catch (e) { caught = e; }
      expect(caught).toBeInstanceOf(SerializerError);
      expect(caught.code).toBe(code);
    }

    test('rejects null input', () => {
      expectCode(() => serializeKeyring(null), 'INVALID_KEYRING');
    });

    test('rejects missing algorithm', () => {
      const keyring = makeValidKeyring();
      delete keyring.algorithm;
      expectCode(() => serializeKeyring(keyring), 'INVALID_ALGORITHM');
    });

    test('rejects empty keys array', () => {
      const keyring = makeValidKeyring({ keys: [] });
      expectCode(() => serializeKeyring(keyring), 'NO_KEYS');
    });

    test('rejects key entry with missing id', () => {
      const keyring = makeValidKeyring({
        keys: [{ alg: 'X25519', data: crypto.randomBytes(32) }],
      });
      expectCode(() => serializeKeyring(keyring), 'INVALID_KEY_ID');
    });

    test('rejects key entry with missing alg', () => {
      const keyring = makeValidKeyring({
        keys: [{ id: 'k1', data: crypto.randomBytes(32) }],
      });
      expectCode(() => serializeKeyring(keyring), 'INVALID_KEY_ALG');
    });

    test('rejects key entry where data is not a Buffer', () => {
      const keyring = makeValidKeyring({
        keys: [{ id: 'k1', alg: 'X25519', data: 'not-a-buffer' }],
      });
      expectCode(() => serializeKeyring(keyring), 'INVALID_KEY_DATA');
    });

    test('rejects key entry with empty data Buffer', () => {
      const keyring = makeValidKeyring({
        keys: [{ id: 'k1', alg: 'X25519', data: Buffer.alloc(0) }],
      });
      expectCode(() => serializeKeyring(keyring), 'EMPTY_KEY_DATA');
    });
  });

  // ── Deserialization ────────────────────────────────────────────────────

  describe('deserializeKeyring', () => {
    function expectCode(fn, code) {
      let caught;
      try { fn(); } catch (e) { caught = e; }
      expect(caught).toBeInstanceOf(SerializerError);
      expect(caught.code).toBe(code);
    }

    test('round-trips a valid keyring', () => {
      const original = makeValidKeyring({ keyringId: 'rt-123' });
      const serialized = serializeKeyring(original);
      const restored = deserializeKeyring(serialized);

      expect(restored.version).toBe(SERIALIZER_VERSION);
      expect(restored.keyringId).toBe('rt-123');
      expect(restored.algorithm).toBe('X25519+ML-KEM-768');
      expect(restored.keyCount).toBe(2);
      expect(restored.keys).toHaveLength(2);
      expect(restored.keys[0].id).toBe('key-active');
      expect(restored.keys[0].alg).toBe('X25519');
      expect(Buffer.isBuffer(restored.keys[0].data)).toBe(true);
      expect(restored.keys[0].data.equals(original.keys[0].data)).toBe(true);
      expect(restored.keys[1].data.equals(original.keys[1].data)).toBe(true);
    });

    test('rejects non-Buffer input', () => {
      expectCode(() => deserializeKeyring('not-a-buffer'), 'INVALID_INPUT');
      expectCode(() => deserializeKeyring(null), 'INVALID_INPUT');
    });

    test('rejects empty buffer', () => {
      expectCode(() => deserializeKeyring(Buffer.alloc(0)), 'EMPTY_INPUT');
    });

    test('rejects malformed JSON', () => {
      expectCode(() => deserializeKeyring(Buffer.from('not json')), 'MALFORMED_JSON');
    });

    test('rejects version mismatch', () => {
      const keyring = makeValidKeyring();
      const serialized = serializeKeyring(keyring);
      const parsed = JSON.parse(serialized.toString('utf8'));
      parsed.version = 99;
      expectCode(() => deserializeKeyring(Buffer.from(JSON.stringify(parsed))), 'VERSION_MISMATCH');
    });

    test('rejects missing keyringId', () => {
      const keyring = makeValidKeyring();
      const serialized = serializeKeyring(keyring);
      const parsed = JSON.parse(serialized.toString('utf8'));
      delete parsed.keyringId;
      expectCode(() => deserializeKeyring(Buffer.from(JSON.stringify(parsed))), 'INVALID_KEYRING_ID');
    });

    test('rejects missing algorithm', () => {
      const keyring = makeValidKeyring();
      const serialized = serializeKeyring(keyring);
      const parsed = JSON.parse(serialized.toString('utf8'));
      delete parsed.algorithm;
      expectCode(() => deserializeKeyring(Buffer.from(JSON.stringify(parsed))), 'INVALID_ALGORITHM');
    });

    test('rejects empty keys array', () => {
      const keyring = makeValidKeyring();
      const serialized = serializeKeyring(keyring);
      const parsed = JSON.parse(serialized.toString('utf8'));
      parsed.keys = [];
      expectCode(() => deserializeKeyring(Buffer.from(JSON.stringify(parsed))), 'NO_KEYS');
    });

    test('rejects key with invalid base64 data', () => {
      const keyring = makeValidKeyring();
      const serialized = serializeKeyring(keyring);
      const parsed = JSON.parse(serialized.toString('utf8'));
      parsed.keys[0].data = '!!!not-base64!!!';
      expectCode(() => deserializeKeyring(Buffer.from(JSON.stringify(parsed))), 'INVALID_KEY_DATA');
    });
  });

  // ── Size limit ────────────────────────────────────────────────────────

  describe('size limit', () => {
    function expectCode(fn, code) {
      let caught;
      try { fn(); } catch (e) { caught = e; }
      expect(caught).toBeInstanceOf(SerializerError);
      expect(caught.code).toBe(code);
    }

    test('rejects serialized output exceeding MAX_SERIALIZED_BYTES', () => {
      const hugeData = crypto.randomBytes(MAX_SERIALIZED_BYTES + 100);
      const keyring = {
        algorithm: 'TEST',
        keys: [{ id: 'huge', alg: 'TEST', data: hugeData }],
      };
      expectCode(() => serializeKeyring(keyring), 'SIZE_LIMIT_EXCEEDED');
    });

    test('rejects deserialization of input exceeding MAX_SERIALIZED_BYTES', () => {
      const huge = Buffer.alloc(MAX_SERIALIZED_BYTES + 100);
      expectCode(() => deserializeKeyring(huge), 'SIZE_LIMIT_EXCEEDED');
    });
  });

  // ── Checksum ──────────────────────────────────────────────────────────

  describe('checksumSerialized', () => {
    function expectCode(fn, code) {
      let caught;
      try { fn(); } catch (e) { caught = e; }
      expect(caught).toBeInstanceOf(SerializerError);
      expect(caught.code).toBe(code);
    }

    test('returns a 64-character hex string', () => {
      const keyring = makeValidKeyring();
      const serialized = serializeKeyring(keyring);
      const checksum = checksumSerialized(serialized);
      expect(typeof checksum).toBe('string');
      expect(checksum).toHaveLength(64);
      expect(checksum).toMatch(/^[0-9a-f]{64}$/);
    });

    test('is deterministic for the same input', () => {
      const keyring = makeValidKeyring({ keyringId: 'fixed-id' });
      const serialized = serializeKeyring(keyring);
      expect(checksumSerialized(serialized)).toBe(checksumSerialized(serialized));
    });

    test('differs for different inputs', () => {
      const keyring1 = makeValidKeyring({ keyringId: 'id-1' });
      const keyring2 = makeValidKeyring({ keyringId: 'id-2' });
      const s1 = serializeKeyring(keyring1);
      const s2 = serializeKeyring(keyring2);
      expect(checksumSerialized(s1)).not.toBe(checksumSerialized(s2));
    });

    test('rejects non-Buffer input', () => {
      expectCode(() => checksumSerialized('not-a-buffer'), 'INVALID_INPUT');
    });
  });

  // ── SerializerError ──────────────────────────────────────────────────

  describe('SerializerError', () => {
    test('has name and code properties', () => {
      const err = new SerializerError('TEST_CODE', 'test message');
      expect(err.name).toBe('SerializerError');
      expect(err.code).toBe('TEST_CODE');
      expect(err.message).toBe('test message');
      expect(err).toBeInstanceOf(Error);
    });
  });
});
