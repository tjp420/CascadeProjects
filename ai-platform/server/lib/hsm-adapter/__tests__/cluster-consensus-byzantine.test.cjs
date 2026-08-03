'use strict';

/**
 * Track 34 Stage 3: Byzantine-hardened RPC validation tests.
 */
const crypto = require('crypto');
const { ClusterConsensusEngine, NODE_STATE, CONSENSUS_EVENT } = require('../cluster-consensus-engine.cjs');
const { CryptoPolicyEngine } = require('../crypto-policy-engine.cjs');
const { HsmAdapterError } = require('../base-adapter.cjs');

/**
 * Generate an Ed25519 key pair for testing.
 */
function generateKeyPair() {
  return crypto.generateKeyPairSync('ed25519');
}

/**
 * Sign a payload with Ed25519 and return base64 signature.
 */
function signPayload(payload, privateKey) {
  const data = Buffer.from(JSON.stringify(payload), 'utf8');
  return crypto.sign(null, data, privateKey).toString('base64');
}

describe('Track 34 Stage 3 Byzantine RPC signing', () => {
  test('signRpcFrame returns null when no signing key configured', () => {
    const engine = new ClusterConsensusEngine({
      nodeId: 'node-a',
      clusterNodes: ['node-a', 'node-b'],
    });
    expect(engine.signRpcFrame({ term: 1 })).toBeNull();
  });

  test('signRpcFrame returns base64 signature when key configured', () => {
    const { privateKey, publicKey } = generateKeyPair();
    const engine = new ClusterConsensusEngine({
      nodeId: 'node-a',
      clusterNodes: ['node-a', 'node-b'],
      signingKeyPair: { privateKey, publicKey },
    });
    const result = engine.signRpcFrame({ term: 1, candidateId: 'node-a' });
    expect(typeof result).toBe('object');
    expect(typeof result.signature).toBe('string');
    expect(result.signature.length).toBeGreaterThan(0);
    expect(typeof result.nonce).toBe('number');
    expect(result.nonce).toBeGreaterThan(0);
    expect(typeof result.timestamp).toBe('number');
    // Verify signature is valid base64
    expect(() => Buffer.from(result.signature, 'base64')).not.toThrow();
  });

  test('verifyRpcFrame accepts valid signature', () => {
    const { privateKey, publicKey } = generateKeyPair();
    const engine = new ClusterConsensusEngine({
      nodeId: 'node-b',
      clusterNodes: ['node-a', 'node-b'],
      peerPublicKeys: new Map([['node-a', publicKey]]),
    });
    const payload = { term: 1, candidateId: 'node-a', lastLogIndex: 0, lastLogTerm: 0 };
    const sig = signPayload(payload, privateKey);
    expect(engine.verifyRpcFrame(payload, 'node-a', sig)).toBe(true);
  });

  test('verifyRpcFrame rejects tampered payload', () => {
    const { privateKey, publicKey } = generateKeyPair();
    const engine = new ClusterConsensusEngine({
      nodeId: 'node-b',
      clusterNodes: ['node-a', 'node-b'],
      peerPublicKeys: new Map([['node-a', publicKey]]),
    });
    const original = { term: 1, candidateId: 'node-a', lastLogIndex: 0, lastLogTerm: 0 };
    const sig = signPayload(original, privateKey);
    // Tamper with the payload
    const tampered = { ...original, term: 99 };
    expect(engine.verifyRpcFrame(tampered, 'node-a', sig)).toBe(false);
  });

  test('verifyRpcFrame rejects unknown peer key', () => {
    const { privateKey } = generateKeyPair();
    const engine = new ClusterConsensusEngine({
      nodeId: 'node-b',
      clusterNodes: ['node-a', 'node-b'],
      peerPublicKeys: new Map(), // no keys registered
    });
    const payload = { term: 1, candidateId: 'node-a' };
    const sig = signPayload(payload, privateKey);
    expect(engine.verifyRpcFrame(payload, 'node-a', sig)).toBe(false);
  });

  test('verifyRpcFrame accepts unsigned when signing not required', () => {
    const engine = new ClusterConsensusEngine({
      nodeId: 'node-b',
      clusterNodes: ['node-a', 'node-b'],
      requireRpcSigning: false,
    });
    expect(engine.verifyRpcFrame({ term: 1 }, 'node-a', null)).toBe(true);
  });

  test('verifyRpcFrame rejects unsigned when signing required', () => {
    const events = [];
    const engine = new ClusterConsensusEngine({
      nodeId: 'node-b',
      clusterNodes: ['node-a', 'node-b'],
      requireRpcSigning: true,
      audit: (event, info) => events.push({ event, info }),
    });
    expect(engine.verifyRpcFrame({ term: 1 }, 'node-a', null)).toBe(false);
    expect(events.some((e) => e.event === CONSENSUS_EVENT.SIGNATURE_INVALID)).toBe(true);
  });

  test('requestVote rejects invalid signature', () => {
    const { privateKey, publicKey } = generateKeyPair();
    // Use a different key to sign (attacker's key)
    const attackerKeys = generateKeyPair();
    const engine = new ClusterConsensusEngine({
      nodeId: 'node-b',
      clusterNodes: ['node-a', 'node-b', 'node-c'],
      peerPublicKeys: new Map([['node-a', publicKey]]),
      requireRpcSigning: true,
    });
    engine.start();

    const payload = { term: 1, candidateId: 'node-a', lastLogIndex: 0, lastLogTerm: 0 };
    // Sign with attacker's key, not node-a's key
    const badSig = signPayload(payload, attackerKeys.privateKey);

    const result = engine.requestVote({ ...payload, signature: badSig });
    expect(result.voteGranted).toBe(false);
    expect(result.reason).toBe('signature_invalid');

    engine.stop();
  });

  test('requestVote accepts valid signature', () => {
    const { privateKey, publicKey } = generateKeyPair();
    const engine = new ClusterConsensusEngine({
      nodeId: 'node-b',
      clusterNodes: ['node-a', 'node-b', 'node-c'],
      peerPublicKeys: new Map([['node-a', publicKey]]),
      requireRpcSigning: true,
    });
    engine.start();

    const payload = { term: 1, candidateId: 'node-a', lastLogIndex: 0, lastLogTerm: 0 };
    const sig = signPayload(payload, privateKey);

    const result = engine.requestVote({ ...payload, signature: sig });
    expect(result.voteGranted).toBe(true);

    engine.stop();
  });

  test('appendEntries rejects invalid signature', () => {
    const { publicKey } = generateKeyPair();
    const attackerKeys = generateKeyPair();
    const engine = new ClusterConsensusEngine({
      nodeId: 'node-b',
      clusterNodes: ['node-a', 'node-b', 'node-c'],
      peerPublicKeys: new Map([['node-a', publicKey]]),
      requireRpcSigning: true,
    });
    engine.start();

    const payload = {
      term: 1,
      leaderId: 'node-a',
      entries: [{ term: 1, index: 1, command: { type: 'PUT' } }],
      leaderCommit: 0,
    };
    // Sign with attacker's key
    const badSig = signPayload(payload, attackerKeys.privateKey);

    const result = engine.appendEntries({ ...payload, signature: badSig });
    expect(result.success).toBe(false);
    expect(result.reason).toBe('signature_invalid');

    engine.stop();
  });

  test('appendEntries accepts valid signature', () => {
    const { privateKey, publicKey } = generateKeyPair();
    const engine = new ClusterConsensusEngine({
      nodeId: 'node-b',
      clusterNodes: ['node-a', 'node-b', 'node-c'],
      peerPublicKeys: new Map([['node-a', publicKey]]),
      requireRpcSigning: true,
    });
    engine.start();

    const payload = {
      term: 1,
      leaderId: 'node-a',
      entries: [{ term: 1, index: 1, command: { type: 'PUT' } }],
      leaderCommit: 0,
    };
    const sig = signPayload(payload, privateKey);

    const result = engine.appendEntries({ ...payload, signature: sig });
    expect(result.success).toBe(true);
    expect(result.matchIndex).toBe(1);

    engine.stop();
  });

  test('receiveHeartbeat rejects invalid signature when signing required', () => {
    const { publicKey } = generateKeyPair();
    const attackerKeys = generateKeyPair();
    const engine = new ClusterConsensusEngine({
      nodeId: 'node-b',
      clusterNodes: ['node-a', 'node-b', 'node-c'],
      peerPublicKeys: new Map([['node-a', publicKey]]),
      requireRpcSigning: true,
    });
    engine.start();

    const payload = { term: 1, leaderId: 'node-a', leaderCommit: 0 };
    const badSig = signPayload(payload, attackerKeys.privateKey);

    const result = engine.receiveHeartbeat({ ...payload, signature: badSig });
    expect(result.accepted).toBe(false);
    expect(result.reason).toBe('signature_invalid');

    engine.stop();
  });

  test('receiveHeartbeat accepts valid signature', () => {
    const { privateKey, publicKey } = generateKeyPair();
    const engine = new ClusterConsensusEngine({
      nodeId: 'node-b',
      clusterNodes: ['node-a', 'node-b', 'node-c'],
      peerPublicKeys: new Map([['node-a', publicKey]]),
      requireRpcSigning: true,
    });
    engine.start();

    const payload = { term: 1, leaderId: 'node-a', leaderCommit: 0 };
    const sig = signPayload(payload, privateKey);

    const result = engine.receiveHeartbeat({ ...payload, signature: sig });
    expect(result.accepted).toBe(true);
    expect(engine.getState().leaderId).toBe('node-a');

    engine.stop();
  });

  test('signature verification emits CONSENSUS_SIGNATURE_INVALID audit event', () => {
    const events = [];
    const { privateKey, publicKey } = generateKeyPair();
    const engine = new ClusterConsensusEngine({
      nodeId: 'node-b',
      clusterNodes: ['node-a', 'node-b'],
      peerPublicKeys: new Map([['node-a', publicKey]]),
      requireRpcSigning: true,
      audit: (event, info) => events.push({ event, info }),
    });
    engine.start();

    // Tampered payload — signature won't match
    const original = { term: 1, candidateId: 'node-a', lastLogIndex: 0, lastLogTerm: 0 };
    const sig = signPayload(original, privateKey);
    const tampered = { ...original, term: 99 };
    engine.requestVote({ ...tampered, signature: sig });

    expect(events.some((e) => e.event === CONSENSUS_EVENT.SIGNATURE_INVALID)).toBe(true);

    engine.stop();
  });

  test('unknown peer emits CONSENSUS_PEER_KEY_UNKNOWN audit event', () => {
    const events = [];
    const { privateKey } = generateKeyPair();
    const engine = new ClusterConsensusEngine({
      nodeId: 'node-b',
      clusterNodes: ['node-a', 'node-b'],
      peerPublicKeys: new Map(), // empty
      requireRpcSigning: true,
      audit: (event, info) => events.push({ event, info }),
    });
    engine.start();

    const payload = { term: 1, candidateId: 'node-a', lastLogIndex: 0, lastLogTerm: 0 };
    const sig = signPayload(payload, privateKey);
    engine.requestVote({ ...payload, signature: sig });

    expect(events.some((e) => e.event === CONSENSUS_EVENT.PEER_KEY_UNKNOWN)).toBe(true);

    engine.stop();
  });

  test('backward compatible: unsigned RPCs work when signing not required', () => {
    const engine = new ClusterConsensusEngine({
      nodeId: 'node-b',
      clusterNodes: ['node-a', 'node-b', 'node-c'],
      requireRpcSigning: false,
    });
    engine.start();

    // No signature field — should work
    const result = engine.requestVote({ term: 1, candidateId: 'node-a', lastLogIndex: 0, lastLogTerm: 0 });
    expect(result.voteGranted).toBe(true);

    engine.stop();
  });
});

