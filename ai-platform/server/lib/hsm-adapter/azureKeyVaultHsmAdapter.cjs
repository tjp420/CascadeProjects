'use strict';

/**
 * Stage 2: Azure Key Vault Managed HSM adapter.
 *
 * Concrete adapter extending BaseHsmAdapter that routes KEK lifecycle
 * and wrap/unwrap operations to Azure Key Vault Managed HSM (FIPS 140-2 L3).
 *
 * Key material is generated and stored inside the Managed HSM pool.
 * Plaintext KEK values never leave the HSM boundary — wrap/unwrap use
 * server-side wrapKey/unwrapKey REST calls with the A256KW algorithm
 * (RFC 3394 AES Key Wrap with 256-bit KEK).
 *
 * Authentication uses DefaultAzureCredential (managed identity, service
 * principal, Azure CLI, or interactive browser fallback).
 *
 * All SDK calls are intercepted by AuditInterceptor for synchronous
 * operational audit logging under established event constants.
 *
 * @module hsm-adapter/azure-keyvault-hsm-adapter
 */

const crypto = require('crypto');
const { BaseHsmAdapter, HsmAdapterError } = require('./base-adapter.cjs');
const { createCredential } = require('./azure-credential-provider.cjs');
const { AuditInterceptor } = require('./azure-audit-interceptor.cjs');
const { CircuitBreaker, STATES: CIRCUIT_STATES } = require('./circuit-breaker.cjs');
const metrics = require('./hsm-metrics.cjs');

const DEFAULT_KEK_BITS = 256;
const AES_KW_ALGORITHM = 'A256KW'; // JWA name for RFC 3394 AES-KW with 256-bit key

// Azure SDK modules loaded lazily via dynamic import (ESM packages)
let _KeyClient = null;
let _CryptographyClient = null;

async function loadAzureSDKs() {
  if (_KeyClient && _CryptographyClient) return;
  const keys = await import('@azure/keyvault-keys');
  _KeyClient = keys.KeyClient;
  _CryptographyClient = keys.CryptographyClient;
}

/**
 * Map an Azure SDK RestError to the appropriate HsmAdapterError code.
 *
 * Azure SDK throws RestError with:
 *   - statusCode: HTTP status (401, 403, 404, 409, 429, 5xx)
 *   - code: 'REQUEST_SEND_ERROR' (network failure) | 'PARSE_ERROR' | undefined
 *   - details.code: Azure service code ('KeyNotFound', 'Forbidden', 'Conflict', ...)
 *
 * @param {Error} err - caught error from Azure SDK
 * @param {string} fallbackCode - HsmAdapterError code if no specific mapping
 * @param {string} contextMsg - human-readable context for the error message
 * @returns {HsmAdapterError} mapped error
 * @private
 */
function _mapAzureError(err, fallbackCode, contextMsg) {
  if (err instanceof HsmAdapterError) return err;

  const statusCode = err.statusCode;
  const sdkCode = err.code;
  const azureCode = err.details && err.details.code;
  const msg = err.message || String(err);

  // Network-level failures (DNS, connection refused, timeout)
  if (sdkCode === 'REQUEST_SEND_ERROR' || err.code === 'ENOTFOUND' || err.code === 'ETIMEDOUT' || err.code === 'ECONNREFUSED') {
    return new HsmAdapterError('CONNECTION_FAILURE', `${contextMsg}: network error (${sdkCode || err.code}): ${msg}`);
  }

  // Malformed response from server
  if (sdkCode === 'PARSE_ERROR') {
    return new HsmAdapterError('CONNECTION_FAILURE', `${contextMsg}: response parse error: ${msg}`);
  }

  // HTTP status code mapping
  if (statusCode === 401) {
    return new HsmAdapterError('AUTH_FAILURE', `${contextMsg}: Azure credential chain exhausted (401): ${msg}`);
  }
  if (statusCode === 403) {
    return new HsmAdapterError('UNAUTHORIZED_KEY_ACCESS', `${contextMsg}: missing RBAC role assignment (403): ${msg}`);
  }
  if (statusCode === 404) {
    return new HsmAdapterError('KEK_NOT_FOUND', `${contextMsg}: key not found (404${azureCode ? `, ${azureCode}` : ''}): ${msg}`);
  }
  if (statusCode === 409) {
    return new HsmAdapterError('KEK_EXISTS', `${contextMsg}: key already exists (409${azureCode ? `, ${azureCode}` : ''}): ${msg}`);
  }
  if (statusCode === 429) {
    return new HsmAdapterError('RATE_LIMITED', `${contextMsg}: Azure throttled request (429): ${msg}`);
  }
  if (statusCode >= 500) {
    return new HsmAdapterError('CONNECTION_FAILURE', `${contextMsg}: Azure server error (${statusCode}): ${msg}`);
  }

  return new HsmAdapterError(fallbackCode, `${contextMsg}: ${azureCode ? `[${azureCode}] ` : ''}${msg}`);
}

