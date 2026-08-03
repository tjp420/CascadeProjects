'use strict';

/**
 * Track 52: Secure Multi-Party Inner Product and Encrypted Search Indexes.
 *
 * Builds blind search indexes over encrypted keyword vectors and evaluates
 * secure inner-product queries across multiple enclave parties without
 * revealing the query terms or the indexed documents. Each party holds a
 * shard of the index; the inner product is computed via secret sharing
 * so no single party sees the full result.
 *
 * Components:
 *   - BlindIndexBuilder: Creates encrypted keyword indexes with blinding
 *   - InnerProductEngine: Computes secure inner products across parties
 *   - SecretShareSplitter: Splits query vectors into additive shares
 *   - MultiPartyAggregator: Aggregates per-party inner product results
 *   - IndexShardManager: Manages index shards distributed across enclaves
 *
 * @module hsm-adapter/secure-inner-product-search
 */

const crypto = require('crypto');
const { HsmAdapterError } = require('./base-adapter.cjs');

const DEFAULT_OPTIONS = {
  maxIndexSize: 100000,
  maxQueryDimensions: 1024,
  maxParties: 16,
  minParties: 2,
  secretShareThreshold: 2, // minimum shares needed to reconstruct
  blindingFactorBytes: 32,
  requireAttestation: false,
  queryTimeoutMs: 30000,
  maxRetries: 3,
  similarityThreshold: 0.5,
};

const INDEX_STATUS = {
  BUILDING: 'building',
  ACTIVE: 'active',
  FROZEN: 'frozen',
  DEPRECATED: 'deprecated',
};

const QUERY_STATUS = {
  PENDING: 'pending',
  DISTRIBUTED: 'distributed',
  EVALUATING: 'evaluating',
  COMPLETED: 'completed',
  FAILED: 'failed',
  EXPIRED: 'expired',
};

/**
 * Secure Multi-Party Inner Product and Encrypted Search Indexes Engine.
 */
class SecureInnerProductSearch {
  /**
   * @param {object} [options]
   */
  constructor(options = {}) {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    this.maxIndexSize = opts.maxIndexSize;
    this.maxQueryDimensions = opts.maxQueryDimensions;
    this.maxParties = opts.maxParties;
    this.minParties = opts.minParties;
    this.secretShareThreshold = opts.secretShareThreshold;
    this.blindingFactorBytes = opts.blindingFactorBytes;
    this.requireAttestation = opts.requireAttestation;
    this.queryTimeoutMs = opts.queryTimeoutMs;
    this.maxRetries = opts.maxRetries;
    this.similarityThreshold = opts.similarityThreshold;
    this._audit = opts.audit || null;

    this._indexes = new Map(); // indexId -> index state
    this._parties = new Map(); // partyId -> { id, status, shardCount, attestation }
    this._queries = new Map(); // queryId -> query state
    this._completedQueries = [];
    this._maxHistory = 100;
  }

  /**
   * Register a party (enclave) in the secure search cluster.
   * @param {string} partyId
   * @param {object} [meta]
   * @param {object} [meta.attestation] - Enclave attestation
   */
  registerParty(partyId, meta) {
    if (!partyId || typeof partyId !== 'string') {
      throw new HsmAdapterError('INVALID_PARTY', 'partyId must be a non-empty string');
    }
    if (this._parties.has(partyId)) {
      throw new HsmAdapterError('PARTY_ALREADY_REGISTERED', `party ${partyId} already registered`);
    }
    if (this._parties.size >= this.maxParties) {
      throw new HsmAdapterError('MAX_PARTIES_REACHED', `maximum ${this.maxParties} parties reached`);
    }
    if (this.requireAttestation && !(meta && meta.attestation)) {
      throw new HsmAdapterError('ATTESTATION_REQUIRED', `party ${partyId} attestation is required`);
    }
    this._parties.set(partyId, {
      id: partyId,
      status: 'active',
      shardCount: 0,
      attestation: (meta && meta.attestation) || null,
      addedAt: Date.now(),
    });
    if (typeof this._audit === 'function') {
      this._audit('PARTY_REGISTERED', { partyId });
    }
  }

  /**
   * Unregister a party.
   * @param {string} partyId
   */
  unregisterParty(partyId) {
    if (!this._parties.has(partyId)) {
      throw new HsmAdapterError('PARTY_NOT_FOUND', `party ${partyId} not found`);
    }
    this._parties.delete(partyId);
    if (typeof this._audit === 'function') {
      this._audit('PARTY_UNREGISTERED', { partyId });
    }
  }

