'use strict';

/**
 * aes-kw.test.cjs
 * Verification suite for AES-KW wrapper processing standard NIST vectors.
 */
const { wrap, unwrap } = require('../aes-kw.cjs');
const { AES_KW_VECTORS } = require('./vectors/aes-kw-vectors.cjs');

describe('AES-KW (RFC 3394) Compliance Suite', () => {

  // Dynamically iterate over all 6 RFC 3394 test vectors
  AES_KW_VECTORS.forEach((vector, index) => {
    const { name, kek, plaintext, ciphertext } = vector;

    describe(`Vector ${index + 1}: ${name}`, () => {
      const kekBuf = Buffer.from(kek, 'hex');
      const plainBuf = Buffer.from(plaintext, 'hex');
      const cipherBuf = Buffer.from(ciphertext, 'hex');

      it('should correctly wrap plaintext into valid NIST ciphertext', () => {
        const result = wrap(kekBuf, plainBuf);
        expect(result.toString('hex').toUpperCase()).toBe(ciphertext.toUpperCase());
      });

      it('should correctly unwrap NIST ciphertext into valid plaintext', () => {
        const result = unwrap(kekBuf, cipherBuf);
        expect(result.toString('hex').toUpperCase()).toBe(plaintext.toUpperCase());
      });
    });
  });

  describe('Error Handling and Integrity Safeguards', () => {
    it('should throw an error during unwrapping if the ciphertext is corrupted', () => {
      const vector = AES_KW_VECTORS[0];
      const kekBuf = Buffer.from(vector.kek, 'hex');
      const corruptedCipherBuf = Buffer.from(vector.ciphertext, 'hex');

      // Flip a bit in the ciphertext payload to violate integrity
      corruptedCipherBuf[corruptedCipherBuf.length - 1] ^= 0x01;

      expect(() => {
        unwrap(kekBuf, corruptedCipherBuf);
      }).toThrow('Integrity check failed');
    });

    it('should throw an error if input lengths violate alignment constraints', () => {
      const validKek = Buffer.alloc(16);
      const invalidPlaintext = Buffer.alloc(13); // Not a multiple of 8

      expect(() => wrap(validKek, invalidPlaintext)).toThrow(/multiple of 8/);
    });
  });
});