/**
 * Azure Key Vault Managed HSM adapter.
 *
 * @extends BaseHsmAdapter
 */
class AzureKeyVaultHsmAdapter extends BaseHsmAdapter {
  /**
   * @param {object} options
   * @param {string} options.vaultUrl - Managed HSM URL (e.g. https://my-hsm.managedhsm.azure.net)
   * @param {object} [options.credentialOptions] - options for DefaultAzureCredential
   * @param {number} [options.kekBits=256] - KEK size in bits (128, 192, 256)
   * @param {object} [options.logger] - logger with info/warn/error methods
   * @param {object} [options.policyEngine] - CryptoPolicyEngine instance
   * @param {object} [options.volatileEvictionEngine] - VolatileEvictionEngine instance
   * @param {object} [options.provenanceTracker] - ProvenanceTracker instance
   * @param {object} [options.retryOptions] - Azure SDK retry options
   */
  constructor(options = {}) {
    super({
      providerName: 'azure-keyvault',
      logger: options.logger,
      policyEngine: options.policyEngine,
      volatileEvictionEngine: options.volatileEvictionEngine,
      provenanceTracker: options.provenanceTracker,
    });

    if (!options.vaultUrl) {
      throw new HsmAdapterError('INVALID_CONFIG', 'vaultUrl is required');
    }
    this.vaultUrl = options.vaultUrl;
    this.credentialOptions = options.credentialOptions || {};
    this.kekBits = options.kekBits || DEFAULT_KEK_BITS;
    if (![128, 192, 256].includes(this.kekBits)) {
      throw new HsmAdapterError(
        'INVALID_KEK_BITS',
        `kekBits must be 128, 192, or 256; got ${this.kekBits}`
      );
    }
    this.retryOptions = options.retryOptions || { maxRetries: 3, retryDelayInMs: 800 };
    this._credential = null;
    this._keyClient = null;
    // LRU-bounded cache: CryptographyClient instances keyed by "tenantId:kekId".
    // Prevents unbounded memory growth in multi-tenant scenarios with many KEKs.
    this._cryptoClients = new Map();
    this._cryptoClientMaxSize = options.cryptoClientMaxSize || 256;
    this._cryptoClientCacheHits = 0;
    this._cryptoClientCacheMisses = 0;
    this._cryptoClientEvictions = 0;
    this._auditInterceptor = null;

    // Stage 3: Circuit breaker for resilience against Azure outages
    this._circuitBreaker = new CircuitBreaker({
      threshold: options.circuitBreakerThreshold || 5,
      cooldownMs: options.circuitBreakerCooldownMs || 30000,
      name: this.providerName,
      onTransition: (newState, prevState, info) => {
        const eventMap = {
          [CIRCUIT_STATES.OPEN]: 'CIRCUIT_OPENED',
          [CIRCUIT_STATES.CLOSED]: 'CIRCUIT_CLOSED',
          [CIRCUIT_STATES.HALF_OPEN]: 'CIRCUIT_HALF_OPEN',
        };
        this._audit(eventMap[newState] || 'CIRCUIT_TRANSITION', {
          prevState, newState, ...info,
        });
        const counterMap = {
          [CIRCUIT_STATES.OPEN]: 'hsm_circuit_opened_total',
          [CIRCUIT_STATES.CLOSED]: 'hsm_circuit_closed_total',
          [CIRCUIT_STATES.HALF_OPEN]: 'hsm_circuit_half_open_total',
        };
        if (counterMap[newState]) {
          metrics.incrementCounter(counterMap[newState]);
        }
      },
    });
  }

