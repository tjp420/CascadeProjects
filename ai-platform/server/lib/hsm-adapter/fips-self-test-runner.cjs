const crypto = require('crypto');

class FipsCriticalFaultError extends Error {
  constructor(message) {
    super(`[FIPS_CRITICAL_FAULT] ${message}`);
    this.name = 'FipsCriticalFaultError';
  }
}

class FipsSelfTestRunner {
  static #isLocked = false;
  static #hasPassed = false;

  /**
   * NIST SP 800-38F / RFC 5869 / SP 800-56A Deterministic Vectors
   */
  static VECTORS = {
    // NIST SP 800-38F: AES-256 Key Wrap (KW)
    AES_KW: {
      key: Buffer.from('000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f', 'hex'),
      plaintext: Buffer.from('00112233445566778899aabbccddeeff', 'hex'),
      ciphertext: Buffer.from('28c9f404c4b810f4cbccb4d939afa8d659dd04c3298e3b33', 'hex')
    },
    // RFC 5869: HKDF-SHA256
    HKDF: {
      ikm: Buffer.from('0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b', 'hex'),
      salt: Buffer.from('000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f', 'hex'),
      info: Buffer.from('f0f1f2f3f4f5f6f7f8f9', 'hex'),
      length: 42,
      okm: Buffer.from('3cb25f151b60726b5557b4099f85632d4815a97330fd5e275422b8ad7c2c441a0d521d2db2d4c6f174c9', 'hex')
    }
  };

  /**
   * Executes Power-On Self-Tests (POST)
   */
  static executePowerOnSelfTests() {
    if (this.#isLocked) {
      throw new FipsCriticalFaultError('Cryptographic module is locked due to a previous POST failure.');
    }
    if (this.#hasPassed) return true;

    try {
      this.#runAesKwTest();
      this.#runHkdfTest();

      this.#hasPassed = true;
      return true;
    } catch (error) {
      this.#isLocked = true;
      throw new FipsCriticalFaultError(error.message);
    }
  }

  static isLocked() {
    return this.#isLocked;
  }

  static resetStatusForTesting() {
    this.#isLocked = false;
    this.#hasPassed = false;
  }

  static #runAesKwTest() {
    const { key, plaintext, ciphertext } = this.VECTORS.AES_KW;

    // Cipher initialization for Key Wrap
    const cipher = crypto.createCipheriv('aes-256-wrap', key, Buffer.alloc(0));
    const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);

    if (!encrypted.equals(ciphertext)) {
      throw new Error('AES-KW Known Answer Test mismatch.');
    }

    const decipher = crypto.createDecipheriv('aes-256-wrap', key, Buffer.alloc(0));
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);

    if (!decrypted.equals(plaintext)) {
      throw new Error('AES-KW Round-Trip Test failure.');
    }
  }

  static #runHkdfTest() {
    const { ikm, salt, info, length, okm } = this.VECTORS.HKDF;

    const derived = crypto.hkdfSync('sha256', ikm, salt, info, length);
    const derivedBuffer = Buffer.from(derived);

    if (!derivedBuffer.equals(okm)) {
      throw new Error('HKDF-SHA256 Known Answer Test mismatch.');
    }
  }
}

module.exports = { FipsSelfTestRunner, FipsCriticalFaultError };
