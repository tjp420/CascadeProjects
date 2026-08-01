'use strict';

/**
 * Track 11: AsymmetricHsmAdapter scaffolding tests.
 */
const { AsymmetricHsmAdapter } = require('../asymmetric-adapter.cjs');
const { HsmAdapterError } = require('../base-adapter.cjs');

describe('AsymmetricHsmAdapter', () => {
  test('can be instantiated', () => {
    const adapter = new AsymmetricHsmAdapter();
    expect(adapter.providerName).toBe('asymmetric');
    expect(adapter.algorithm).toBe('rsa-oaep');
    expect(adapter.keySize).toBe(2048);
  });

  test('accepts algorithm and keySize options', () => {
    const adapter = new AsymmetricHsmAdapter({ algorithm: 'ecdh', keySize: 256 });
    expect(adapter.algorithm).toBe('ecdh');
    expect(adapter.keySize).toBe(256);
  });

  test('initializes successfully', async () => {
    const adapter = new AsymmetricHsmAdapter();
    await adapter.initialize();
    expect(adapter._initialized).toBe(true);
  });

  test('listKEKs returns empty before key generation', async () => {
    const adapter = new AsymmetricHsmAdapter();
    await adapter.initialize();
    const list = await adapter.listKEKs();
    expect(list).toEqual([]);
  });

  test('createKEK rejects with NOT_IMPLEMENTED', async () => {
    const adapter = new AsymmetricHsmAdapter();
    await adapter.initialize();
    await expect(adapter.createKEK()).rejects.toMatchObject({
      name: 'HsmAdapterError',
      code: 'NOT_IMPLEMENTED',
    });
  });

  test('wrap rejects with NOT_IMPLEMENTED', async () => {
    const adapter = new AsymmetricHsmAdapter();
    await adapter.initialize();
    await expect(adapter.wrap('kek-1', Buffer.alloc(32))).rejects.toMatchObject({
      name: 'HsmAdapterError',
      code: 'NOT_IMPLEMENTED',
    });
  });

  test('exportPublicKey rejects with NOT_IMPLEMENTED', async () => {
    const adapter = new AsymmetricHsmAdapter();
    await adapter.initialize();
    await expect(adapter.exportPublicKey('kek-1')).rejects.toMatchObject({
      name: 'HsmAdapterError',
      code: 'NOT_IMPLEMENTED',
    });
  });
});
