'use strict';

/**
 * Semantic Cache Store — Vector-based prompt similarity caching for inference responses
 *
 * Provides:
 *   - Lightweight text vectorization via TF-IDF-style hashing (no external embeddings API needed)
 *   - Cosine similarity matching against cached prompt vectors
 *   - Configurable similarity threshold, TTL, and max cache size
 *   - Per-provider and per-model cache partitioning
 *   - LRU eviction when cache exceeds max entries
 *   - Hit/miss tracking with latency savings stats
 *   - Manual invalidation by pattern, provider, or full flush
 *
 * @module semantic-cache-store
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const logger = require('./app-logger.cjs');

const SIMPLEBEACON_DIR = path.join(process.cwd(), '.simplebeacon');
const STORE_PATH = path.join(SIMPLEBEACON_DIR, 'semantic-cache-config.json');

const DEFAULT_CONFIG = {
  enabled: true,
  similarityThreshold: 0.92,
  ttlMs: 60 * 60 * 1000, // 1 hour
  maxEntries: 1000,
  minPromptLength: 20,
  skipSystemPrompts: true,
  perProviderPartition: true,
  excludedPatterns: [],
};

const VECTOR_DIMENSIONS = 256;
const TERM_BUCKETS = VECTOR_DIMENSIONS;

let _config = null;
let _cacheDirty = true;

// In-memory cache: Map<cacheKey, CacheEntry>
// cacheKey = provider:model:promptHash
const cache = new Map();

// Stats
const stats = {
  hits: 0,
  misses: 0,
  evictions: 0,
  totalSavedLatencyMs: 0,
  totalSavedTokens: 0,
  hitRate: 0,
};

// Access order for LRU (Map preserves insertion order in JS)
// When we access an entry, we delete and re-insert to move it to the end

function readConfig() {
  if (!_cacheDirty) return _config;
  try {
    if (fs.existsSync(STORE_PATH)) {
      _config = { ...DEFAULT_CONFIG, ...JSON.parse(fs.readFileSync(STORE_PATH, 'utf8')) };
    } else {
      _config = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
    }
  } catch {
    _config = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
  }
  _cacheDirty = false;
  return _config;
}

function writeConfig() {
  if (!fs.existsSync(SIMPLEBEACON_DIR)) fs.mkdirSync(SIMPLEBEACON_DIR, { recursive: true });
  const tmp = STORE_PATH + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(_config, null, 2), 'utf8');
  fs.renameSync(tmp, STORE_PATH);
  _cacheDirty = false;
}

function getConfig() {
  return readConfig();
}

function updateConfig(updates) {
  var config = readConfig();
  if (updates.enabled !== undefined) config.enabled = updates.enabled;
  if (updates.similarityThreshold !== undefined) {
    if (updates.similarityThreshold < 0 || updates.similarityThreshold > 1) {
      throw new Error('similarityThreshold must be between 0 and 1');
    }
    config.similarityThreshold = updates.similarityThreshold;
  }
  if (updates.ttlMs !== undefined) config.ttlMs = updates.ttlMs;
  if (updates.maxEntries !== undefined) config.maxEntries = updates.maxEntries;
  if (updates.minPromptLength !== undefined) config.minPromptLength = updates.minPromptLength;
  if (updates.skipSystemPrompts !== undefined) config.skipSystemPrompts = updates.skipSystemPrompts;
  if (updates.perProviderPartition !== undefined) config.perProviderPartition = updates.perProviderPartition;
  if (updates.excludedPatterns !== undefined) config.excludedPatterns = updates.excludedPatterns;
  writeConfig();
  return { success: true, config: config };
}

function resetConfig() {
  _config = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
  writeConfig();
  return { success: true, config: _config };
}

// ── Text Vectorization ───────────────────────────────────────────────────────

/**
 * Tokenize text into normalized lowercase word tokens.
 * Strips punctuation, splits on whitespace, filters short tokens.
 */
function tokenize(text) {
  if (!text || typeof text !== 'string') return [];
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(function (t) { return t.length > 1; });
}

/**
 * Hash a string to an integer in range [0, TERM_BUCKETS).
 * Uses a simple but well-distributed hash.
 */