describe('Track 34 Stage 3 Byzantine Prometheus metrics', () => {
  test('signRpcFrame increments hsm_consensus_rpc_signed_total', () => {
    const metrics = require('../hsm-metrics.cjs');
    metrics.reset();
    const { privateKey, publicKey } = generateKeyPair();
    const engine = new ClusterConsensusEngine({
      nodeId: 'node-a',
      clusterNodes: ['node-a', 'node-b'],
      signingKeyPair: { privateKey, publicKey },
    });
    engine.signRpcFrame({ term: 1 });
    engine.signRpcFrame({ term: 2 });

    const m = metrics.getMetrics();
    expect(m.hsm_consensus_rpc_signed_total).toBe(2);
  });

  test('invalid signature increments hsm_consensus_signature_invalid_total', () => {
    const metrics = require('../hsm-metrics.cjs');
    metrics.reset();
    const { publicKey } = generateKeyPair();
    const attackerKeys = generateKeyPair();
    const engine = new ClusterConsensusEngine({
      nodeId: 'node-b',
      clusterNodes: ['node-a', 'node-b'],
      peerPublicKeys: new Map([['node-a', publicKey]]),
      requireRpcSigning: true,
    });
    engine.start();

    const payload = { term: 1, candidateId: 'node-a', lastLogIndex: 0, lastLogTerm: 0 };
    const badSig = signPayload(payload, attackerKeys.privateKey);
    engine.requestVote({ ...payload, signature: badSig });

    const m = metrics.getMetrics();
    expect(m.hsm_consensus_signature_invalid_total).toBeGreaterThan(0);

    engine.stop();
  });

  test('unknown peer increments hsm_consensus_peer_key_unknown_total', () => {
    const metrics = require('../hsm-metrics.cjs');
    metrics.reset();
    const { privateKey } = generateKeyPair();
    const engine = new ClusterConsensusEngine({
      nodeId: 'node-b',
      clusterNodes: ['node-a', 'node-b'],
      peerPublicKeys: new Map(),
      requireRpcSigning: true,
    });
    engine.start();

    const payload = { term: 1, candidateId: 'node-a' };
    const sig = signPayload(payload, privateKey);
    engine.requestVote({ ...payload, signature: sig });

    const m = metrics.getMetrics();
    expect(m.hsm_consensus_peer_key_unknown_total).toBeGreaterThan(0);

    engine.stop();
  });
});

