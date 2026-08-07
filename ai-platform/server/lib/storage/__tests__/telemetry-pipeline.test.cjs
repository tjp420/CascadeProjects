'use strict';

const EventEmitter = require('events');
const os = require('os');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const { ShardReconciler } = require('../shard-reconciler.cjs');
const { RepairWorker } = require('../repair-worker.cjs');
const reassembler = require('../reassembler.cjs');
const hsmMetrics = require('../../hsm-adapter/hsm-metrics.cjs');

// Helper: poll until a metric meets or exceeds target or timeout elapses
async function waitForMetric(getValueFn, target = 1, timeout = 500, interval = 50) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      const v = Number(getValueFn()) || 0;
      if (v >= target) return v;
    } catch (e) {
      // ignore and retry
    }
    await new Promise((res) => setTimeout(res, interval));
  }
  // final attempt
  return Number(getValueFn()) || 0;
}

function tmpDir(prefix) {
  const d = path.join(os.tmpdir(), `${prefix}-${crypto.randomBytes(4).toString('hex')}`);
  fs.mkdirSync(d, { recursive: true });
  return d;
}

function sha256HexOfObj(obj) {
  const c = reassembler.jcsCanonicalize(obj);
  return reassembler.sha256Bytes(Buffer.from(c));
}

// Bridge adapter: routes metrics.inc() calls to the central hsm-metrics registry
function createCentralMetricsBridge() {
  return {
    inc(name, value, labels) {
      const count = Number(value) || 1;
      for (let i = 0; i < count; i++) {
        hsmMetrics.incrementCounter(name);
      }
    },
  };
}

