'use strict';

/**
 * Track 33: Cluster recovery tests.
 */
const { ClusterRecoveryCoordinator } = require('../cluster-recovery-coordinator.cjs');
const { CatchUpBatchStreamer } = require('../catchup-batch-streamer.cjs');
const { CryptoPolicyEngine } = require('../crypto-policy-engine.cjs');
const { HsmAdapterError, BaseHsmAdapter } = require('../base-adapter.cjs');
const { SoftwareHsmAdapter } = require('../software-adapter.cjs');

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

  test('tenant-specific recoverySync policy overrides default', () => {
    const engine = new CryptoPolicyEngine({
      default: {},
      tenants: {
        't-permissive': {
          recoverySync: {
            maxCatchUpBatchSize: 128,
            reSyncRetryLimit: 10,
            backoffBaseIntervalMs: 500,
            maxBackOffMs: 120000,
            requireBftCatchUpAck: false,
            allowedCatchUpModes: ['sliding-window', 'checkpoint', 'snapshot'],
          },
        },
      },
    });
    // Tenant with relaxed policy can use larger batch size
    expect(() => engine.validate('t-permissive', 'recoverySync', {
      maxCatchUpBatchSize: 128,
      catchUpMode: 'snapshot',
      bftAck: false,
    })).not.toThrow();

    // Default tenant still restricted to 64
    expect(() => engine.validate('t1', 'recoverySync', {
      maxCatchUpBatchSize: 128,
    })).toThrow(HsmAdapterError);
  });

  test('recoverySync validation skips undefined numeric fields', () => {
    const engine = new CryptoPolicyEngine({ default: {} });
    // All fields undefined — should not throw
    expect(() => engine.validate('t1', 'recoverySync', {})).not.toThrow();
    expect(() => engine.validate('t1', 'recoverySync', {
      catchUpMode: 'sliding-window',
    })).not.toThrow();
  });
});

describe('Track 33 base-adapter recovery telemetry hooks', () => {
  test('emitNodeRecoveryStarted emits NODE_RECOVERY_STARTED audit event', async () => {
    const logger = { info: jest.fn() };
    const adapter = new SoftwareHsmAdapter({ logger });
    await adapter.initialize();

    adapter.emitNodeRecoveryStarted({
      nodeId: 'node-d',
      shardId: 'shard-1',
      localSequence: 0,
      mode: 'sliding-window',
    });

    expect(logger.info).toHaveBeenCalledWith(
      'NODE_RECOVERY_STARTED',
      expect.objectContaining({
        sub: 'hsm-adapter',
        provider: 'software',
        nodeId: 'node-d',
        shardId: 'shard-1',
        mode: 'sliding-window',
      })
    );
  });

  test('emitNodeRecoverySynced emits NODE_RECOVERY_SYNCED audit event', async () => {
    const logger = { info: jest.fn() };
    const adapter = new SoftwareHsmAdapter({ logger });
    await adapter.initialize();

    adapter.emitNodeRecoverySynced({
      nodeId: 'node-d',
      shardId: 'shard-1',
      localSequence: 25,
      batchesApplied: 3,
    });

    expect(logger.info).toHaveBeenCalledWith(
      'NODE_RECOVERY_SYNCED',
      expect.objectContaining({
        sub: 'hsm-adapter',
        provider: 'software',
        nodeId: 'node-d',
        shardId: 'shard-1',
        localSequence: 25,
        batchesApplied: 3,
      })
    );
  });

  test('recovery telemetry hooks throw when adapter not initialized', async () => {
    const logger = { info: jest.fn() };
    const adapter = new SoftwareHsmAdapter({ logger });
    // Don't call initialize()

    expect(() => adapter.emitNodeRecoveryStarted({ nodeId: 'node-a' })).toThrow(HsmAdapterError);
    expect(() => adapter.emitNodeRecoverySynced({ nodeId: 'node-a' })).toThrow(HsmAdapterError);
  });

  test('recovery telemetry hooks default to empty info object', async () => {
    const logger = { info: jest.fn() };
    const adapter = new SoftwareHsmAdapter({ logger });
    await adapter.initialize();

    adapter.emitNodeRecoveryStarted();
    adapter.emitNodeRecoverySynced();

    expect(logger.info).toHaveBeenCalledWith(
      'NODE_RECOVERY_STARTED',
      expect.objectContaining({ sub: 'hsm-adapter', provider: 'software' })
    );
    expect(logger.info).toHaveBeenCalledWith(
      'NODE_RECOVERY_SYNCED',
      expect.objectContaining({ sub: 'hsm-adapter', provider: 'software' })
    );
  });

  test('recovery telemetry hooks are silent when no logger is configured', async () => {
    const adapter = new SoftwareHsmAdapter({});
    await adapter.initialize();

    // Should not throw — _audit is a no-op without a logger
    expect(() => adapter.emitNodeRecoveryStarted({ nodeId: 'node-a' })).not.toThrow();
    expect(() => adapter.emitNodeRecoverySynced({ nodeId: 'node-a' })).not.toThrow();
  });
});
