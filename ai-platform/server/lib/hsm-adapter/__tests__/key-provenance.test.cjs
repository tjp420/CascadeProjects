"use strict";

/**
 * Track 16: Key provenance ledger and decentralized proof tests.
 */
const crypto = require("crypto");
const { ProvenanceTracker } = require("../provenance-tracker.cjs");
const { ProvenanceProof } = require("../provenance-proof.cjs");
const { SoftwareHsmAdapter } = require("../software-adapter.cjs");
const { AsymmetricHsmAdapter } = require("../asymmetric-adapter.cjs");
const { HsmAdapterError } = require("../base-adapter.cjs");

describe("ProvenanceTracker", () => {
  let tracker;

  beforeEach(() => {
    tracker = new ProvenanceTracker({
      buildHash: "test-build-123",
      hardwareRootToken: "hw-token-123",
    });
  });

  test("registers a record with all required fields", () => {
    const record = tracker.register("tenant-a", "kek-1", {
      algorithm: "aes-kw",
      kekBits: 256,
      createdAt: 1_700_000_000_000,
    });
    expect(record.kekId).toBe("kek-1");
    expect(record.tenantId).toBe("tenant-a");
    expect(record.algorithm).toBe("aes-kw");
    expect(record.keySize).toBe(256);
    expect(record.buildHash).toBe("test-build-123");
    expect(record.hardwareRootToken).toBe("hw-token-123");
    expect(typeof record.signature).toBe("string");
    expect(record.signature.length).toBeGreaterThan(0);
  });

  test("getRecord returns the stored record", () => {
    tracker.register("tenant-a", "kek-1", {
      algorithm: "aes-kw",
      kekBits: 256,
    });
    const fetched = tracker.getRecord("kek-1");
    expect(fetched.kekId).toBe("kek-1");
  });

  test("getRecord returns null for unknown kekId", () => {
    expect(tracker.getRecord("missing")).toBeNull();
  });

  test("verify returns true for a valid record", () => {
    const record = tracker.register("tenant-a", "kek-1", {
      algorithm: "aes-kw",
      kekBits: 256,
    });
    expect(tracker.verify(record)).toBe(true);
  });

  test("verify throws for a tampered record", () => {
    const record = tracker.register("tenant-a", "kek-1", {
      algorithm: "aes-kw",
      kekBits: 256,
    });
    record.algorithm = "aes-kwp";
    expect(() => tracker.verify(record)).toThrow(HsmAdapterError);
    try {
      tracker.verify(record);
    } catch (e) {
      expect(e.code).toBe("KEY_PROVENANCE_CORRUPTED");
    }
  });

  test("validate passes for matching in-memory info", () => {
    tracker.register("tenant-a", "kek-1", {
      algorithm: "aes-kw",
      kekBits: 256,
      createdAt: 1_700_000_000_000,
    });
    expect(
      tracker.validate("kek-1", {
        tenantId: "tenant-a",
        algorithm: "aes-kw",
        kekBits: 256,
        createdAt: 1_700_000_000_000,
      }),
    ).toBe(true);
  });

  test("validate throws for mismatched algorithm", () => {
    tracker.register("tenant-a", "kek-1", {
      algorithm: "aes-kw",
      kekBits: 256,
    });
    expect(() =>
      tracker.validate("kek-1", {
        tenantId: "tenant-a",
        algorithm: "aes-kwp",
        kekBits: 256,
      }),
    ).toThrow(HsmAdapterError);
  });

  test("validate throws for missing record", () => {
    expect(() =>
      tracker.validate("missing", {
        tenantId: "t",
        algorithm: "aes-kw",
        kekBits: 256,
      }),
    ).toThrow(HsmAdapterError);
  });

  test("records form a hash chain", () => {
    const r1 = tracker.register("t", "kek-1", {
      algorithm: "aes-kw",
      kekBits: 256,
    });
    const r2 = tracker.register("t", "kek-2", {
      algorithm: "aes-kw",
      kekBits: 256,
    });
    expect(r2.previousHash).not.toBeNull();
    expect(typeof r2.previousHash).toBe("string");
  });
});

