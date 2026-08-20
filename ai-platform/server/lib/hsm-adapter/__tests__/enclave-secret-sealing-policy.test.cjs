"use strict";

/**
 * Track 42: Enclave Secret-Sealing and Attestation Policy tests.
 */
const {
  EnclaveSecretSealingPolicy,
  DEFAULT_SEALING_POLICY,
} = require("../enclave-secret-sealing-policy.cjs");
const { CryptoPolicyEngine } = require("../crypto-policy-engine.cjs");
const { HsmAdapterError } = require("../base-adapter.cjs");

describe("Track 42: Enclave Secret-Sealing Policy", () => {
  let policy;

  beforeEach(() => {
    policy = new EnclaveSecretSealingPolicy();
  });

  describe("validateSeal", () => {
    test("accepts a valid seal config with allowed cipher and key size", () => {
      const result = policy.validateSeal({
        cipher: "aes-256-gcm",
        keyBits: 256,
      });
      expect(result.valid).toBe(true);
      expect(result.cipher).toBe("aes-256-gcm");
    });

    test("rejects an unsupported sealing cipher", () => {
      expect(() =>
        policy.validateSeal({ cipher: "rc4", keyBits: 256 }),
      ).toThrow(HsmAdapterError);
    });

    test("rejects a key size below minimum", () => {
      expect(() =>
        policy.validateSeal({ cipher: "aes-256-gcm", keyBits: 64 }),
      ).toThrow(HsmAdapterError);
    });

    test("rejects data exceeding max size", () => {
      expect(() =>
        policy.validateSeal({
          cipher: "aes-256-gcm",
          keyBits: 256,
          dataSizeBytes: 999999999,
        }),
      ).toThrow(HsmAdapterError);
    });

    test("rejects a key that exceeds rotation interval", () => {
      expect(() =>
        policy.validateSeal({
          cipher: "aes-256-gcm",
          keyBits: 256,
          keyAgeMs: 7200000, // 2 hours, exceeds 1 hour rotation
        }),
      ).toThrow(HsmAdapterError);
    });

    test("rejects a key that exceeds max age", () => {
      expect(() =>
        policy.validateSeal({
          cipher: "aes-256-gcm",
          keyBits: 256,
          keyAgeMs: 999999999, // exceeds max age
        }),
      ).toThrow(HsmAdapterError);
    });

    test("accepts a key within rotation interval", () => {
      const result = policy.validateSeal({
        cipher: "aes-256-gcm",
        keyBits: 256,
        keyAgeMs: 1800000, // 30 min, within 1 hour
      });
      expect(result.valid).toBe(true);
    });

    test("rejects missing config", () => {
      expect(() => policy.validateSeal(null)).toThrow(HsmAdapterError);
    });
  });

  describe("validateUnseal", () => {
    test("accepts unseal inside enclave", () => {
      const result = policy.validateUnseal({ insideEnclave: true });
      expect(result.valid).toBe(true);
    });

    test("rejects unseal outside enclave when not allowed", () => {
      expect(() => policy.validateUnseal({ insideEnclave: false })).toThrow(
        HsmAdapterError,
      );
    });

    test("defaults to inside enclave when not specified", () => {
      const result = policy.validateUnseal({});
      expect(result.valid).toBe(true);
    });
  });

  describe("generateChallenge", () => {
    test("generates a nonce and expiry", () => {
      const challenge = policy.generateChallenge();
      expect(challenge.nonce).toBeDefined();
      expect(typeof challenge.nonce).toBe("string");
      expect(challenge.nonce.length).toBe(64); // 32 bytes hex
      expect(challenge.expiresAt).toBeGreaterThan(Date.now());
    });

    test("generates unique nonces", () => {
      const c1 = policy.generateChallenge();
      const c2 = policy.generateChallenge();
      expect(c1.nonce).not.toBe(c2.nonce);
    });
  });

  describe("validateAttestation", () => {
    test("accepts a valid attestation with nonce", () => {
      const challenge = policy.generateChallenge();
      const result = policy.validateAttestation({
        nonce: challenge.nonce,
        timestamp: Math.floor(Date.now() / 1000),
        attestationAgeSeconds: 0,
        measurement: "MOCK_MRENCLAVE_00000000000000000000000000000000",
      });
      expect(result.valid).toBe(true);
    });

    test("rejects attestation without nonce when challenge-response required", () => {
      expect(() =>
        policy.validateAttestation({
          timestamp: Math.floor(Date.now() / 1000),
          attestationAgeSeconds: 0,
        }),
      ).toThrow(HsmAdapterError);
    });

    test("rejects replayed nonce", () => {
      const challenge = policy.generateChallenge();
      const attestation = {
        nonce: challenge.nonce,
        timestamp: Math.floor(Date.now() / 1000),
        attestationAgeSeconds: 0,
      };
      policy.validateAttestation(attestation);
      expect(() => policy.validateAttestation(attestation)).toThrow(
        HsmAdapterError,
      );
    });

    test("rejects expired attestation", () => {
      const challenge = policy.generateChallenge();
      expect(() =>
        policy.validateAttestation({
          nonce: challenge.nonce,
          timestamp: Math.floor(Date.now() / 1000) - 120,
          attestationAgeSeconds: 120,
        }),
      ).toThrow(HsmAdapterError);
    });

    test("rejects attestation with TTL below minimum", () => {
      const challenge = policy.generateChallenge();
      expect(() =>
        policy.validateAttestation({
          nonce: challenge.nonce,
          timestamp: Math.floor(Date.now() / 1000),
          attestationAgeSeconds: 0,
          ttlSeconds: 60, // below min 300
        }),
      ).toThrow(HsmAdapterError);
    });

    test("rejects missing attestation", () => {
      expect(() => policy.validateAttestation(null)).toThrow(HsmAdapterError);
    });
  });

  describe("validateKeyProvisioning", () => {
    test("accepts valid key provisioning with attestation", () => {
      const result = policy.validateKeyProvisioning({
        keyType: "kek",
        attestationVerified: true,
      });
      expect(result.valid).toBe(true);
      expect(result.keyType).toBe("kek");
    });

    test("rejects provisioning without attestation when required", () => {
      expect(() =>
        policy.validateKeyProvisioning({
          keyType: "kek",
          attestationVerified: false,
        }),
      ).toThrow(HsmAdapterError);
    });

    test("rejects unsupported key type", () => {
      expect(() =>
        policy.validateKeyProvisioning({
          keyType: "unknown-type",
          attestationVerified: true,
        }),
      ).toThrow(HsmAdapterError);
    });

    test("rejects key exceeding max age", () => {
      expect(() =>
        policy.validateKeyProvisioning({
          keyType: "kek",
          attestationVerified: true,
          keyAgeMs: 999999999,
        }),
      ).toThrow(HsmAdapterError);
    });

    test("rejects when max provisioned keys reached", () => {
      const smallPolicy = new EnclaveSecretSealingPolicy({
        policy: { keyProvisioning: { maxProvisionedKeys: 2 } },
      });
      smallPolicy.validateKeyProvisioning({
        keyType: "kek",
        attestationVerified: true,
      });
      smallPolicy.validateKeyProvisioning({
        keyType: "kek",
        attestationVerified: true,
      });
      expect(() =>
        smallPolicy.validateKeyProvisioning({
          keyType: "kek",
          attestationVerified: true,
        }),
      ).toThrow(HsmAdapterError);
    });

    test("rejects missing config", () => {
      expect(() => policy.validateKeyProvisioning(null)).toThrow(
        HsmAdapterError,
      );
    });
  });

  describe("sealed key tracking", () => {
    test("recordSealedKey and removeSealedKey track count", () => {
      expect(policy.sealedKeyCount).toBe(0);
      policy.recordSealedKey("key-1", {
        keyType: "kek",
        cipher: "aes-256-gcm",
      });
      expect(policy.sealedKeyCount).toBe(1);
      policy.recordSealedKey("key-2", {
        keyType: "wrap-key",
        cipher: "aes-256-gcm",
      });
      expect(policy.sealedKeyCount).toBe(2);
      policy.removeSealedKey("key-1");
      expect(policy.sealedKeyCount).toBe(1);
    });

    test("provisionedKeyCount increments on successful provisioning", () => {
      expect(policy.provisionedKeyCount).toBe(0);
      policy.validateKeyProvisioning({
        keyType: "kek",
        attestationVerified: true,
      });
      expect(policy.provisionedKeyCount).toBe(1);
    });
  });

  describe("reset", () => {
    test("clears all internal state", () => {
      const challenge = policy.generateChallenge();
      policy.validateAttestation({
        nonce: challenge.nonce,
        timestamp: Math.floor(Date.now() / 1000),
        attestationAgeSeconds: 0,
      });
      policy.recordSealedKey("key-1", {
        keyType: "kek",
        cipher: "aes-256-gcm",
      });
      policy.validateKeyProvisioning({
        keyType: "kek",
        attestationVerified: true,
      });
      expect(policy.sealedKeyCount).toBe(1);
      expect(policy.provisionedKeyCount).toBe(1);
      policy.reset();
      expect(policy.sealedKeyCount).toBe(0);
      expect(policy.provisionedKeyCount).toBe(0);
    });
  });

  describe("policy overrides", () => {
    test("allows unseal outside enclave when policy permits", () => {
      const relaxed = new EnclaveSecretSealingPolicy({
        policy: { allowUnsealOutsideEnclave: true },
      });
      const result = relaxed.validateUnseal({ insideEnclave: false });
      expect(result.valid).toBe(true);
    });

    test("allows custom sealing ciphers", () => {
      const custom = new EnclaveSecretSealingPolicy({
        policy: { allowedSealingCiphers: ["chacha20-poly1305"] },
      });
      const result = custom.validateSeal({
        cipher: "chacha20-poly1305",
        keyBits: 256,
      });
      expect(result.valid).toBe(true);
    });

    test("allows provisioning without attestation when policy permits", () => {
      const relaxed = new EnclaveSecretSealingPolicy({
        policy: {
          keyProvisioning: { requireAttestationBeforeProvision: false },
        },
      });
      const result = relaxed.validateKeyProvisioning({
        keyType: "kek",
        attestationVerified: false,
      });
      expect(result.valid).toBe(true);
    });
  });
});

