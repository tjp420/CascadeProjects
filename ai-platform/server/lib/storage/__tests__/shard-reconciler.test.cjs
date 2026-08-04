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
