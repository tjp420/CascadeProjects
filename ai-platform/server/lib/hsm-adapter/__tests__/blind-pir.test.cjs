"use strict";

/**
 * Track 24: Blind signatures and homomorphic PIR.
 */
const crypto = require("crypto");
const { BlindSignatureIssuer } = require("../blind-signature-issuer.cjs");
const {
  PirQueryProcessor,
  ModularHomomorphicEngine,
} = require("../pir-query-processor.cjs");
const { CryptoPolicyEngine } = require("../crypto-policy-engine.cjs");
const { HsmAdapterError } = require("../base-adapter.cjs");

describe("BlindSignatureIssuer", () => {
  function makeGoodKeys() {
    return crypto.generateKeyPairSync("rsa", {
      modulusLength: 2048,
      publicExponent: 65537,
    });
  }

  test("blind, sign, unblind, and verify a message", () => {
    const { publicKey, privateKey } = makeGoodKeys();
    const issuer = new BlindSignatureIssuer({ publicKey, privateKey });
    const message = "track24-blind-message";

    const { blindedMessage, r } = issuer.blind(message);
    const blindSignature = issuer.sign(blindedMessage);
    const signature = issuer.unblind(blindSignature, r);

    expect(issuer.verify(message, signature)).toBe(true);
  });

  test("rejects a tampered message", () => {
    const { publicKey, privateKey } = makeGoodKeys();
    const issuer = new BlindSignatureIssuer({ publicKey, privateKey });
    const message = "track24-blind-message";

    const { blindedMessage, r } = issuer.blind(message);
    const blindSignature = issuer.sign(blindedMessage);
    const signature = issuer.unblind(blindSignature, r);

    expect(issuer.verify("different-message", signature)).toBe(false);
  });

  test("emits TOKEN_BLIND_SIGNED audit event", () => {
    const { publicKey, privateKey } = makeGoodKeys();
    const events = [];
    const issuer = new BlindSignatureIssuer({
      publicKey,
      privateKey,
      audit: (event, info) => events.push({ event, info }),
    });

    const { blindedMessage } = issuer.blind("audit-test");
    issuer.sign(blindedMessage);

    expect(events).toHaveLength(1);
    expect(events[0].event).toBe("TOKEN_BLIND_SIGNED");
    expect(events[0].info.tenantId).toBeNull();
    expect(typeof events[0].info.keyThumbprint).toBe("string");
  });

  test("policy rejects non-standard public exponent", () => {
    const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", {
      modulusLength: 2048,
      publicExponent: 3,
    });
    const policyEngine = new CryptoPolicyEngine({ default: {} });
    const issuer = new BlindSignatureIssuer({
      publicKey,
      privateKey,
      tenantId: "t1",
      policyEngine,
    });

    expect(() => issuer.blind("policy-test")).toThrow(HsmAdapterError);
  });

  test("policy rejects modulus below minimum", () => {
    const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", {
      modulusLength: 1024,
      publicExponent: 65537,
    });
    const policyEngine = new CryptoPolicyEngine({ default: {} });
    const issuer = new BlindSignatureIssuer({
      publicKey,
      privateKey,
      tenantId: "t1",
      policyEngine,
    });

    expect(() => issuer.blind("policy-test")).toThrow(HsmAdapterError);
  });
});

describe("PirQueryProcessor", () => {
  test("selects the correct row from a 2D matrix", () => {
    const engine = new ModularHomomorphicEngine({
      secret: 12345n,
      modulus: 2n ** 64n,
    });
    const processor = new PirQueryProcessor({ engine });

    const query = [engine.encrypt(0), engine.encrypt(1), engine.encrypt(0)];
    const data = [
      [10, 20, 30],
      [40, 50, 60],
      [70, 80, 90],
    ];

    const encryptedResult = processor.process(query, data);
    const result = encryptedResult.map((c) => Number(engine.decrypt(c)));

    expect(result).toEqual([40, 50, 60]);
  });

  test("emits PIR_QUERY_EXECUTED audit event", () => {
    const engine = new ModularHomomorphicEngine({
      secret: 99n,
      modulus: 2n ** 64n,
    });
    const events = [];
    const processor = new PirQueryProcessor({
      engine,
      tenantId: "t1",
      audit: (event, info) => events.push({ event, info }),
    });

    const query = [engine.encrypt(0), engine.encrypt(1), engine.encrypt(0)];
    const data = [
      [1, 2],
      [3, 4],
      [5, 6],
    ];
    processor.process(query, data);

    expect(events).toHaveLength(1);
    expect(events[0].event).toBe("PIR_QUERY_EXECUTED");
    expect(events[0].info.tenantId).toBe("t1");
  });

  test("policy rejects queries with too many rows", () => {
    const engine = new ModularHomomorphicEngine({
      secret: 77n,
      modulus: 2n ** 64n,
    });
    const policyEngine = new CryptoPolicyEngine({
      default: {},
      tenants: {
        t1: { privacy: { pir: { maxRows: 2 } } },
      },
    });
    const processor = new PirQueryProcessor({
      engine,
      tenantId: "t1",
      policyEngine,
    });

    const query = [engine.encrypt(0), engine.encrypt(0), engine.encrypt(1)];
    const data = [[1], [2], [3]];

    expect(() => processor.process(query, data)).toThrow(HsmAdapterError);
  });

  test("regression: empty data returns empty result", () => {
    const engine = new ModularHomomorphicEngine({
      secret: 1n,
      modulus: 2n ** 64n,
    });
    const processor = new PirQueryProcessor({ engine });

    expect(processor.process([], [])).toEqual([]);
  });
});
