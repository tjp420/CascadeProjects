"use strict";

/**
 * Track 20: Post-quantum hybrid KEM tests.
 */
const { PqcHybridAdapter } = require("../pqc-hybrid-adapter.cjs");
const { PqcEncapsulationEngine } = require("../pqc-encapsulation-engine.cjs");
const { SoftwareHsmAdapter } = require("../software-adapter.cjs");
const { CryptoPolicyEngine } = require("../crypto-policy-engine.cjs");
const { HsmAdapterError } = require("../base-adapter.cjs");

describe("PqcHybridAdapter", () => {
  test("encapsulates and decapsulates a root key", () => {
    const sender = new PqcHybridAdapter("t1", { kemLevel: 768 });
    const recipient = new PqcHybridAdapter("t1", {
      kemLevel: 768,
    }).generateRecipientKeypair();

    const { rootKey, payload } = sender.encapsulate(recipient);
    expect(Buffer.isBuffer(rootKey)).toBe(true);
    expect(rootKey.length).toBe(64);
    expect(payload.version).toBe("1.0.0");

    const decap = new PqcHybridAdapter("t1", { recipient });
    const recovered = decap.decapsulate(payload);
    expect(recovered.equals(rootKey)).toBe(true);
  });

  test("different tenants produce different root keys", () => {
    const sender1 = new PqcHybridAdapter("t1", { kemLevel: 768 });
    const recipient = new PqcHybridAdapter("t1", {
      kemLevel: 768,
    }).generateRecipientKeypair();
    const { rootKey: key1 } = sender1.encapsulate(recipient);

    const sender2 = new PqcHybridAdapter("t2", { kemLevel: 768 });
    const { rootKey: key2 } = sender2.encapsulate(recipient);
    expect(key1.equals(key2)).toBe(false);
  });

  test("invalid ciphertext fails integrity", () => {
    const sender = new PqcHybridAdapter("t1", { kemLevel: 768 });
    const recipient = new PqcHybridAdapter("t1", {
      kemLevel: 768,
    }).generateRecipientKeypair();
    const { payload } = sender.encapsulate(recipient);

    payload.pqc.ciphertext.c2 = Buffer.alloc(32, 0xab).toString("base64");
    const decap = new PqcHybridAdapter("t1", { recipient });
    expect(() => decap.decapsulate(payload)).toThrow(HsmAdapterError);
  });

  test("throws on combined key hash mismatch", () => {
    const sender = new PqcHybridAdapter("t1", { kemLevel: 768 });
    const recipient = new PqcHybridAdapter("t1", {
      kemLevel: 768,
    }).generateRecipientKeypair();
    const { payload } = sender.encapsulate(recipient);

    payload.combinedKeyHash = Buffer.alloc(32, 0xcd).toString("base64");
    const decap = new PqcHybridAdapter("t1", { recipient });
    expect(() => decap.decapsulate(payload)).toThrow(HsmAdapterError);
  });

  test("emits PQC_KEY_ENCAPSULATED audit", () => {
    const logger = { info: jest.fn() };
    const sender = new PqcHybridAdapter("t1", { kemLevel: 768, logger });
    const recipient = new PqcHybridAdapter("t1", {
      kemLevel: 768,
    }).generateRecipientKeypair();
    sender.encapsulate(recipient);
    expect(logger.info).toHaveBeenCalledWith(
      "PQC_KEY_ENCAPSULATED",
      expect.objectContaining({ tenantId: "t1", kemLevel: 768 }),
    );
  });

  test("emits HYBRID_TRANSITION_VERIFIED audit", () => {
    const logger = { info: jest.fn() };
    const sender = new PqcHybridAdapter("t1", { kemLevel: 768 });
    const recipient = new PqcHybridAdapter("t1", {
      kemLevel: 768,
    }).generateRecipientKeypair();
    const { payload } = sender.encapsulate(recipient);

    const decap = new PqcHybridAdapter("t1", { recipient, logger });
    decap.decapsulate(payload);
    expect(logger.info).toHaveBeenCalledWith(
      "HYBRID_TRANSITION_VERIFIED",
      expect.objectContaining({ tenantId: "t1", kemLevel: 768 }),
    );
  });
});

describe("PqcEncapsulationEngine", () => {
  test("supports all KEM levels", () => {
    [512, 768, 1024].forEach((level) => {
      const engine = new PqcEncapsulationEngine(level);
      const { publicKey, secretKey } = engine.generateKeypair();
      const { ciphertext, sharedSecret } = engine.encapsulate(publicKey);
      expect(sharedSecret.length).toBe(32);
      const recovered = engine.decapsulate(ciphertext, secretKey);
      expect(recovered.equals(sharedSecret)).toBe(true);
    });
  });
});

describe("Policy and adapter integration", () => {
  test("CryptoPolicyEngine rejects KEM levels outside range", () => {
    const policy = new CryptoPolicyEngine({
      default: { pqc: { minKemLevel: 768, maxKemLevel: 1024 } },
    });
    expect(() => policy.validate("t1", "pqc", { kemLevel: 512 })).toThrow(
      HsmAdapterError,
    );
  });

  test("BaseHsmAdapter PQC hybrid methods work end-to-end", async () => {
    const logger = { info: jest.fn() };
    const adapter = new SoftwareHsmAdapter({ logger });
    await adapter.initialize();

    const recipient = adapter.createPqcHybridKeypair("t1", { kemLevel: 768 });
    const { rootKey, payload } = adapter.hybridEncapsulate("t1", recipient, {
      kemLevel: 768,
    });
    const recovered = adapter.hybridDecapsulate("t1", payload, { recipient });
    expect(recovered.equals(rootKey)).toBe(true);
  });

  test("regression: wrap/unwrap still works after adapter changes", async () => {
    const adapter = new SoftwareHsmAdapter();
    await adapter.initialize();
    const kekId = await adapter.createKEK("t1");
    const plaintext = Buffer.alloc(16, 0xef);
    const wrapped = await adapter.wrap("t1", kekId, plaintext);
    const unwrapped = await adapter.unwrap("t1", kekId, wrapped);
    expect(unwrapped.equals(plaintext)).toBe(true);
  });
});
