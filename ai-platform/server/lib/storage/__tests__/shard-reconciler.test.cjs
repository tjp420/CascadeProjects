'use strict';

const { ShardReconciler } = require('../shard-reconciler.cjs');
const { HomomorphicKeyShardDisperser } = require('../../hsm-adapter/homomorphic-key-shard-disperser.cjs');

describe('Shard reconciler recovery loop integration', () => {
  test('starts and emits started event', () => {
    const r = new ShardReconciler({ pollIntervalMs: 100 });
    let started = false;
    r.once('started', () => { started = true; });
    r.start();
    expect(started).toBe(true);
    r.stop();
  });

  test('triggerSync returns ok for array of shard ids', async () => {
    const r = new ShardReconciler();
    const res = await r.triggerSync(['s1', 's2']);
    expect(res.ok).toBe(true);
  });

  test('verifyShardContinuity detects gaps and duplicates, schedules repair with jitter', async () => {
    const provider = async () => [
      { tenantId: 't1', shardId: 'sh-gap', records: [{ seq: 1 }, { seq: 2 }, { seq: 4 }] },
      { tenantId: 't2', shardId: 'sh-dup', records: [{ seq: 10 }, { seq: 11 }, { seq: 11 }, { seq: 12 }] },
    ];

    const r = new ShardReconciler({ pollIntervalMs: 1000, shardProvider: provider });
    const seen = [];
    r.on('shard:out_of_sync', (ev) => seen.push(ev));

    const repairs = [];
    r.on('reconcile:requested', (payload) => repairs.push(payload));

    const issues = await r.verifyShardContinuity();
    expect(issues.length).toBe(2);
    expect(seen.length).toBe(2);

    await new Promise((res) => setTimeout(res, 50));

    expect(repairs.length).toBeGreaterThanOrEqual(1);
    const gapPayload = repairs.find((p) => p && p.shardId === 'sh-gap');
    expect(gapPayload).toBeTruthy();
    expect(typeof gapPayload.repairJitterMs).toBe('number');
    expect(gapPayload.repairJitterMs).toBe(r.repairJitterMs);

    const before = repairs.length;
    await r.verifyShardContinuity();
    await new Promise((res) => setTimeout(res, 50));
    expect(repairs.length).toBe(before);

    const resSync = await r.triggerSync(['sh-gap']);
    expect(resSync && resSync.ok).toBe(true);
  });

  test('reconcile restores valid single-tenant request', async () => {
    const r = new ShardReconciler();
    const res = await r.reconcile({
      tenantId: 'tenant-a',
      sourceTenantId: 'tenant-a',
      shardId: 'shard-001',
      onlineNodes: ['node1', 'node2', 'node3'],
      minQuorum: 3,
    });
    expect(res.ok).toBe(true);
    expect(res.reconciled).toContain('shard-001');
    expect(res.tenantId).toBe('tenant-a');
  });

  test('reconcile throws CROSS_TENANT_RECON_VIOLATION on tenant mismatch', async () => {
    const r = new ShardReconciler();
    await expect(r.reconcile({
      tenantId: 'tenant-a',
      sourceTenantId: 'tenant-b',
      shardId: 'shard-001',
      onlineNodes: ['node1', 'node2', 'node3'],
      minQuorum: 3,
    })).rejects.toHaveProperty('code', 'CROSS_TENANT_RECON_VIOLATION');
  });

  test('reconcile throws SHARD_RECON_VIOLATION when quorum is insufficient', async () => {
    const r = new ShardReconciler();
    await expect(r.reconcile({
      tenantId: 'tenant-a',
      sourceTenantId: 'tenant-a',
      shardId: 'shard-001',
      onlineNodes: ['node1'],
      minQuorum: 3,
    })).rejects.toHaveProperty('code', 'SHARD_RECON_VIOLATION');
  });

  test('reconcile throws SHARD_RECON_VIOLATION when tenant identity missing', async () => {
    const r = new ShardReconciler();
    await expect(r.reconcile({
      onlineNodes: ['node1', 'node2', 'node3'],
      minQuorum: 3,
    })).rejects.toHaveProperty('code', 'SHARD_RECON_VIOLATION');
  });

  test('attachToDisperser reconciles on disperser emitted event', (done) => {
    const disperser = new HomomorphicKeyShardDisperser({
      policy: { kemAlgorithm: 'ml-kem-1024', minTargetPlatformQuorum: 3 },
    });
    const r = new ShardReconciler({ policy: { minTargetPlatformQuorum: 3 } });
    r.attachToDisperser(disperser);

    r.once('reconcile:requested', (payload) => {
      expect(payload.tenantId).toBe('tenant-a');
      expect(payload.onlineNodes).toEqual(['dest1', 'dest2', 'dest3']);
      done();
    });

    disperser.disperse({
      tenantId: 'tenant-a',
      sourcePlatformId: 'platform-a',
      kemAlgorithm: 'ml-kem-1024',
      destinations: [
        { platformId: 'dest1' },
        { platformId: 'dest2' },
        { platformId: 'dest3' },
      ],
    });
  });
});
