'use strict';

/**
 * validate-keyring-lifecycle.cjs
 *
 * Cross-module round-trip lifecycle validation for the Track 10 keyring
 * serializer and AES-KWP primitive.
 *
 * Performs:
 *   - AES-KW / AES-KWP vector spot-checks
 *   - serialize() -> deserialize() round-trip with 128/192/256-bit KEKs
 *   - Tamper and wrong-KEK failure checks
 */

const assert = require('assert');
const crypto = require('crypto');
const { serialize, deserialize } = require('../server/lib/keyring-serializer.cjs');
const { wrap, unwrap, wrapPad, unwrapPad } = require('../server/lib/aes-kw.cjs');
const { KW_VECTORS, KWP_VECTORS } = require('../server/lib/__tests__/vectors/aes-kw-vectors.cjs');

console.log('=== Track 10 Keyring Lifecycle Validation ===\n');

// 1. Primitive spot-checks: AES-KW and AES-KWP vectors
console.log('[1] Verifying AES-KW RFC 3394 vectors...');
KW_VECTORS.forEach((v, i) => {
  const wrapped = wrap(v.kek, v.plaintext);
  assert(wrapped.equals(v.ciphertext), `KW vector ${i + 1} wrap mismatch`);
  const unwrapped = unwrap(v.kek, v.ciphertext);
  assert(unwrapped.equals(v.plaintext), `KW vector ${i + 1} unwrap mismatch`);
});
console.log(`    ✓ ${KW_VECTORS.length} AES-KW vectors pass`);

console.log('[2] Verifying AES-KWP RFC 5649 vectors...');
KWP_VECTORS.forEach((v, i) => {
  const wrapped = wrapPad(v.kek, v.plaintext);
  assert(wrapped.equals(v.ciphertext), `KWP vector ${i + 1} wrap mismatch`);
  const unwrapped = unwrapPad(v.kek, v.ciphertext);
  assert(unwrapped.equals(v.plaintext), `KWP vector ${i + 1} unwrap mismatch`);
});
console.log(`    ✓ ${KWP_VECTORS.length} AES-KWP vectors pass`);

// 2. End-to-end keyring serializer lifecycle
console.log('[3] Verifying keyring-serializer round-trip...');

const keyring = {
  algorithm: 'X25519+ML-KEM-768',
  keyringId: 'lifecycle-001',
  createdAt: new Date().toISOString(),
  keyCount: 2,
  keys: [
    { id: 'active', alg: 'X25519', data: crypto.randomBytes(32).toString('base64') },
    { id: 'previous', alg: 'X25519', data: crypto.randomBytes(32).toString('base64') },
  ],
};

[16, 24, 32].forEach((kekLen) => {
  const kek = crypto.randomBytes(kekLen);
  const blob = serialize(keyring, kek);
  assert(Buffer.isBuffer(blob) && blob.length > 12, `KEK len ${kekLen}: serialize did not produce a valid blob`);

  const restored = deserialize(blob, kek);
  assert.deepStrictEqual(restored, keyring, `KEK len ${kekLen}: round-trip mismatch`);
  console.log(`    ✓ Round-trip with ${kekLen * 8}-bit KEK`);
});

// 3. Failure checks
console.log('[4] Verifying tamper and wrong-KEK failure modes...');

const kek = crypto.randomBytes(32);
const blob = serialize(keyring, kek);

// Wrong KEK
const wrongKek = crypto.randomBytes(32);
assert.throws(() => deserialize(blob, wrongKek), 'Wrong KEK should fail');
console.log('    ✓ Wrong KEK rejected');

// Tampered magic
const magicTampered = Buffer.from(blob);
magicTampered[0] ^= 0xFF;
assert.throws(() => deserialize(magicTampered, kek), 'Tampered magic should fail');
console.log('    ✓ Tampered magic rejected');

// Tampered ciphertext
const cipherTampered = Buffer.from(blob);
cipherTampered[cipherTampered.length - 1] ^= 0xFF;
assert.throws(() => deserialize(cipherTampered, kek), 'Tampered ciphertext should fail');
console.log('    ✓ Tampered ciphertext rejected');

console.log('\n=== All lifecycle checks passed ===');
