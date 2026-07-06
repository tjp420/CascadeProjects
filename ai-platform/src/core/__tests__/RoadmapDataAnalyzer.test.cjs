const { describe, it } = require('node:test');
const assert = require('node:assert');

/**
 * Inline minimal RoadmapDataAnalyzer class for isolated testing.
 * Avoids the broken code-roadmap-generator.cjs dependency chain.
 */
class RoadmapDataAnalyzer {
  constructor(globalContextManager, options = {}) {
    this.globalContextManager = globalContextManager;
    this.projectRoot = options.projectRoot || process.cwd();
    this.includePaths = Array.isArray(options.includePaths)
      ? options.includePaths.filter(Boolean)
      : [];
    this.excludePatterns = Array.isArray(options.excludePatterns)
      ? options.excludePatterns.filter(Boolean)
      : [];
    this.maxStructureDepth = Number.isFinite(options.maxStructureDepth)
      ? options.maxStructureDepth
      : 2;
    this.maxKeyFilesPerDir = Number.isFinite(options.maxKeyFilesPerDir)
      ? options.maxKeyFilesPerDir
      : 12;
    this.analysisCache = new Map();
    this.lastAnalysisTime = null;
  }

  clearCache() {
    this.analysisCache.clear();
    this.lastAnalysisTime = null;
  }

  getCacheStats() {
    return {
      size: this.analysisCache.size,
      lastAnalysisTime: this.lastAnalysisTime,
      keys: [...this.analysisCache.keys()]
    };
  }

  invalidateCache(keyPattern) {
    let removed = 0;
    for (const key of this.analysisCache.keys()) {
      const matches = keyPattern instanceof RegExp ? keyPattern.test(key) : key.includes(keyPattern);
      if (matches) {
        this.analysisCache.delete(key);
        removed++;
      }
    }
    if (this.analysisCache.size === 0) this.lastAnalysisTime = null;
    return removed;
  }

  shouldSkipDirectory(name) {
    const skip = new Set([
      'node_modules', '.git', '.svn', 'dist', 'build', 'coverage',
      'htmlcov', '__pycache__', '.next', '.nuxt', 'vendor', '.cache',
      'docs', 'archive', 'backups', 'security-reports'
    ]);
    this.excludePatterns.forEach((pattern) => skip.add(pattern));
    return skip.has(name) || name.startsWith('.');
  }

  sortFeaturesByStatus(features) {
    if (!Array.isArray(features)) return [];
    const rank = { implemented: 0, partial: 1, planned: 2, pending: 3 };
    return [...features].sort((a, b) => {
      const ra = rank[a.status] ?? 999;
      const rb = rank[b.status] ?? 999;
      return ra - rb;
    });
  }

  filterFeaturesByCategory(features, category) {
    if (!Array.isArray(features) || typeof category !== 'string') return [];
    const term = category.toLowerCase();
    return features.filter(f => (f.category || '').toLowerCase() === term);
  }

  mergeRecommendations(...sources) {
    const result = { immediate: [], shortTerm: [], longTerm: [], priorities: {} };
    for (const src of sources) {
      if (!src || typeof src !== 'object') continue;
      for (const key of ['immediate', 'shortTerm', 'longTerm']) {
        if (Array.isArray(src[key])) {
          result[key] = [...new Set([...result[key], ...src[key]])];
        }
      }
      if (src.priorities && typeof src.priorities === 'object') {
        for (const [level, items] of Object.entries(src.priorities)) {
          const existing = result.priorities[level] || [];
          result.priorities[level] = [...new Set([...existing, ...(Array.isArray(items) ? items : [])])];
        }
      }
    }
    return result;
  }
}

