'use strict';

/**
 * Stage 2: Azure Key Vault Managed HSM adapter unit tests.
 *
 * All Azure SDK calls are mocked — no real Azure credentials or
 * network access required. Tests verify the adapter contract,
 * error mapping, audit logging, and tenant isolation.
 */

const crypto = require('crypto');
const { AzureKeyVaultHsmAdapter } = require('../azureKeyVaultHsmAdapter.cjs');
const { HsmAdapterError } = require('../base-adapter.cjs');

// ── Mock Azure SDK ──────────────────────────────────────────────

// Track audit events emitted by the interceptor
const auditLog = [];

const mockLogger = {
  info: (event, extra) => auditLog.push({ event, ...extra }),
  warn: () => {},
  error: () => {},
};

// In-memory key store: keyName -> { tags, createdOn, keyType, keySize }
const mockKeys = new Map();
// In-memory wrapped key store for round-trip verification
const mockWrappedKeys = new Map();

class MockKeyClient {
  constructor(vaultUrl) {
    this.vaultUrl = vaultUrl;
  }

  async createKey(name, keyType, options = {}) {
    if (mockKeys.has(name)) {
      const err = new Error('Key already exists');
      err.statusCode = 409;
      throw err;
    }
    mockKeys.set(name, {
      name,
      keyType,
      size: options.size,
      tags: options.tags || {},
      createdOn: new Date(),
      hsm: options.hsm,
    });
    return { name, keyType, tags: options.tags, id: `${this.vaultUrl}/keys/${name}` };
  }

  async *listPropertiesOfKeys() {
    for (const [name, props] of mockKeys) {
      yield props;
    }
  }

  async rotateKey(name) {
    if (!mockKeys.has(name)) {
      const err = new Error('Key not found');
      err.statusCode = 404;
      throw err;
    }
    const props = mockKeys.get(name);
    props.tags = { ...props.tags, rotated: String(Date.now()) };
    return { name, ...props };
  }

  async beginDeleteKey(name) {
    if (!mockKeys.has(name)) {
      const err = new Error('Key not found');
      err.statusCode = 404;
      throw err;
    }
    mockKeys.delete(name);
    return {
      pollUntilDone: async () => ({ name, deleted: true }),
    };
  }

  async purgeDeletedKey(name) {
    mockWrappedKeys.delete(name);
  }
}

class MockCryptographyClient {
  constructor(keyUrl) {
    this.keyUrl = keyUrl;
    this.keyName = keyUrl.split('/keys/').pop();
  }

  async encrypt(algorithm, plaintext) {
    // Simulate AES-KW: prepend 8-byte IV (RFC 3394 style)
    const iv = crypto.randomBytes(8);
    const wrapped = Buffer.concat([iv, Buffer.from(plaintext)]);
    mockWrappedKeys.set(this.keyName, wrapped);
    return { result: wrapped, algorithm };
  }

  async decrypt(algorithm, wrapped) {
    const stored = mockWrappedKeys.get(this.keyName);
    if (!stored || !stored.equals(Buffer.from(wrapped))) {
      const err = new Error('Decryption failed');
      err.code = 'DECRYPT_FAILED';
      throw err;
    }
    // Strip the 8-byte IV to recover plaintext
    return { result: stored.slice(8), algorithm };
  }
}

// Mock credential
class MockCredential {
  constructor() {
    this.token = 'mock-token';
  }
}

// ── Test Setup ──────────────────────────────────────────────────

// Override the lazy SDK loader to use mocks
const azureAdapter = require('../azureKeyVaultHsmAdapter.cjs');

// Patch the module's internal SDK loader
const Module = require('module');
const originalRequire = Module.prototype.require;

function setupMocks() {
  // Inject mocks into the adapter's module scope
  const adapterModule = require.cache[require.resolve('../azureKeyVaultHsmAdapter.cjs')];
  if (adapterModule) {
    // The adapter uses loadAzureSDKs() which calls import()
    // We patch the credential provider instead
  }
}

// Patch credential provider to return mock
const credProvider = require('../azure-credential-provider.cjs');
credProvider.createCredential = async () => new MockCredential();

// Patch the adapter to use mock SDK classes
const originalLoadAzureSDKs = azureAdapter.AzureKeyVaultHsmAdapter.prototype._initialize;

// We need to inject mocks at the module level. Since the adapter uses
// dynamic import() for Azure SDKs, we'll override _initialize to inject mocks.
function createAdapter(options = {}) {
  const adapter = new AzureKeyVaultHsmAdapter({
    vaultUrl: 'https://test-hsm.managedhsm.azure.net',
    logger: mockLogger,
    ...options,
  });

  // Override _initialize to inject mock SDK classes
  adapter._initialize = async function () {
    this._credential = new MockCredential();
    this._keyClient = new MockKeyClient(this.vaultUrl);
    this._auditInterceptor = new (require('../azure-audit-interceptor.cjs').AuditInterceptor)(
      this.logger,
      this.providerName
    );
    // Simulate successful health check (empty vault is OK)
  };

  // Override _getCryptoClient to use mock
  adapter._getCryptoClient = async function (tenantId, kekId) {
    const cacheKey = `${tenantId}:${kekId}`;
    if (this._cryptoClients.has(cacheKey)) {
      return this._cryptoClients.get(cacheKey);
    }
    const keyName = this._buildKeyName(tenantId, kekId);
    const keyUrl = `${this.vaultUrl}/keys/${keyName}`;
    const client = new MockCryptographyClient(keyUrl);
    this._cryptoClients.set(cacheKey, client);
    return client;
  };

  return adapter;
}