  /**
   * Algorithm name for Azure wrapKey/unwrapKey calls.
   * @returns {string} JWA algorithm name
   * @private
   */
  _getAlgorithm() {
    if (this.kekBits === 128) return 'A128KW';
    if (this.kekBits === 192) return 'A192KW';
    return AES_KW_ALGORITHM;
  }

  /**
   * Build the Azure key name for a tenant/kekId pair.
   * @param {string} tenantId
   * @param {string} kekId
   * @returns {string} Azure key name
   * @private
   */
  _buildKeyName(tenantId, kekId) {
    // Azure key names: ^[0-9a-zA-Z-]+$, max 127 chars
    const safeTenant = tenantId.replace(/[^0-9a-zA-Z-]/g, '-').slice(0, 60);
    return `${safeTenant}-${kekId}`;
  }

  /**
   * Get or create a CryptographyClient for the given KEK.
   * @param {string} tenantId
   * @param {string} kekId
   * @returns {Promise<object>} CryptographyClient instance
   * @private
   */
  async _getCryptoClient(tenantId, kekId) {
    const cacheKey = `${tenantId}:${kekId}`;

    // Cache hit: move to end of Map (most-recently-used) for LRU eviction
    if (this._cryptoClients.has(cacheKey)) {
      const client = this._cryptoClients.get(cacheKey);
      // Delete and re-insert to mark as most-recently-used
      this._cryptoClients.delete(cacheKey);
      this._cryptoClients.set(cacheKey, client);
      this._cryptoClientCacheHits++;
      return client;
    }

    // Cache miss: evict oldest entry if at capacity
    if (this._cryptoClients.size >= this._cryptoClientMaxSize) {
      const oldestKey = this._cryptoClients.keys().next().value;
      this._cryptoClients.delete(oldestKey);
      this._cryptoClientEvictions++;
    }

    const keyName = this._buildKeyName(tenantId, kekId);
    const keyUrl = `${this.vaultUrl}/keys/${keyName}`;
    const client = new _CryptographyClient(keyUrl, this._credential, {
      retryOptions: this.retryOptions,
    });
    this._cryptoClients.set(cacheKey, client);
    this._cryptoClientCacheMisses++;
    return client;
  }

  /**
   * Get cache statistics for observability.
   * @returns {object} {size, maxSize, hits, misses, evictions, hitRate}
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
   * Clear the crypto client cache. Useful for testing or forced reconnection.
   */
  clearCryptoClientCache() {
    this._cryptoClients.clear();
  }

  // ── Required BaseHsmAdapter hooks ──────────────────────────────

  /**
   * Initialize the Azure Key Vault connection.
   * @returns {Promise<void>}
   * @protected
   */
  async _initialize() {
    try {
      await loadAzureSDKs();
      this._credential = await createCredential(this.credentialOptions);
      this._keyClient = new _KeyClient(this.vaultUrl, this._credential, {
        retryOptions: this.retryOptions,
      });
      this._auditInterceptor = new AuditInterceptor(this.logger, this.providerName);

      // Health check: verify HSM is reachable
      // listPropertiesOfKeys should not throw if the vault is accessible
      try {
        const iter = await this._keyClient.listPropertiesOfKeys();
        // Consume first item to trigger the API call; empty vault is OK
        await iter.next();
      } catch (err) {
        // 401, 403, network errors, and 5xx are fatal during init
        const mapped = _mapAzureError(err, 'INIT_FAILURE', `HSM init health check at ${this.vaultUrl}`);
        if (mapped.code === 'AUTH_FAILURE' || mapped.code === 'UNAUTHORIZED_KEY_ACCESS' ||
            mapped.code === 'CONNECTION_FAILURE' || mapped.code === 'RATE_LIMITED') {
          throw mapped;
        }
        // Other errors (e.g. empty vault, 404 on list): log but don't fail
        this._log('warn', 'HSM health check returned non-fatal error', { error: err.message });
      }
    } catch (err) {
      throw _mapAzureError(err, 'INIT_FAILURE', 'HSM init');
    }
  }

