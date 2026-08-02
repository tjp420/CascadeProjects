'use strict';

/**
 * Track 29/42: ZK-Rollup telemetry accumulator tests.
 */
const { ZkRollupAccumulator } = require('../zk-rollup-accumulator.cjs');

describe('Track 29 ZK-Rollup accumulator', () => {
  test('ingests and finalizes EPHEMERAL_SHARE_RATCHETED events', () => {
    const crypto = require('crypto');
    const rollup = new ZkRollupAccumulator({ maxBatchSize: 2 });
    const canonical = JSON.stringify({
      _eventType: 'EPHEMERAL_SHARE_RATCHETED',
      epochId: 1,
      nodeId: 'n1',
      shareCommitmentHash: 'abc123',
    });
    const sig = crypto.createHmac('sha256', 'zk-rollup-vector-clock-key').update(canonical).digest('hex');
    rollup.ingest('EPHEMERAL_SHARE_RATCHETED', {
      epochId: 1,
      nodeId: 'n1',
      shareCommitmentHash: 'abc123',
      vectorClockSignature: sig,
    });
    const result = rollup.ingest('EPHEMERAL_SHARE_RATCHETED', {
      epochId: 2,
      nodeId: 'n2',
      shareCommitmentHash: 'def456',
    });
    expect(result.finalized).toBe(true);
    expect(result.count).toBe(2);
    expect(result.root).toMatch(/[a-f0-9]{64}/);
    expect(rollup.getLatestRoot()).toBe(result.root);
  });

  test('rejects unrecognized event types', () => {
    const rollup = new ZkRollupAccumulator();
    expect(() => rollup.ingest('UNKNOWN_EVENT', {})).toThrow();
  });

  test('verifyVectorClockSignature returns false for bad signature', () => {
    const rollup = new ZkRollupAccumulator();
    const ok = rollup.verifyVectorClockSignature({ epochId: 1, nodeId: 'n1' }, 'bad-signature');
    expect(ok).toBe(false);
  });
});