describe('Track 34 Stage 3 consensus policy validation', () => {
  test('validates requireAsymmetricRpcSigning policy', () => {
    const engine = new CryptoPolicyEngine({ default: {} });
    expect(() => engine.validate('t1', 'consensus', {
      minQuorumNodes: 2,
      requireAsymmetricRpcSigning: true,
    })).not.toThrow();

    // Default policy has requireAsymmetricRpcSigning: false, so disabling is allowed
    expect(() => engine.validate('t1', 'consensus', {
      requireAsymmetricRpcSigning: false,
    })).not.toThrow();
  });

  test('tenant with requireAsymmetricRpcSigning blocks disabling', () => {
    const engine = new CryptoPolicyEngine({
      default: {},
      tenants: {
        't-strict': {
          consensus: {
            requireAsymmetricRpcSigning: true,
          },
        },
      },
    });
    expect(() => engine.validate('t-strict', 'consensus', {
      requireAsymmetricRpcSigning: false,
    })).toThrow(HsmAdapterError);
  });

  test('validates signatureAlgorithm policy', () => {
    const engine = new CryptoPolicyEngine({ default: {} });
    expect(() => engine.validate('t1', 'consensus', {
      signatureAlgorithm: 'ed25519',
    })).not.toThrow();

    expect(() => engine.validate('t1', 'consensus', {
      signatureAlgorithm: 'rsa-2048',
    })).toThrow(HsmAdapterError);
  });

  test('validates allowedClusterPeerKeys policy', () => {
    const engine = new CryptoPolicyEngine({
      default: {},
      tenants: {
        't-restricted': {
          consensus: {
            allowedClusterPeerKeys: ['key-aaa', 'key-bbb'],
          },
        },
      },
    });
    expect(() => engine.validate('t-restricted', 'consensus', {
      allowedClusterPeerKeys: ['key-aaa'],
    })).not.toThrow();

    expect(() => engine.validate('t-restricted', 'consensus', {
      allowedClusterPeerKeys: ['key-ccc'],
    })).toThrow(HsmAdapterError);
  });
});
