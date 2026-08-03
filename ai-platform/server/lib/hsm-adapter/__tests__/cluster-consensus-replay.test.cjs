'use strict';

/**
 * Track 34 Phase 4: Signature replay protection tests.
 */
const crypto = require('crypto');
const { ClusterConsensusEngine, NODE_STATE, CONSENSUS_EVENT } = require('../cluster-consensus-engine.cjs');
const { CryptoPolicyEngine } = require('../crypto-policy-engine.cjs');
const { HsmAdapterError } = require('../base-adapter.cjs');

function generateKeyPair() {
  return crypto.generateKeyPairSync('ed25519');
}

function signPayload(payload, privateKey) {
  const data = Buffer.from(JSON.stringify(payload), 'utf8');
  return crypto.sign(null, data, privateKey).toString('base64');
}

describe('Track 34 Phase 4 replay protection — signRpcFrame', () => {
  test('signRpcFrame injects monotonic nonce and timestamp', () => {
    const { privateKey, publicKey } = generateKeyPair();
    const engine = new ClusterConsensusEngine({
      nodeId: 'node-a',
      clusterNodes: ['node-a', 'node-b'],
      signingKeyPair: { privateKey, publicKey },
    });
    const r1 = engine.signRpcFrame({ term: 1 });
    const r2 = engine.signRpcFrame({ term: 2 });
    expect(r2.nonce).toBeGreaterThan(r1.nonce);
    expect(r2.timestamp).toBeGreaterThanOrEqual(r1.timestamp);
  });

  test('signRpcFrame returns null when no signing key', () => {
    const engine = new ClusterConsensusEngine({
      nodeId: 'node-a',
      clusterNodes: ['node-a', 'node-b'],
    });
    expect(engine.signRpcFrame({ term: 1 })).toBeNull();
  });
});

describe('Track 34 Phase 4 replay protection — timestamp freshness', () => {
  test('verifyRpcFrame rejects expired timestamp', () => {
    const { privateKey, publicKey } = generateKeyPair();
    const engine = new ClusterConsensusEngine({
      nodeId: 'node-b',
      clusterNodes: ['node-a', 'node-b'],
      peerPublicKeys: new Map([['node-a', publicKey]]),
      replayWindowMs: 1000,
    });
    // Create a payload with an old timestamp
    const oldTimestamp = Date.now() - 10000; // 10s ago, window is 1s
    const payload = { term: 1, candidateId: 'node-a', lastLogIndex: 0, lastLogTerm: 0, nonce: 1, timestamp: oldTimestamp };
    const sig = signPayload(payload, privateKey);
    expect(engine.verifyRpcFrame(payload, 'node-a', sig)).toBe(false);
  });

  test('verifyRpcFrame rejects future timestamp beyond tolerance', () => {
    const { privateKey, publicKey } = generateKeyPair();
    const engine = new ClusterConsensusEngine({
      nodeId: 'node-b',
      clusterNodes: ['node-a', 'node-b'],
      peerPublicKeys: new Map([['node-a', publicKey]]),
      replayWindowMs: 1000,
    });
    const futureTimestamp = Date.now() + 10000; // 10s in the future
    const payload = { term: 1, candidateId: 'node-a', nonce: 1, timestamp: futureTimestamp };
    const sig = signPayload(payload, privateKey);
    expect(engine.verifyRpcFrame(payload, 'node-a', sig)).toBe(false);
  });

  test('verifyRpcFrame accepts fresh timestamp within window', () => {
    const { privateKey, publicKey } = generateKeyPair();
    const engine = new ClusterConsensusEngine({
      nodeId: 'node-b',
      clusterNodes: ['node-a', 'node-b'],
      peerPublicKeys: new Map([['node-a', publicKey]]),
      replayWindowMs: 5000,
    });
    const payload = { term: 1, candidateId: 'node-a', nonce: 1, timestamp: Date.now() };
    const sig = signPayload(payload, privateKey);
    expect(engine.verifyRpcFrame(payload, 'node-a', sig)).toBe(true);
  });

  test('TIMESTAMP_EXPIRED audit event emitted on expired frame', () => {
    const events = [];
    const { privateKey, publicKey } = generateKeyPair();
    const engine = new ClusterConsensusEngine({
      nodeId: 'node-b',
      clusterNodes: ['node-a', 'node-b'],
      peerPublicKeys: new Map([['node-a', publicKey]]),
      replayWindowMs: 100,
      audit: (event, info) => events.push({ event, info }),
    });
    const oldTimestamp = Date.now() - 5000;
    const payload = { term: 1, candidateId: 'node-a', nonce: 1, timestamp: oldTimestamp };
    const sig = signPayload(payload, privateKey);
    engine.verifyRpcFrame(payload, 'node-a', sig);
    expect(events.some((e) => e.event === CONSENSUS_EVENT.TIMESTAMP_EXPIRED)).toBe(true);
  });
});