function hashStr(str) {
  var hash = 0;
  for (var i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % TERM_BUCKETS;
}

/**
 * Vectorize text into a fixed-dimensional TF-IDF-style vector.
 * Uses feature hashing (the hashing trick) to map tokens to dimensions.
 * Each dimension accumulates term frequency weight.
 * The vector is then L2-normalized for cosine similarity computation.
 *
 * @param {string} text
 * @returns {Float32Array} Normalized vector of VECTOR_DIMENSIONS dimensions
 */
function vectorize(text) {
  var vec = new Float32Array(VECTOR_DIMENSIONS);
  var tokens = tokenize(text);
  if (tokens.length === 0) return vec;

  // Count term frequencies via feature hashing
  var tf = {};
  for (var i = 0; i < tokens.length; i++) {
    var bucket = hashStr(tokens[i]);
    tf[bucket] = (tf[bucket] || 0) + 1;
  }

  // Apply sublinear TF scaling (1 + log(tf)) and populate vector
  for (var b in tf) {
    var idx = parseInt(b, 10);
    vec[idx] = 1 + Math.log(tf[b]);
  }

  // L2 normalize
  var norm = 0;
  for (var j = 0; j < VECTOR_DIMENSIONS; j++) {
    norm += vec[j] * vec[j];
  }
  norm = Math.sqrt(norm);
  if (norm > 0) {
    for (var k = 0; k < VECTOR_DIMENSIONS; k++) {
      vec[k] = vec[k] / norm;
    }
  }

  return vec;
}

/**
 * Compute cosine similarity between two L2-normalized vectors.
 * Since vectors are pre-normalized, this is just a dot product.
 */
function cosineSimilarity(vecA, vecB) {
  var dot = 0;
  for (var i = 0; i < VECTOR_DIMENSIONS; i++) {
    dot += vecA[i] * vecB[i];
  }
  return dot;
}

// ── Cache Key Generation ─────────────────────────────────────────────────────

function makeCacheKey(provider, model, promptText) {
  var partition = '';
  var config = readConfig();
  if (config.perProviderPartition) {
    partition = provider + ':' + (model || 'default') + ':';
  }
  var promptHash = crypto.createHash('sha256').update(promptText).digest('hex').slice(0, 16);
  return partition + promptHash;
}

/**
 * Extract the user-facing prompt text from a messages array or string.
 * Concatenates all user messages, skipping system messages if configured.
 */
function extractPromptText(prompt) {
  if (typeof prompt === 'string') return prompt;
  if (!Array.isArray(prompt)) return String(prompt || '');

  var config = readConfig();
  var parts = [];
  for (var i = 0; i < prompt.length; i++) {
    var msg = prompt[i];
    if (!msg || typeof msg !== 'object') continue;
    if (config.skipSystemPrompts && msg.role === 'system') continue;
    if (msg.content) parts.push(String(msg.content));
  }
  return parts.join('\n');
}

// ── Cache Lookup ─────────────────────────────────────────────────────────────

/**
 * Check if a prompt should be excluded from caching based on configured patterns.
 */
function isExcluded(promptText) {
  var config = readConfig();
  if (!config.excludedPatterns || config.excludedPatterns.length === 0) return false;
  for (var i = 0; i < config.excludedPatterns.length; i++) {
    try {
      var pattern = config.excludedPatterns[i];
      if (pattern.startsWith('/') && pattern.lastIndexOf('/') > 0) {
        var regex = new RegExp(pattern.slice(1, pattern.lastIndexOf('/')), pattern.slice(pattern.lastIndexOf('/') + 1));
        if (regex.test(promptText)) return true;
      } else if (promptText.toLowerCase().includes(pattern.toLowerCase())) {
        return true;
      }
    } catch {}
  }
  return false;
}

/**
 * Look up a cached response by semantic similarity.
 * Returns the cached response if a match is found above the similarity threshold,
 * or null if no match or cache is disabled.
 *
 * @param {string} provider — Provider ID (e.g. 'openai', 'anthropic', 'ollama')
 * @param {string} model — Model name (optional)
 * @param {string|Array} prompt — Prompt string or messages array
 * @returns {object|null} Cached response or null
 */
function lookup(provider, model, prompt) {
  var config = readConfig();
  if (!config.enabled) return null;

  var promptText = extractPromptText(prompt);
  if (promptText.length < config.minPromptLength) return null;
  if (isExcluded(promptText)) return null;

  var queryVec = vectorize(promptText);
  var cacheKey = makeCacheKey(provider, model, promptText);
  var now = Date.now();

  // First try exact key match (fast path)
  var exact = cache.get(cacheKey);
  if (exact) {
    if (now - exact.createdAt > config.ttlMs) {
      cache.delete(cacheKey);
      _evict();
    } else {
      // Move to end for LRU
      cache.delete(cacheKey);
      cache.set(cacheKey, exact);
      exact.hitCount++;
      exact.lastAccessedAt = now;
      stats.hits++;
      _updateHitRate();
      logger.debug('[SemanticCache] Exact hit for provider=' + provider);
      return { response: exact.response, similarity: 1.0, cachedAt: exact.createdAt, savedLatencyMs: exact.latencyMs };
    }
  }

  // Semantic similarity search
  var bestMatch = null;
  var bestScore = 0;
  var bestKey = null;

  var entries = Array.from(cache.entries());
  for (var i = 0; i < entries.length; i++) {
    var key = entries[i][0];
    var entry = entries[i][1];

    // Skip expired
    if (now - entry.createdAt > config.ttlMs) {
      cache.delete(key);
      _evict();
      continue;
    }

    // Skip different provider partition if enabled
    if (config.perProviderPartition && entry.provider !== provider) continue;

    var score = cosineSimilarity(queryVec, entry.vector);
    if (score > bestScore) {
      bestScore = score;
      bestMatch = entry;
      bestKey = key;
    }
  }

  if (bestMatch && bestScore >= config.similarityThreshold) {
    // Move to end for LRU
    cache.delete(bestKey);
    cache.set(bestKey, bestMatch);
    bestMatch.hitCount++;
    bestMatch.lastAccessedAt = now;
    stats.hits++;
    stats.totalSavedLatencyMs += bestMatch.latencyMs;
    stats.totalSavedTokens += (bestMatch.tokenCount || 0);
    _updateHitRate();
    logger.info('[SemanticCache] Semantic hit (score=' + bestScore.toFixed(4) + ') for provider=' + provider);
    return { response: bestMatch.response, similarity: bestScore, cachedAt: bestMatch.createdAt, savedLatencyMs: bestMatch.latencyMs };
  }

  stats.misses++;
  _updateHitRate();
  return null;
}

/**
 * Store a response in the cache.
 *
 * @param {string} provider
 * @param {string} model
 * @param {string|Array} prompt
 * @param {object} response — The provider response to cache
 * @param {number} latencyMs — Time taken to generate the response
 * @param {number} [tokenCount] — Number of tokens in the response
 */
function store(provider, model, prompt, response, latencyMs, tokenCount) {
  var config = readConfig();
  if (!config.enabled) return;

  var promptText = extractPromptText(prompt);
  if (promptText.length < config.minPromptLength) return;
  if (isExcluded(promptText)) return;

  var cacheKey = makeCacheKey(provider, model, promptText);
  var vec = vectorize(promptText);

  var entry = {
    key: cacheKey,
    provider: provider,
    model: model || 'default',
    vector: vec,
    promptPreview: promptText.slice(0, 200),
    promptHash: crypto.createHash('sha256').update(promptText).digest('hex').slice(0, 16),
    response: response,
    latencyMs: latencyMs || 0,
    tokenCount: tokenCount || 0,
    hitCount: 0,
    createdAt: Date.now(),
    lastAccessedAt: Date.now(),
  };

  // Enforce max entries with LRU eviction
  while (cache.size >= config.maxEntries) {
    _evictOldest();
  }

  cache.set(cacheKey, entry);
  logger.debug('[SemanticCache] Stored entry for provider=' + provider + ' (cache size=' + cache.size + ')');
}

function _evictOldest() {
  // Map preserves insertion order — first entry is oldest (LRU)
  var firstKey = cache.keys().next().value;
  if (firstKey !== undefined) {
    cache.delete(firstKey);
    stats.evictions++;
  }
}

function _evict() {
  // Clean up expired entries
  var config = readConfig();
  var now = Date.now();
  var toDelete = [];
  cache.forEach(function (entry, key) {
    if (now - entry.createdAt > config.ttlMs) {
      toDelete.push(key);
    }
  });
  for (var i = 0; i < toDelete.length; i++) {
    cache.delete(toDelete[i]);
    stats.evictions++;
  }
}

function _updateHitRate() {
  var total = stats.hits + stats.misses;
  stats.hitRate = total > 0 ? stats.hits / total : 0;
}

// ── Cache Management ─────────────────────────────────────────────────────────

function clearCache() {
  var size = cache.size;
  cache.clear();
  stats.hits = 0;
  stats.misses = 0;
  stats.evictions = 0;
  stats.totalSavedLatencyMs = 0;
  stats.totalSavedTokens = 0;
  stats.hitRate = 0;
  return { success: true, cleared: size };
}

function invalidateByProvider(provider) {
  var count = 0;
  var toDelete = [];
  cache.forEach(function (entry, key) {
    if (entry.provider === provider) {
      toDelete.push(key);
      count++;
    }
  });
  for (var i = 0; i < toDelete.length; i++) {
    cache.delete(toDelete[i]);
  }
  return { success: true, invalidated: count };
}

function invalidateByPattern(pattern) {
  var count = 0;
  var toDelete = [];
  var regex = null;
  try {
    regex = new RegExp(pattern);
  } catch {
    // Fall back to substring match
  }
  cache.forEach(function (entry, key) {
    var matched = false;
    if (regex) {
      matched = regex.test(entry.promptPreview);
    } else {
      matched = entry.promptPreview.toLowerCase().includes(pattern.toLowerCase());
    }
    if (matched) {
      toDelete.push(key);
      count++;
    }
  });
  for (var i = 0; i < toDelete.length; i++) {
    cache.delete(toDelete[i]);
  }
  return { success: true, invalidated: count };
}

function getStats() {
  var config = readConfig();
  _evict(); // Clean expired before reporting

  var entries = Array.from(cache.values());
  var totalEntries = entries.length;
  var byProvider = {};
  var totalHitCount = 0;

  for (var i = 0; i < entries.length; i++) {
    var entry = entries[i];
    byProvider[entry.provider] = (byProvider[entry.provider] || 0) + 1;
    totalHitCount += entry.hitCount;
  }

  return {
    enabled: config.enabled,
    similarityThreshold: config.similarityThreshold,
    ttlMs: config.ttlMs,
    maxEntries: config.maxEntries,
    minPromptLength: config.minPromptLength,
    cacheSize: totalEntries,
    hits: stats.hits,
    misses: stats.misses,
    evictions: stats.evictions,
    hitRate: stats.hitRate,
    totalSavedLatencyMs: stats.totalSavedLatencyMs,
    totalSavedTokens: stats.totalSavedTokens,
    avgSavedLatencyMs: stats.hits > 0 ? Math.round(stats.totalSavedLatencyMs / stats.hits) : 0,
    totalHitCount: totalHitCount,
    byProvider: byProvider,
    vectorDimensions: VECTOR_DIMENSIONS,
    perProviderPartition: config.perProviderPartition,
    excludedPatternsCount: (config.excludedPatterns || []).length,
  };
}

function getEntries(limit) {
  _evict();
  limit = limit || 50;
  var entries = Array.from(cache.values())
    .sort(function (a, b) { return b.lastAccessedAt - a.lastAccessedAt; })
    .slice(0, limit)
    .map(function (e) {
      return {
        key: e.key,
        provider: e.provider,
        model: e.model,
        promptPreview: e.promptPreview,
        promptHash: e.promptHash,
        hitCount: e.hitCount,
        latencyMs: e.latencyMs,
        tokenCount: e.tokenCount,
        createdAt: new Date(e.createdAt).toISOString(),
        lastAccessedAt: new Date(e.lastAccessedAt).toISOString(),
        ageMs: Date.now() - e.createdAt,
      };
    });
  return entries;
}

// ── Test Similarity ──────────────────────────────────────────────────────────

function testSimilarity(textA, textB) {
  var vecA = vectorize(textA);
  var vecB = vectorize(textB);
  var score = cosineSimilarity(vecA, vecB);
  return {
    similarity: score,
    threshold: readConfig().similarityThreshold,
    wouldMatch: score >= readConfig().similarityThreshold,
    tokensA: tokenize(textA).length,
    tokensB: tokenize(textB).length,
  };
}

module.exports = {
  VECTOR_DIMENSIONS: VECTOR_DIMENSIONS,
  getConfig: getConfig,
  updateConfig: updateConfig,
  resetConfig: resetConfig,
  lookup: lookup,
  store: store,
  clearCache: clearCache,
  invalidateByProvider: invalidateByProvider,
  invalidateByPattern: invalidateByPattern,
  getStats: getStats,
  getEntries: getEntries,
  testSimilarity: testSimilarity,
  vectorize: vectorize,
  cosineSimilarity: cosineSimilarity,
  extractPromptText: extractPromptText,
};
