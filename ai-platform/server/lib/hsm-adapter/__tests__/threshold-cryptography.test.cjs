'use strict';

/**
 * Track 17: Threshold cryptography and distributed key recovery tests.
 */
const crypto = require('crypto');
const { SoftwareHsmAdapter } = require('../software-adapter.cjs');
const { CryptoPolicyEngine } = require('../crypto-policy-engine.cjs');
const { HsmAdapterError } = require('../base-adapter.cjs');

describe('Threshold cryptography', () => {
  test('splits and recovers a 32-byte KEK with threshold 3 of 5', async () => {
    const adapter = new SoftwareHsmAdapter();
    await adapter.initialize();
    const secret = crypto.randomBytes(32);
    const custodians = ['A', 'B', 'C', 'D', 'E'];
    const shards = await adapter.splitKey('t1', secret, 5, 3, custodians);
    expect(shards.length).toBe(5);
    expect(shards[0].ys.length).toBeGreaterThan(0);

    const recovered = await adapter.recoverKey('t1', shards.slice(0, 3), 3);
    expect(recovered.equals(secret)).toBe(true);
  });

  test('recovers from more than M shards', async () => {
    const adapter = new SoftwareHsmAdapter();
    await adapter.initialize();
    const secret = crypto.randomBytes(32);
    const custodians = ['A', 'B', 'C', 'D', 'E'];
    const shards = await adapter.splitKey('t1', secret, 5, 3, custodians);
    const recovered = await adapter.recoverKey('t1', shards, 3);
    expect(recovered.equals(secret)).toBe(true);
  });

  test('fails with fewer than M shards', async () => {
    const adapter = new SoftwareHsmAdapter();
    await adapter.initialize();
    const secret = crypto.randomBytes(32);
    const custodians = ['A', 'B', 'C', 'D', 'E'];
    const shards = await adapter.splitKey('t1', secret, 5, 3, custodians);
    await expect(adapter.recoverKey('t1', shards.slice(0, 2), 3)).rejects.toMatchObject({
      name: 'HsmAdapterError',
      code: 'INSUFFICIENT_SHARDS',
    });
  });

  test('rejects duplicate custodian IDs', async () => {
    const adapter = new SoftwareHsmAdapter();
    await adapter.initialize();
    const secret = crypto.randomBytes(32);
    const custodians = ['A', 'B', 'C'];
    const shards = await adapter.splitKey('t1', secret, 3, 2, custodians);
    const tampered = [shards[0], { ...shards[1], custodianId: 'A' }];
    await expect(adapter.recoverKey('t1', tampered, 2)).rejects.toMatchObject({
      name: 'HsmAdapterError',
      code: 'SHARD_CUSTODIAN_MISMATCH',
    });
  });

  test('tampered shard does not recover original secret', async () => {
    const adapter = new SoftwareHsmAdapter();
    await adapter.initialize();
    const secret = crypto.randomBytes(32);
    const custodians = ['A', 'B', 'C', 'D', 'E'];
    const shards = await adapter.splitKey('t1', secret, 5, 3, custodians);
    shards[0].ys[0] = Buffer.alloc(32, 0xAB).toString('base64');
    const recovered = await adapter.recoverKey('t1', shards.slice(0, 3), 3);
    expect(recovered.equals(secret)).toBe(false);
  });

  test('emits KEY_SHARD_GENERATED audit event', async () => {
    const logger = { info: jest.fn() };
    const adapter = new SoftwareHsmAdapter({ logger });
    await adapter.initialize();
    const secret = crypto.randomBytes(32);
    await adapter.splitKey('t1', secret, 3, 2, ['A', 'B', 'C']);
    expect(logger.info).toHaveBeenCalledWith(
      'KEY_SHARD_GENERATED',
      expect.objectContaining({ tenantId: 't1', total: 3, threshold: 2 })
    );
  });

  test('emits KEY_RECONSTRUCTION_SUCCESS audit event', async () => {
    const logger = { info: jest.fn() };
    const adapter = new SoftwareHsmAdapter({ logger });
    await adapter.initialize();
    const secret = crypto.randomBytes(32);
    const shards = await adapter.splitKey('t1', secret, 3, 2, ['A', 'B', 'C']);
    await adapter.recoverKey('t1', shards, 2);
    expect(logger.info).toHaveBeenCalledWith(
      'KEY_RECONSTRUCTION_SUCCESS',
      expect.objectContaining({ tenantId: 't1', threshold: 2 })
    );
  });

  test('policy enforces threshold and total bounds', async () => {
    const policy = new CryptoPolicyEngine({
      default: { threshold: { minThreshold: 2, maxTotal: 5 } },
    });
    const logger = { info: jest.fn() };
    const adapter = new SoftwareHsmAdapter({ policyEngine: policy, logger });
    await adapter.initialize();
    const secret = crypto.randomBytes(32);
    await expect(adapter.splitKey('t1', secret, 6, 2, ['A', 'B', 'C', 'D', 'E', 'F'])).rejects.toMatchObject({
      name: 'HsmAdapterError',
      code: 'POLICY_VIOLATION_BLOCKED',
    });
  });

  test('regression: wrap/unwrap still work on existing KEKs', async () => {
    const adapter = new SoftwareHsmAdapter();
    await adapter.initialize();
    const kekId = await adapter.createKEK('t1');
    const plaintext = Buffer.alloc(16, 0xCD);
    const wrapped = await adapter.wrap('t1', kekId, plaintext);
    const unwrapped = await adapter.unwrap('t1', kekId, wrapped);
    expect(unwrapped.equals(plaintext)).toBe(true);
  });
});
