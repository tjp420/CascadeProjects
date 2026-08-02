'use strict';

/**
 * Track 34: Cluster consensus integration with base-adapter keyring lifecycle.
 */
const { ClusterConsensusEngine, NODE_STATE } = require('../cluster-consensus-engine.cjs');
const { SoftwareHsmAdapter } = require('../software-adapter.cjs');
const { HsmAdapterError } = require('../base-adapter.cjs');
const { serialize } = require('../../keyring-serializer.cjs');

describe('Track 34 consensus-gated keyring lifecycle', () => {
  test('createKEK succeeds when consensus engine is leader with quorum', async () => {
    const consensusEvents = [];
    const consensus = new ClusterConsensusEngine({
      nodeId: 'node-a',
      clusterNodes: ['node-a', 'node-b', 'node-c'],
      audit: (event, info) => consensusEvents.push({ event, info }),
    });
    consensus.start();
    await consensus.startElection();
    expect(consensus.getState().state).toBe(NODE_STATE.LEADER);

    const logger = { info: jest.fn() };
    const adapter = new SoftwareHsmAdapter({ consensusEngine: consensus, logger });
    await adapter.initialize();

    const kekId = await adapter.createKEK('tenant-1', { name: 'test-kek' });
    expect(kekId).toBeDefined();
    // Consensus engine should have committed the log entry
    expect(consensusEvents.some((e) => e.event === 'LOG_COMMITTED')).toBe(true);
    // Adapter should have emitted CONSENSUS_GATED_COMMIT via its logger
    const gatedCall = logger.info.mock.calls.find((c) => c[0] === 'CONSENSUS_GATED_COMMIT');
    expect(gatedCall).toBeDefined();
    expect(gatedCall[1].operation).toBe('createKEK');

    consensus.stop();
  });

  test('createKEK blocked when node is not leader', async () => {
    const consensus = new ClusterConsensusEngine({
      nodeId: 'node-b',
      clusterNodes: ['node-a', 'node-b', 'node-c'],
    });
    consensus.start();
    // node-b is a follower — no election started

    const adapter = new SoftwareHsmAdapter({ consensusEngine: consensus });
    await adapter.initialize();

    await expect(adapter.createKEK('tenant-1')).rejects.toThrow(HsmAdapterError);
    await expect(adapter.createKEK('tenant-1')).rejects.toThrow('not leader');

    consensus.stop();
  });

  test('createKEK succeeds without consensus engine (local mode)', async () => {
    const adapter = new SoftwareHsmAdapter({});
    await adapter.initialize();

    const kekId = await adapter.createKEK('tenant-1');
    expect(kekId).toBeDefined();
  });

  test('rotateKEK gated by consensus when leader', async () => {
    const consensusEvents = [];
    const consensus = new ClusterConsensusEngine({
      nodeId: 'node-a',
      clusterNodes: ['node-a', 'node-b', 'node-c'],
      audit: (event, info) => consensusEvents.push({ event, info }),
    });
    consensus.start();
    await consensus.startElection();

    const logger = { info: jest.fn() };
    const adapter = new SoftwareHsmAdapter({ consensusEngine: consensus, logger });
    await adapter.initialize();

    const kekId = await adapter.createKEK('tenant-1');
    const newKekId = await adapter.rotateKEK('tenant-1', kekId);
    expect(newKekId).toBeDefined();
    expect(newKekId).not.toBe(kekId);
    // Both createKEK and rotateKEK should have gated commits via adapter logger
    const gatedCommits = logger.info.mock.calls.filter((c) => c[0] === 'CONSENSUS_GATED_COMMIT');
    expect(gatedCommits.length).toBeGreaterThanOrEqual(2);
    expect(gatedCommits[0][1].operation).toBe('createKEK');
    expect(gatedCommits[1][1].operation).toBe('rotateKEK');

    consensus.stop();
  });

  test('rotateKEK blocked when not leader', async () => {
    const consensus = new ClusterConsensusEngine({
      nodeId: 'node-b',
      clusterNodes: ['node-a', 'node-b', 'node-c'],
    });
    consensus.start();

    const adapter = new SoftwareHsmAdapter({ consensusEngine: consensus });
    await adapter.initialize();

    // Create a KEK first without consensus to set up the test
    const kekId = await adapter._createKEK('tenant-1');

    await expect(adapter.rotateKEK('tenant-1', kekId)).rejects.toThrow('not leader');

    consensus.stop();
  });

  test('importKeyring gated by consensus when leader', async () => {
    const consensusEvents = [];
    const consensus = new ClusterConsensusEngine({
      nodeId: 'node-a',
      clusterNodes: ['node-a', 'node-b', 'node-c'],
      audit: (event, info) => consensusEvents.push({ event, info }),
    });
    consensus.start();
    await consensus.startElection();

    const logger = { info: jest.fn() };
    const adapter = new SoftwareHsmAdapter({ consensusEngine: consensus, logger });
    await adapter.initialize();

    // Serialize an empty keyring, then import it
    const masterKek = Buffer.alloc(32, 0xab);
    const envelope = serialize({ keys: [] }, masterKek);
    const result = await adapter.importKeyring(envelope, masterKek);
    expect(result).toBeDefined();
    expect(consensusEvents.some((e) => e.event === 'LOG_COMMITTED')).toBe(true);
    const gatedCall = logger.info.mock.calls.find((c) => c[0] === 'CONSENSUS_GATED_COMMIT');
    expect(gatedCall).toBeDefined();
    expect(gatedCall[1].operation).toBe('importKeyring');

    consensus.stop();
  });

  test('importKeyring blocked when not leader', async () => {
    const consensus = new ClusterConsensusEngine({
      nodeId: 'node-b',
      clusterNodes: ['node-a', 'node-b', 'node-c'],
    });
    consensus.start();

    const adapter = new SoftwareHsmAdapter({ consensusEngine: consensus });
    await adapter.initialize();

    const masterKek = Buffer.alloc(32, 0xab);
    const envelope = serialize({ keys: [] }, masterKek);

    await expect(adapter.importKeyring(envelope, masterKek)).rejects.toThrow('not leader');

    consensus.stop();
  });

  test('createKEK blocked when consensus commit fails (no quorum)', async () => {
    const consensus = new ClusterConsensusEngine({
      nodeId: 'node-a',
      clusterNodes: ['node-a', 'node-b', 'node-c', 'node-d', 'node-e'],
      minQuorumNodes: 4,
      replicateLog: () => Promise.reject(new Error('network unreachable')),
    });
    consensus.start();
    await consensus.startElection();

    const adapter = new SoftwareHsmAdapter({ consensusEngine: consensus });
    await adapter.initialize();

    await expect(adapter.createKEK('tenant-1')).rejects.toThrow(HsmAdapterError);

    consensus.stop();
  });

  test('consensus engine option is optional and defaults to null', async () => {
    const adapter = new SoftwareHsmAdapter({});
    await adapter.initialize();
    expect(adapter._consensusEngine).toBeNull();

    // Operations should work normally without consensus
    const kekId = await adapter.createKEK('tenant-1');
    expect(kekId).toBeDefined();
  });

  test('wrap and unwrap do not require consensus', async () => {
    const consensus = new ClusterConsensusEngine({
      nodeId: 'node-b',
      clusterNodes: ['node-a', 'node-b', 'node-c'],
    });
    consensus.start();
    // node-b is follower

    const adapter = new SoftwareHsmAdapter({ consensusEngine: consensus });
    await adapter.initialize();

    const kekId = await adapter._createKEK('tenant-1');
    const plaintext = Buffer.alloc(32, 0x42); // AES-KW requires >= 16 bytes, multiple of 8
    const wrapped = await adapter.wrap('tenant-1', kekId, plaintext);
    const unwrapped = await adapter.unwrap('tenant-1', kekId, wrapped);
    expect(unwrapped.equals(plaintext)).toBe(true);

    consensus.stop();
  });

  test('CONSENSUS_GATED_COMMIT audit event includes operation and index', async () => {
    const consensus = new ClusterConsensusEngine({
      nodeId: 'node-a',
      clusterNodes: ['node-a', 'node-b', 'node-c'],
    });
    consensus.start();
    await consensus.startElection();

    const logger = { info: jest.fn() };
    const adapter = new SoftwareHsmAdapter({ consensusEngine: consensus, logger });
    await adapter.initialize();

    await adapter.createKEK('tenant-1');

    const gatedCall = logger.info.mock.calls.find((c) => c[0] === 'CONSENSUS_GATED_COMMIT');
    expect(gatedCall).toBeDefined();
    expect(gatedCall[1].operation).toBe('createKEK');
    expect(typeof gatedCall[1].index).toBe('number');
    expect(typeof gatedCall[1].replicas).toBe('number');

    consensus.stop();
  });
});