describe('Track 34 Phase 4 replay protection — nonce monotonicity', () => {
  test('verifyRpcFrame rejects replayed nonce (same nonce)', () => {
    const { privateKey, publicKey } = generateKeyPair();
    const engine = new ClusterConsensusEngine({
      nodeId: 'node-b',
      clusterNodes: ['node-a', 'node-b'],
      peerPublicKeys: new Map([['node-a', publicKey]]),
      replayWindowMs: 60000, // large window so timestamp doesn't interfere
    });
    const ts = Date.now();
    const payload1 = { term: 1, candidateId: 'node-a', nonce: 5, timestamp: ts };
    const sig1 = signPayload(payload1, privateKey);
    expect(engine.verifyRpcFrame(payload1, 'node-a', sig1)).toBe(true);

    // Replay with same nonce — should be rejected
    const payload2 = { term: 1, candidateId: 'node-a', nonce: 5, timestamp: ts + 1 };
    const sig2 = signPayload(payload2, privateKey);
    expect(engine.verifyRpcFrame(payload2, 'node-a', sig2)).toBe(false);
  });

  test('verifyRpcFrame rejects lower nonce (going backwards)', () => {
    const { privateKey, publicKey } = generateKeyPair();
    const engine = new ClusterConsensusEngine({
      nodeId: 'node-b',
      clusterNodes: ['node-a', 'node-b'],
      peerPublicKeys: new Map([['node-a', publicKey]]),
      replayWindowMs: 60000,
    });
    const ts = Date.now();
    // First frame with nonce 10
    const payload1 = { term: 1, candidateId: 'node-a', nonce: 10, timestamp: ts };
    const sig1 = signPayload(payload1, privateKey);
    expect(engine.verifyRpcFrame(payload1, 'node-a', sig1)).toBe(true);

    // Second frame with nonce 5 (lower) — should be rejected
    const payload2 = { term: 1, candidateId: 'node-a', nonce: 5, timestamp: ts + 1 };
    const sig2 = signPayload(payload2, privateKey);
    expect(engine.verifyRpcFrame(payload2, 'node-a', sig2)).toBe(false);
  });

  test('verifyRpcFrame accepts increasing nonce sequence', () => {
    const { privateKey, publicKey } = generateKeyPair();
    const engine = new ClusterConsensusEngine({
      nodeId: 'node-b',
      clusterNodes: ['node-a', 'node-b'],
      peerPublicKeys: new Map([['node-a', publicKey]]),
      replayWindowMs: 60000,
    });
    for (let i = 1; i <= 5; i++) {
      const payload = { term: 1, candidateId: 'node-a', nonce: i, timestamp: Date.now() };
      const sig = signPayload(payload, privateKey);
      expect(engine.verifyRpcFrame(payload, 'node-a', sig)).toBe(true);
    }
  });

  test('NONCE_STALE audit event emitted on replayed nonce', () => {
    const events = [];
    const { privateKey, publicKey } = generateKeyPair();
    const engine = new ClusterConsensusEngine({
      nodeId: 'node-b',
      clusterNodes: ['node-a', 'node-b'],
      peerPublicKeys: new Map([['node-a', publicKey]]),
      replayWindowMs: 60000,
      audit: (event, info) => events.push({ event, info }),
    });
    const ts = Date.now();
    const payload1 = { term: 1, candidateId: 'node-a', nonce: 3, timestamp: ts };
    const sig1 = signPayload(payload1, privateKey);
    engine.verifyRpcFrame(payload1, 'node-a', sig1);

    const payload2 = { term: 1, candidateId: 'node-a', nonce: 3, timestamp: ts + 1 };
    const sig2 = signPayload(payload2, privateKey);
    engine.verifyRpcFrame(payload2, 'node-a', sig2);

    expect(events.some((e) => e.event === CONSENSUS_EVENT.NONCE_STALE)).toBe(true);
  });

  test('nonce tracking is per-sender (different senders independent)', () => {
    const keysA = generateKeyPair();
    const keysB = generateKeyPair();
    const engine = new ClusterConsensusEngine({
      nodeId: 'node-c',
      clusterNodes: ['node-a', 'node-b', 'node-c'],
      peerPublicKeys: new Map([['node-a', keysA.publicKey], ['node-b', keysB.publicKey]]),
      replayWindowMs: 60000,
    });
    const ts = Date.now();
    // node-a sends nonce 1
    const pA = { term: 1, candidateId: 'node-a', nonce: 1, timestamp: ts };
    expect(engine.verifyRpcFrame(pA, 'node-a', signPayload(pA, keysA.privateKey))).toBe(true);

    // node-b sends nonce 1 — should be accepted (different sender)
    const pB = { term: 1, candidateId: 'node-b', nonce: 1, timestamp: ts };
    expect(engine.verifyRpcFrame(pB, 'node-b', signPayload(pB, keysB.privateKey))).toBe(true);
  });
});