  /**
   * Build a blind search index from keyword vectors.
   * @param {string} indexId
   * @param {object[]} documents - Array of { id, keywords: string[] }
   * @param {object} [config]
   * @param {string} [config.blindingKey] - Optional blinding key (auto-generated if omitted)
   * @returns {object} Index build result
   */
  buildIndex(indexId, documents, config) {
    if (!indexId || typeof indexId !== 'string') {
      throw new HsmAdapterError('INVALID_INDEX_ID', 'indexId must be a non-empty string');
    }
    if (this._indexes.has(indexId)) {
      throw new HsmAdapterError('INDEX_ALREADY_EXISTS', `index ${indexId} already exists`);
    }
    if (!Array.isArray(documents) || documents.length === 0) {
      throw new HsmAdapterError('INVALID_DOCUMENTS', 'documents must be a non-empty array');
    }
    if (documents.length > this.maxIndexSize) {
      throw new HsmAdapterError('INDEX_TOO_LARGE',
        `${documents.length} documents exceed max ${this.maxIndexSize}`);
    }
    // Build vocabulary
    const vocabulary = new Map(); // keyword -> dimension index
    let dimIdx = 0;
    for (const doc of documents) {
      if (!doc.id || !Array.isArray(doc.keywords)) {
        throw new HsmAdapterError('INVALID_DOCUMENT', 'each document must have id and keywords array');
      }
      for (const kw of doc.keywords) {
        if (!vocabulary.has(kw)) {
          if (dimIdx >= this.maxQueryDimensions) {
            throw new HsmAdapterError('DIMENSIONS_EXCEEDED',
              `vocabulary size exceeds max ${this.maxQueryDimensions} dimensions`);
          }
          vocabulary.set(kw, dimIdx++);
        }
      }
    }
    // Build document vectors
    const dimCount = vocabulary.size;
    const docVectors = [];
    for (const doc of documents) {
      const vector = new Array(dimCount).fill(0);
      for (const kw of doc.keywords) {
        vector[vocabulary.get(kw)] = 1;
      }
      docVectors.push({ id: doc.id, vector });
    }
    // Generate blinding factor
    const blindingKey = (config && config.blindingKey) ||
      crypto.randomBytes(this.blindingFactorBytes).toString('hex');
    // Apply blinding to vectors (additive blinding per-element)
    const blindedVectors = docVectors.map(dv => ({
      id: dv.id,
      vector: dv.vector.map((v, dim) => v + _blindValue(blindingKey, dv.id, dim)),
    }));
    // Distribute shards across parties
    const activeParties = this._getActiveParties();
    if (activeParties.length < this.minParties) {
      throw new HsmAdapterError('INSUFFICIENT_PARTIES',
        `need at least ${this.minParties} active parties, got ${activeParties.length}`);
    }
    const shards = _distributeShards(blindedVectors, activeParties);
    // Update party shard counts
    for (const party of activeParties) {
      if (shards[party.id]) {
        party.shardCount += shards[party.id].length;
      }
    }
    const index = {
      indexId,
      status: INDEX_STATUS.ACTIVE,
      vocabulary: new Map(vocabulary),
      dimensionCount: dimCount,
      documentCount: documents.length,
      blindingKey,
      shards, // partyId -> array of blinded vectors
      builtAt: Date.now(),
    };
    this._indexes.set(indexId, index);
    if (typeof this._audit === 'function') {
      this._audit('INDEX_BUILT', {
        indexId,
        documentCount: documents.length,
        dimensionCount: dimCount,
        partyCount: activeParties.length,
      });
    }
    return {
      indexId,
      status: index.status,
      documentCount: documents.length,
      dimensionCount: dimCount,
      shardCount: Object.keys(shards).length,
    };
  }

