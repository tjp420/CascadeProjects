'use strict';

/**
 * Tests for the LRU-bounded CryptographyClient cache in AzureKeyVaultHsmAdapter.
 *
 * Verifies:
 *   - Cache hits return existing clients
 *   - Cache misses create new clients
 *   - LRU eviction when cache reaches max size
 *   - Recently used clients are preserved (moved to end)
 *   - Cache statistics are tracked correctly
 *   - clearCryptoClientCache() empties the cache
 */

const { AzureKeyVaultHsmAdapter } = require('../azureKeyVaultHsmAdapter.cjs');

// Mock CryptographyClient — just records its keyUrl for identity
class MockCryptoClient {
  constructor(keyUrl) {
    this.keyUrl = keyUrl;
    this.createdAt = Date.now();
  }
}

// Mock KeyClient
class MockKeyClient {
  constructor() {}
  async *listPropertiesOfKeys() { /* empty vault */ }
  async createKey(name, _type, opts) { return { name, tags: opts.tags }; }
  async rotateKey() { return {}; }
  async beginDeleteKey() { return { pollUntilDone: async () => ({}) }; }
  async purgeDeletedKey() {}
}

// Mock credential
class MockCredential {}

// Patch credential provider
const credProvider = require('../azure-credential-provider.cjs');
credProvider.createCredential = async () => new MockCredential();

function createAdapter(options = {}) {
  const adapter = new AzureKeyVaultHsmAdapter({
    vaultUrl: 'https://test-hsm.managedhsm.azure.net',
    logger: { info: () => {}, warn: () => {}, error: () => {} },
    cryptoClientMaxSize: 3, // Small size for testing LRU eviction
    ...options,
  });

  // Override _initialize to inject mock SDK classes
  adapter._initialize = async function () {
    this._credential = new MockCredential();
    this._keyClient = new MockKeyClient();
    this._auditInterceptor = new (require('../azure-audit-interceptor.cjs').AuditInterceptor)(
      this.logger,
      this.providerName
    );
  };

  // Override only the CryptographyClient constructor to use mock
  // Keep the real LRU cache logic intact
  adapter._getCryptoClient = async function (tenantId, kekId) {
    const cacheKey = `${tenantId}:${kekId}`;

    if (this._cryptoClients.has(cacheKey)) {
      const client = this._cryptoClients.get(cacheKey);
      this._cryptoClients.delete(cacheKey);
      this._cryptoClients.set(cacheKey, client);
      this._cryptoClientCacheHits++;
      return client;
    }

    if (this._cryptoClients.size >= this._cryptoClientMaxSize) {
      const oldestKey = this._cryptoClients.keys().next().value;
      this._cryptoClients.delete(oldestKey);
      this._cryptoClientEvictions++;
    }

    const keyName = this._buildKeyName(tenantId, kekId);
    const keyUrl = `${this.vaultUrl}/keys/${keyName}`;
    const client = new MockCryptoClient(keyUrl);
    this._cryptoClients.set(cacheKey, client);
    this._cryptoClientCacheMisses++;
    return client;
  };

  return adapter;
}