  /**
   * Create a new KEK in the Managed HSM.
   * @param {string} tenantId
   * @param {object} [meta] - optional metadata stored as key tags
   * @returns {Promise<string>} kekId
   * @protected
   */
  async _createKEK(tenantId, meta = {}) {
    if (this._circuitBreaker.isBlocked()) {
      throw new HsmAdapterError('CIRCUIT_OPEN', 'HSM circuit breaker is open — createKEK rejected');
    }
    const kekId = crypto.randomBytes(6).toString('hex');
    const keyName = this._buildKeyName(tenantId, kekId);
    const keySize = this.kekBits;
    const start = Date.now();

    try {
      metrics.incrementCounter('hsm_create_kek_total');

      const result = await this._auditInterceptor.wrapCall(
        'CREATE_KEK',
        'createKey',
        () => this._keyClient.createKey(keyName, 'AES', {
          size: keySize,
          tags: {
            tenant: tenantId,
            created: String(Date.now()),
            track: 'stage2',
            ...meta,
          },
          hsm: true, // Force HSM-backed key
        })
      );

      if (!result) {
        throw new HsmAdapterError('KEK_GEN_FAILED', 'Azure createKey returned no result');
      }

      this._circuitBreaker.recordSuccess();
      metrics.observeHistogram('hsm_create_kek_duration_ms', Date.now() - start);
      return kekId;
    } catch (err) {
      const mapped = _mapAzureError(err, 'KEK_GEN_FAILED', `createKEK(${tenantId}, ${kekId})`);
      this._circuitBreaker.recordFailure(err);
      metrics.incrementCounter('hsm_create_kek_failures_total');
      throw mapped;
    }
  }

  /**
   * Wrap a plaintext buffer using the named KEK via Azure wrapKey.
   * @param {string} tenantId
   * @param {string} kekId
   * @param {Buffer} plaintext
   * @returns {Promise<Buffer>} wrapped ciphertext
   * @protected
   */
  async _wrap(tenantId, kekId, plaintext) {
    if (this._circuitBreaker.isBlocked()) {
      throw new HsmAdapterError('CIRCUIT_OPEN', 'HSM circuit breaker is open — wrap rejected');
    }
    const client = await this._getCryptoClient(tenantId, kekId);
    const algorithm = this._getAlgorithm();
    const start = Date.now();

    try {
      metrics.incrementCounter('hsm_wrap_total');

      const result = await this._auditInterceptor.wrapCall(
        'WRAP',
        'encrypt',
        () => client.encrypt(algorithm, plaintext)
      );

      if (!result || !result.result) {
        throw new HsmAdapterError('WRAP_FAILED', 'Azure encrypt returned no result');
      }

      this._circuitBreaker.recordSuccess();
      metrics.observeHistogram('hsm_wrap_duration_ms', Date.now() - start);
      return Buffer.from(result.result);
    } catch (err) {
      const mapped = _mapAzureError(err, 'WRAP_FAILED', `wrap(${tenantId}, ${kekId})`);
      this._circuitBreaker.recordFailure(err);
      metrics.incrementCounter('hsm_wrap_failures_total');
      throw mapped;
    }
  }

  /**
   * Unwrap a wrapped buffer using the named KEK via Azure unwrapKey.
   * @param {string} tenantId
   * @param {string} kekId
   * @param {Buffer} wrapped
   * @returns {Promise<Buffer>} plaintext
   * @protected
   */
  async _unwrap(tenantId, kekId, wrapped) {
    if (this._circuitBreaker.isBlocked()) {
      throw new HsmAdapterError('CIRCUIT_OPEN', 'HSM circuit breaker is open — unwrap rejected');
    }
    const client = await this._getCryptoClient(tenantId, kekId);
    const algorithm = this._getAlgorithm();
    const start = Date.now();

    try {
      metrics.incrementCounter('hsm_unwrap_total');

      const result = await this._auditInterceptor.wrapCall(
        'UNWRAP',
        'decrypt',
        () => client.decrypt(algorithm, wrapped)
      );

      if (!result || !result.result) {
        throw new HsmAdapterError('UNWRAP_FAILED', 'Azure decrypt returned no result');
      }

      this._circuitBreaker.recordSuccess();
      metrics.observeHistogram('hsm_unwrap_duration_ms', Date.now() - start);
      return Buffer.from(result.result);
    } catch (err) {
      const mapped = _mapAzureError(err, 'UNWRAP_FAILED', `unwrap(${tenantId}, ${kekId})`);
      this._circuitBreaker.recordFailure(err);
      metrics.incrementCounter('hsm_unwrap_failures_total');
      throw mapped;
    }
  }

