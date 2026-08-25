const crypto = require("crypto");

class FipsCriticalFaultError extends Error {
  constructor(message) {
    super(`[FIPS_CRITICAL_FAULT] ${message}`);
    this.name = "FipsCriticalFaultError";
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
      key: Buffer.from(
        "000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f",
        "hex",
      ),
      plaintext: Buffer.from("00112233445566778899aabbccddeeff", "hex"),
      ciphertext: Buffer.from(
        "64e8c3f9ce0f5ba263e9777905818a2a93c8191e7d6e8ae7",
        "hex",
      ),
    },
    // RFC 5869: HKDF-SHA256
    HKDF: {
      ikm: Buffer.from("0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b", "hex"),
      salt: Buffer.from("000102030405060708090a0b0c", "hex"),
      info: Buffer.from("f0f1f2f3f4f5f6f7f8f9", "hex"),
      length: 42,
      okm: Buffer.from(
        "3cb25f25faacd57a90434f64d0362f2a2d2d0a90cf1a5a4c5db02d56ecc4c5bf34007208d5b887185865",
        "hex",
      ),
    },
  };

  /**
   * Executes Power-On Self-Tests (POST)
   */
  static executePowerOnSelfTests() {
    if (this.#isLocked) {
      throw new FipsCriticalFaultError(
        "Cryptographic module is locked due to a previous POST failure.",
      );
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
    const iv = Buffer.from("a6a6a6a6a6a6a6a6", "hex");

    const cipher = crypto.createCipheriv("id-aes256-wrap", key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);

    if (!encrypted.equals(ciphertext)) {
      throw new Error("AES-KW Known Answer Test mismatch.");
    }

    const decipher = crypto.createDecipheriv("id-aes256-wrap", key, iv);
    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]);

    if (!decrypted.equals(plaintext)) {
      throw new Error("AES-KW Round-Trip Test failure.");
    }
  }

  static #runHkdfTest() {
    const { ikm, salt, info, length, okm } = this.VECTORS.HKDF;

    const derived = crypto.hkdfSync("sha256", ikm, salt, info, length);
    const derivedBuffer = Buffer.from(derived);

    if (!derivedBuffer.equals(okm)) {
      throw new Error("HKDF-SHA256 Known Answer Test mismatch.");
    }
  }
}

module.exports = { FipsSelfTestRunner, FipsCriticalFaultError };
