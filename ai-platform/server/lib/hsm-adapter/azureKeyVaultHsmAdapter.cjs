'use strict';

/**
 * Stage 2: Azure Key Vault Managed HSM adapter.
 *
 * Concrete BaseHsmAdapter implementation for Azure Key Vault Managed HSM.
 * Uses @azure/keyvault-keys (KeyClient) for KEK lifecycle and
 * @azure/keyvault-keys (CryptographyClient) for wrap/unwrap operations.
 *
 * All Azure SDK modules are loaded lazily via dynamic import() so the
 * adapter can be unit-tested with mocks without the real SDK installed.
 *
 * @module hsm-adapter/azureKeyVaultHsmAdapter
 */

const crypto = require('crypto');
const { BaseHsmAdapter, HsmAdapterError } = require('./base-adapter.cjs');
const { createCredential } = require('./azure-credential-provider.cjs');
const { AuditInterceptor } = require('./azure-audit-interceptor.cjs');

const SUPPORTED_KEK_BITS = [128, 192, 256];
const AES_KW_ALGORITHM = 'A256KW';

class AzureKeyVaultHsmAdapter extends BaseHsmAdapter {
  /**
   * @param {object} options
   * @param {string} options.vaultUrl - Azure Key Vault URL (required)
   * @param {number} [options.kekBits=256] - KEK key size in bits
   * @param {object} [options.logger] - logger with info/warn/error
   * @param {CryptoPolicyEngine} [options.policyEngine]
   */
  constructor(options = {}) {
    if (!options.vaultUrl) {
      throw new HsmAdapterError('INVALID_INPUT', 'vaultUrl is required');
    }
    if (options.kekBits !== undefined && !SUPPORTED_KEK_BITS.includes(options.kekBits)) {
      throw new HsmAdapterError(
        'INVALID_INPUT',
        `kekBits ${options.kekBits} is not supported; use one of ${SUPPORTED_KEK_BITS.join(', ')}`
      );
    }
    super({
      providerName: 'azure-keyvault',
      ...options,
    });
    this.vaultUrl = options.vaultUrl;
    this.kekBits = options.kekBits || 256;
    this._cryptoClients = new Map();
    this._cryptoClientMaxSize = options.cryptoClientMaxSize || 256;
    this._cryptoClientCacheHits = 0;
    this._cryptoClientCacheMisses = 0;
    this._cryptoClientEvictions = 0;
  }

  /**
   * Return stats for the LRU CryptographyClient cache.
   * @returns {{size, maxSize, hits, misses, evictions, hitRate}}
   */
  getCryptoClientCacheStats() {
    const total = this._cryptoClientCacheHits + this._cryptoClientCacheMisses;
    return {
      size: this._cryptoClients.size,
      maxSize: this._cryptoClientMaxSize,
      hits: this._cryptoClientCacheHits,
      misses: this._cryptoClientCacheMisses,
      evictions: this._cryptoClientEvictions,
      hitRate: total === 0 ? 0 : this._cryptoClientCacheHits / total,
    };
  }

  /**
   * Clear the LRU CryptographyClient cache.
   */
  clearCryptoClientCache() {
    this._cryptoClients.clear();
  }

  async _initialize() {
    this._credential = await createCredential();
    let keyvaultKeys;
    try {
      keyvaultKeys = await import('@azure/keyvault-keys');
    } catch (e) {
      throw new HsmAdapterError(
        'DEPENDENCY_MISSING',
        `@azure/keyvault-keys is not installed. Install it with: npm install @azure/keyvault-keys. Original error: ${e.message}`
      );
    }
    this._KeyClient = keyvaultKeys.KeyClient;
    this._CryptographyClient = keyvaultKeys.CryptographyClient;
    this._keyClient = new this._KeyClient(this.vaultUrl, this._credential);
    this._auditInterceptor = new AuditInterceptor(this.logger, this.providerName);
  }

  _buildKeyName(tenantId, kekId) {
    return `${tenantId}-${kekId}`;
  }

  async _getCryptoClient(tenantId, kekId) {
    const cacheKey = `${tenantId}:${kekId}`;

    if (this._cryptoClients.has(cacheKey)) {
      const client = this._cryptoClients.get(cacheKey);
      // Move to most-recently-used (delete + re-set)
      this._cryptoClients.delete(cacheKey);
      this._cryptoClients.set(cacheKey, client);
      this._cryptoClientCacheHits++;
      return client;
    }

    // LRU eviction when cache is full
    if (this._cryptoClients.size >= this._cryptoClientMaxSize) {
      const oldestKey = this._cryptoClients.keys().next().value;
      this._cryptoClients.delete(oldestKey);
      this._cryptoClientEvictions++;
    }

    const keyName = this._buildKeyName(tenantId, kekId);
    const keyUrl = `${this.vaultUrl}/keys/${keyName}`;
    const client = new this._CryptographyClient(keyUrl, this._credential);
    this._cryptoClients.set(cacheKey, client);
    this._cryptoClientCacheMisses++;
    return client;
  }