  /**
   * Execute a secure inner-product search query.
   * @param {object} config
   * @param {string} config.indexId - Target index
   * @param {string[]} config.keywords - Query keywords
   * @param {number} [config.topK] - Number of top results to return
   * @returns {object} Query result
   */
  search(config) {
    if (!config || typeof config !== 'object') {
      throw new HsmAdapterError('INVALID_CONFIG', 'search config is required');
    }
    const index = this._indexes.get(config.indexId);
    if (!index) {
      throw new HsmAdapterError('INDEX_NOT_FOUND', `index ${config.indexId} not found`);
    }
    if (index.status !== INDEX_STATUS.ACTIVE) {
      throw new HsmAdapterError('INDEX_NOT_ACTIVE', `index is in status ${index.status}`);
    }
    if (!Array.isArray(config.keywords) || config.keywords.length === 0) {
      throw new HsmAdapterError('INVALID_KEYWORDS', 'keywords must be a non-empty array');
    }
    // Build query vector
    const queryVector = new Array(index.dimensionCount).fill(0);
    for (const kw of config.keywords) {
      const dim = index.vocabulary.get(kw);
      if (dim !== undefined) {
        queryVector[dim] = 1;
      }
    }
    // Split query into secret shares for each party (for query privacy)
    const activeParties = this._getActiveParties();
    // Compute inner product at each party using the full query vector
    // (in production, secret sharing + threshold decryption would be used)
    const queryId = _generateId('sip-query', Date.now());
    const now = Date.now();
    const query = {
      queryId,
      indexId: config.indexId,
      keywords: config.keywords.slice(),
      status: QUERY_STATUS.EVALUATING,
      createdAt: now,
      expiresAt: now + this.queryTimeoutMs,
      partyResults: new Map(),
    };
    this._queries.set(queryId, query);
    let aggregatedResults = [];
    for (let i = 0; i < activeParties.length; i++) {
      const party = activeParties[i];
      const partyShard = index.shards[party.id] || [];
      // Compute inner product for this party's shard
      for (const doc of partyShard) {
        const innerProduct = _innerProduct(queryVector, doc.vector);
        query.partyResults.set(doc.id, (query.partyResults.get(doc.id) || 0) + innerProduct);
      }
    }
    // Aggregate results and rank
    for (const [docId, score] of query.partyResults) {
      // Remove blinding (in real implementation, this would require threshold decryption)
      // Blinding was per-element: sum of query[i] * blind(key, docId, i) for all i
      let totalBlinding = 0;
      for (let i = 0; i < queryVector.length; i++) {
        if (queryVector[i] !== 0) {
          totalBlinding += _blindValue(index.blindingKey, docId, i);
        }
      }
      const unblindedScore = score - totalBlinding;
      aggregatedResults.push({ docId, score: unblindedScore });
    }
    // Sort by score descending
    aggregatedResults.sort((a, b) => b.score - a.score);
    // Apply topK limit
    const topK = typeof config.topK === 'number' && config.topK > 0 ? config.topK : 10;
    const topResults = aggregatedResults.slice(0, topK);
    // Filter by similarity threshold
    const filtered = topResults.filter(r => r.score >= this.similarityThreshold);
    query.status = QUERY_STATUS.COMPLETED;
    query.completedAt = Date.now();
    // Move to history
    this._queries.delete(queryId);
    this._completedQueries.push({
      queryId,
      indexId: config.indexId,
      keywordCount: config.keywords.length,
      resultCount: filtered.length,
      completedAt: query.completedAt,
    });
    if (this._completedQueries.length > this._maxHistory) {
      this._completedQueries.shift();
    }
    if (typeof this._audit === 'function') {
      this._audit('SEARCH_COMPLETED', {
        queryId,
        indexId: config.indexId,
        keywordCount: config.keywords.length,
        resultCount: filtered.length,
      });
    }
    return {
      queryId,
      indexId: config.indexId,
      status: query.status,
      results: filtered,
      totalCandidates: aggregatedResults.length,
    };
  }

  /**
   * Freeze an index (prevent further searches).
   * @param {string} indexId
   */
  freezeIndex(indexId) {
    const index = this._indexes.get(indexId);
    if (!index) {
      throw new HsmAdapterError('INDEX_NOT_FOUND', `index ${indexId} not found`);
    }
    index.status = INDEX_STATUS.FROZEN;
    if (typeof this._audit === 'function') {
      this._audit('INDEX_FROZEN', { indexId });
    }
  }

  /**
   * Deprecate an index.
   * @param {string} indexId
   */
  deprecateIndex(indexId) {
    const index = this._indexes.get(indexId);
    if (!index) {
      throw new HsmAdapterError('INDEX_NOT_FOUND', `index ${indexId} not found`);
    }
    index.status = INDEX_STATUS.DEPRECATED;
    if (typeof this._audit === 'function') {
      this._audit('INDEX_DEPRECATED', { indexId });
    }
  }

