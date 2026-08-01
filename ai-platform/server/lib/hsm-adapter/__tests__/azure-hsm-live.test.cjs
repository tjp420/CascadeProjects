'use strict';

/**
 * Stage 2: Azure Key Vault Managed HSM live integration tests.
 *
 * These tests run against a real Azure Managed HSM pool. They are
 * skipped unless AZURE_MANAGED_HSM_URL is set in the environment.
 *
 * In CI, this is triggered by the track-stage2-azure.yml workflow
 * which uses OIDC federated authentication via azure/login.
 *
 * Locally, set these environment variables:
 *   AZURE_MANAGED_HSM_URL=https://<hsm-name>.managedhsm.azure.net
 *   AZURE_TENANT_ID=<tenant-id>
 *   AZURE_CLIENT_ID=<app-id>
 *   AZURE_SUBSCRIPTION_ID=<sub-id>
 *
 * And run: az login (to populate AzureCliCredential)
 */

const crypto = require('crypto');
const { AzureKeyVaultHsmAdapter } = require('../azureKeyVaultHsmAdapter.cjs');
const { HsmAdapterError } = require('../base-adapter.cjs');

const HSM_URL = process.env.AZURE_MANAGED_HSM_URL;
const TEST_TENANT = process.env.AZURE_HSM_TEST_TENANT_ID || 'ci-test-tenant';

const describeOrSkip = HSM_URL ? describe : describe.skip;

describeOrSkip('AzureKeyVaultHsmAdapter — Live Integration', () => {
  let adapter;
  let createdKekIds = [];

  beforeAll(async () => {
    adapter = new AzureKeyVaultHsmAdapter({
      vaultUrl: HSM_URL,
      kekBits: 256,
      logger: {
        info: (event, extra) => console.log(`[audit] ${event}`, extra || ''),
        warn: (msg, extra) => console.warn(`[warn] ${msg}`, extra || ''),
        error: (msg, extra) => console.error(`[error] ${msg}`, extra || ''),
      },
    });
    await adapter.initialize();
  }, 30000);

  afterAll(async () => {
    for (const kekId of createdKekIds) {
      try {
        await adapter.zeroize(TEST_TENANT, kekId);
        console.log(`[cleanup] zeroized ${kekId}`);
      } catch (err) {
        console.log(`[cleanup] failed to zeroize ${kekId}: ${err.message}`);
      }
    }
  }, 30000);

  async function createTestKEK() {
    const kekId = await adapter.createKEK(TEST_TENANT, { source: 'live-test' });
    createdKekIds.push(kekId);
    return kekId;
  }

  test('adapter initializes and connects to Managed HSM', () => {
    expect(adapter._initialized).toBe(true);
    expect(adapter._keyClient).toBeDefined();
  });

  test('createKEK creates a real HSM-backed AES-256 key', async () => {
    const kekId = await createTestKEK();
    expect(typeof kekId).toBe('string');
    expect(kekId.length).toBeGreaterThan(0);

    const keys = await adapter.listKEKs(TEST_TENANT);
    const found = keys.find((k) => k.kekId === kekId);
    expect(found).toBeDefined();
    expect(found.meta.tenant).toBe(TEST_TENANT);
    expect(found.meta.source).toBe('live-test');
  }, 30000);

  test('wrap and unwrap round-trip with real HSM', async () => {
    const kekId = await createTestKEK();
    const plaintext = crypto.randomBytes(32);

    const wrapped = await adapter.wrap(TEST_TENANT, kekId, plaintext);
    expect(Buffer.isBuffer(wrapped)).toBe(true);
    expect(wrapped.length).toBeGreaterThan(plaintext.length);

    const unwrapped = await adapter.unwrap(TEST_TENANT, kekId, wrapped);
    expect(unwrapped.equals(plaintext)).toBe(true);
  }, 30000);

  test('wrap with multiple plaintext sizes', async () => {
    const kekId = await createTestKEK();
    const sizes = [16, 32, 48, 64, 128, 256];

    for (const size of sizes) {
      const plaintext = crypto.randomBytes(size);
      const wrapped = await adapter.wrap(TEST_TENANT, kekId, plaintext);
      const unwrapped = await adapter.unwrap(TEST_TENANT, kekId, wrapped);
      expect(unwrapped.equals(plaintext)).toBe(true);
    }
  }, 60000);

  test('unwrap with corrupted ciphertext fails', async () => {
    const kekId = await createTestKEK();
    const corrupted = crypto.randomBytes(48);
    await expect(adapter.unwrap(TEST_TENANT, kekId, corrupted)).rejects.toThrow(
      HsmAdapterError
    );
  }, 30000);

  test('rotateKEK creates a new key and old key still works', async () => {
    const oldKekId = await createTestKEK();
    const plaintext = crypto.randomBytes(32);

    const wrapped = await adapter.wrap(TEST_TENANT, oldKekId, plaintext);

    const newKekId = await adapter.rotateKEK(TEST_TENANT, oldKekId);
    createdKekIds.push(newKekId);
    expect(newKekId).not.toBe(oldKekId);

    const unwrapped = await adapter.unwrap(TEST_TENANT, oldKekId, wrapped);
    expect(unwrapped.equals(plaintext)).toBe(true);
  }, 30000);

  test('listKEKs returns only keys for the test tenant', async () => {
    await createTestKEK();
    await createTestKEK();

    const keys = await adapter.listKEKs(TEST_TENANT);
    expect(keys.length).toBeGreaterThanOrEqual(2);

    for (const key of keys) {
      expect(key.meta.tenant).toBe(TEST_TENANT);
    }
  }, 30000);

  test('zeroize permanently deletes a key', async () => {
    const kekId = await createTestKEK();

    const keysBefore = await adapter.listKEKs(TEST_TENANT);
    expect(keysBefore.some((k) => k.kekId === kekId)).toBe(true);

    await adapter.zeroize(TEST_TENANT, kekId);
    createdKekIds = createdKekIds.filter((id) => id !== kekId);

    const keysAfter = await adapter.listKEKs(TEST_TENANT);
    expect(keysAfter.some((k) => k.kekId === kekId)).toBe(false);

    await expect(
      adapter.wrap(TEST_TENANT, kekId, crypto.randomBytes(32))
    ).rejects.toThrow(HsmAdapterError);
  }, 30000);

  test('exportKeyring and importKeyring round-trip via HSM', async () => {
    const kekId = await createTestKEK();
    const masterKek = crypto.randomBytes(32);

    const keyringData = {
      version: 1,
      keys: [
        { kekId, key: crypto.randomBytes(32).toString('base64') },
      ],
    };

    const envelope = await adapter.exportKeyring(keyringData, masterKek);
    expect(Buffer.isBuffer(envelope)).toBe(true);

    const restored = await adapter.importKeyring(envelope, masterKek);
    expect(restored.version).toBe(keyringData.version);
    expect(restored.keys[0].kekId).toBe(kekId);
  }, 30000);
});
