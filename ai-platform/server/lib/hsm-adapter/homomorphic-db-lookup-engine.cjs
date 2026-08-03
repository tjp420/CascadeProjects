'use strict';

/**
 * Track 49: Homomorphic database lookup engine.
 *
 * Accepts encrypted search filters and executes dot-product matching
 * logic directly over encrypted columns without exposing underlying
 * plaintext values.
 *
 * @module hsm-adapter/homomorphic-db-lookup-engine
 */

const { HsmAdapterError } = require('./base-adapter.cjs');

const P = 170141183460469231731687303715884105727n;

class HomomorphicDbLookupEngine {
  /**
   * @param {object} options
   * @param {object} options.policy
   * @param {EnclaveAttestationClient} [options.attestationClient]
   * @param {Function} [options.audit]
   */
  constructor(options = {}) {
    this.policy = options.policy || {};
    this._attestationClient = options.attestationClient || null;
    this._audit = options.audit || null;
  }

  /**
   * Execute an encrypted lookup query.
   * @param {object} query
   * @returns {object}
   */
  execute(query) {
    if (this.policy.requireQueryAttestation && this._attestationClient) {
      const result = this._attestationClient.verify(query.attestation);
      if (!result.verified) {
        throw new HsmAdapterError('DB_LOOKUP_ATTESTATION_INVALID', 'query attestation is not valid');
      }
    }
    if (!Array.isArray(query.encryptedFilters) || query.encryptedFilters.length === 0) {
      throw new HsmAdapterError('DB_LOOKUP_FILTERS_MISSING', 'encrypted filters are required');
    }
    if (query.encryptedFilters.length > (this.policy.maxEncryptedColumnsPerQuery || 8)) {
      throw new HsmAdapterError('DB_LOOKUP_COLUMNS_EXCEEDED', `filters ${query.encryptedFilters.length} exceed maximum ${this.policy.maxEncryptedColumnsPerQuery}`);
    }
    if (typeof query.blindingType === 'string' && !this.policy.allowedBlindingTypes.includes(query.blindingType)) {
      throw new HsmAdapterError('DB_LOOKUP_BLINDING_BLOCKED', `blinding type ${query.blindingType} is not allowed`);
    }
    if (query.crossTenant && !this.policy.allowCrossTenantTables) {
      throw new HsmAdapterError('DB_LOOKUP_CROSS_TENANT_BLOCKED', 'cross-tenant tables are not allowed');
    }
    const now = Math.floor(Date.now() / 1000);
    const age = now - (query.queryEpoch || now);
    if (age > (this.policy.maxQueryAgeSeconds || 60)) {
      throw new HsmAdapterError('DB_LOOKUP_QUERY_EXPIRED', `query age ${age}s exceeds maximum ${this.policy.maxQueryAgeSeconds}s`);
    }
    const matches = [];
    for (const record of (query.records || [])) {
      const score = _dotProduct(query.encryptedFilters, record.encryptedColumns);
      if (score > 0n) {
        matches.push({ recordId: record.id, score: score.toString() });
      }
    }
    if (this._audit) {
      this._audit('HOMOMORPHIC_DB_QUERY_INITIATED', {
        tenantId: query.tenantId,
        tableAlias: query.tableAlias,
        filterCount: query.encryptedFilters.length,
        matchCount: matches.length,
      });
    }
    return {
      tenantId: query.tenantId,
      tableAlias: query.tableAlias,
      matches,
    };
  }
}

function _dotProduct(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return 0n;
  let sum = 0n;
  for (let i = 0; i < a.length; i += 1) {
    const av = typeof a[i] === 'bigint' ? a[i] : BigInt(a[i]);
    const bv = typeof b[i] === 'bigint' ? b[i] : BigInt(b[i]);
    sum = (sum + (av * bv)) % P;
  }
  return sum;
}

module.exports = { HomomorphicDbLookupEngine };
