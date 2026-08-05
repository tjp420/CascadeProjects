'use strict';

/**
 * Tests for SIEM broker production cluster sync wiring.
 *
 * Verifies that enableClusterSync() correctly:
 * - Wires the broker's sendFn to the cluster's _broadcast function
 * - Calls enableDistributedSync with correct parameters
 * - Throws on invalid inputs
 * - Enables distributed token bucket coordination
 */

const SiemSecurityBroker = require('../siem-broker.cjs');

describe('SIEM Broker Cluster Sync Wiring', () => {
  let broker;

  beforeEach(() => {
    broker = new SiemSecurityBroker({
      maxTokens: 100,
      refillRate: 10,
      refillIntervalMs: 1000,
    });
  });

  afterEach(() => {
    broker.close();
  });

  test('SIEM-WIRE-01: enableClusterSync is a function', () => {
    expect(typeof broker.enableClusterSync).toBe('function');
  });

  test('SIEM-WIRE-02: enableClusterSync wires sendFn to cluster _broadcast', () => {
    let broadcastCalled = false;
    let broadcastMsg = null;
    const mockClusterSync = {
      _broadcast: (msg) => {
        broadcastCalled = true;
        broadcastMsg = msg;
      },
    };

    broker.enableClusterSync(mockClusterSync, 3, 'node-1');

    // Trigger a broadcast by checking if distributed sync is enabled
    expect(broker._sendToPeers).toBeDefined();
    // Call the sendFn to verify it routes to _broadcast
    broker._sendToPeers({ type: 'SIEM_BUCKET_SYNC', test: true });
    expect(broadcastCalled).toBe(true);
    expect(broadcastMsg.type).toBe('SIEM_BUCKET_SYNC');
  });

  test('SIEM-WIRE-03: enableClusterSync sets correct nodeId', () => {
    const mockClusterSync = { _broadcast: () => {} };
    broker.enableClusterSync(mockClusterSync, 3, 'node-2');
    expect(broker._nodeId).toBe('node-2');
  });

  test('SIEM-WIRE-04: enableClusterSync sets correct nodeCount', () => {
    const mockClusterSync = { _broadcast: () => {} };
    broker.enableClusterSync(mockClusterSync, 5, 'node-1');
    expect(broker._distNodeCount).toBe(5);
  });

  test('SIEM-WIRE-05: enableClusterSync throws on null clusterSync', () => {
    expect(() => broker.enableClusterSync(null, 3, 'node-1')).toThrow();
  });

  test('SIEM-WIRE-06: enableClusterSync throws on non-object clusterSync', () => {
    expect(() => broker.enableClusterSync('string', 3, 'node-1')).toThrow();
  });

  test('SIEM-WIRE-07: enableClusterSync uses default nodeCount when not provided', () => {
    const mockClusterSync = { _broadcast: () => {} };
    broker.enableClusterSync(mockClusterSync);
    expect(broker._distNodeCount).toBe(2);
  });

  test('SIEM-WIRE-08: enableClusterSync uses default nodeId when not provided', () => {
    const mockClusterSync = { _broadcast: () => {} };
    broker.enableClusterSync(mockClusterSync, 3);
    expect(broker._nodeId).toBe('node-1');
  });

  test('SIEM-WIRE-09: handlePeerSync processes incoming SIEM_BUCKET_SYNC', () => {
    const mockClusterSync = { _broadcast: () => {} };
    broker.enableClusterSync(mockClusterSync, 3, 'node-1');
    expect(() => {
      broker.handlePeerSync({
        type: 'SIEM_BUCKET_SYNC',
        from: 'node-2',
        localTokens: 50,
        maxLocalTokens: 33,
      });
    }).not.toThrow();
  });

  test('SIEM-WIRE-10: handleTokenRequest processes incoming SIEM_TOKEN_REQUEST', () => {
    const mockClusterSync = { _broadcast: () => {} };
    broker.enableClusterSync(mockClusterSync, 3, 'node-1');
    const granted = broker.handleTokenRequest({
      type: 'SIEM_TOKEN_REQUEST',
      from: 'node-2',
      to: 'node-1',
      requested: 5,
    });
    expect(typeof granted).toBe('number');
  });

  test('SIEM-WIRE-11: handleTokenGrant processes incoming SIEM_TOKEN_GRANT', () => {
    const mockClusterSync = { _broadcast: () => {} };
    broker.enableClusterSync(mockClusterSync, 3, 'node-1');
    expect(() => {
      broker.handleTokenGrant({
        type: 'SIEM_TOKEN_GRANT',
        from: 'node-2',
        to: 'node-1',
        granted: 5,
      });
    }).not.toThrow();
  });

  test('SIEM-WIRE-12: getDistributedState returns state after enableClusterSync', () => {
    const mockClusterSync = { _broadcast: () => {} };
    broker.enableClusterSync(mockClusterSync, 3, 'node-1');
    const state = broker.getDistributedState();
    expect(state).toBeDefined();
    expect(state.nodeId).toBe('node-1');
    expect(state.nodeCount).toBe(3);
  });

  test('SIEM-WIRE-13: getClusterTelemetry returns telemetry after enableClusterSync', () => {
    const mockClusterSync = { _broadcast: () => {} };
    broker.enableClusterSync(mockClusterSync, 3, 'node-1');
    const telemetry = broker.getClusterTelemetry();
    expect(telemetry).toBeDefined();
  });

  test('SIEM-WIRE-14: fair share is calculated correctly', () => {
    const mockClusterSync = { _broadcast: () => {} };
    broker.enableClusterSync(mockClusterSync, 4, 'node-1');
    // maxTokens=100, nodeCount=4, fairShare=25
    expect(broker._fairShare).toBe(25);
  });

  test('SIEM-WIRE-15: enableClusterSync works with clusterSync that has no _broadcast', () => {
    const mockClusterSync = {};
    // Should not throw, but sendFn will be a no-op
    broker.enableClusterSync(mockClusterSync, 3, 'node-1');
    expect(broker._nodeId).toBe('node-1');
    // Calling sendFn should not throw
    expect(() => broker._sendToPeers({ type: 'test' })).not.toThrow();
  });
});