  /**
   * Rotate an existing KEK by creating a new one for the same tenant.
   * @param {string} tenantId
   * @param {string} oldKekId
   * @returns {Promise<string>} newKekId
   * @protected
   */
  async _rotateKEK(tenantId, oldKekId) {
    metrics.incrementCounter('hsm_rotate_kek_total');
    // Create a new KEK
    const newKekId = await this._createKEK(tenantId, { rotatedFrom: oldKekId });

    // Trigger server-side rotation on the old key (creates a new version)
    try {
      const oldKeyName = this._buildKeyName(tenantId, oldKekId);
      await this._auditInterceptor.wrapCall(
        'ROTATE_KEK',
        'rotateKey',
        () => this._keyClient.rotateKey(oldKeyName)
      );
    } catch (err) {
      // Rotation failure is non-fatal — the new KEK is already created
      this._log('warn', 'Old KEK rotation failed (non-fatal)', { oldKekId, error: err.message });
    }

    // Clear cached crypto client for old KEK
    this._cryptoClients.delete(`${tenantId}:${oldKekId}`);

    return newKekId;
  }

  /**
   * List all KEKs for a tenant, filtered by the tenant tag.
   * @param {string} tenantId
   * @returns {Promise<Array<{kekId, meta, createdAt}>>}
   * @protected
   */
  async _listKEKs(tenantId) {
    const results = [];
    const expectedPrefix = this._buildKeyName(tenantId, '');

    try {
      const iter = await this._keyClient.listPropertiesOfKeys();
      for await (const keyProperties of iter) {
        // Filter by tenant tag and key name prefix
        if (keyProperties.tags && keyProperties.tags.tenant === tenantId) {
          // Extract kekId from the key name (strip tenant prefix)
          const kekId = keyProperties.name.startsWith(expectedPrefix)
            ? keyProperties.name.slice(expectedPrefix.length)
            : keyProperties.name;
          results.push({
            kekId,
            meta: keyProperties.tags,
            createdAt: keyProperties.createdOn
              ? keyProperties.createdOn.getTime()
              : null,
          });
        }
      }
    } catch (err) {
      throw _mapAzureError(err, 'LIST_FAILED', `listKEKs(${tenantId})`);
    }

    return results;
  }

  /**
   * Delete a KEK from the Managed HSM.
   * @param {string} tenantId
   * @param {string} kekId
   * @returns {Promise<object>} deletion info
   * @protected
   */
  async _zeroize(tenantId, kekId) {
    const keyName = this._buildKeyName(tenantId, kekId);

    try {
      const poller = await this._keyClient.beginDeleteKey(keyName);
      await poller.pollUntilDone();

      // Purge the deleted key (permanent deletion)
      try {
        await this._keyClient.purgeDeletedKey(keyName);
      } catch (err) {
        // Purge may fail if soft-delete is not configured; non-fatal
        this._log('warn', 'Purge of deleted key failed (non-fatal)', { kekId, error: err.message });
      }

      // Clear cached crypto client
      this._cryptoClients.delete(`${tenantId}:${kekId}`);

      metrics.incrementCounter('hsm_zeroize_total');
      return { keyName, deleted: true, purged: true };
    } catch (err) {
      throw _mapAzureError(err, 'ZEROIZE_FAILED', `zeroize(${tenantId}, ${kekId})`);
    }
  }
}

module.exports = {
  AzureKeyVaultHsmAdapter,
  AES_KW_ALGORITHM,
  DEFAULT_KEK_BITS,
};