describe('Track 34 Phase 4 replay protection — disabled', () => {
  test('replay protection can be disabled via constructor', () => {
    const { privateKey, publicKey } = generateKeyPair();
    const engine = new ClusterConsensusEngine({
      nodeId: 'node-b',
      clusterNodes: ['node-a', 'node-b'],
      peerPublicKeys: new Map([['node-a', publicKey]]),
      enableReplayProtection: false,
    });
    // Old timestamp — should be accepted when replay protection is off
    const payload = { term: 1, candidateId: 'node-a', nonce: 1, timestamp: Date.now() - 99999 };
    const sig = signPayload(payload, privateKey);
    expect(engine.verifyRpcFrame(payload, 'node-a', sig)).toBe(true);
  });

  test('nonce check skipped when replay protection disabled', () => {
    const { privateKey, publicKey } = generateKeyPair();
    const engine = new ClusterConsensusEngine({
      nodeId: 'node-b',
      clusterNodes: ['node-a', 'node-b'],
      peerPublicKeys: new Map([['node-a', publicKey]]),
      enableReplayProtection: false,
    });
    const payload1 = { term: 1, candidateId: 'node-a', nonce: 5, timestamp: Date.now() };
    const sig1 = signPayload(payload1, privateKey);
    expect(engine.verifyRpcFrame(payload1, 'node-a', sig1)).toBe(true);

    // Same nonce — should be accepted when replay protection is off
    const payload2 = { term: 1, candidateId: 'node-a', nonce: 5, timestamp: Date.now() };
    const sig2 = signPayload(payload2, privateKey);
    expect(engine.verifyRpcFrame(payload2, 'node-a', sig2)).toBe(true);
  });

  test('frames without nonce/timestamp pass when replay protection enabled (backward compat)', () => {
    const { privateKey, publicKey } = generateKeyPair();
    const engine = new ClusterConsensusEngine({
      nodeId: 'node-b',
      clusterNodes: ['node-a', 'node-b'],
      peerPublicKeys: new Map([['node-a', publicKey]]),
      enableReplayProtection: true,
    });
    // No nonce or timestamp — should skip replay checks
    const payload = { term: 1, candidateId: 'node-a', lastLogIndex: 0, lastLogTerm: 0 };
    const sig = signPayload(payload, privateKey);
    expect(engine.verifyRpcFrame(payload, 'node-a', sig)).toBe(true);
  });
});

describe('Track 34 Phase 4 replay protection — integration with RPC methods', () => {
  test('requestVote rejects replayed frame', () => {
    const { privateKey, publicKey } = generateKeyPair();
    const engine = new ClusterConsensusEngine({
      nodeId: 'node-b',
      clusterNodes: ['node-a', 'node-b', 'node-c'],
      peerPublicKeys: new Map([['node-a', publicKey]]),
      requireRpcSigning: true,
      replayWindowMs: 60000,
    });
    engine.start();

    const ts = Date.now();
    const payload = { term: 1, candidateId: 'node-a', lastLogIndex: 0, lastLogTerm: 0, nonce: 10, timestamp: ts };
    const sig = signPayload(payload, privateKey);

    // First request — accepted
    const r1 = engine.requestVote({ ...payload, signature: sig });
    expect(r1.voteGranted).toBe(true);

    // Replay — rejected
    const r2 = engine.requestVote({ ...payload, signature: sig });
    expect(r2.voteGranted).toBe(false);
    expect(r2.reason).toBe('signature_invalid');

    engine.stop();
  });

  test('appendEntries rejects replayed frame', () => {
    const { privateKey, publicKey } = generateKeyPair();
    const engine = new ClusterConsensusEngine({
      nodeId: 'node-b',
      clusterNodes: ['node-a', 'node-b', 'node-c'],
      peerPublicKeys: new Map([['node-a', publicKey]]),
      requireRpcSigning: true,
      replayWindowMs: 60000,
    });
    engine.start();

    const ts = Date.now();
    const payload = {
      term: 1,
      leaderId: 'node-a',
      entries: [{ term: 1, index: 1, command: { type: 'PUT' } }],
      leaderCommit: 0,
      nonce: 1,
      timestamp: ts,
    };
    const sig = signPayload(payload, privateKey);

    // First request — accepted
    const r1 = engine.appendEntries({ ...payload, signature: sig });
    expect(r1.success).toBe(true);

    // Replay — rejected
    const r2 = engine.appendEntries({ ...payload, signature: sig });
    expect(r2.success).toBe(false);
    expect(r2.reason).toBe('signature_invalid');

    engine.stop();
  });
});