  async _createKEK(tenantId, meta = {}) {
    const kekId = crypto.randomBytes(6).toString('hex');
    const keyName = this._buildKeyName(tenantId, kekId);
    try {
      await this._keyClient.createKey(keyName, 'oct', {
        size: this.kekBits / 8,
        hsm: true,
        tags: {
          tenant: tenantId,
          track: 'stage2',
          ...meta,
        },
      });
      this._auditInterceptor.logSuccess('CREATE_KEK', 'createKey', { tenantId, kekId });
    } catch (error) {
      this._auditInterceptor.logFailure('CREATE_KEK', 'createKey', error, { tenantId, kekId });
      throw this._mapAzureError(error, 'createKey');
    }
    return kekId;
  }

  async _wrap(tenantId, kekId, plaintext) {
    const client = await this._getCryptoClient(tenantId, kekId);
    try {
      const result = await client.encrypt(AES_KW_ALGORITHM, plaintext);
      this._auditInterceptor.logSuccess('WRAP', 'encrypt', { tenantId, kekId });
      return Buffer.from(result.result);
    } catch (error) {
      this._auditInterceptor.logFailure('WRAP', 'encrypt', error, { tenantId, kekId });
      throw this._mapAzureError(error, 'encrypt');
    }
  }

  async _unwrap(tenantId, kekId, wrapped) {
    const client = await this._getCryptoClient(tenantId, kekId);
    try {
      const result = await client.decrypt(AES_KW_ALGORITHM, wrapped);
      this._auditInterceptor.logSuccess('UNWRAP', 'decrypt', { tenantId, kekId });
      return Buffer.from(result.result);
    } catch (error) {
      this._auditInterceptor.logFailure('UNWRAP', 'decrypt', error, { tenantId, kekId });
      throw this._mapAzureError(error, 'decrypt');
    }
  }

  async _rotateKEK(tenantId, oldKekId) {
    const oldKeyName = this._buildKeyName(tenantId, oldKekId);
    try {
      await this._keyClient.rotateKey(oldKeyName);
      this._auditInterceptor.logSuccess('ROTATE_KEK', 'rotateKey', { tenantId, kekId: oldKekId });
    } catch (error) {
      this._auditInterceptor.logFailure('ROTATE_KEK', 'rotateKey', error, { tenantId, kekId: oldKekId });
      throw this._mapAzureError(error, 'rotateKey');
    }
    const newKekId = await this._createKEK(tenantId, { rotatedFrom: oldKekId });
    return newKekId;
  }

  async _listKEKs(tenantId) {
    const keys = [];
    try {
      for await (const props of this._keyClient.listPropertiesOfKeys()) {
        if (props.tags && props.tags.tenant === tenantId) {
          const kekId = props.name.split('-').pop();
          keys.push({
            kekId,
            meta: props.tags,
            createdAt: props.createdOn,
          });
        }
      }
    } catch (error) {
      throw this._mapAzureError(error, 'listPropertiesOfKeys');
    }
    return keys;
  }

  async _zeroize(tenantId, kekId) {
    const keyName = this._buildKeyName(tenantId, kekId);
    try {
      const poller = await this._keyClient.beginDeleteKey(keyName);
      await poller.pollUntilDone();
      await this._keyClient.purgeDeletedKey(keyName);
      this._cryptoClients.delete(`${tenantId}:${kekId}`);
      if (this.logger) {
        this.logger.info('KEY_ZEROIZED', { tenantId, kekId });
      }
    } catch (error) {
      throw this._mapAzureError(error, 'beginDeleteKey');
    }
    return true;
  }

  _mapAzureError(error, operation) {
    const statusCode = error.statusCode || error.status;
    const azureCode = error.details && error.details.code;
    const message = azureCode ? `${error.message} (Azure: ${azureCode})` : error.message;

    if (statusCode === 401) {
      return new HsmAdapterError('AUTH_FAILURE', message);
    }
    if (statusCode === 403) {
      return new HsmAdapterError('UNAUTHORIZED_KEY_ACCESS', message);
    }
    if (statusCode === 404) {
      return new HsmAdapterError('KEK_NOT_FOUND', message);
    }
    if (statusCode === 409) {
      if (operation === 'createKey') {
        return new HsmAdapterError('KEK_EXISTS', message);
      }
      return new HsmAdapterError('CONFLICT', message);
    }
    if (statusCode === 429) {
      return new HsmAdapterError('RATE_LIMITED', message);
    }
    if (statusCode === 503) {
      return new HsmAdapterError('CONNECTION_FAILURE', message);
    }
    if (error.code === 'REQUEST_SEND_ERROR' || error.code === 'ECONNREFUSED') {
      return new HsmAdapterError('CONNECTION_FAILURE', message);
    }
    if (error.code === 'PARSE_ERROR') {
      return new HsmAdapterError('CONNECTION_FAILURE', message);
    }
    if (error.code === 'ETIMEDOUT') {
      return new HsmAdapterError('CONNECTION_FAILURE', message);
    }
    if (error.code === 'DECRYPT_FAILED') {
      return new HsmAdapterError('UNWRAP_FAILED', message);
    }
    if (operation === 'encrypt') {
      return new HsmAdapterError('WRAP_FAILED', message);
    }
    if (operation === 'decrypt') {
      return new HsmAdapterError('UNWRAP_FAILED', message);
    }
    return new HsmAdapterError('UNKNOWN_ERROR', message);
  }
}

module.exports = { AzureKeyVaultHsmAdapter };