describe('CI Telemetry Pipeline: reassembler + repair-worker + reconciler', () => {
  beforeEach(() => {
    hsmMetrics.reset();
  });

  test('L2-01: reconciler increments hsm-metrics on out-of-sync gap', async () => {
    const reconciler = new ShardReconciler({
      pollIntervalMs: 99999,
      repairCooldownMs: 0,
      shardProvider: async () => [
        {
          tenantId: 't1',
          shardId: 's1',
          records: [{ seq: 1 }, { seq: 3 }], // gap: missing seq 2
        },
      ],
    });

    const issues = await reconciler.verifyShardContinuity();
    expect(issues.length).toBeGreaterThanOrEqual(1);
    expect(issues[0].reason).toBe('sequence_gap');

    const metrics = hsmMetrics.getMetrics();
    expect(metrics.hsm_shard_out_of_sync_total).toBeGreaterThanOrEqual(1);
    expect(metrics.hsm_shard_reconciler_repair_requested_total).toBeGreaterThanOrEqual(1);
  });

  test('L2-01b: reconciler increments hsm-metrics on duplicate sequence', async () => {
    const reconciler = new ShardReconciler({
      pollIntervalMs: 99999,
      repairCooldownMs: 0,
      shardProvider: async () => [
        {
          tenantId: 't1',
          shardId: 's1',
          records: [{ seq: 1 }, { seq: 1 }], // duplicate
        },
      ],
    });

    const issues = await reconciler.verifyShardContinuity();
    expect(issues.length).toBeGreaterThanOrEqual(1);
    expect(issues[0].reason).toBe('duplicate_sequence');

    const metrics = hsmMetrics.getMetrics();
    expect(metrics.hsm_shard_out_of_sync_total).toBeGreaterThanOrEqual(1);
  });

  test('L2-02: repair-worker increments hsm-metrics on completion', async () => {
    const emitter = new EventEmitter();
    const worker = new RepairWorker({ emitter, repairJitterMs: 1, processingTimeMs: 10 });

    const payload = { tenantId: 't1', shardId: 'sh-gap', fromSeq: 3, toSeq: 3 };
    emitter.emit('shard:reconciler:reconcile_requested', payload);

    // Wait for jitter + processing (repairJitterMs defaults to 1000 if 0 passed)
    await new Promise((res) => setTimeout(res, 1200));

    expect(worker.processed.length).toBe(1);
    const completed = await waitForMetric(() => hsmMetrics.getMetrics().hsm_repair_worker_completed_total, 1, 500);
    expect(completed).toBeGreaterThanOrEqual(1);
  });

  test('L2-03: reassembler success increments hsm-metrics via bridge', async () => {
    const staging = tmpDir('reass-stage');
    const live = path.join(tmpDir('reass-live-root'), 'tenant1', 'shardA');
    const chunk = { filename: 'blk1.json', payload: JSON.stringify({ seq: 1, data: 'x' }) };
    const expectedHash = sha256HexOfObj(JSON.parse(chunk.payload));
    await reassembler.stageChunks(staging, [chunk]);
    const manifest = {
      expectedLeafHashes: { 'blk1.json': expectedHash },
      labels: { tenantId: 'tenant1', shardId: 'shardA' },
    };

    const metricsBridge = createCentralMetricsBridge();
    const res = await reassembler.finalizeRehydration(staging, live, manifest, metricsBridge);
    expect(res.success).toBe(true);

    const metrics = hsmMetrics.getMetrics();
    expect(metrics.hsm_shard_reconstructed_blocks_total).toBeGreaterThanOrEqual(1);
    expect(metrics.hsm_shard_reassembly_attempts_total).toBeGreaterThanOrEqual(1);
  });

  test('L2-04: reassembler failure increments attempt counter', async () => {
    const staging = tmpDir('reass-stage-fail');
    const live = path.join(tmpDir('reass-live-fail-root'), 'tenant1', 'shardB');
    const chunk = { filename: 'blk1.json', payload: JSON.stringify({ seq: 1, data: 'x' }) };
    await reassembler.stageChunks(staging, [chunk]);
    // Manifest with wrong hash to trigger failure
    const manifest = {
      expectedLeafHashes: { 'blk1.json': 'deadbeef00000000000000000000000000000000000000000000000000000000' },
      labels: { tenantId: 'tenant1', shardId: 'shardB' },
    };

    const metricsBridge = createCentralMetricsBridge();
    await expect(reassembler.finalizeRehydration(staging, live, manifest, metricsBridge)).rejects.toThrow();

    const metrics = hsmMetrics.getMetrics();
    expect(metrics.hsm_shard_reassembly_attempts_total).toBeGreaterThanOrEqual(1);
  });

  test('L2-05: cooldown skip increments skip counter', async () => {
    const reconciler = new ShardReconciler({
      pollIntervalMs: 99999,
      repairCooldownMs: 60000, // long cooldown
      shardProvider: async () => [
        {
          tenantId: 't1',
          shardId: 's1',
          records: [{ seq: 1 }, { seq: 3 }],
        },
      ],
    });

    // First pass triggers repair
    await reconciler.verifyShardContinuity();
    // Second pass should hit cooldown
    await reconciler.verifyShardContinuity();

    const metrics = hsmMetrics.getMetrics();
    expect(metrics.hsm_shard_reconciler_repair_skipped_total).toBeGreaterThanOrEqual(1);
  });

  test('L3-01: all 6 new metrics registered in central counters', () => {
    const metrics = hsmMetrics.getMetrics();
    expect(metrics).toHaveProperty('hsm_shard_out_of_sync_total');
    expect(metrics).toHaveProperty('hsm_shard_reconciler_repair_requested_total');
    expect(metrics).toHaveProperty('hsm_shard_reconciler_repair_skipped_total');
    expect(metrics).toHaveProperty('hsm_shard_reconstructed_blocks_total');
    expect(metrics).toHaveProperty('hsm_shard_reassembly_attempts_total');
    expect(metrics).toHaveProperty('hsm_repair_worker_completed_total');
  });

  test('L3-02: local reconciler metrics still work (backward compat)', async () => {
    const reconciler = new ShardReconciler({
      pollIntervalMs: 99999,
      repairCooldownMs: 0,
      shardProvider: async () => [
        {
          tenantId: 't1',
          shardId: 's1',
          records: [{ seq: 1 }, { seq: 3 }],
        },
      ],
    });

    await reconciler.verifyShardContinuity();
    expect(reconciler.metrics.hsm_shard_out_of_sync_total).toBeGreaterThanOrEqual(1);
    expect(reconciler.metrics.hsm_shard_reconciler_repair_requested_total).toBeGreaterThanOrEqual(1);
  });

  test('L3-03: end-to-end pipeline — reconciler detects gap, repair-worker completes, all counters increment', async () => {
    const emitter = new EventEmitter();
    const worker = new RepairWorker({ emitter, repairJitterMs: 0, processingTimeMs: 10 });
    const reconciler = new ShardReconciler({
      pollIntervalMs: 99999,
      repairCooldownMs: 0,
      shardProvider: async () => [
        {
          tenantId: 't1',
          shardId: 's1',
          records: [{ seq: 1 }, { seq: 5 }], // gap: missing 2,3,4
        },
      ],
    });

    // Wire reconciler events to repair-worker via shared emitter
    reconciler.on('shard:reconciler:reconcile_requested', (p) => worker.handle(p));

    await reconciler.verifyShardContinuity();
    await new Promise((res) => setTimeout(res, 1200));

    const metrics = hsmMetrics.getMetrics();
    expect(metrics.hsm_shard_out_of_sync_total).toBeGreaterThanOrEqual(1);
    expect(metrics.hsm_shard_reconciler_repair_requested_total).toBeGreaterThanOrEqual(1);
    expect(metrics.hsm_repair_worker_completed_total).toBeGreaterThanOrEqual(1);
    expect(worker.processed.length).toBeGreaterThanOrEqual(1);
  });
});
