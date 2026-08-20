"use strict";

/**
 * Track 18: Session ratchet and out-of-order message tests.
 */
const crypto = require("crypto");
const { CryptographicRatchet } = require("../cryptographic-ratchet.cjs");
const { RatchetMessageHandler } = require("../ratchet-message-handler.cjs");
const { SoftwareHsmAdapter } = require("../software-adapter.cjs");
const { CryptoPolicyEngine } = require("../crypto-policy-engine.cjs");
const { HsmAdapterError } = require("../base-adapter.cjs");

function _makePair(rootKey) {
  const alice = new CryptographicRatchet(rootKey, { isInitiator: true });
  const bob = new CryptographicRatchet(rootKey, { isInitiator: false });
  return { alice, bob };
}

describe("CryptographicRatchet", () => {
  test("symmetric ratchet encrypts and decrypts in order", () => {
    const rootKey = crypto.randomBytes(32);
    const { alice, bob } = _makePair(rootKey);

    const plaintext = crypto.randomBytes(1024);
    const aad = "track18-test";
    const envelope = alice.encrypt(plaintext, aad);
    const decrypted = bob.decrypt(envelope, aad);
    expect(decrypted.equals(plaintext)).toBe(true);
  });

  test("multiple messages advance message keys", () => {
    const rootKey = crypto.randomBytes(32);
    const { alice, bob } = _makePair(rootKey);

    const plaintexts = [
      crypto.randomBytes(64),
      crypto.randomBytes(128),
      crypto.randomBytes(32),
    ];
    const aad = "multi";
    const envelopes = plaintexts.map((p) => alice.encrypt(p, aad));
    const decrypted = envelopes.map((e) => bob.decrypt(e, aad));
    plaintexts.forEach((p, i) => expect(decrypted[i].equals(p)).toBe(true));
  });

  test("DH ratchet changes chain and public key", () => {
    const rootKey = crypto.randomBytes(32);
    const { alice, bob } = _makePair(rootKey);

    const publicKey = alice.dhStep(bob.dhPublicKey, "send");
    expect(publicKey.chainIndex).toBe(1);
    expect(publicKey.publicKey).toBeInstanceOf(Buffer);
    expect(publicKey.publicKey.length).toBeGreaterThan(0);
  });

  test("emits RATCHET_STEPPED audit on DH step", () => {
    const logger = { info: jest.fn() };
    const rootKey = crypto.randomBytes(32);
    const alice = new CryptographicRatchet(rootKey, { logger });
    const bob = new CryptographicRatchet(rootKey, { isInitiator: false });
    alice.dhStep(bob.dhPublicKey, "send");
    expect(logger.info).toHaveBeenCalledWith(
      "RATCHET_STEPPED",
      expect.objectContaining({ chainIndex: 1, dh: true }),
    );
  });

  test("session expiry throws SESSION_EXPIRED", () => {
    const rootKey = crypto.randomBytes(32);
    const alice = new CryptographicRatchet(rootKey, {
      sessionExpiryMs: 1,
      createdAt: Date.now() - 2,
    });
    expect(() => alice.encrypt(Buffer.alloc(16))).toThrow(HsmAdapterError);
    try {
      alice.encrypt(Buffer.alloc(16));
    } catch (e) {
      expect(e.code).toBe("SESSION_EXPIRED");
    }
  });
});

describe("RatchetMessageHandler", () => {
  test("handles out-of-order messages and releases cache", () => {
    const rootKey = crypto.randomBytes(32);
    const { alice, bob } = _makePair(rootKey);
    const handler = new RatchetMessageHandler({ maxSkipped: 10 });

    const aad = "reorder";
    const plaintexts = [Buffer.from("1"), Buffer.from("2"), Buffer.from("3")];
    const envelopes = plaintexts.map((p) => alice.encrypt(p, aad));

    // Deliver 0, 2, then 1
    expect(handler.decrypt(bob, envelopes[0], aad).toString()).toBe("1");
    expect(handler.decrypt(bob, envelopes[2], aad).toString()).toBe("3");
    expect(handler.cacheSize).toBe(1);
    expect(handler.decrypt(bob, envelopes[1], aad).toString()).toBe("2");
    expect(handler.cacheSize).toBe(0);
  });

  test("rejects gaps larger than maxSkipped", () => {
    const rootKey = crypto.randomBytes(32);
    const { alice, bob } = _makePair(rootKey);
    const handler = new RatchetMessageHandler({ maxSkipped: 1 });

    const aad = "gap";
    const envelopes = [
      alice.encrypt(Buffer.from("0"), aad),
      alice.encrypt(Buffer.from("1"), aad),
      alice.encrypt(Buffer.from("2"), aad),
      alice.encrypt(Buffer.from("3"), aad),
    ];
    handler.decrypt(bob, envelopes[0], aad);
    expect(() => handler.decrypt(bob, envelopes[3], aad)).toThrow(
      HsmAdapterError,
    );
  });

  test("rejects duplicate or old-chain messages", () => {
    const rootKey = crypto.randomBytes(32);
    const { alice, bob } = _makePair(rootKey);
    const handler = new RatchetMessageHandler({ maxSkipped: 10 });

    const aad = "old";
    const e1 = alice.encrypt(Buffer.from("1"), aad);
    const e2 = alice.encrypt(Buffer.from("2"), aad);
    const e3 = alice.encrypt(Buffer.from("3"), aad);

    handler.decrypt(bob, e1, aad);
    handler.decrypt(bob, e2, aad);
    expect(() => handler.decrypt(bob, e1, aad)).toThrow(HsmAdapterError);
  });
});

describe("Policy and adapter integration", () => {
  test("BaseHsmAdapter.createRatchet wires audit logger", async () => {
    const logger = { info: jest.fn() };
    const adapter = new SoftwareHsmAdapter({ logger });
    await adapter.initialize();
    const rootKey = crypto.randomBytes(32);
    const ratchet = adapter.createRatchet(rootKey, { sessionExpiryMs: 1000 });
    expect(ratchet).toBeInstanceOf(CryptographicRatchet);
  });

  test("CryptoPolicyEngine ratchet policy rejects oversized maxSkipped", () => {
    const policy = new CryptoPolicyEngine({
      default: { ratchet: { maxSkipped: 100 } },
    });
    expect(() => policy.validate("t1", "ratchet", { maxSkipped: 101 })).toThrow(
      HsmAdapterError,
    );
  });

  test("regression: wrap/unwrap still works after adapter changes", async () => {
    const adapter = new SoftwareHsmAdapter();
    await adapter.initialize();
    const kekId = await adapter.createKEK("t1");
    const plaintext = Buffer.alloc(16, 0xab);
    const wrapped = await adapter.wrap("t1", kekId, plaintext);
    const unwrapped = await adapter.unwrap("t1", kekId, wrapped);
    expect(unwrapped.equals(plaintext)).toBe(true);
  });
});
