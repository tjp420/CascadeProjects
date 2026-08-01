'use strict';

/**
 * aes-kw.test.cjs
 * Verification suite for AES-KW wrapper processing standard NIST vectors.
 */
const { wrap, unwrap } = require('../aes-kw.cjs');
const { KW_VECTORS } = require('./vectors/aes-kw-vectors.cjs');

describe('AES-KW (RFC 3394) Compliance Suite', () => {

  // Dynamically iterate over all 6 RFC 3394 test vectors
  KW_VECTORS.forEach((vector, index) => {
    const { name, kek, plaintext, ciphertext } = vector;

    describe(`Vector ${index + 1}: ${name}`, () => {
      it('should correctly wrap plaintext into valid NIST ciphertext', () => {
        const result = wrap(kek, plaintext);
        expect(result.toString('hex').toUpperCase()).toBe(ciphertext.toString('hex').toUpperCase());
      });

      it('should correctly unwrap NIST ciphertext into valid plaintext', () => {
        const result = unwrap(kek, ciphertext);
        expect(result.toString('hex').toUpperCase()).toBe(plaintext.toString('hex').toUpperCase());
      });
    });
  });

  describe('Error Handling and Integrity Safeguards', () => {
    it('should throw an error during unwrapping if the ciphertext is corrupted', () => {
      const vector = KW_VECTORS[0];
      const corruptedCipherBuf = Buffer.from(vector.ciphertext);

      // Flip a bit in the ciphertext payload to violate integrity
      corruptedCipherBuf[corruptedCipherBuf.length - 1] ^= 0x01;

      expect(() => {
        unwrap(vector.kek, corruptedCipherBuf);
      }).toThrow('Integrity check failed');
    });

    it('should throw an error if input lengths violate alignment constraints', () => {
      const validKek = Buffer.alloc(16);
      const invalidPlaintext = Buffer.alloc(13); // Not a multiple of 8

      expect(() => wrap(validKek, invalidPlaintext)).toThrow(/multiple of 8/);
    });

    it('should reject malformed KEK bit-lengths', () => {
      const plainBuf = Buffer.alloc(16);
      const invalidKeks = [
        Buffer.alloc(15),  // 120 bits
        Buffer.alloc(17),  // 136 bits
        Buffer.alloc(23),  // 184 bits
        Buffer.alloc(25),  // 200 bits
        Buffer.alloc(31),  // 248 bits
        Buffer.alloc(33)   // 264 bits
      ];

      invalidKeks.forEach(invalidKek => {
        expect(() => wrap(invalidKek, plainBuf)).toThrow(/Invalid KEK length/);
        expect(() => unwrap(invalidKek, Buffer.alloc(24))).toThrow(/Invalid KEK length/);
      });
    });

    it('should reject misaligned or undersized ciphertext blocks during unwrap', () => {
      const validKek = Buffer.alloc(16);

      expect(() => unwrap(validKek, Buffer.alloc(16))).toThrow(/at least 24 bytes/);
      expect(() => unwrap(validKek, Buffer.alloc(25))).toThrow(/multiple of 8/);
    });
  });
});