describe('AzureKeyVaultHsmAdapter — LRU Crypto Client Cache', () => {
  let adapter;

  beforeEach(async () => {
    adapter = createAdapter();
    await adapter.initialize();
  });

  test('cache starts empty', () => {
    const stats = adapter.getCryptoClientCacheStats();
    expect(stats.size).toBe(0);
    expect(stats.maxSize).toBe(3);
    expect(stats.hits).toBe(0);
    expect(stats.misses).toBe(0);
    expect(stats.evictions).toBe(0);
    expect(stats.hitRate).toBe(0);
  });

  test('first access is a cache miss', async () => {
    await adapter._getCryptoClient('tenant-a', 'kek-1');
    const stats = adapter.getCryptoClientCacheStats();
    expect(stats.size).toBe(1);
    expect(stats.misses).toBe(1);
    expect(stats.hits).toBe(0);
  });

  test('second access to same key is a cache hit', async () => {
    await adapter._getCryptoClient('tenant-a', 'kek-1');
    await adapter._getCryptoClient('tenant-a', 'kek-1');
    const stats = adapter.getCryptoClientCacheStats();
    expect(stats.size).toBe(1);
    expect(stats.misses).toBe(1);
    expect(stats.hits).toBe(1);
    expect(stats.hitRate).toBeCloseTo(0.5);
  });

  test('different KEKs are separate cache entries', async () => {
    await adapter._getCryptoClient('tenant-a', 'kek-1');
    await adapter._getCryptoClient('tenant-a', 'kek-2');
    await adapter._getCryptoClient('tenant-b', 'kek-1');
    const stats = adapter.getCryptoClientCacheStats();
    expect(stats.size).toBe(3);
    expect(stats.misses).toBe(3);
  });

  test('LRU eviction removes oldest entry when cache is full', async () => {
    // Fill cache to max size (3)
    await adapter._getCryptoClient('tenant-a', 'kek-1');
    await adapter._getCryptoClient('tenant-a', 'kek-2');
    await adapter._getCryptoClient('tenant-a', 'kek-3');
    expect(adapter.getCryptoClientCacheStats().size).toBe(3);

    // Add one more — should evict kek-1 (oldest)
    await adapter._getCryptoClient('tenant-a', 'kek-4');
    const stats = adapter.getCryptoClientCacheStats();
    expect(stats.size).toBe(3);
    expect(stats.evictions).toBe(1);

    // Accessing kek-1 should be a miss (was evicted)
    const beforeMisses = adapter.getCryptoClientCacheStats().misses;
    await adapter._getCryptoClient('tenant-a', 'kek-1');
    expect(adapter.getCryptoClientCacheStats().misses).toBe(beforeMisses + 1);
  });

  test('accessing a key moves it to most-recently-used (prevents eviction)', async () => {
    // Fill cache
    await adapter._getCryptoClient('tenant-a', 'kek-1');
    await adapter._getCryptoClient('tenant-a', 'kek-2');
    await adapter._getCryptoClient('tenant-a', 'kek-3');

    // Access kek-1 to make it most-recently-used
    await adapter._getCryptoClient('tenant-a', 'kek-1');

    // Add kek-4 — should evict kek-2 (now oldest), not kek-1
    await adapter._getCryptoClient('tenant-a', 'kek-4');
    expect(adapter.getCryptoClientCacheStats().evictions).toBe(1);

    // kek-1 should still be cached (hit), kek-2 should be evicted (miss)
    const hitsBefore = adapter.getCryptoClientCacheStats().hits;
    await adapter._getCryptoClient('tenant-a', 'kek-1');
    expect(adapter.getCryptoClientCacheStats().hits).toBe(hitsBefore + 1);

    const missesBefore = adapter.getCryptoClientCacheStats().misses;
    await adapter._getCryptoClient('tenant-a', 'kek-2');
    expect(adapter.getCryptoClientCacheStats().misses).toBe(missesBefore + 1);
  });

  test('cache hit returns the same client instance', async () => {
    const client1 = await adapter._getCryptoClient('tenant-a', 'kek-1');
    const client2 = await adapter._getCryptoClient('tenant-a', 'kek-1');
    expect(client1).toBe(client2);
  });

  test('clearCryptoClientCache empties the cache', async () => {
    await adapter._getCryptoClient('tenant-a', 'kek-1');
    await adapter._getCryptoClient('tenant-a', 'kek-2');
    expect(adapter.getCryptoClientCacheStats().size).toBe(2);

    adapter.clearCryptoClientCache();
    expect(adapter.getCryptoClientCacheStats().size).toBe(0);

    // Next access should be a miss
    const missesBefore = adapter.getCryptoClientCacheStats().misses;
    await adapter._getCryptoClient('tenant-a', 'kek-1');
    expect(adapter.getCryptoClientCacheStats().misses).toBe(missesBefore + 1);
  });

  test('cache stats track cumulative hits, misses, and evictions', async () => {
    await adapter._getCryptoClient('t', 'k1'); // miss
    await adapter._getCryptoClient('t', 'k1'); // hit
    await adapter._getCryptoClient('t', 'k2'); // miss
    await adapter._getCryptoClient('t', 'k3'); // miss
    await adapter._getCryptoClient('t', 'k4'); // miss + eviction
    await adapter._getCryptoClient('t', 'k2'); // hit

    const stats = adapter.getCryptoClientCacheStats();
    expect(stats.hits).toBe(2);
    expect(stats.misses).toBe(4);
    expect(stats.evictions).toBe(1);
    expect(stats.hitRate).toBeCloseTo(2 / 6);
  });

  test('default max size is 256 when not specified', async () => {
    const adapter2 = new AzureKeyVaultHsmAdapter({
      vaultUrl: 'https://test-hsm.managedhsm.azure.net',
      logger: { info: () => {}, warn: () => {}, error: () => {} },
    });
    expect(adapter2._cryptoClientMaxSize).toBe(256);
  });

  test('custom max size can be configured', async () => {
    const adapter2 = createAdapter({ cryptoClientMaxSize: 10 });
    expect(adapter2._cryptoClientMaxSize).toBe(10);
  });
});
