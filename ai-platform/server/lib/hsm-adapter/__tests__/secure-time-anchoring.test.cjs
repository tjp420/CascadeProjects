'use strict';

/**
 * Track 22: Secure time anchoring and tamper-evident epoch frame tests.
 */
const crypto = require('crypto');
const { TimeAnchorEngine } = require('../time-anchor-engine.cjs');
const { EpochFrame } = require('../epoch-frame.cjs');
const { SoftwareHsmAdapter } = require('../software-adapter.cjs');
const { CryptoPolicyEngine } = require('../crypto-policy-engine.cjs');
const { HsmAdapterError } = require('../base-adapter.cjs');

function _makeOracles(n = 5) {
  const oracles = {};
  const keys = [];
  for (let i = 0; i < n; i++) {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
    oracles[`o${i}`] = { publicKey };
    keys.push({ oracleId: `o${i}`, privateKey });
  }
  return { oracles, keys };
}

function _sign(oracleId, timestamp, epochNumber, privateKey) {
  const payload = `${epochNumber}:${timestamp}:${oracleId}`;
  const signer = crypto.createSign('sha256');
  signer.update(payload);
  return signer.sign(privateKey, 'base64');
}

describe('TimeAnchorEngine', () => {
  test('reaches median consensus and rejects outlier', () => {
    const now = Date.now();
    const { oracles, keys } = _makeOracles(5);
    const engine = new TimeAnchorEngine({ oracles, minQuorum: 3, maxDriftMs: 5000 });

    keys.forEach((k, i) => {
      const ts = i === 4 ? now + 100000 : now;
      engine.submitPulse(k.oracleId, ts, _sign(k.oracleId, ts, 0, k.privateKey), 0);
    });

    const consensus = engine.consensusTimestamp(1);
    expect(consensus).toBe(now);
  });

  test('fails when quorum is not met', () => {
    const now = Date.now();
    const { oracles, keys } = _makeOracles(2);
    const engine = new TimeAnchorEngine({ oracles, minQuorum: 3, maxDriftMs: 5000 });

    keys.forEach((k) => {
      engine.submitPulse(k.oracleId, now, _sign(k.oracleId, now, 0, k.privateKey), 0);
    });

    expect(() => engine.consensusTimestamp(1)).toThrow(HsmAdapterError);
  });

  test('rejects invalid oracle signature', () => {
    const now = Date.now();
    const { oracles, keys } = _makeOracles(1);
    const engine = new TimeAnchorEngine({ oracles, minQuorum: 1, maxDriftMs: 5000 });
    const badSig = 'aGVsbG8=';

    expect(() => engine.submitPulse(keys[0].oracleId, now, badSig, 0)).toThrow(HsmAdapterError);
  });
});

describe('EpochFrame', () => {
  test('signs and verifies a frame', () => {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
    const frame = new EpochFrame({
      epochNumber: 0,
      previousHash: Buffer.alloc(32, 0),
      consensusTimestamp: Date.now(),
      driftMs: 0,
    });
    frame.sign(privateKey);
    expect(frame.verify(publicKey)).toBe(true);
  });

  test('rejects broken chain with invalid previous hash', () => {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
    const f1 = new EpochFrame({
      epochNumber: 0,
      previousHash: Buffer.alloc(32, 0),
      consensusTimestamp: 1000,
      driftMs: 0,
    });
    f1.sign(privateKey);

    const f2 = new EpochFrame({
      epochNumber: 1,
      previousHash: Buffer.alloc(32, 0xAB),
      consensusTimestamp: 2000,
      driftMs: 0,
    });
    f2.sign(privateKey);
    expect(f2.verify(publicKey, f1)).toBe(false);
  });

  test('detects consensus timestamp rollback', () => {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
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
});

describe('Policy and adapter integration', () => {
  test('CryptoPolicyEngine rejects excessive time drift', () => {
    const policy = new CryptoPolicyEngine({
      default: { time: { maxDriftMs: 60000, minQuorum: 3 } },
    });
    expect(() => policy.validate('t1', 'time', { maxDriftMs: 120000 })).toThrow(HsmAdapterError);
  });

  test('BaseHsmAdapter verifyTemporalGuard blocks drift', async () => {
    const now = Date.now();
    const { oracles, keys } = _makeOracles(3);
    const engine = new TimeAnchorEngine({ oracles, minQuorum: 3, maxDriftMs: 5000 });
    keys.forEach((k) => {
      engine.submitPulse(k.oracleId, now, _sign(k.oracleId, now, 0, k.privateKey), 0);
    });
    engine.consensusTimestamp(1);

    const adapter = new SoftwareHsmAdapter({ timeAnchor: engine });
    await adapter.initialize();

    expect(() => adapter.verifyTemporalGuard('t1', now + 10000)).toThrow(HsmAdapterError);
  });

  test('BaseHsmAdapter wrap is blocked on excessive clock drift', async () => {
    const now = Date.now();
    const { oracles, keys } = _makeOracles(3);
    const engine = new TimeAnchorEngine({ oracles, minQuorum: 3, maxDriftMs: 5000 });
    keys.forEach((k) => {
      engine.submitPulse(k.oracleId, now - 100000, _sign(k.oracleId, now - 100000, 0, k.privateKey), 0);
    });
    engine.consensusTimestamp(1);

    const adapter = new SoftwareHsmAdapter();
    await adapter.initialize();
    const kekId = await adapter.createKEK('t1');
    adapter._timeAnchor = engine;

    const plaintext = Buffer.alloc(16, 0x22);
    await expect(adapter.wrap('t1', kekId, plaintext)).rejects.toThrow(HsmAdapterError);
  });

  test('regression: wrap/unwrap still works without time anchor', async () => {
    const adapter = new SoftwareHsmAdapter();
    await adapter.initialize();
    const kekId = await adapter.createKEK('t1');
    const plaintext = Buffer.alloc(16, 0x33);
    const wrapped = await adapter.wrap('t1', kekId, plaintext);
    const unwrapped = await adapter.unwrap('t1', kekId, wrapped);
    expect(unwrapped.equals(plaintext)).toBe(true);
  });
});