describe("Track 42: CryptoPolicyEngine secretSealing validation", () => {
  test("accepts a valid secret sealing config", () => {
    const engine = new CryptoPolicyEngine({ default: {} });
    expect(() =>
      engine.validate("t1", "secretSealing", {
        cipher: "aes-256-gcm",
        keyBits: 256,
        requireKeyRotation: true,
        attestationVerified: true,
        keyType: "kek",
      }),
    ).not.toThrow();
  });

  test("rejects an unsupported sealing cipher", () => {
    const engine = new CryptoPolicyEngine({ default: {} });
    expect(() =>
      engine.validate("t1", "secretSealing", {
        cipher: "rc4",
        keyBits: 256,
      }),
    ).toThrow(HsmAdapterError);
  });

  test("rejects a key below minimum bits", () => {
    const engine = new CryptoPolicyEngine({ default: {} });
    expect(() =>
      engine.validate("t1", "secretSealing", {
        cipher: "aes-256-gcm",
        keyBits: 64,
      }),
    ).toThrow(HsmAdapterError);
  });

  test("rejects data exceeding max size", () => {
    const engine = new CryptoPolicyEngine({ default: {} });
    expect(() =>
      engine.validate("t1", "secretSealing", {
        cipher: "aes-256-gcm",
        keyBits: 256,
        dataSizeBytes: 999999999,
      }),
    ).toThrow(HsmAdapterError);
  });

  test("rejects key rotation disabled when required", () => {
    const engine = new CryptoPolicyEngine({ default: {} });
    expect(() =>
      engine.validate("t1", "secretSealing", {
        cipher: "aes-256-gcm",
        keyBits: 256,
        requireKeyRotation: false,
      }),
    ).toThrow(HsmAdapterError);
  });

  test("rejects unseal outside enclave when not allowed", () => {
    const engine = new CryptoPolicyEngine({ default: {} });
    expect(() =>
      engine.validate("t1", "secretSealing", {
        cipher: "aes-256-gcm",
        keyBits: 256,
        allowUnsealOutsideEnclave: true,
      }),
    ).toThrow(HsmAdapterError);
  });

  test("rejects provisioning without attestation when required", () => {
    const engine = new CryptoPolicyEngine({ default: {} });
    expect(() =>
      engine.validate("t1", "secretSealing", {
        cipher: "aes-256-gcm",
        keyBits: 256,
        attestationVerified: false,
      }),
    ).toThrow(HsmAdapterError);
  });

  test("rejects unsupported key type", () => {
    const engine = new CryptoPolicyEngine({ default: {} });
    expect(() =>
      engine.validate("t1", "secretSealing", {
        cipher: "aes-256-gcm",
        keyBits: 256,
        attestationVerified: true,
        keyType: "unknown-type",
      }),
    ).toThrow(HsmAdapterError);
  });
});
