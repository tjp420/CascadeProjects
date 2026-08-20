"use strict";

/**
 * Track 58: Multi-Key FHE Relinearization Engine tests.
 */
const {
  MultiKeyFheRelinearizationEngine,
  DEFAULT_OPTIONS,
  KEY_STATUS,
  CIPHERTEXT_STATUS,
  OP_TYPE,
} = require("../multi-key-fhe-relinearization-engine.cjs");
const { HsmAdapterError } = require("../base-adapter.cjs");

describe("Track 58: MultiKeyFheRelinearizationEngine", () => {
  let engine;

  beforeEach(() => {
    engine = new MultiKeyFheRelinearizationEngine({
      maxKeyPairs: 10,
      maxNoiseBudget: 1000,
      noiseThreshold: 50,
      maxCiphertextOps: 1000,
    });
  });

  describe("generateKeyPair", () => {
    test("generates a key pair", () => {
      const result = engine.generateKeyPair("k1", "user-a");
      expect(result.keyId).toBe("k1");
      expect(result.userId).toBe("user-a");
      expect(result.status).toBe(KEY_STATUS.ACTIVE);
      expect(result.publicKey).toBeDefined();
    });

    test("rejects empty keyId", () => {
      expect(() => engine.generateKeyPair("")).toThrow(HsmAdapterError);
    });

    test("rejects duplicate keyId", () => {
      engine.generateKeyPair("k1");
      expect(() => engine.generateKeyPair("k1")).toThrow(HsmAdapterError);
    });

    test("rejects when max key pairs reached", () => {
      for (let i = 0; i < 10; i++) {
        engine.generateKeyPair(`k${i}`);
      }
      expect(() => engine.generateKeyPair("k10")).toThrow(HsmAdapterError);
    });
  });

  describe("generateRelinearizationKey", () => {
    test("generates a relinearization key", () => {
      engine.generateKeyPair("k1");
      engine.generateKeyPair("k2");
      const result = engine.generateRelinearizationKey("rk1", "k1", "k2");
      expect(result.relinKeyId).toBe("rk1");
      expect(result.sourceKeyId).toBe("k1");
      expect(result.targetKeyId).toBe("k2");
    });

    test("rejects empty relinKeyId", () => {
      engine.generateKeyPair("k1");
      engine.generateKeyPair("k2");
      expect(() => engine.generateRelinearizationKey("", "k1", "k2")).toThrow(
        HsmAdapterError,
      );
    });

    test("rejects duplicate relinKeyId", () => {
      engine.generateKeyPair("k1");
      engine.generateKeyPair("k2");
      engine.generateRelinearizationKey("rk1", "k1", "k2");
      expect(() =>
        engine.generateRelinearizationKey("rk1", "k1", "k2"),
      ).toThrow(HsmAdapterError);
    });

    test("rejects unknown source key", () => {
      engine.generateKeyPair("k2");
      expect(() =>
        engine.generateRelinearizationKey("rk1", "unknown", "k2"),
      ).toThrow(HsmAdapterError);
    });

    test("rejects unknown target key", () => {
      engine.generateKeyPair("k1");
      expect(() =>
        engine.generateRelinearizationKey("rk1", "k1", "unknown"),
      ).toThrow(HsmAdapterError);
    });

    test("rejects revoked source key", () => {
      engine.generateKeyPair("k1");
      engine.generateKeyPair("k2");
      engine.revokeKey("k1");
      expect(() =>
        engine.generateRelinearizationKey("rk1", "k1", "k2"),
      ).toThrow(HsmAdapterError);
    });
  });

  describe("encrypt", () => {
    test("encrypts a plaintext", () => {
      engine.generateKeyPair("k1");
      const result = engine.encrypt("k1", 42n);
      expect(result.ciphertextId).toBeDefined();
      expect(result.keyId).toBe("k1");
      expect(result.status).toBe(CIPHERTEXT_STATUS.FRESH);
      expect(result.noiseBudget).toBeGreaterThan(0);
    });

    test("rejects unknown key", () => {
      expect(() => engine.encrypt("unknown", 42n)).toThrow(HsmAdapterError);
    });

    test("rejects revoked key", () => {
      engine.generateKeyPair("k1");
      engine.revokeKey("k1");
      expect(() => engine.encrypt("k1", 42n)).toThrow(HsmAdapterError);
    });

    test("accepts number plaintext", () => {
      engine.generateKeyPair("k1");
      const result = engine.encrypt("k1", 100);
      expect(result.ciphertextId).toBeDefined();
    });
  });

  describe("decrypt", () => {
    test("decrypts a ciphertext", () => {
      engine.generateKeyPair("k1");
      const ct = engine.encrypt("k1", 42n);
      const result = engine.decrypt(ct.ciphertextId);
      expect(result.plaintext).toBe(42n);
    });

    test("rejects unknown ciphertext", () => {
      expect(() => engine.decrypt("unknown")).toThrow(HsmAdapterError);
    });
  });

  describe("add", () => {
    test("adds two ciphertexts with same key", () => {
      engine.generateKeyPair("k1");
      const ct1 = engine.encrypt("k1", 10n);
      const ct2 = engine.encrypt("k1", 20n);
      const result = engine.add(ct1.ciphertextId, ct2.ciphertextId);
      const decrypted = engine.decrypt(result.ciphertextId);
      expect(decrypted.plaintext).toBe(30n);
    });

    test("rejects unknown ciphertext", () => {
      engine.generateKeyPair("k1");
      const ct = engine.encrypt("k1", 10n);
      expect(() => engine.add(ct.ciphertextId, "unknown")).toThrow(
        HsmAdapterError,
      );
    });
  });

  describe("sub", () => {
    test("subtracts two ciphertexts with same key", () => {
      engine.generateKeyPair("k1");
      const ct1 = engine.encrypt("k1", 30n);
      const ct2 = engine.encrypt("k1", 12n);
      const result = engine.sub(ct1.ciphertextId, ct2.ciphertextId);
      const decrypted = engine.decrypt(result.ciphertextId);
      expect(decrypted.plaintext).toBe(18n);
    });
  });

  describe("mul", () => {
    test("multiplies two ciphertexts with same key", () => {
      engine.generateKeyPair("k1");
      const ct1 = engine.encrypt("k1", 6n);
      const ct2 = engine.encrypt("k1", 7n);
      const result = engine.mul(ct1.ciphertextId, ct2.ciphertextId);
      const decrypted = engine.decrypt(result.ciphertextId);
      expect(decrypted.plaintext).toBe(42n);
    });

    test("multiplies cross-key ciphertexts with relin key", () => {
      engine.generateKeyPair("k1", "user-a");
      engine.generateKeyPair("k2", "user-b");
      engine.generateRelinearizationKey("rk1", "k1", "k2");
      const ct1 = engine.encrypt("k1", 5n);
      const ct2 = engine.encrypt("k2", 8n);
      const result = engine.mul(ct1.ciphertextId, ct2.ciphertextId, "rk1");
      expect(result.status).toBe(CIPHERTEXT_STATUS.RELINEARIZED);
    });

    test("rejects cross-key mul without relin key", () => {
      engine.generateKeyPair("k1");
      engine.generateKeyPair("k2");
      const ct1 = engine.encrypt("k1", 5n);
      const ct2 = engine.encrypt("k2", 8n);
      expect(() => engine.mul(ct1.ciphertextId, ct2.ciphertextId)).toThrow(
        HsmAdapterError,
      );
    });

    test("rejects unknown relin key", () => {
      engine.generateKeyPair("k1");
      engine.generateKeyPair("k2");
      const ct1 = engine.encrypt("k1", 5n);
      const ct2 = engine.encrypt("k2", 8n);
      expect(() =>
        engine.mul(ct1.ciphertextId, ct2.ciphertextId, "unknown"),
      ).toThrow(HsmAdapterError);
    });
  });

  describe("scalarMul", () => {
    test("multiplies a ciphertext by a scalar", () => {
      engine.generateKeyPair("k1");
      const ct = engine.encrypt("k1", 7n);
      const result = engine.scalarMul(ct.ciphertextId, 6n);
      const decrypted = engine.decrypt(result.ciphertextId);
      expect(decrypted.plaintext).toBe(42n);
    });

    test("rejects unknown ciphertext", () => {
      expect(() => engine.scalarMul("unknown", 5n)).toThrow(HsmAdapterError);
    });
  });

  describe("scalarAdd", () => {
    test("adds a scalar to a ciphertext", () => {
      engine.generateKeyPair("k1");
      const ct = engine.encrypt("k1", 30n);
      const result = engine.scalarAdd(ct.ciphertextId, 12n);
      const decrypted = engine.decrypt(result.ciphertextId);
      expect(decrypted.plaintext).toBe(42n);
    });

    test("rejects unknown ciphertext", () => {
      expect(() => engine.scalarAdd("unknown", 5n)).toThrow(HsmAdapterError);
    });
  });

  describe("switchKey", () => {
    test("switches a ciphertext to a different key space", () => {
      engine.generateKeyPair("k1");
      engine.generateKeyPair("k2");
      engine.generateRelinearizationKey("rk1", "k1", "k2");
      const ct = engine.encrypt("k1", 42n);
      const result = engine.switchKey(ct.ciphertextId, "k2", "rk1");
      expect(result.keyId).toBe("k2");
      const decrypted = engine.decrypt(result.ciphertextId);
      expect(decrypted.plaintext).toBe(42n);
    });

    test("rejects when key switching disabled", () => {
      const disabled = new MultiKeyFheRelinearizationEngine({
        enableKeySwitching: false,
      });
      disabled.generateKeyPair("k1");
      disabled.generateKeyPair("k2");
      disabled.generateRelinearizationKey("rk1", "k1", "k2");
      const ct = disabled.encrypt("k1", 42n);
      expect(() => disabled.switchKey(ct.ciphertextId, "k2", "rk1")).toThrow(
        HsmAdapterError,
      );
    });

    test("rejects unknown ciphertext", () => {
      engine.generateKeyPair("k1");
      engine.generateKeyPair("k2");
      engine.generateRelinearizationKey("rk1", "k1", "k2");
      expect(() => engine.switchKey("unknown", "k2", "rk1")).toThrow(
        HsmAdapterError,
      );
    });

    test("rejects mismatched relin key", () => {
      engine.generateKeyPair("k1");
      engine.generateKeyPair("k2");
      engine.generateKeyPair("k3");
      engine.generateRelinearizationKey("rk1", "k1", "k2");
      const ct = engine.encrypt("k1", 42n);
      expect(() => engine.switchKey(ct.ciphertextId, "k3", "rk1")).toThrow(
        HsmAdapterError,
      );
    });
  });

  describe("bootstrap", () => {
    test("bootstraps a ciphertext to refresh noise budget", () => {
      engine.generateKeyPair("k1");
      const ct = engine.encrypt("k1", 42n);
      // Reduce noise budget
      const ciphertext = engine._ciphertexts.get(ct.ciphertextId);
      ciphertext.noiseBudget = 10;
      const result = engine.bootstrap(ct.ciphertextId);
      expect(result.noiseBudget).toBe(1000);
      expect(result.status).toBe(CIPHERTEXT_STATUS.BOOTSTRAPPED);
    });

    test("rejects when bootstrapping disabled", () => {
      const disabled = new MultiKeyFheRelinearizationEngine({
        enableBootstrapping: false,
      });
      disabled.generateKeyPair("k1");
      const ct = disabled.encrypt("k1", 42n);
      expect(() => disabled.bootstrap(ct.ciphertextId)).toThrow(
        HsmAdapterError,
      );
    });

    test("rejects unknown ciphertext", () => {
      expect(() => engine.bootstrap("unknown")).toThrow(HsmAdapterError);
    });
  });

  describe("revokeKey", () => {
    test("revokes a key pair", () => {
      engine.generateKeyPair("k1");
      const result = engine.revokeKey("k1");
      expect(result.revoked).toBe(true);
      const key = engine.getKeyPair("k1");
      expect(key.status).toBe(KEY_STATUS.REVOKED);
    });

    test("rejects unknown key", () => {
      expect(() => engine.revokeKey("unknown")).toThrow(HsmAdapterError);
    });
  });

  describe("getKeyPair", () => {
    test("returns key pair info", () => {
      engine.generateKeyPair("k1", "user-a");
      const key = engine.getKeyPair("k1");
      expect(key).not.toBeNull();
      expect(key.keyId).toBe("k1");
      expect(key.userId).toBe("user-a");
    });

    test("returns null for unknown key", () => {
      expect(engine.getKeyPair("unknown")).toBeNull();
    });
  });

  describe("getKeyPairs", () => {
    test("returns all key pairs", () => {
      engine.generateKeyPair("k1");
      engine.generateKeyPair("k2");
      expect(engine.getKeyPairs().length).toBe(2);
    });
  });

  describe("getCiphertext", () => {
    test("returns ciphertext info", () => {
      engine.generateKeyPair("k1");
      const ct = engine.encrypt("k1", 42n);
      const info = engine.getCiphertext(ct.ciphertextId);
      expect(info).not.toBeNull();
      expect(info.ciphertextId).toBe(ct.ciphertextId);
    });

    test("returns null for unknown ciphertext", () => {
      expect(engine.getCiphertext("unknown")).toBeNull();
    });
  });

  describe("getRelinearizationKey", () => {
    test("returns relin key info", () => {
      engine.generateKeyPair("k1");
      engine.generateKeyPair("k2");
      engine.generateRelinearizationKey("rk1", "k1", "k2");
      const info = engine.getRelinearizationKey("rk1");
      expect(info).not.toBeNull();
      expect(info.sourceKeyId).toBe("k1");
      expect(info.targetKeyId).toBe("k2");
    });

    test("returns null for unknown relin key", () => {
      expect(engine.getRelinearizationKey("unknown")).toBeNull();
    });
  });

  describe("getEvalHistory", () => {
    test("returns evaluation history", () => {
      engine.generateKeyPair("k1");
      const ct1 = engine.encrypt("k1", 10n);
      const ct2 = engine.encrypt("k1", 20n);
      engine.add(ct1.ciphertextId, ct2.ciphertextId);
      expect(engine.getEvalHistory().length).toBeGreaterThan(0);
    });
  });

  describe("getStats", () => {
    test("returns summary statistics", () => {
      engine.generateKeyPair("k1");
      engine.generateKeyPair("k2");
      const stats = engine.getStats();
      expect(stats.totalKeyPairs).toBe(2);
      expect(stats.totalRelinKeys).toBe(0);
    });
  });

  describe("reset", () => {
    test("clears all state", () => {
      engine.generateKeyPair("k1");
      engine.reset();
      expect(engine.getStats().totalKeyPairs).toBe(0);
    });
  });

  describe("full multi-key FHE flow", () => {
    test("complete multi-key encrypt -> eval -> relin -> decrypt flow", () => {
      // Generate key pairs for two users
      engine.generateKeyPair("alice-key", "alice");
      engine.generateKeyPair("bob-key", "bob");
      // Generate relinearization key from alice to bob
      engine.generateRelinearizationKey("alice-to-bob", "alice-key", "bob-key");
      // Each user encrypts their private value
      const aliceCt = engine.encrypt("alice-key", 15n);
      const bobCt = engine.encrypt("bob-key", 25n);
      // Same-key operations (within each user's space)
      const aliceDouble = engine.scalarMul(aliceCt.ciphertextId, 2n);
      const decryptedAliceDouble = engine.decrypt(aliceDouble.ciphertextId);
      expect(decryptedAliceDouble.plaintext).toBe(30n);
      // Cross-key multiplication with relinearization
      const crossProduct = engine.mul(
        aliceCt.ciphertextId,
        bobCt.ciphertextId,
        "alice-to-bob",
      );
      expect(crossProduct.status).toBe(CIPHERTEXT_STATUS.RELINEARIZED);
      // Key switch alice's ciphertext to bob's key space
      const switched = engine.switchKey(
        aliceCt.ciphertextId,
        "bob-key",
        "alice-to-bob",
      );
      expect(switched.keyId).toBe("bob-key");
      // Add switched ciphertext with bob's ciphertext (now same key)
      const sum = engine.add(switched.ciphertextId, bobCt.ciphertextId);
      const decryptedSum = engine.decrypt(sum.ciphertextId);
      expect(decryptedSum.plaintext).toBe(40n); // 15 + 25
      // Verify stats
      const stats = engine.getStats();
      expect(stats.totalKeyPairs).toBe(2);
      expect(stats.totalRelinKeys).toBe(1);
      expect(stats.relinearizationCount).toBeGreaterThan(0);
      expect(stats.keySwitchCount).toBeGreaterThan(0);
    });
  });
});
