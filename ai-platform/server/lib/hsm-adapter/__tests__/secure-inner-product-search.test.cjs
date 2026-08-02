'use strict';

/**
 * Track 52: Secure Multi-Party Inner Product and Encrypted Search Indexes tests.
 */
const {
  SecureInnerProductSearch,
  DEFAULT_OPTIONS,
  INDEX_STATUS,
  QUERY_STATUS,
} = require('../secure-inner-product-search.cjs');
const { HsmAdapterError } = require('../base-adapter.cjs');

describe('Track 52: SecureInnerProductSearch', () => {
  let sip;

  beforeEach(() => {
    sip = new SecureInnerProductSearch({
      minParties: 2,
      maxParties: 10,
      requireAttestation: false,
      similarityThreshold: 0.0,
    });
    // Register parties
    sip.registerParty('p1');
    sip.registerParty('p2');
    sip.registerParty('p3');
  });

  describe('registerParty', () => {
    test('registers a party', () => {
      const parties = sip.getParties();
      expect(parties.length).toBe(3);
    });

    test('rejects empty ID', () => {
      expect(() => sip.registerParty('')).toThrow(HsmAdapterError);
    });

    test('rejects duplicate', () => {
      expect(() => sip.registerParty('p1')).toThrow(HsmAdapterError);
    });

    test('enforces max parties', () => {
      const small = new SecureInnerProductSearch({ minParties: 1, maxParties: 2 });
      small.registerParty('p1');
      small.registerParty('p2');
      expect(() => small.registerParty('p3')).toThrow(HsmAdapterError);
    });

    test('rejects missing attestation when required', () => {
      const strict = new SecureInnerProductSearch({ requireAttestation: true });
      expect(() => strict.registerParty('p1')).toThrow(HsmAdapterError);
    });
  });

  describe('unregisterParty', () => {
    test('removes a party', () => {
      sip.unregisterParty('p3');
      expect(sip.getParties().length).toBe(2);
    });

    test('rejects unknown party', () => {
      expect(() => sip.unregisterParty('unknown')).toThrow(HsmAdapterError);
    });
  });

  describe('buildIndex', () => {
    test('builds an index from documents', () => {
      const result = sip.buildIndex('idx1', [
        { id: 'doc1', keywords: ['apple', 'banana'] },
        { id: 'doc2', keywords: ['banana', 'cherry'] },
        { id: 'doc3', keywords: ['apple', 'cherry'] },
      ]);
      expect(result.indexId).toBe('idx1');
      expect(result.documentCount).toBe(3);
      expect(result.dimensionCount).toBe(3); // apple, banana, cherry
      expect(result.shardCount).toBe(3); // distributed across 3 parties
    });

    test('rejects empty index ID', () => {
      expect(() => sip.buildIndex('', [
        { id: 'doc1', keywords: ['a'] },
      ])).toThrow(HsmAdapterError);
    });

    test('rejects duplicate index', () => {
      sip.buildIndex('idx1', [{ id: 'doc1', keywords: ['a'] }]);
      expect(() => sip.buildIndex('idx1', [{ id: 'doc2', keywords: ['b'] }]))
        .toThrow(HsmAdapterError);
    });

    test('rejects empty documents', () => {
      expect(() => sip.buildIndex('idx1', [])).toThrow(HsmAdapterError);
    });

    test('rejects document without id', () => {
      expect(() => sip.buildIndex('idx1', [{ keywords: ['a'] }])).toThrow(HsmAdapterError);
    });

    test('rejects document without keywords', () => {
      expect(() => sip.buildIndex('idx1', [{ id: 'doc1' }])).toThrow(HsmAdapterError);
    });

    test('rejects insufficient parties', () => {
      const small = new SecureInnerProductSearch({ minParties: 5 });
      small.registerParty('p1');
      expect(() => small.buildIndex('idx1', [{ id: 'doc1', keywords: ['a'] }]))
        .toThrow(HsmAdapterError);
    });
  });

  describe('search', () => {
    test('executes a search query', () => {
      sip.buildIndex('idx1', [
        { id: 'doc1', keywords: ['apple', 'banana'] },
        { id: 'doc2', keywords: ['banana', 'cherry'] },
        { id: 'doc3', keywords: ['apple', 'cherry'] },
      ]);
      const result = sip.search({
        indexId: 'idx1',
        keywords: ['apple'],
        topK: 5,
      });
      expect(result.status).toBe(QUERY_STATUS.COMPLETED);
      expect(result.results.length).toBeGreaterThan(0);
      // doc1 and doc3 should match 'apple'
      const docIds = result.results.map(r => r.docId);
      expect(docIds).toContain('doc1');
      expect(docIds).toContain('doc3');
    });

    test('returns ranked results', () => {
      sip.buildIndex('idx1', [
        { id: 'doc1', keywords: ['apple', 'banana', 'cherry'] },
        { id: 'doc2', keywords: ['apple'] },
        { id: 'doc3', keywords: ['banana'] },
      ]);
      const result = sip.search({
        indexId: 'idx1',
        keywords: ['apple', 'banana', 'cherry'],
        topK: 3,
      });
      // doc1 has all 3 keywords, should rank highest
      expect(result.results[0].docId).toBe('doc1');
    });

    test('respects topK limit', () => {
      sip.buildIndex('idx1', [
        { id: 'doc1', keywords: ['a'] },
        { id: 'doc2', keywords: ['a'] },
        { id: 'doc3', keywords: ['a'] },
        { id: 'doc4', keywords: ['a'] },
        { id: 'doc5', keywords: ['a'] },
      ]);
      const result = sip.search({
        indexId: 'idx1',
        keywords: ['a'],
        topK: 2,
      });
      expect(result.results.length).toBe(2);
    });

    test('rejects unknown index', () => {
      expect(() => sip.search({
        indexId: 'unknown',
        keywords: ['a'],
      })).toThrow(HsmAdapterError);
    });

    test('rejects empty keywords', () => {
      sip.buildIndex('idx1', [{ id: 'doc1', keywords: ['a'] }]);
      expect(() => sip.search({
        indexId: 'idx1',
        keywords: [],
      })).toThrow(HsmAdapterError);
    });

    test('rejects null config', () => {
      expect(() => sip.search(null)).toThrow(HsmAdapterError);
    });

    test('rejects frozen index', () => {
      sip.buildIndex('idx1', [{ id: 'doc1', keywords: ['a'] }]);
      sip.freezeIndex('idx1');
      expect(() => sip.search({
        indexId: 'idx1',
        keywords: ['a'],
      })).toThrow(HsmAdapterError);
    });

    test('returns results for multi-keyword query', () => {
      sip.buildIndex('idx1', [
        { id: 'doc1', keywords: ['apple', 'banana'] },
        { id: 'doc2', keywords: ['banana', 'cherry'] },
        { id: 'doc3', keywords: ['apple', 'cherry', 'banana'] },
      ]);
      const result = sip.search({
        indexId: 'idx1',
        keywords: ['apple', 'banana'],
        topK: 5,
      });
      // doc3 has both apple and banana
      const docIds = result.results.map(r => r.docId);
      expect(docIds).toContain('doc1');
      expect(docIds).toContain('doc3');
    });
  });

  describe('freezeIndex', () => {
    test('freezes an active index', () => {
      sip.buildIndex('idx1', [{ id: 'doc1', keywords: ['a'] }]);
      sip.freezeIndex('idx1');
      const index = sip.getIndex('idx1');
      expect(index.status).toBe(INDEX_STATUS.FROZEN);
    });

    test('rejects unknown index', () => {
      expect(() => sip.freezeIndex('unknown')).toThrow(HsmAdapterError);
    });
  });

  describe('deprecateIndex', () => {
    test('deprecates an index', () => {
      sip.buildIndex('idx1', [{ id: 'doc1', keywords: ['a'] }]);
      sip.deprecateIndex('idx1');
      const index = sip.getIndex('idx1');
      expect(index.status).toBe(INDEX_STATUS.DEPRECATED);
    });

    test('rejects unknown index', () => {
      expect(() => sip.deprecateIndex('unknown')).toThrow(HsmAdapterError);
    });
  });

  describe('deleteIndex', () => {
    test('deletes an index', () => {
      sip.buildIndex('idx1', [{ id: 'doc1', keywords: ['a'] }]);
      sip.deleteIndex('idx1');
      expect(sip.getIndex('idx1')).toBeNull();
    });

    test('rejects unknown index', () => {
      expect(() => sip.deleteIndex('unknown')).toThrow(HsmAdapterError);
    });
  });

  describe('getIndex', () => {
    test('returns index metadata', () => {
      sip.buildIndex('idx1', [{ id: 'doc1', keywords: ['a', 'b'] }]);
      const index = sip.getIndex('idx1');
      expect(index).not.toBeNull();
      expect(index.indexId).toBe('idx1');
      expect(index.documentCount).toBe(1);
      expect(index.dimensionCount).toBe(2);
    });

    test('returns null for unknown index', () => {
      expect(sip.getIndex('unknown')).toBeNull();
    });
  });

  describe('getIndexes', () => {
    test('returns all indexes', () => {
      sip.buildIndex('idx1', [{ id: 'doc1', keywords: ['a'] }]);
      sip.buildIndex('idx2', [{ id: 'doc2', keywords: ['b'] }]);
      expect(sip.getIndexes().length).toBe(2);
    });
  });

  describe('getParties', () => {
    test('returns all parties', () => {
      const parties = sip.getParties();
      expect(parties.length).toBe(3);
      expect(parties[0].id).toBe('p1');
    });
  });

  describe('getCompletedQueries', () => {
    test('returns completed query history', () => {
      sip.buildIndex('idx1', [{ id: 'doc1', keywords: ['a'] }]);
      sip.search({ indexId: 'idx1', keywords: ['a'] });
      expect(sip.getCompletedQueries().length).toBe(1);
    });
  });

  describe('getStats', () => {
    test('returns summary statistics', () => {
      sip.buildIndex('idx1', [{ id: 'doc1', keywords: ['a'] }]);
      const stats = sip.getStats();
      expect(stats.partyCount).toBe(3);
      expect(stats.activeParties).toBe(3);
      expect(stats.indexCount).toBe(1);
    });
  });

  describe('reset', () => {
    test('clears all state', () => {
      sip.buildIndex('idx1', [{ id: 'doc1', keywords: ['a'] }]);
      sip.reset();
      expect(sip.getIndexes().length).toBe(0);
      expect(sip.getParties().length).toBe(0);
    });
  });

  describe('full search flow', () => {
    test('complete build -> search -> rank flow', () => {
      // Build index with 5 documents
      sip.buildIndex('docs', [
        { id: 'd1', keywords: ['machine', 'learning', 'privacy'] },
        { id: 'd2', keywords: ['homomorphic', 'encryption'] },
        { id: 'd3', keywords: ['machine', 'learning', 'encryption'] },
        { id: 'd4', keywords: ['privacy', 'enclave'] },
        { id: 'd5', keywords: ['homomorphic', 'privacy', 'enclave'] },
      ]);
      // Search for 'privacy enclave'
      const result = sip.search({
        indexId: 'docs',
        keywords: ['privacy', 'enclave'],
        topK: 3,
      });
      expect(result.status).toBe(QUERY_STATUS.COMPLETED);
      // d4 and d5 should match both keywords
      const docIds = result.results.map(r => r.docId);
      expect(docIds).toContain('d4');
      expect(docIds).toContain('d5');
      // d4 and d5 both have 2 matching keywords, either can rank first
      expect(['d4', 'd5']).toContain(result.results[0].docId);
      expect(result.results[0].score).toBe(2);
      // Verify stats
      const stats = sip.getStats();
      expect(stats.indexCount).toBe(1);
    });
  });
});
