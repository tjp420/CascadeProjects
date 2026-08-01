'use strict';

/**
 * aes-kw.cjs
 * RFC 3394 / NIST SP 800-38F Key Wrap (AES-KW) Wrapper Implementation.
 */
const crypto = require('crypto');

/**
 * Standard Alternative Initial Value for AES-KW (RFC 3394 Section 2.2.3.1)
 * Hex: 0xA6A6A6A6A6A6A6A6
 */
const IV_A6 = Buffer.from('A6A6A6A6A6A6A6A6', 'hex');

/**
 * Wraps a plaintext key using a Key Encryption Key (KEK) via AES-KW.
 * @param {Buffer} kek - The Key Encryption Key (128, 192, or 256 bits).
 * @param {Buffer} plaintext - The key data to be wrapped (must be a multiple of 8 bytes, >= 16 bytes).
 * @returns {Buffer} The wrapped ciphertext.
 */
function wrap(kek, plaintext) {
  if (!Buffer.isBuffer(kek) || !Buffer.isBuffer(plaintext)) {
    throw new TypeError('Inputs must be Buffers');
  }
  if (![16, 24, 32].includes(kek.length)) {
    throw new Error('Invalid KEK length. Must be 128, 192, or 256 bits.');
  }
  if (plaintext.length < 16 || plaintext.length % 8 !== 0) {
    throw new Error('Plaintext length must be a multiple of 8 bytes and at least 16 bytes.');
  }

  const n = plaintext.length / 8;
  const R = [];

  // Initialize intermediate registers
  for (let i = 0; i < n; i++) {
    R[i] = plaintext.subarray(i * 8, (i + 1) * 8);
  }

  let A = Buffer.from(IV_A6);
  const cipherName = `aes-${kek.length * 8}-ecb`;

  // 6 rounds of the wrapping core loop
  for (let j = 0; j <= 5; j++) {
    for (let i = 1; i <= n; i++) {
      const concat = Buffer.concat([A, R[i - 1]]);
      const cipher = crypto.createCipheriv(cipherName, kek, Buffer.alloc(0));
      cipher.setAutoPadding(false);
      const B = Buffer.concat([cipher.update(concat), cipher.final()]);

      // Calculate t = (n * j) + i
      const t = (n * j) + i;
      A = B.subarray(0, 8);

      // XOR the least significant 8 bytes of A with t
      const tBuffer = Buffer.alloc(8);
      tBuffer.writeUInt32BE(t, 4); // Write t to the lower 4 bytes of an 8-byte buffer
      for (let k = 0; k < 8; k++) {
        A[k] ^= tBuffer[k];
      }

      R[i - 1] = B.subarray(8, 16);
    }
  }

  return Buffer.concat([A, ...R]);
}

/**
 * Unwraps a ciphertext key using a Key Encryption Key (KEK) via AES-KW.
 * @param {Buffer} kek - The Key Encryption Key (128, 192, or 256 bits).
 * @param {Buffer} ciphertext - The wrapped ciphertext.
 * @returns {Buffer} The unwrapped plaintext key.
 * @throws {Error} If integrity validation check fails.
 */
function unwrap(kek, ciphertext) {
  if (!Buffer.isBuffer(kek) || !Buffer.isBuffer(ciphertext)) {
    throw new TypeError('Inputs must be Buffers');
  }
  if (![16, 24, 32].includes(kek.length)) {
    throw new Error('Invalid KEK length. Must be 128, 192, or 256 bits.');
  }
  if (ciphertext.length < 24 || ciphertext.length % 8 !== 0) {
    throw new Error('Ciphertext length must be a multiple of 8 bytes and at least 24 bytes.');
  }

  const n = (ciphertext.length / 8) - 1;
  let A = ciphertext.subarray(0, 8);
  const R = [];

  for (let i = 1; i <= n; i++) {
    R[i - 1] = ciphertext.subarray(i * 8, (i + 1) * 8);
  }

  const decipherName = `aes-${kek.length * 8}-ecb`;

  // 6 rounds of the unwrapping core loop (reversed)
  for (let j = 5; j >= 0; j--) {
    for (let i = n; i >= 1; i--) {
      const t = (n * j) + i;
      const tBuffer = Buffer.alloc(8);
      tBuffer.writeUInt32BE(t, 4);

      // XOR the least significant 8 bytes of A with t before deciphering
      const intermediateA = Buffer.from(A);
      for (let k = 0; k < 8; k++) {
        intermediateA[k] ^= tBuffer[k];
      }

      const concat = Buffer.concat([intermediateA, R[i - 1]]);
      const decipher = crypto.createDecipheriv(decipherName, kek, Buffer.alloc(0));
      decipher.setAutoPadding(false);
      const B = Buffer.concat([decipher.update(concat), decipher.final()]);

      A = B.subarray(0, 8);
      R[i - 1] = B.subarray(8, 16);
    }
  }

  // Integrity Check: Verify initial A matches IV_A6
  if (!A.equals(IV_A6)) {
    throw new Error('Integrity check failed: Invalid KEK or corrupted ciphertext.');
  }

  return Buffer.concat(R);
}

module.exports = {
  wrap,
  unwrap,
};