describe('Track 34 Phase 4 replay protection — Prometheus metrics', () => {
  test('expired timestamp increments hsm_consensus_timestamp_expired_total', () => {
    const metrics = require('../hsm-metrics.cjs');
    metrics.reset();
    const { privateKey, publicKey } = generateKeyPair();
    const engine = new ClusterConsensusEngine({
      nodeId: 'node-b',
      clusterNodes: ['node-a', 'node-b'],
      peerPublicKeys: new Map([['node-a', publicKey]]),
      replayWindowMs: 100,
    });
    const oldTs = Date.now() - 5000;
    const payload = { term: 1, candidateId: 'node-a', nonce: 1, timestamp: oldTs };
    const sig = signPayload(payload, privateKey);
    engine.verifyRpcFrame(payload, 'node-a', sig);

    const m = metrics.getMetrics();
    expect(m.hsm_consensus_timestamp_expired_total).toBeGreaterThan(0);
    expect(m.hsm_consensus_replay_detected_total).toBeGreaterThan(0);
  });

  test('stale nonce increments hsm_consensus_nonce_stale_total', () => {
    const metrics = require('../hsm-metrics.cjs');
    metrics.reset();
    const { privateKey, publicKey } = generateKeyPair();
    const engine = new ClusterConsensusEngine({
      nodeId: 'node-b',
      clusterNodes: ['node-a', 'node-b'],
      peerPublicKeys: new Map([['node-a', publicKey]]),
      replayWindowMs: 60000,
    });
    const ts = Date.now();
    const p1 = { term: 1, candidateId: 'node-a', nonce: 5, timestamp: ts };
    const sig1 = signPayload(p1, privateKey);
    engine.verifyRpcFrame(p1, 'node-a', sig1);

    const p2 = { term: 1, candidateId: 'node-a', nonce: 5, timestamp: ts + 1 };
    const sig2 = signPayload(p2, privateKey);
    engine.verifyRpcFrame(p2, 'node-a', sig2);

    const m = metrics.getMetrics();
    expect(m.hsm_consensus_nonce_stale_total).toBeGreaterThan(0);
    expect(m.hsm_consensus_replay_detected_total).toBeGreaterThan(0);
  });
});

describe('Track 34 Phase 4 replay protection — policy validation', () => {
  test('validates enableReplayProtection policy', () => {
    const engine = new CryptoPolicyEngine({ default: {} });
    expect(() => engine.validate('t1', 'consensus', {
      enableReplayProtection: true,
    })).not.toThrow();
  });

  test('tenant with enableReplayProtection blocks disabling', () => {
    const engine = new CryptoPolicyEngine({
      default: {},
      tenants: {
        't-strict': {
          consensus: { enableReplayProtection: true },
        },
      },
    });
    expect(() => engine.validate('t-strict', 'consensus', {
      enableReplayProtection: false,
    })).toThrow(HsmAdapterError);
  });

  test('validates replayWindowMs upper bound', () => {
    const engine = new CryptoPolicyEngine({ default: {} });
    expect(() => engine.validate('t1', 'consensus', {
      replayWindowMs: 10000, // default policy max is 5000
    })).toThrow(HsmAdapterError);
  });

  test('validates replayWindowMs lower bound (100ms minimum)', () => {
    const engine = new CryptoPolicyEngine({ default: {} });
    expect(() => engine.validate('t1', 'consensus', {
      replayWindowMs: 50,
    })).toThrow(HsmAdapterError);
  });

  test('validates replayWindowMs within bounds', () => {
    const engine = new CryptoPolicyEngine({ default: {} });
    expect(() => engine.validate('t1', 'consensus', {
      replayWindowMs: 3000,
    })).not.toThrow();
  });

  test('tenant can override replayWindowMs to a lower value', () => {
    const engine = new CryptoPolicyEngine({
      default: {},
      tenants: {
        't-fast': {
          consensus: { replayWindowMs: 2000 },
        },
      },
    });
    expect(() => engine.validate('t-fast', 'consensus', {
      replayWindowMs: 1500,
    })).not.toThrow();
    // But exceeding tenant max still fails
    expect(() => engine.validate('t-fast', 'consensus', {
      replayWindowMs: 3000,
    })).toThrow(HsmAdapterError);
  });
});
