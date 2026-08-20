"use strict";

/**
 * Track 11 / 12: AsymmetricHsmAdapter functional tests.
 */
const crypto = require("crypto");
const { AsymmetricHsmAdapter } = require("../asymmetric-adapter.cjs");
const { Attestation } = require("../attestation.cjs");
const { HsmAdapterError } = require("../base-adapter.cjs");

describe("AsymmetricHsmAdapter", () => {
  describe("RSA-OAEP", () => {
    let adapter;

    beforeEach(async () => {
      adapter = new AsymmetricHsmAdapter({
        algorithm: "rsa-oaep",
        keySize: 2048,
      });
      await adapter.initialize();
    });

    test("creates a KEK and exports the public key as SPKI", async () => {
      const kekId = await adapter.createKEK("t1");
      const spki = await adapter.exportPublicKey("t1", kekId);
      expect(Buffer.isBuffer(spki)).toBe(true);
      expect(spki.length).toBeGreaterThan(0);
    });

    test("wrap/unwrap round-trips a small plaintext", async () => {
      const kekId = await adapter.createKEK("t1");
      const plaintext = crypto.randomBytes(32);
      const wrapped = await adapter.wrap("t1", kekId, plaintext);
      const unwrapped = await adapter.unwrap("t1", kekId, wrapped);
      expect(unwrapped.equals(plaintext)).toBe(true);
    });

    test("rejects plaintext larger than OAEP padding limit", async () => {
      const kekId = await adapter.createKEK("t1");
      const tooLarge = crypto.randomBytes(256); // exceeds 190-byte 2048-bit OAEP max
      await expect(adapter.wrap("t1", kekId, tooLarge)).rejects.toMatchObject({
        name: "HsmAdapterError",
        code: "INVALID_INPUT",
      });
    });

    test("rotateKEK creates a new key and preserves the old one", async () => {
      const oldId = await adapter.createKEK("t1");
      const newId = await adapter.rotateKEK("t1", oldId);
      expect(newId).not.toBe(oldId);
      const list = await adapter.listKEKs("t1");
      expect(list).toHaveLength(2);
    });
  });

  describe("ECDH", () => {
    let adapter;

    beforeEach(async () => {
      adapter = new AsymmetricHsmAdapter({ algorithm: "ecdh", keySize: 256 });
      await adapter.initialize();
    });

    test("creates a KEK and exports the public key as SPKI", async () => {
      const kekId = await adapter.createKEK("t1");
      const spki = await adapter.exportPublicKey("t1", kekId);
      expect(Buffer.isBuffer(spki)).toBe(true);
      expect(spki.length).toBeGreaterThan(0);
    });

    test("wrap/unwrap round-trips a plaintext", async () => {
      const kekId = await adapter.createKEK("t1");
      const plaintext = crypto.randomBytes(100);
      const wrapped = await adapter.wrap("t1", kekId, plaintext);
      const unwrapped = await adapter.unwrap("t1", kekId, wrapped);
      expect(unwrapped.equals(plaintext)).toBe(true);
    });

    test("wrap/unwrap with matching context round-trips", async () => {
      const kekId = await adapter.createKEK("t1");
      const plaintext = crypto.randomBytes(64);
      const context = "user-123:epoch-1";
      const wrapped = await adapter.wrap("t1", kekId, plaintext, context);
      const unwrapped = await adapter.unwrap("t1", kekId, wrapped, context);
      expect(unwrapped.equals(plaintext)).toBe(true);
    });

    test("rejects context mismatch on unwrap", async () => {
      const kekId = await adapter.createKEK("t1");
      const plaintext = crypto.randomBytes(64);
      const wrapped = await adapter.wrap("t1", kekId, plaintext, "context-a");
      await expect(
        adapter.unwrap("t1", kekId, wrapped, "context-b"),
      ).rejects.toMatchObject({
        name: "HsmAdapterError",
        code: "UNWRAP_FAILED",
      });
    });

    test("rejects corrupted wrapped payload", async () => {
      const kekId = await adapter.createKEK("t1");
      const wrapped = await adapter.wrap("t1", kekId, crypto.randomBytes(32));
      wrapped[wrapped.length - 1] ^= 0xff;
      await expect(adapter.unwrap("t1", kekId, wrapped)).rejects.toMatchObject({
        name: "HsmAdapterError",
        code: "UNWRAP_FAILED",
      });
    });
  });

  describe("attestation", () => {
    let attestation;
    let adapter;

    beforeEach(async () => {
      attestation = new Attestation();
      adapter = new AsymmetricHsmAdapter({
        algorithm: "ecdh",
        keySize: 256,
        attestation,
      });
      await adapter.initialize();
    });

    test("attestPublicKey returns a signed certificate", async () => {
      const kekId = await adapter.createKEK("t1");
      const cert = await adapter.attestPublicKey("t1", kekId);
      expect(cert.subject.CN).toBe(kekId);
      expect(cert.issuer.CN).toBe("MockHSM-Root");
      expect(cert.algorithm).toBe("ecdh");
      expect(
        Buffer.from(cert.subjectPublicKeyInfo, "base64").length,
      ).toBeGreaterThan(0);
    });

    test("verifyAttestation passes for a valid certificate", async () => {
      const kekId = await adapter.createKEK("t1");
      const cert = await adapter.attestPublicKey("t1", kekId);
      const result = await adapter.verifyAttestation("t1", kekId, cert);
      expect(result).toBe(true);
    });

    test("verifyAttestation fails for expired certificate", async () => {
      const kekId = await adapter.createKEK("t1");
      const cert = await adapter.attestPublicKey("t1", kekId);
      cert.notAfter = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      await expect(
        adapter.verifyAttestation("t1", kekId, cert),
      ).rejects.toMatchObject({
        name: "HsmAdapterError",
        code: "ATTESTATION_INVALID",
      });
    });

    test("verifyAttestation fails for certificate with mismatched public key", async () => {
      const kekId = await adapter.createKEK("t1");
      const otherKekId = await adapter.createKEK("t1");
      const cert = await adapter.attestPublicKey("t1", otherKekId);
      await expect(
        adapter.verifyAttestation("t1", kekId, cert),
      ).rejects.toMatchObject({
        name: "HsmAdapterError",
        code: "ATTESTATION_MISMATCH",
      });
    });

    test("attestPublicKey requires an attestation engine", async () => {
      const noAttestation = new AsymmetricHsmAdapter({
        algorithm: "ecdh",
        keySize: 256,
      });
      await noAttestation.initialize();
      const kekId = await noAttestation.createKEK("t1");
      await expect(noAttestation.attestPublicKey(kekId)).rejects.toMatchObject({
        name: "HsmAdapterError",
        code: "ATTESTATION_NOT_CONFIGURED",
      });
    });
  });

  describe("validation", () => {
    test("rejects unsupported algorithm", () => {
      expect(
        () => new AsymmetricHsmAdapter({ algorithm: "rsa-pkcs1" }),
      ).toThrow(HsmAdapterError);
    });

    test("rejects invalid key size", () => {
      expect(
        () =>
          new AsymmetricHsmAdapter({ algorithm: "rsa-oaep", keySize: 1024 }),
      ).toThrow(HsmAdapterError);
    });

    test("rejects unknown KEK", async () => {
      const adapter = new AsymmetricHsmAdapter();
      await adapter.initialize();
      await expect(
        adapter.wrap("t1", "missing", Buffer.alloc(16)),
      ).rejects.toMatchObject({
        name: "HsmAdapterError",
        code: "UNKNOWN_KEK",
      });
    });
  });
});
