"use strict";

/**
 * Track 19: Homomorphic masking and encrypted search token tests.
 */
const crypto = require("crypto");
const { HomomorphicMasker } = require("../homomorphic-masker.cjs");
const { EncryptedSearchToken } = require("../encrypted-search-token.cjs");
const { SoftwareHsmAdapter } = require("../software-adapter.cjs");
const { CryptoPolicyEngine } = require("../crypto-policy-engine.cjs");
const { HsmAdapterError } = require("../base-adapter.cjs");

const SMALL_PRIME = 1019n; // explicit prime for fast tests

describe("HomomorphicMasker", () => {
  test("blinds and unmasks an integer", () => {
    const masker = new HomomorphicMasker({ modulus: SMALL_PRIME });
    const { ciphertext, blindingFactor } = masker.blind(100n);
    expect(ciphertext).toBeGreaterThanOrEqual(0n);
    expect(ciphertext).toBeLessThan(masker.modulus);
    const recovered = masker.unmask(ciphertext, blindingFactor);
    expect(recovered).toBe(100n);
  });

  test("adds two masked values without unwrapping", () => {
    const masker = new HomomorphicMasker({ modulus: SMALL_PRIME });
    const a = masker.blind(50n);
    const b = masker.blind(70n);
    const blindSum = masker.add(a.ciphertext, b.ciphertext);
    const totalBlinding = masker.combineBlinds([
      a.blindingFactor,
      b.blindingFactor,
    ]);
    const recovered = masker.unmaskSum(blindSum, totalBlinding);
    expect(recovered).toBe(120n);
  });

  test("reduces inputs >= p modulo p", () => {
    const masker = new HomomorphicMasker({ modulus: SMALL_PRIME });
    const { ciphertext, blindingFactor } = masker.blind(SMALL_PRIME + 100n);
    const recovered = masker.unmask(ciphertext, blindingFactor);
    expect(recovered).toBe(100n);
  });

  test("throws HOMOMORPHIC_OVERFLOW for inputs >= 2p", () => {
    const masker = new HomomorphicMasker({ modulus: SMALL_PRIME });
    expect(() => masker.blind(SMALL_PRIME * 2n)).toThrow(HsmAdapterError);
    try {
      masker.blind(SMALL_PRIME * 2n);
    } catch (e) {
      expect(e.code).toBe("HOMOMORPHIC_OVERFLOW");
    }
  });

  test("throws INVALID_BLIND for out-of-range blinding factor", () => {
    const masker = new HomomorphicMasker({ modulus: SMALL_PRIME });
    const { ciphertext } = masker.blind(100n);
    expect(() => masker.unmask(ciphertext, -1n)).toThrow(HsmAdapterError);
    expect(() => masker.unmask(-1n, 0n)).toThrow(HsmAdapterError);
  });

  test("emits PAYLOAD_BLINDED audit", () => {
    const logger = { info: jest.fn() };
    const masker = new HomomorphicMasker({ modulus: SMALL_PRIME, logger });
    masker.blind(100n);
    expect(logger.info).toHaveBeenCalledWith(
      "PAYLOAD_BLINDED",
      expect.objectContaining({ sub: "hsm-adapter", provider: "homomorphic" }),
    );
  });
});

describe("EncryptedSearchToken", () => {
  test("generates matching tokens for the same query and salt", () => {
    const token = new EncryptedSearchToken({
      initialSalt: crypto.randomBytes(32),
      tokenExpiryMs: 10000,
    });
    const salt = crypto.randomBytes(32);
    const t1 = token.generate("hello world", salt);
    const t2 = token.generate("hello world", salt);
    expect(t1.length).toBe(32);
    expect(t1.equals(t2)).toBe(true);
  });

  test("different salts produce different tokens", () => {
    const token = new EncryptedSearchToken({ tokenExpiryMs: 10000 });
    const t1 = token.generate("query", crypto.randomBytes(32));
    const t2 = token.generate("query", crypto.randomBytes(32));
    expect(t1.equals(t2)).toBe(false);
  });

  test("verify matches current salt token", () => {
    const token = new EncryptedSearchToken({ tokenExpiryMs: 10000 });
    const stored = token.generate("search me");
    expect(token.verify(stored, "search me")).toBe(true);
    expect(token.verify(stored, "other")).toBe(false);
  });

  test("rotation preserves matching during grace window", () => {
    const token = new EncryptedSearchToken({
      tokenExpiryMs: 600000,
      graceWindowMs: 600000,
    });
    const stored = token.generate("find me");
    token.rotate();
    expect(token.verify(stored, "find me")).toBe(true);
  });

  test("throws TOKEN_EXPIRED after active salt expires", async () => {
    const token = new EncryptedSearchToken({
      tokenExpiryMs: 1,
      graceWindowMs: 0,
    });
    const stored = token.generate("x");
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(() => token.verify(stored, "x")).toThrow(HsmAdapterError);
    try {
      token.verify(stored, "x");
    } catch (e) {
      expect(e.code).toBe("TOKEN_EXPIRED");
    }
  });

  test("emits STATE_MATCHED audit on generate", () => {
    const logger = { info: jest.fn() };
    const token = new EncryptedSearchToken({ logger });
    token.generate("hello");
    expect(logger.info).toHaveBeenCalledWith(
      "STATE_MATCHED",
      expect.objectContaining({ sub: "hsm-adapter", provider: "search-token" }),
    );
  });
});

describe("Policy and adapter integration", () => {
  test("CryptoPolicyEngine rejects excessive homomorphic modulus", () => {
    const policy = new CryptoPolicyEngine({
      default: { homomorphic: { maxModulusBits: 1024 } },
    });
    expect(() =>
      policy.validate("t1", "homomorphic", { maxModulusBits: 2048 }),
    ).toThrow(HsmAdapterError);
  });

  test("BaseHsmAdapter creates masker and tokenizer", async () => {
    const logger = { info: jest.fn() };
    const adapter = new SoftwareHsmAdapter({ logger });
    await adapter.initialize();
    const masker = adapter.createHomomorphicMasker({ modulus: SMALL_PRIME });
    expect(masker).toBeInstanceOf(HomomorphicMasker);
    const tokenizer = adapter.createSearchTokenizer({ tokenExpiryMs: 10000 });
    expect(tokenizer).toBeInstanceOf(EncryptedSearchToken);
  });

  test("regression: wrap/unwrap still works after adapter changes", async () => {
    const adapter = new SoftwareHsmAdapter();
    await adapter.initialize();
    const kekId = await adapter.createKEK("t1");
    const plaintext = Buffer.alloc(16, 0xcd);
    const wrapped = await adapter.wrap("t1", kekId, plaintext);
    const unwrapped = await adapter.unwrap("t1", kekId, wrapped);
    expect(unwrapped.equals(plaintext)).toBe(true);
  });
});