describe("ProvenanceProof", () => {
  test("create returns a proof containing the record", () => {
    const tracker = new ProvenanceTracker({ buildHash: "b" });
    const record = tracker.register("t", "kek-1", {
      algorithm: "aes-kw",
      kekBits: 256,
    });
    const proof = ProvenanceProof.create(record);
    expect(proof.record).toBe(record);
    expect(proof.version).toBe("1.0.0");
  });

  test("verify passes with the root public key", () => {
    const tracker = new ProvenanceTracker({ buildHash: "b" });
    const record = tracker.register("t", "kek-1", {
      algorithm: "aes-kw",
      kekBits: 256,
    });
    const proof = ProvenanceProof.create(record);
    expect(ProvenanceProof.verify(proof, tracker.publicKey)).toBe(true);
  });

  test("verify throws for a tampered record", () => {
    const tracker = new ProvenanceTracker({ buildHash: "b" });
    const record = tracker.register("t", "kek-1", {
      algorithm: "aes-kw",
      kekBits: 256,
    });
    record.algorithm = "aes-kwp";
    const proof = ProvenanceProof.create(record);
    expect(() => ProvenanceProof.verify(proof, tracker.publicKey)).toThrow(
      HsmAdapterError,
    );
  });

  test("verify throws with a wrong public key", () => {
    const tracker = new ProvenanceTracker({ buildHash: "b" });
    const other = new ProvenanceTracker({ buildHash: "b" });
    const record = tracker.register("t", "kek-1", {
      algorithm: "aes-kw",
      kekBits: 256,
    });
    const proof = ProvenanceProof.create(record);
    expect(() => ProvenanceProof.verify(proof, other.publicKey)).toThrow(
      HsmAdapterError,
    );
  });
});

describe("Adapter provenance integration", () => {
  test("SoftwareHsmAdapter creates and validates provenance on wrap/unwrap", async () => {
    const adapter = new SoftwareHsmAdapter({ buildHash: "sw-build" });
    await adapter.initialize();
    const kekId = await adapter.createKEK("t1");
    const record = adapter._provenanceTracker.getRecord(kekId);
    expect(record).not.toBeNull();
    expect(record.buildHash).toBe("sw-build");

    const plaintext = Buffer.alloc(16, 0xab);
    const wrapped = await adapter.wrap("t1", kekId, plaintext);
    const unwrapped = await adapter.unwrap("t1", kekId, wrapped);
    expect(unwrapped.equals(plaintext)).toBe(true);
  });

  test("AsymmetricHsmAdapter creates and validates provenance on wrap/unwrap", async () => {
    const adapter = new AsymmetricHsmAdapter({
      algorithm: "ecdh",
      keySize: 256,
      buildHash: "asym-build",
    });
    await adapter.initialize();
    const kekId = await adapter.createKEK("t1");
    const record = adapter._provenanceTracker.getRecord(kekId);
    expect(record).not.toBeNull();
    expect(record.buildHash).toBe("asym-build");

    const plaintext = crypto.randomBytes(32);
    const wrapped = await adapter.wrap("t1", kekId, plaintext);
    const unwrapped = await adapter.unwrap("t1", kekId, wrapped);
    expect(unwrapped.equals(plaintext)).toBe(true);
  });

  test("corrupted provenance throws KEY_PROVENANCE_CORRUPTED on wrap", async () => {
    const adapter = new SoftwareHsmAdapter();
    await adapter.initialize();
    const kekId = await adapter.createKEK("t1");
    // Tamper the record in the tracker
    const record = adapter._provenanceTracker.getRecord(kekId);
    record.algorithm = "aes-kwp";
    await expect(
      adapter.wrap("t1", kekId, Buffer.alloc(16)),
    ).rejects.toMatchObject({
      name: "HsmAdapterError",
      code: "KEY_PROVENANCE_CORRUPTED",
    });
  });
});