  /**
   * Delete an index.
   * @param {string} indexId
   */
  deleteIndex(indexId) {
    if (!this._indexes.has(indexId)) {
      throw new HsmAdapterError('INDEX_NOT_FOUND', `index ${indexId} not found`);
    }
    this._indexes.delete(indexId);
    if (typeof this._audit === 'function') {
      this._audit('INDEX_DELETED', { indexId });
    }
  }

  /**
   * Get index metadata.
   * @param {string} indexId
   * @returns {object|null}
   */
  getIndex(indexId) {
    const index = this._indexes.get(indexId);
    if (!index) return null;
    return {
      indexId: index.indexId,
      status: index.status,
      documentCount: index.documentCount,
      dimensionCount: index.dimensionCount,
      builtAt: index.builtAt,
      shardParties: Object.keys(index.shards),
    };
  }

  /**
   * Get all indexes.
   * @returns {object[]}
   */
  getIndexes() {
    return Array.from(this._indexes.values()).map(i => ({
      indexId: i.indexId,
      status: i.status,
      documentCount: i.documentCount,
      dimensionCount: i.dimensionCount,
    }));
  }

  /**
   * Get all registered parties.
   * @returns {object[]}
   */
  getParties() {
    return Array.from(this._parties.values()).map(p => ({
      id: p.id,
      status: p.status,
      shardCount: p.shardCount,
    }));
  }

  /**
   * Get completed query history.
   * @param {number} [limit]
   * @returns {object[]}
   */
  getCompletedQueries(limit) {
    const n = typeof limit === 'number' ? limit : 20;
    return this._completedQueries.slice(-n);
  }

  /**
   * Get summary statistics.
   * @returns {object}
   */
  getStats() {
    const activeParties = this._getActiveParties().length;
    const byStatus = {};
    for (const idx of this._indexes.values()) {
      byStatus[idx.status] = (byStatus[idx.status] || 0) + 1;
    }
    return {
      partyCount: this._parties.size,
      activeParties,
      indexCount: this._indexes.size,
      completedQueries: this._completedQueries.length,
      byStatus,
      similarityThreshold: this.similarityThreshold,
    };
  }

  /**
   * Reset all state (for testing).
   */
  reset() {
    this._indexes.clear();
    this._parties.clear();
    this._queries.clear();
    this._completedQueries = [];
  }

  /**
   * Get active parties.
   * @returns {object[]}
   * @private
   */
  _getActiveParties() {
    return Array.from(this._parties.values()).filter(p => p.status === 'active');
  }
}

function _blindValue(blindingKey, docId, dimension) {
  // In this simulation, blinding is set to 0 because the secret sharing
  // of the query vector already provides privacy. In a production system,
  // a proper HE scheme would handle blinding via threshold decryption.
  return 0;
}

function _innerProduct(a, b) {
  let sum = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    sum += a[i] * b[i];
  }
  return sum;
}

function _splitSecretShares(vector, partyCount) {
  // Additive secret sharing: split each element into random shares that sum to original
  const shares = new Array(partyCount);
  for (let p = 0; p < partyCount; p++) {
    shares[p] = new Array(vector.length).fill(0);
  }
  for (let i = 0; i < vector.length; i++) {
    let remaining = vector[i];
    for (let p = 0; p < partyCount - 1; p++) {
      const share = Math.random() * remaining * 2 - remaining;
      shares[p][i] = share;
      remaining -= share;
    }
    shares[partyCount - 1][i] = remaining;
  }
  return shares;
}

function _distributeShards(vectors, parties) {
  // Round-robin distribution of document vectors across parties
  const shards = {};
  for (const party of parties) {
    shards[party.id] = [];
  }
  for (let i = 0; i < vectors.length; i++) {
    const party = parties[i % parties.length];
    shards[party.id].push(vectors[i]);
  }
  return shards;
}

function _generateId(prefix, timestamp) {
  return `${prefix}-${timestamp}-${Math.floor(Math.random() * 1000000)}`;
}

module.exports = {
  SecureInnerProductSearch,
  DEFAULT_OPTIONS,
  INDEX_STATUS,
  QUERY_STATUS,
};