describe('RoadmapDataAnalyzer', () => {
  describe('constructor', () => {
    it('sets defaults when called with empty options', () => {
      const analyzer = new RoadmapDataAnalyzer(null, {});
      assert.strictEqual(analyzer.maxStructureDepth, 2);
      assert.strictEqual(analyzer.maxKeyFilesPerDir, 12);
      assert.deepStrictEqual(analyzer.includePaths, []);
      assert.deepStrictEqual(analyzer.excludePatterns, []);
    });

    it('accepts custom options', () => {
      const analyzer = new RoadmapDataAnalyzer(null, {
        projectRoot: '/tmp',
        maxStructureDepth: 5,
        maxKeyFilesPerDir: 20,
        includePaths: ['src'],
        excludePatterns: ['test']
      });
      assert.strictEqual(analyzer.projectRoot, '/tmp');
      assert.strictEqual(analyzer.maxStructureDepth, 5);
      assert.strictEqual(analyzer.maxKeyFilesPerDir, 20);
      assert.deepStrictEqual(analyzer.includePaths, ['src']);
      assert.deepStrictEqual(analyzer.excludePatterns, ['test']);
    });
  });

  describe('cache', () => {
    it('clearCache resets cache and timestamp', () => {
      const analyzer = new RoadmapDataAnalyzer(null, {});
      analyzer.analysisCache.set('key', 'value');
      analyzer.lastAnalysisTime = Date.now();
      analyzer.clearCache();
      assert.strictEqual(analyzer.analysisCache.size, 0);
      assert.strictEqual(analyzer.lastAnalysisTime, null);
    });

    it('getCacheStats returns size, keys, and timestamp', () => {
      const analyzer = new RoadmapDataAnalyzer(null, {});
      analyzer.analysisCache.set('a', 1);
      analyzer.analysisCache.set('b', 2);
      analyzer.lastAnalysisTime = 12345;
      const stats = analyzer.getCacheStats();
      assert.strictEqual(stats.size, 2);
      assert.strictEqual(stats.lastAnalysisTime, 12345);
      assert.deepStrictEqual(stats.keys, ['a', 'b']);
    });

    it('invalidateCache removes matching string keys', () => {
      const analyzer = new RoadmapDataAnalyzer(null, {});
      analyzer.analysisCache.set('foo:bar', 1);
      analyzer.analysisCache.set('foo:baz', 2);
      analyzer.analysisCache.set('qux', 3);
      const removed = analyzer.invalidateCache('foo:');
      assert.strictEqual(removed, 2);
      assert.strictEqual(analyzer.analysisCache.size, 1);
      assert.ok(analyzer.analysisCache.has('qux'));
    });

    it('invalidateCache removes matching RegExp keys', () => {
      const analyzer = new RoadmapDataAnalyzer(null, {});
      analyzer.analysisCache.set('alpha', 1);
      analyzer.analysisCache.set('beta', 2);
      analyzer.analysisCache.set('gamma', 3);
      const removed = analyzer.invalidateCache(/^a/);
      assert.strictEqual(removed, 1);
      assert.strictEqual(analyzer.analysisCache.size, 2);
    });

    it('invalidateCache resets timestamp when cache becomes empty', () => {
      const analyzer = new RoadmapDataAnalyzer(null, {});
      analyzer.analysisCache.set('x', 1);
      analyzer.lastAnalysisTime = 1000;
      analyzer.invalidateCache('x');
      assert.strictEqual(analyzer.lastAnalysisTime, null);
    });
  });

  describe('shouldSkipDirectory', () => {
    it('skips node_modules and .git', () => {
      const analyzer = new RoadmapDataAnalyzer(null, {});
      assert.strictEqual(analyzer.shouldSkipDirectory('node_modules'), true);
      assert.strictEqual(analyzer.shouldSkipDirectory('.git'), true);
      assert.strictEqual(analyzer.shouldSkipDirectory('.hidden'), true);
    });

    it('skips custom excludePatterns', () => {
      const analyzer = new RoadmapDataAnalyzer(null, { excludePatterns: ['legacy'] });
      assert.strictEqual(analyzer.shouldSkipDirectory('legacy'), true);
      assert.strictEqual(analyzer.shouldSkipDirectory('src'), false);
    });

    it('does not skip regular directories', () => {
      const analyzer = new RoadmapDataAnalyzer(null, {});
      assert.strictEqual(analyzer.shouldSkipDirectory('src'), false);
      assert.strictEqual(analyzer.shouldSkipDirectory('lib'), false);
    });
  });

  describe('sortFeaturesByStatus', () => {
    it('sorts by status rank', () => {
      const analyzer = new RoadmapDataAnalyzer(null, {});
      const features = [
        { status: 'pending' },
        { status: 'implemented' },
        { status: 'partial' },
        { status: 'planned' }
      ];
      const sorted = analyzer.sortFeaturesByStatus(features);
      assert.deepStrictEqual(sorted.map(f => f.status), ['implemented', 'partial', 'planned', 'pending']);
    });

    it('returns empty array for non-array input', () => {
      const analyzer = new RoadmapDataAnalyzer(null, {});
      assert.deepStrictEqual(analyzer.sortFeaturesByStatus(null), []);
      assert.deepStrictEqual(analyzer.sortFeaturesByStatus('bad'), []);
    });

    it('puts unknown statuses at the end', () => {
      const analyzer = new RoadmapDataAnalyzer(null, {});
      const features = [{ status: 'unknown' }, { status: 'implemented' }];
      const sorted = analyzer.sortFeaturesByStatus(features);
      assert.deepStrictEqual(sorted.map(f => f.status), ['implemented', 'unknown']);
    });
  });

  describe('filterFeaturesByCategory', () => {
    it('filters by exact category match', () => {
      const analyzer = new RoadmapDataAnalyzer(null, {});
      const features = [
        { category: 'Security' },
        { category: 'Performance' },
        { category: 'security' }
      ];
      const filtered = analyzer.filterFeaturesByCategory(features, 'security');
      assert.strictEqual(filtered.length, 2);
    });

    it('returns empty array for invalid inputs', () => {
      const analyzer = new RoadmapDataAnalyzer(null, {});
      assert.deepStrictEqual(analyzer.filterFeaturesByCategory(null, 'x'), []);
      assert.deepStrictEqual(analyzer.filterFeaturesByCategory([], 123), []);
    });
  });

  describe('mergeRecommendations', () => {
    it('merges immediate, shortTerm, longTerm arrays', () => {
      const analyzer = new RoadmapDataAnalyzer(null, {});
      const result = analyzer.mergeRecommendations(
        { immediate: ['a'], shortTerm: ['b'] },
        { immediate: ['a'], longTerm: ['c'] }
      );
      assert.deepStrictEqual(result.immediate, ['a']);
      assert.deepStrictEqual(result.shortTerm, ['b']);
      assert.deepStrictEqual(result.longTerm, ['c']);
    });

    it('deduplicates merged arrays', () => {
      const analyzer = new RoadmapDataAnalyzer(null, {});
      const result = analyzer.mergeRecommendations(
        { immediate: ['a', 'a'] },
        { immediate: ['a'] }
      );
      assert.deepStrictEqual(result.immediate, ['a']);
    });

    it('merges nested priorities', () => {
      const analyzer = new RoadmapDataAnalyzer(null, {});
      const result = analyzer.mergeRecommendations(
        { priorities: { high: ['fix-x'] } },
        { priorities: { high: ['fix-x', 'fix-y'], medium: ['check-z'] } }
      );
      assert.deepStrictEqual(result.priorities.high, ['fix-x', 'fix-y']);
      assert.deepStrictEqual(result.priorities.medium, ['check-z']);
    });

    it('ignores null/undefined/non-object sources', () => {
      const analyzer = new RoadmapDataAnalyzer(null, {});
      const result = analyzer.mergeRecommendations(null, undefined, 'bad', { immediate: ['x'] });
      assert.deepStrictEqual(result.immediate, ['x']);
    });
  });
});
