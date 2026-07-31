'use strict';

/**
 * Model-Routing Optimizer Store — Persisted configuration for
 * intelligent prompt orchestration. Defines model tiers, cost rules,
 * complexity scoring weights, and routing policies that dynamically
 * route requests between public or localized model tiers.
 *
 * @module model-routing-store
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const STORE_PATH =
  process.env.MODEL_ROUTING_STORE_PATH ||
  path.join(process.cwd(), '.simplebeacon', 'model-routing.json');

const DEFAULT_TIERS = [
  {
    id: 'local-fast',
    name: 'Local Fast (Ollama)',
    provider: 'ollama',
    model: 'llama3.2',
    priority: 1,
    maxTokenLength: 4000,
    maxComplexityScore: 30,
    costPer1kTokens: 0,
    avgLatencyMs: 2000,
    enabled: true,
  },
  {
    id: 'local-capable',
    name: 'Local Capable (Ollama)',
    provider: 'ollama',
    model: 'llama3.1:8b',
    priority: 2,
    maxTokenLength: 8000,
    maxComplexityScore: 60,
    costPer1kTokens: 0,
    avgLatencyMs: 5000,
    enabled: true,
  },
  {
    id: 'cloud-fast',
    name: 'Cloud Fast (OpenAI Mini)',
    provider: 'openai',
    model: 'gpt-4o-mini',
    priority: 3,
    maxTokenLength: 8000,
    maxComplexityScore: 50,
    costPer1kTokens: 0.15,
    avgLatencyMs: 1500,
    enabled: true,
  },
  {
    id: 'cloud-capable',
    name: 'Cloud Capable (OpenAI)',
    provider: 'openai',
    model: 'gpt-4o',
    priority: 4,
    maxTokenLength: 32000,
    maxComplexityScore: 80,
    costPer1kTokens: 2.50,
    avgLatencyMs: 3000,
    enabled: true,
  },
  {
    id: 'cloud-premium',
    name: 'Cloud Premium (Anthropic)',
    provider: 'anthropic',
    model: 'claude-3-5-sonnet-20241022',
    priority: 5,
    maxTokenLength: 64000,
    maxComplexityScore: 100,
    costPer1kTokens: 3.00,
    avgLatencyMs: 4000,
    enabled: true,
  },
];

const DEFAULT_ROUTING_CONFIG = {
  enabled: true,
  strategy: 'cost-optimized',
  complexityWeights: {
    codeBlockRatio: 0.3,
    avgWordLength: 0.15,
    questionDepth: 0.2,
    technicalTerms: 0.2,
    messageLength: 0.15,
  },
  tokenEstimateCharsPerToken: 4,
  fallbackTierId: 'cloud-capable',
  costBudgetPerRequest: 0.10,
  latencySlaMs: 10000,
  preferLocalWhenAvailable: true,
};

const DEFAULT_STATS = {
  totalRequests: 0,
  tierDistribution: {},
  totalEstimatedCost: 0,
  avgComplexityScore: 0,
  avgTokenEstimate: 0,
  routingOverrides: 0,
};

let _cache = null;
let _cacheDirty = true;

function readStore() {
  if (_cache && !_cacheDirty) return _cache;
  try {
    if (fs.existsSync(STORE_PATH)) {
      const raw = fs.readFileSync(STORE_PATH, 'utf8');
      _cache = JSON.parse(raw);
      if (!_cache.tiers) _cache.tiers = DEFAULT_TIERS;
      if (!_cache.routing) _cache.routing = DEFAULT_ROUTING_CONFIG;
      if (!_cache.stats) _cache.stats = DEFAULT_STATS;
    } else {
      _cache = {
        tiers: DEFAULT_TIERS,
        routing: DEFAULT_ROUTING_CONFIG,
        stats: DEFAULT_STATS,
      };
    }
  } catch {
    _cache = {
      tiers: DEFAULT_TIERS,
      routing: DEFAULT_ROUTING_CONFIG,
      stats: DEFAULT_STATS,
    };
  }
  _cacheDirty = false;
  return _cache;
}

function writeStore(store) {
  const dir = path.dirname(STORE_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const tmp = STORE_PATH + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(store, null, 2), 'utf8');
  fs.renameSync(tmp, STORE_PATH);
  _cache = store;
  _cacheDirty = false;
}

// ── Tier Management ─────────────────────────────────────────────────────────

function getTiers() {
  return readStore().tiers;
}

function getTier(id) {
  return readStore().tiers.find((t) => t.id === id) || null;
}

function createTier(data) {
  const store = readStore();
  const id = data.id || `tier-${crypto.randomBytes(4).toString('hex')}`;
  if (store.tiers.find((t) => t.id === id)) {
    return { success: false, error: 'Tier ID already exists' };
  }
  const tier = {
    id,
    name: data.name || 'Untitled Tier',
    provider: data.provider || 'ollama',
    model: data.model || '',
    priority: data.priority || store.tiers.length + 1,
    maxTokenLength: data.maxTokenLength || 8000,
    maxComplexityScore: data.maxComplexityScore || 50,
    costPer1kTokens: data.costPer1kTokens || 0,
    avgLatencyMs: data.avgLatencyMs || 3000,
    enabled: data.enabled !== false,
  };
  store.tiers.push(tier);
  writeStore(store);
  return { success: true, tier };
}

function updateTier(id, updates) {
  const store = readStore();
  const tier = store.tiers.find((t) => t.id === id);
  if (!tier) return { success: false, error: 'Tier not found' };
  Object.assign(tier, updates);
  writeStore(store);
  return { success: true, tier };
}

function deleteTier(id) {
  const store = readStore();
  const idx = store.tiers.findIndex((t) => t.id === id);
  if (idx === -1) return { success: false, error: 'Tier not found' };
  const deleted = store.tiers.splice(idx, 1)[0];
  writeStore(store);
  return { success: true, deleted };
}

// ── Routing Config ──────────────────────────────────────────────────────────

function getRoutingConfig() {
  return readStore().routing;
}

function updateRoutingConfig(updates) {
  const store = readStore();
  Object.assign(store.routing, updates);
  writeStore(store);
  return { success: true, routing: store.routing };
}

// ── Complexity Scoring ──────────────────────────────────────────────────────

function estimateTokens(text) {
  const config = getRoutingConfig();
  return Math.ceil((text || '').length / (config.tokenEstimateCharsPerToken || 4));
}

function scoreComplexity(text, messages) {
  const config = getRoutingConfig();
  const weights = config.complexityWeights || {};
  const fullText = [text, ...(messages || []).map((m) => m.content || '')].join(' ');

  if (!fullText || fullText.length === 0) return 0;

  // Code block ratio: how much of the text is inside code blocks
  const codeBlocks = (fullText.match(/```[\s\S]*?```/g) || []).join('');
  const codeBlockRatio = fullText.length > 0 ? codeBlocks.length / fullText.length : 0;

  // Average word length
  const words = fullText.split(/\s+/).filter(Boolean);
  const avgWordLength = words.length > 0
    ? words.reduce((sum, w) => sum + w.length, 0) / words.length
    : 0;

  // Question depth: nested questions or multi-part questions
  const questionMarks = (fullText.match(/\?/g) || []).length;
  const questionDepth = Math.min(questionMarks / 10, 1) * 100;

  // Technical terms density
  const techTerms = [
    'algorithm', 'architecture', 'async', 'authentication', 'authorization',
    'class', 'closure', 'compile', 'concurrency', 'database', 'debug',
    'deploy', 'design', 'distributed', 'encryption', 'framework', 'function',
    'gradient', 'hash', 'index', 'infrastructure', 'inheritance', 'interface',
    'kubernetes', 'latency', 'middleware', 'microservice', 'optimize', 'parse',
    'polymorphism', 'protocol', 'recursion', 'refactor', 'runtime', 'scalability',
    'schema', 'serialization', 'serverless', 'state', 'thread', 'transaction',
    'typescript', 'validation', 'websocket', 'workflow',
  ];
  const lowered = fullText.toLowerCase();
  const techTermCount = techTerms.filter((t) => lowered.includes(t)).length;
  const technicalTerms = Math.min((techTermCount / 15) * 100, 100);

  // Message length factor (normalized)
  const messageLength = Math.min((fullText.length / 5000) * 100, 100);

  // Weighted sum
  const score = Math.round(
    codeBlockRatio * 100 * (weights.codeBlockRatio || 0.3) +
    Math.min(avgWordLength * 10, 100) * (weights.avgWordLength || 0.15) +
    questionDepth * (weights.questionDepth || 0.2) +
    technicalTerms * (weights.technicalTerms || 0.2) +
    messageLength * (weights.messageLength || 0.15)
  );

  return Math.min(Math.max(score, 0), 100);
}

// ── Routing Decision Engine ─────────────────────────────────────────────────

function selectTier(promptText, messages, options) {
  const store = readStore();
  const config = store.routing;

  if (!config.enabled) {
    return {
      routed: false,
      reason: 'Routing disabled',
      tier: null,
      provider: options?.requestedProvider || 'ollama',
      model: options?.requestedModel || null,
      complexityScore: 0,
      tokenEstimate: 0,
    };
  }

  const tokenEstimate = estimateTokens(promptText);
  const complexityScore = scoreComplexity(promptText, messages);

  // Get enabled tiers sorted by priority (ascending = cheapest first)
  const enabledTiers = store.tiers
    .filter((t) => t.enabled)
    .sort((a, b) => a.priority - b.priority);

  if (enabledTiers.length === 0) {
    return {
      routed: false,
      reason: 'No enabled tiers',
      tier: null,
      provider: options?.requestedProvider || 'ollama',
      model: options?.requestedModel || null,
      complexityScore,
      tokenEstimate,
    };
  }

  // Strategy: cost-optimized tries cheapest tier that can handle the request
  // Strategy: quality-optimized tries highest quality tier within budget
  // Strategy: latency-optimized tries fastest tier that can handle the request

  let candidateTiers = enabledTiers.filter(
    (t) => tokenEstimate <= t.maxTokenLength && complexityScore <= t.maxComplexityScore
  );

  if (candidateTiers.length === 0) {
    // No tier can handle it — use fallback
    const fallback = store.tiers.find((t) => t.id === config.fallbackTierId) || enabledTiers[enabledTiers.length - 1];
    return {
      routed: true,
      reason: 'Exceeds all tier limits, using fallback',
      tier: fallback,
      provider: fallback.provider,
      model: fallback.model,
      complexityScore,
      tokenEstimate,
      fallback: true,
    };
  }

  let selected;

  if (config.strategy === 'latency-optimized') {
    selected = candidateTiers.sort((a, b) => a.avgLatencyMs - b.avgLatencyMs)[0];
  } else if (config.strategy === 'quality-optimized') {
    // Highest complexity ceiling = highest quality
    selected = candidateTiers.sort((a, b) => b.maxComplexityScore - a.maxComplexityScore)[0];
  } else {
    // cost-optimized (default): cheapest tier that can handle it
    // Prefer local when available and configured
    if (config.preferLocalWhenAvailable) {
      const localTiers = candidateTiers.filter((t) => t.provider === 'ollama');
      if (localTiers.length > 0) {
        selected = localTiers.sort((a, b) => a.priority - b.priority)[0];
      }
    }
    if (!selected) {
      selected = candidateTiers.sort((a, b) => a.costPer1kTokens - b.costPer1kTokens)[0];
    }
  }

  // Check cost budget
  const estimatedCost = (tokenEstimate / 1000) * selected.costPer1kTokens;
  if (estimatedCost > config.costBudgetPerRequest) {
    // Try to find a cheaper tier
    const cheaperTiers = candidateTiers
      .filter((t) => (tokenEstimate / 1000) * t.costPer1kTokens <= config.costBudgetPerRequest)
      .sort((a, b) => a.costPer1kTokens - b.costPer1kTokens);
    if (cheaperTiers.length > 0) {
      selected = cheaperTiers[0];
    }
  }

  // Check if routing overrides the requested provider/model
  const requestedProvider = options?.requestedProvider;
  const requestedModel = options?.requestedModel;
  const isOverride = requestedProvider && requestedProvider !== selected.provider;

  return {
    routed: true,
    reason: isOverride ? `Routed from ${requestedProvider} to ${selected.provider}` : 'Optimal tier selected',
    tier: selected,
    provider: selected.provider,
    model: selected.model,
    complexityScore,
    tokenEstimate,
    estimatedCost: (tokenEstimate / 1000) * selected.costPer1kTokens,
    override: isOverride,
  };
}

// ── Stats ───────────────────────────────────────────────────────────────────

function recordRoutingDecision(decision) {
  const store = readStore();
  const stats = store.stats;

  stats.totalRequests++;
  stats.avgComplexityScore = Math.round(
    ((stats.avgComplexityScore * (stats.totalRequests - 1)) + decision.complexityScore) / stats.totalRequests
  );
  stats.avgTokenEstimate = Math.round(
    ((stats.avgTokenEstimate * (stats.totalRequests - 1)) + decision.tokenEstimate) / stats.totalRequests
  );

  if (decision.tier) {
    const tierId = decision.tier.id;
    stats.tierDistribution[tierId] = (stats.tierDistribution[tierId] || 0) + 1;
  }

  if (decision.estimatedCost) {
    stats.totalEstimatedCost = Math.round((stats.totalEstimatedCost + decision.estimatedCost) * 10000) / 10000;
  }

  if (decision.override) {
    stats.routingOverrides++;
  }

  writeStore(store);
}

function getStats() {
  return readStore().stats;
}

function resetStats() {
  const store = readStore();
  store.stats = { ...DEFAULT_STATS, tierDistribution: {} };
  writeStore(store);
  return { success: true, stats: store.stats };
}

// ── Test Endpoint ───────────────────────────────────────────────────────────

function testRouting(promptText, messages) {
  const decision = selectTier(promptText, messages, {});
  return {
    success: true,
    complexityScore: decision.complexityScore,
    tokenEstimate: decision.tokenEstimate,
    selectedTier: decision.tier,
    provider: decision.provider,
    model: decision.model,
    reason: decision.reason,
    estimatedCost: decision.estimatedCost || 0,
    fallback: decision.fallback || false,
  };
}

module.exports = {
  getTiers,
  getTier,
  createTier,
  updateTier,
  deleteTier,
  getRoutingConfig,
  updateRoutingConfig,
  selectTier,
  scoreComplexity,
  estimateTokens,
  recordRoutingDecision,
  getStats,
  resetStats,
  testRouting,
};
