'use strict';

/**
 * Track 33: Cluster recovery tests.
 */
const { ClusterRecoveryCoordinator } = require('../cluster-recovery-coordinator.cjs');
const { CatchUpBatchStreamer } = require('../catchup-batch-streamer.cjs');
const { CryptoPolicyEngine } = require('../crypto-policy-engine.cjs');
const { HsmAdapterError } = require('../base-adapter.cjs');

describe('Track 33 cluster recovery', () => {
  test('multi-batch sliding-window catch-up reaches synced', async () => {
    const events = [];
    const coordinator = new ClusterRecoveryCoordinator({
      clusterNodes: ['node-a', 'node-b', 'node-c', 'node-d'],
      maxCatchUpBatchSize: 10,
      reSyncRetryLimit: 5,
      backoffBaseIntervalMs: 10,
      maxBackOffMs: 1000,
      audit: (event, info) => events.push({ event, info }),
    });
    const streamer = new CatchUpBatchStreamer({
      audit: (event, info) => events.push({ event, info }),
    });

    coordinator.setClusterSequence('shard-1', 25);
    const session = coordinator.startRecovery('node-d', 'shard-1', 0);
    expect(session.mode).toBe('sliding-window');
    expect(events.some((e) => e.event === 'NODE_RECOVERY_STARTED')).toBe(true);

    await streamer.stream(session, coordinator);

    expect(session.completed).toBe(true);
    expect(session.localSequence).toBe(25);
    expect(events.some((e) => e.event === 'NODE_RECOVERY_SYNCED')).toBe(true);
    expect(events.some((e) => e.event === 'CATCH_UP_BATCH_ACK')).toBe(true);
  });

  test('exponential back-off triggers on delivery failure', async () => {
    const events = [];
    const coordinator = new ClusterRecoveryCoordinator({
      clusterNodes: ['node-a', 'node-b'],
      maxCatchUpBatchSize: 10,
      reSyncRetryLimit: 3,
      backoffBaseIntervalMs: 10,
      maxBackOffMs: 1000,
      audit: (event, info) => events.push({ event, info }),
    });
    const streamer = new CatchUpBatchStreamer({
      deliver: () => false,
      audit: (event, info) => events.push({ event, info }),
    });

    coordinator.setClusterSequence('shard-1', 20);
    const session = coordinator.startRecovery('node-b', 'shard-1', 0);

    await expect(streamer.stream(session, coordinator)).rejects.toThrow(HsmAdapterError);
    expect(session.attempts).toBeGreaterThan(0);
    expect(session.nextBackOffMs).toBeGreaterThanOrEqual(10);
    expect(events.some((e) => e.event === 'CATCH_UP_BATCH_RETRY')).toBe(true);
  });

  test('checkpoint mode selected when lag exceeds threshold', () => {
    const coordinator = new ClusterRecoveryCoordinator({
      clusterNodes: ['node-a', 'node-b'],
      maxCatchUpBatchSize: 64,
      checkpointThreshold: 100,
    });
    coordinator.setClusterSequence('shard-1', 250);
    const session = coordinator.startRecovery('node-b', 'shard-1', 0);
    expect(session.mode).toBe('checkpoint');
  });

  test('quorum ack required for batch advancement', async () => {
    const events = [];
    const coordinator = new ClusterRecoveryCoordinator({
      clusterNodes: ['node-a', 'node-b'],
      maxCatchUpBatchSize: 10,
      audit: (event, info) => events.push({ event, info }),
    });
    const streamer = new CatchUpBatchStreamer({
      deliver: () => true,
      requireBftCatchUpAck: true,
      audit: (event, info) => events.push({ event, info }),
    });

    coordinator.setClusterSequence('shard-1', 15);
    const session = coordinator.startRecovery('node-b', 'shard-1', 0);
    await streamer.stream(session, coordinator);
    expect(session.completed).toBe(true);
  });

  test('rejects non-cluster node recovery', () => {
    const coordinator = new ClusterRecoveryCoordinator({
      clusterNodes: ['node-a'],
    });
    coordinator.setClusterSequence('shard-1', 10);
    expect(() => coordinator.startRecovery('node-z', 'shard-1', 0)).toThrow(HsmAdapterError);
  });

  test('CryptoPolicyEngine validates recoverySync configuration', () => {
    const engine = new CryptoPolicyEngine({ default: {} });
    expect(() => engine.validate('t1', 'recoverySync', {
      maxCatchUpBatchSize: 64,
      reSyncRetryLimit: 5,
      backoffBaseIntervalMs: 1000,
      catchUpMode: 'sliding-window',
      bftAck: true,
    })).not.toThrow();

    expect(() => engine.validate('t1', 'recoverySync', { maxCatchUpBatchSize: 100 })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'recoverySync', { reSyncRetryLimit: 10 })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'recoverySync', { backoffBaseIntervalMs: 120000 })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'recoverySync', { catchUpMode: 'burst' })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'recoverySync', { bftAck: false })).toThrow(HsmAdapterError);
  });
});
