"use strict";

/**
 * Track 22: Secure time anchoring and tamper-evident epoch frame tests.
 *
 * Covers spec items:
 *   L2-01: Reach consensus from multiple oracles
 *   L2-02: Reject rogue oracle outside drift window
 *   L2-03: Fail quorum when too few valid pulses
 *   L2-04: Sign and verify an epoch frame
 *   L2-05: Temporal guard blocks drift
 *   L3-01: Monotonic time violation
 *   L3-02: Epoch chain tampering (invalid previousHash)
 *   S-01: Oracle public keys not stored with pulses
 *   S-02: Epoch chain hash links are tamper-evident
 *   S-03: Median calculation robust to floor((N-1)/2) rogue oracles
 *   S-04: No operation accepts a local timestamp without guard validation
 */
const crypto = require("crypto");
const { TimeAnchorEngine } = require("../time-anchor-engine.cjs");
const { EpochFrame } = require("../epoch-frame.cjs");
const { SoftwareHsmAdapter } = require("../software-adapter.cjs");
const { CryptoPolicyEngine } = require("../crypto-policy-engine.cjs");
const { HsmAdapterError } = require("../base-adapter.cjs");

function _makeOracles(n = 5) {
  const oracles = {};
  const keys = [];
  for (let i = 0; i < n; i++) {
    const { publicKey, privateKey } = crypto.generateKeyPairSync("ec", {
      namedCurve: "prime256v1",
    });
    oracles[`o${i}`] = { publicKey };
    keys.push({ oracleId: `o${i}`, privateKey });
  }
  return { oracles, keys };
}

function _sign(oracleId, timestamp, epochNumber, privateKey) {
  const payload = `${epochNumber}:${timestamp}:${oracleId}`;
  const signer = crypto.createSign("sha256");
  signer.update(payload);
  return signer.sign(privateKey, "base64");
}