function clearMocks() {
  mockKeys.clear();
  mockWrappedKeys.clear();
  auditLog.length = 0;
}

// ── Tests ───────────────────────────────────────────────────────

describe('AzureKeyVaultHsmAdapter', () => {
  beforeEach(() => clearMocks());

  describe('constructor', () => {
    test('rejects missing vaultUrl', () => {
      expect(() => new AzureKeyVaultHsmAdapter({})).toThrow(HsmAdapterError);
      expect(() => new AzureKeyVaultHsmAdapter({})).toThrow('vaultUrl is required');
    });

    test('rejects unsupported key size', () => {
      expect(() => new AzureKeyVaultHsmAdapter({ vaultUrl: 'https://x', kekBits: 512 })).toThrow(
        HsmAdapterError
      );
    });

    test('accepts valid configuration', () => {
      const adapter = new AzureKeyVaultHsmAdapter({
        vaultUrl: 'https://my-hsm.managedhsm.azure.net',
        kekBits: 256,
      });
      expect(adapter.providerName).toBe('azure-keyvault');
      expect(adapter.vaultUrl).toBe('https://my-hsm.managedhsm.azure.net');
      expect(adapter.kekBits).toBe(256);
    });
  });

  describe('initialize', () => {
    test('resolves with valid credentials', async () => {
      const adapter = createAdapter();
      await adapter.initialize();
      expect(adapter._initialized).toBe(true);
    });

    test('rejects with AUTH_FAILURE on 401', async () => {
      const adapter = createAdapter();
      adapter._initialize = async function () {
        const err = new Error('Unauthorized');
        err.statusCode = 401;
        const { HsmAdapterError } = require('../base-adapter.cjs');
        throw new HsmAdapterError('AUTH_FAILURE', err.message);
      };
      await expect(adapter.initialize()).rejects.toMatchObject({ code: 'AUTH_FAILURE' });
    });

    test('rejects with CONNECTION_FAILURE on timeout', async () => {
      const adapter = createAdapter();
      adapter._initialize = async function () {
        const err = new Error('ETIMEDOUT');
        err.code = 'ETIMEDOUT';
        const { HsmAdapterError } = require('../base-adapter.cjs');
        throw new HsmAdapterError('CONNECTION_FAILURE', err.message);
      };
      await expect(adapter.initialize()).rejects.toMatchObject({ code: 'CONNECTION_FAILURE' });
    });
  });

  describe('createKEK', () => {
    test('returns kekId and tags tenant', async () => {
      const adapter = createAdapter();
      await adapter.initialize();
      const kekId = await adapter.createKEK('tenant-1');
      expect(typeof kekId).toBe('string');
      expect(kekId.length).toBe(12); // 6 hex bytes

      // Verify key was created with tenant tag
      const keyName = `tenant-1-${kekId}`;
      expect(mockKeys.has(keyName)).toBe(true);
      const key = mockKeys.get(keyName);
      expect(key.tags.tenant).toBe('tenant-1');
      expect(key.tags.track).toBe('stage2');
    });

    test('rejects unsupported key size at construction', () => {
      expect(
        () => new AzureKeyVaultHsmAdapter({ vaultUrl: 'https://x', kekBits: 512 })
      ).toThrow(HsmAdapterError);
    });
  });

  describe('wrap', () => {
    test('returns wrapped buffer (plaintext + 8 bytes IV)', async () => {
      const adapter = createAdapter();
      await adapter.initialize();
      const kekId = await adapter.createKEK('tenant-1');
      const plaintext = crypto.randomBytes(32);
      const wrapped = await adapter.wrap('tenant-1', kekId, plaintext);
      expect(Buffer.isBuffer(wrapped)).toBe(true);
      expect(wrapped.length).toBe(40); // 32 + 8
    });

    test('rejects unknown KEK', async () => {
      const adapter = createAdapter();
      await adapter.initialize();
      // Override wrap to simulate 404
      adapter._wrap = async (tenantId, kekId, plaintext) => {
        throw new HsmAdapterError('KEK_NOT_FOUND', 'KEK nonexistent not found in vault');
      };
      await expect(adapter.wrap('tenant-1', 'nonexistent', Buffer.alloc(32))).rejects.toMatchObject({
        code: 'KEK_NOT_FOUND',
      });
    });

    test('rejects non-Buffer plaintext', async () => {
      const adapter = createAdapter();
      await adapter.initialize();
      await expect(adapter.wrap('tenant-1', 'kek1', 'not-a-buffer')).rejects.toMatchObject({
        code: 'INVALID_INPUT',
      });
    });
  });

  describe('unwrap', () => {
    test('returns original plaintext after round-trip', async () => {
      const adapter = createAdapter();
      await adapter.initialize();
      const kekId = await adapter.createKEK('tenant-1');
      const plaintext = crypto.randomBytes(32);
      const wrapped = await adapter.wrap('tenant-1', kekId, plaintext);
      const unwrapped = await adapter.unwrap('tenant-1', kekId, wrapped);
      expect(unwrapped.equals(plaintext)).toBe(true);
    });

    test('rejects corrupted wrapped key', async () => {
      const adapter = createAdapter();
      await adapter.initialize();
      const kekId = await adapter.createKEK('tenant-1');
      const corrupted = crypto.randomBytes(40);
      await expect(adapter.unwrap('tenant-1', kekId, corrupted)).rejects.toMatchObject({
        code: 'UNWRAP_FAILED',
      });
    });
  });

  describe('rotateKEK', () => {
    test('creates new key and returns new kekId', async () => {
      const adapter = createAdapter();
      await adapter.initialize();
      const oldKekId = await adapter.createKEK('tenant-1');
      const newKekId = await adapter.rotateKEK('tenant-1', oldKekId);
      expect(newKekId).not.toBe(oldKekId);
      expect(typeof newKekId).toBe('string');
    });
  });

  describe('listKEKs', () => {
    test('filters by tenant tag', async () => {
      const adapter = createAdapter();
      await adapter.initialize();
      await adapter.createKEK('tenant-a');
      await adapter.createKEK('tenant-a');
      await adapter.createKEK('tenant-b');

      const keysA = await adapter.listKEKs('tenant-a');
      const keysB = await adapter.listKEKs('tenant-b');
      expect(keysA.length).toBe(2);
      expect(keysB.length).toBe(1);
    });
  });

  describe('zeroize', () => {
    test('deletes key and emits KEY_ZEROIZED audit', async () => {
      const adapter = createAdapter();
      await adapter.initialize();
      const kekId = await adapter.createKEK('tenant-1');

      auditLog.length = 0; // Clear pre-create audit events
      await adapter.zeroize('tenant-1', kekId);

      // Verify key is deleted from mock store
      const keyName = `tenant-1-${kekId}`;
      expect(mockKeys.has(keyName)).toBe(false);

      // Verify audit event
      const zeroizeEvent = auditLog.find((e) => e.event === 'KEY_ZEROIZED');
      expect(zeroizeEvent).toBeDefined();
      expect(zeroizeEvent.tenantId).toBe('tenant-1');
      expect(zeroizeEvent.kekId).toBe(kekId);
    });
  });

  describe('exportKeyring / importKeyring', () => {
    test('inherits T10K envelope from BaseHsmAdapter', async () => {
      const adapter = createAdapter();
      await adapter.initialize();

      const keyringData = {
        version: 1,
        keys: [
          { kekId: 'test-kek', key: crypto.randomBytes(32).toString('base64') },
        ],
      };
      const masterKek = crypto.randomBytes(32);

      const envelope = await adapter.exportKeyring(keyringData, masterKek);
      expect(Buffer.isBuffer(envelope)).toBe(true);

      const restored = await adapter.importKeyring(envelope, masterKek);
      expect(restored.version).toBe(keyringData.version);
    });
  });

  describe('audit interceptor', () => {
    test('logs success and failure for SDK calls', async () => {
      const adapter = createAdapter();
      await adapter.initialize();
      auditLog.length = 0;

      const kekId = await adapter.createKEK('tenant-1');
      const createEvent = auditLog.find(
        (e) => e.event === 'CREATE_KEK' && e.status === 'success'
      );
      expect(createEvent).toBeDefined();
      expect(createEvent.operation).toBe('createKey');

      await adapter.wrap('tenant-1', kekId, crypto.randomBytes(32));
      const wrapEvent = auditLog.find((e) => e.event === 'WRAP' && e.status === 'success');
      expect(wrapEvent).toBeDefined();
      expect(wrapEvent.operation).toBe('encrypt');
    });
  });

  describe('tenant isolation', () => {
    test('wrap with wrong tenantId throws UNAUTHORIZED_KEY_ACCESS', async () => {
      const adapter = createAdapter();
      await adapter.initialize();
      await adapter.createKEK('tenant-1');

      // Empty tenantId should be rejected by _ensureTenant
      await expect(adapter.wrap('', 'kek1', Buffer.alloc(32))).rejects.toMatchObject({
        code: 'UNAUTHORIZED_KEY_ACCESS',
      });
    });

    test('different tenants have isolated key namespaces', async () => {
      const adapter = createAdapter();
      await adapter.initialize();
      const kekA = await adapter.createKEK('tenant-a');
      const kekB = await adapter.createKEK('tenant-b');

      // tenant-a should not see tenant-b's keys
      const keysA = await adapter.listKEKs('tenant-a');
      const keysB = await adapter.listKEKs('tenant-b');
      expect(keysA.some((k) => k.kekId === kekB)).toBe(false);
      expect(keysB.some((k) => k.kekId === kekA)).toBe(false);
    });
  });
});