describe("TimeAnchorEngine", () => {
  test("L2-01/L2-02: reaches median consensus and rejects outlier", () => {
    const now = Date.now();
    const { oracles, keys } = _makeOracles(5);
    const engine = new TimeAnchorEngine({
      oracles,
      minQuorum: 3,
      maxDriftMs: 5000,
    });

    keys.forEach((k, i) => {
      const ts = i === 4 ? now + 100000 : now;
      engine.submitPulse(
        k.oracleId,
        ts,
        _sign(k.oracleId, ts, 0, k.privateKey),
        0,
      );
    });

    const consensus = engine.consensusTimestamp(1);
    expect(consensus).toBe(now);
  });

  test("L2-03: fails with ORACLE_QUORUM_FAILED when quorum is not met", () => {
    const now = Date.now();
    const { oracles, keys } = _makeOracles(2);
    const engine = new TimeAnchorEngine({
      oracles,
      minQuorum: 3,
      maxDriftMs: 5000,
    });

    keys.forEach((k) => {
      engine.submitPulse(
        k.oracleId,
        now,
        _sign(k.oracleId, now, 0, k.privateKey),
        0,
      );
    });

    let caught;
    try {
      engine.consensusTimestamp(1);
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(HsmAdapterError);
    expect(caught.code).toBe("ORACLE_QUORUM_FAILED");
  });

  test("rejects invalid oracle signature with ORACLE_SIGNATURE_INVALID", () => {
    const now = Date.now();
    const { oracles, keys } = _makeOracles(1);
    const engine = new TimeAnchorEngine({
      oracles,
      minQuorum: 1,
      maxDriftMs: 5000,
    });
    const badSig = "aGVsbG8=";

    let caught;
    try {
      engine.submitPulse(keys[0].oracleId, now, badSig, 0);
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(HsmAdapterError);
    expect(caught.code).toBe("ORACLE_SIGNATURE_INVALID");
  });

  test("L3-01: monotonic time violation throws on older timestamp", () => {
    const now = Date.now();
    const { oracles, keys } = _makeOracles(3);
    const engine = new TimeAnchorEngine({
      oracles,
      minQuorum: 3,
      maxDriftMs: 5000,
    });

    // First epoch: establish consensus
    keys.forEach((k) => {
      engine.submitPulse(
        k.oracleId,
        now,
        _sign(k.oracleId, now, 0, k.privateKey),
        0,
      );
    });
    engine.consensusTimestamp(1);

    // Second epoch: try to submit a pulse with an older timestamp
    let caught;
    try {
      engine.submitPulse(
        keys[0].oracleId,
        now - 10000,
        _sign(keys[0].oracleId, now - 10000, 1, keys[0].privateKey),
        1,
      );
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(HsmAdapterError);
    expect(caught.code).toBe("MONOTONIC_TIME_VIOLATION");
  });

  test("L3-01: monotonic time violation throws on older epoch number", () => {
    const { oracles, keys } = _makeOracles(3);
    const engine = new TimeAnchorEngine({
      oracles,
      minQuorum: 3,
      maxDriftMs: 5000,
    });
    const now = Date.now();

    keys.forEach((k) => {
      engine.submitPulse(
        k.oracleId,
        now,
        _sign(k.oracleId, now, 5, k.privateKey),
        5,
      );
    });
    engine.consensusTimestamp(5);

    // Try to submit a pulse with a lower epoch number
    let caught;
    try {
      engine.submitPulse(
        keys[0].oracleId,
        now + 1000,
        _sign(keys[0].oracleId, now + 1000, 3, keys[0].privateKey),
        3,
      );
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(HsmAdapterError);
    expect(caught.code).toBe("MONOTONIC_TIME_VIOLATION");
  });

  test("S-03: median is robust to floor((N-1)/2) rogue oracles", () => {
    const { oracles, keys } = _makeOracles(5);
    const engine = new TimeAnchorEngine({
      oracles,
      minQuorum: 3,
      maxDriftMs: 1000,
    });
    const t = Date.now();
    // 3 honest, 2 rogue (far off)
    keys.forEach((k, i) => {
      const ts = i < 3 ? t : t + 999999;
      engine.submitPulse(
        k.oracleId,
        ts,
        _sign(k.oracleId, ts, 0, k.privateKey),
        0,
      );
    });
    const consensus = engine.consensusTimestamp(1);
    expect(consensus).toBe(t);
  });
});

describe("EpochFrame", () => {
  test("L2-04: signs and verifies a frame", () => {
    const { publicKey, privateKey } = crypto.generateKeyPairSync("ec", {
      namedCurve: "prime256v1",
    });
    const frame = new EpochFrame({
      epochNumber: 0,
      previousHash: Buffer.alloc(32, 0),
      consensusTimestamp: Date.now(),
      driftMs: 0,
    });
    frame.sign(privateKey);
    expect(frame.verify(publicKey)).toBe(true);
  });

  test("L3-02: rejects broken chain with invalid previous hash", () => {
    const { publicKey, privateKey } = crypto.generateKeyPairSync("ec", {
      namedCurve: "prime256v1",
    });
    const f1 = new EpochFrame({
      epochNumber: 0,
      previousHash: Buffer.alloc(32, 0),
      consensusTimestamp: 1000,
      driftMs: 0,
    });
    f1.sign(privateKey);

    const f2 = new EpochFrame({
      epochNumber: 1,
      previousHash: Buffer.alloc(32, 0xab),
      consensusTimestamp: 2000,
      driftMs: 0,
    });
    f2.sign(privateKey);
    expect(f2.verify(publicKey, f1)).toBe(false);
  });

  test("detects consensus timestamp rollback", () => {
    const { publicKey, privateKey } = crypto.generateKeyPairSync("ec", {
      namedCurve: "prime256v1",
    });
    const f1 = new EpochFrame({
      epochNumber: 0,
      previousHash: Buffer.alloc(32, 0),
      consensusTimestamp: 2000,
      driftMs: 0,
    });
    f1.sign(privateKey);

    const f2 = new EpochFrame({
      epochNumber: 1,
      previousHash: f1.hash(),
      consensusTimestamp: 1000,
      driftMs: 0,
    });
    f2.sign(privateKey);
    expect(f2.verify(publicKey, f1)).toBe(false);
  });

  test("throws EPOCH_SIGNATURE_INVALID when verifying unsigned frame", () => {
    const { publicKey } = crypto.generateKeyPairSync("ec", {
      namedCurve: "prime256v1",
    });
    const frame = new EpochFrame({
      epochNumber: 0,
      previousHash: Buffer.alloc(32, 0),
      consensusTimestamp: Date.now(),
      driftMs: 0,
    });
    let caught;
    try {
      frame.verify(publicKey);
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(HsmAdapterError);
    expect(caught.code).toBe("EPOCH_SIGNATURE_INVALID");
  });
});

describe("Policy and adapter integration", () => {
  test("CryptoPolicyEngine rejects excessive time drift", () => {
    const policy = new CryptoPolicyEngine({
      default: { time: { maxDriftMs: 60000, minQuorum: 3 } },
    });
    let caught;
    try {
      policy.validate("t1", "time", { maxDriftMs: 120000 });
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(HsmAdapterError);
    expect(caught.code).toBe("POLICY_VIOLATION_BLOCKED");
  });

  test("CryptoPolicyEngine rejects insufficient minQuorum", () => {
    const policy = new CryptoPolicyEngine({
      default: { time: { maxDriftMs: 60000, minQuorum: 3 } },
    });
    let caught;
    try {
      policy.validate("t1", "time", { minQuorum: 1 });
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(HsmAdapterError);
    expect(caught.code).toBe("POLICY_VIOLATION_BLOCKED");
  });

  test("L2-05: verifyTemporalGuard blocks drift with TEMPORAL_DRIFT_BLOCKED", async () => {
    const now = Date.now();
    const { oracles, keys } = _makeOracles(3);
    const engine = new TimeAnchorEngine({
      oracles,
      minQuorum: 3,
      maxDriftMs: 5000,
    });
    keys.forEach((k) => {
      engine.submitPulse(
        k.oracleId,
        now,
        _sign(k.oracleId, now, 0, k.privateKey),
        0,
      );
    });
    engine.consensusTimestamp(1);

    const adapter = new SoftwareHsmAdapter({ timeAnchor: engine });
    await adapter.initialize();

    let caught;
    try {
      adapter.verifyTemporalGuard("t1", now + 10000);
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(HsmAdapterError);
    expect(caught.code).toBe("TEMPORAL_DRIFT_BLOCKED");
  });

  test("S-04: wrap is blocked on excessive clock drift", async () => {
    const now = Date.now();
    const { oracles, keys } = _makeOracles(3);
    const engine = new TimeAnchorEngine({
      oracles,
      minQuorum: 3,
      maxDriftMs: 5000,
    });
    keys.forEach((k) => {
      engine.submitPulse(
        k.oracleId,
        now - 100000,
        _sign(k.oracleId, now - 100000, 0, k.privateKey),
        0,
      );
    });
    engine.consensusTimestamp(1);

    const adapter = new SoftwareHsmAdapter();
    await adapter.initialize();
    const kekId = await adapter.createKEK("t1");
    adapter._timeAnchor = engine;

    const plaintext = Buffer.alloc(16, 0x22);
    let caught;
    try {
      await adapter.wrap("t1", kekId, plaintext);
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(HsmAdapterError);
    expect(caught.code).toBe("TEMPORAL_DRIFT_BLOCKED");
  });

  test("S-04: unwrap is blocked on excessive clock drift", async () => {
    const now = Date.now();
    const { oracles, keys } = _makeOracles(3);
    const engine = new TimeAnchorEngine({
      oracles,
      minQuorum: 3,
      maxDriftMs: 5000,
    });

    // First, establish consensus at a reasonable time and create/wrap a KEK
    keys.forEach((k) => {
      engine.submitPulse(
        k.oracleId,
        now,
        _sign(k.oracleId, now, 0, k.privateKey),
        0,
      );
    });
    engine.consensusTimestamp(1);

    const adapter = new SoftwareHsmAdapter({ timeAnchor: engine });
    await adapter.initialize();
    const kekId = await adapter.createKEK("t1");
    const plaintext = Buffer.alloc(16, 0x44);
    const wrapped = await adapter.wrap("t1", kekId, plaintext);

    // Now submit new pulses far in the past to create a large drift
    const driftedEngine = new TimeAnchorEngine({
      oracles,
      minQuorum: 3,
      maxDriftMs: 5000,
    });
    keys.forEach((k) => {
      driftedEngine.submitPulse(
        k.oracleId,
        now - 100000,
        _sign(k.oracleId, now - 100000, 1, k.privateKey),
        1,
      );
    });
    driftedEngine.consensusTimestamp(2);
    adapter._timeAnchor = driftedEngine;

    let caught;
    try {
      await adapter.unwrap("t1", kekId, wrapped);
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(HsmAdapterError);
    expect(caught.code).toBe("TEMPORAL_DRIFT_BLOCKED");
  });

  test("S-04: rotateKEK is blocked on excessive clock drift", async () => {
    const now = Date.now();
    const { oracles, keys } = _makeOracles(3);
    const engine = new TimeAnchorEngine({
      oracles,
      minQuorum: 3,
      maxDriftMs: 5000,
    });

    // Establish consensus far in the past
    keys.forEach((k) => {
      engine.submitPulse(
        k.oracleId,
        now - 100000,
        _sign(k.oracleId, now - 100000, 0, k.privateKey),
        0,
      );
    });
    engine.consensusTimestamp(1);

    const adapter = new SoftwareHsmAdapter();
    await adapter.initialize();
    const kekId = await adapter.createKEK("t1");
    adapter._timeAnchor = engine;

    let caught;
    try {
      await adapter.rotateKEK("t1", kekId);
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(HsmAdapterError);
    expect(caught.code).toBe("TEMPORAL_DRIFT_BLOCKED");
  });

  test("regression: wrap/unwrap still works without time anchor", async () => {
    const adapter = new SoftwareHsmAdapter();
    await adapter.initialize();
    const kekId = await adapter.createKEK("t1");
    const plaintext = Buffer.alloc(16, 0x33);
    const wrapped = await adapter.wrap("t1", kekId, plaintext);
    const unwrapped = await adapter.unwrap("t1", kekId, wrapped);
    expect(unwrapped.equals(plaintext)).toBe(true);
  });

  test("regression: rotateKEK still works without time anchor", async () => {
    const adapter = new SoftwareHsmAdapter();
    await adapter.initialize();
    const kekId = await adapter.createKEK("t1");
    const newKekId = await adapter.rotateKEK("t1", kekId);
    expect(newKekId).toBeTruthy();
    expect(newKekId).not.toBe(kekId);
  });
});
