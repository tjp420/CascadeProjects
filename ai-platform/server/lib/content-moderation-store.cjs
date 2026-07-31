'use strict';

/**
 * Content Moderation Store — High-speed sentiment analysis and toxicity
 * scoring engine that flags, blocks, or scores offensive or non-compliant
 * speech blocks live in both prompts and responses.
 *
 * Features:
 *   - Lexical toxicity scoring (0-100) using weighted profanity/hate/slur
 *     dictionaries with negation and intensity modifiers
 *   - Sentiment analysis (positive/negative/neutral) with confidence score
 *   - Configurable thresholds for flag/block actions
 *   - Per-category breakdown: profanity, hate_speech, harassment,
 *     threat, sexual, self_harm, spam
 *   - Custom word lists for organization-specific moderation
 *   - Flagged content tracking with stats and audit trail
 *
 * @module content-moderation-store
 */

const fs = require('fs');
const path = require('path');
const logger = require('./app-logger.cjs');

const STORE_PATH =
  process.env.CONTENT_MODERATION_PATH ||
  path.join(process.cwd(), '.simplebeacon', 'content-moderation.json');

// ── Toxicity Lexicons ───────────────────────────────────────────────────────

const PROFANITY_WORDS = new Set([
  'damn', 'hell', 'crap', 'ass', 'bastard', 'bitch', 'bollocks', 'bugger',
  'bollocks', 'bloody', 'bugger', 'git', 'prick', 'wanker', 'twat',
  'arse', 'arsehole', 'dick', 'dickhead', 'jackass', 'jerk', 'moron',
  'idiot', 'stupid', 'dumb', 'retard', 'lame', 'suck', 'sucks',
]);

const HATE_SPEECH_WORDS = new Set([
  'nazi', 'fascist', 'terrorist', 'raghead', 'cameljockey', 'wetback',
  'spic', 'chink', 'gook', 'kike', 'kraut', 'paki', 'tranny', 'sodomite',
  'hebe', 'raghead', 'towelhead', 'porchmonkey', 'junglebunny',
]);

const HARASSMENT_WORDS = new Set([
  'harass', 'stalk', 'intimidate', 'bully', 'torment', 'persecute',
  'hound', 'badger', 'pester', 'molest', 'coerce', 'blackmail',
]);

const THREAT_WORDS = new Set([
  'kill', 'murder', 'assassinate', 'execute', 'behead', 'torture',
  'mutilate', 'slaughter', 'massacre', 'bomb', 'poison', 'strangle',
  'drown', 'burn', 'destroy', 'annihilate', 'exterminate',
]);

const SEXUAL_WORDS = new Set([
  'porn', 'pornography', 'nsfw', 'nude', 'naked', 'explicit',
  'erotic', 'obscene', 'lewd', 'indecent', 'vulgar',
]);

const SELF_HARM_WORDS = new Set([
  'suicide', 'selfharm', 'self-harm', 'cutting', 'overdose',
  'end it all', 'kill myself', 'hurt myself', 'no reason to live',
]);

const SPAM_INDICATORS = new Set([
  'click here', 'free offer', 'limited time', 'act now', 'buy now',
  'subscribe', 'follow me', 'check out my', 'visit my', 'discount',
  'promo code', 'coupon', 'deal', 'bargain', 'best price',
]);

// Intensity modifiers
const INTENSIFIERS = new Set(['very', 'extremely', 'incredibly', 'absolutely', 'totally', 'completely', 'utterly']);
const NEGATORS = new Set(['not', 'no', 'never', 'without', 'hardly', 'barely', 'scarcely']);

// Category weights for overall toxicity score
const CATEGORY_WEIGHTS = {
  profanity: 1.0,
  hate_speech: 3.5,
  harassment: 2.5,
  threat: 3.0,
  sexual: 1.5,
  self_harm: 2.0,
  spam: 0.5,
};

// ── Default Configuration ──────────────────────────────────────────────────

const DEFAULT_CONFIG = {
  enabled: true,
  checkPrompts: true,
  checkResponses: true,
  thresholds: {
    flag: 25,
    block: 70,
    blockHateSpeech: 50,
    blockThreat: 60,
  },
  actions: {
    flag: 'flag',
    block: 'block',
    score: 'score',
  },
  customBlockWords: [],
  customFlagWords: [],
  enabledCategories: {
    profanity: true,
    hate_speech: true,
    harassment: true,
    threat: true,
    sexual: true,
    self_harm: true,
    spam: false,
  },
};

// ── Store State ─────────────────────────────────────────────────────────────

let _config = null;
let _cacheDirty = true;
const _flaggedContent = [];
const MAX_FLAGGED = 500;

function readStore() {
  if (!_cacheDirty) return _config;
  try {
    if (fs.existsSync(STORE_PATH)) {
      const raw = fs.readFileSync(STORE_PATH, 'utf8');
      _config = JSON.parse(raw);
      // Merge with defaults for any missing fields
      _config = { ...DEFAULT_CONFIG, ..._config };
      _config.thresholds = { ...DEFAULT_CONFIG.thresholds, ...(_config.thresholds || {}) };
      _config.enabledCategories = { ...DEFAULT_CONFIG.enabledCategories, ...(_config.enabledCategories || {}) };
    } else {
      _config = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
    }
  } catch {
    _config = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
  }
  _cacheDirty = false;
  return _config;
}

function writeStore() {
  const dir = path.dirname(STORE_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const tmp = STORE_PATH + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(_config, null, 2), 'utf8');
  fs.renameSync(tmp, STORE_PATH);
  _cacheDirty = false;
}

// ── Text Analysis ───────────────────────────────────────────────────────────

function tokenize(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^\w\s'-]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

function analyzeSentiment(text) {
  const tokens = tokenize(text);
  if (tokens.length === 0) return { label: 'neutral', score: 0, confidence: 0 };

  const positiveWords = new Set([
    'good', 'great', 'excellent', 'amazing', 'wonderful', 'fantastic',
    'happy', 'joy', 'love', 'like', 'best', 'awesome', 'perfect',
    'beautiful', 'brilliant', 'outstanding', 'superb', 'delightful',
    'pleased', 'satisfied', 'grateful', 'thank', 'appreciate', 'positive',
    'success', 'win', 'benefit', 'helpful', 'useful', 'improve', 'better',
  ]);
  const negativeWords = new Set([
    'bad', 'terrible', 'awful', 'horrible', 'worst', 'hate', 'dislike',
    'angry', 'sad', 'upset', 'frustrated', 'annoyed', 'disappointed',
    'fail', 'failure', 'lose', 'loss', 'wrong', 'error', 'broken',
    'useless', 'worthless', 'waste', 'poor', 'negative', 'problem',
    'issue', 'bug', 'crash', 'slow', 'difficult', 'hard', 'painful',
  ]);

  let positive = 0;
  let negative = 0;
  let prevWord = '';

  for (const token of tokens) {
    let isPositive = positiveWords.has(token);
    let isNegative = negativeWords.has(token);

    // Check for negation
    if (NEGATORS.has(prevWord)) {
      isPositive = !isPositive && isNegative;
      isNegative = !isNegative && positiveWords.has(token);
      const temp = isPositive;
      isPositive = isNegative;
      isNegative = temp;
    }

    // Check for intensifier
    let multiplier = 1;
    if (INTENSIFIERS.has(prevWord)) multiplier = 1.5;

    if (isPositive) positive += multiplier;
    if (isNegative) negative += multiplier;

    prevWord = token;
  }

  const total = positive + negative;
  if (total === 0) return { label: 'neutral', score: 0, confidence: 0.5 };

  const score = Math.round(((positive - negative) / total) * 100);
  const confidence = Math.round(Math.min(total / tokens.length * 2, 1) * 100) / 100;

  let label = 'neutral';
  if (score > 15) label = 'positive';
  else if (score < -15) label = 'negative';

  return { label, score, confidence };
}

function scoreToxicity(text) {
  const config = readStore();
  const tokens = tokenize(text);
  if (tokens.length === 0) {
    return {
      toxicityScore: 0,
      sentiment: { label: 'neutral', score: 0, confidence: 0 },
      categories: {},
      matchedWords: [],
      verdict: 'allow',
    };
  }

  const categories = {
    profanity: 0,
    hate_speech: 0,
    harassment: 0,
    threat: 0,
    sexual: 0,
    self_harm: 0,
    spam: 0,
  };

  const matchedWords = [];
  let prevWord = '';

  const checkCategory = (category, wordSet, weight) => {
    if (!config.enabledCategories[category]) return;
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      if (wordSet.has(token)) {
        let intensity = 1;
        if (i > 0 && INTENSIFIERS.has(tokens[i - 1])) intensity = 1.5;
        if (i > 0 && NEGATORS.has(tokens[i - 1])) intensity = 0.3; // negation reduces
        categories[category] += weight * intensity;
        matchedWords.push({ word: token, category, intensity });
      }
    }
  };

  checkCategory('profanity', PROFANITY_WORDS, 1.0);
  checkCategory('hate_speech', HATE_SPEECH_WORDS, 3.5);
  checkCategory('harassment', HARASSMENT_WORDS, 2.5);
  checkCategory('threat', THREAT_WORDS, 3.0);
  checkCategory('sexual', SEXUAL_WORDS, 1.5);
  checkCategory('self_harm', SELF_HARM_WORDS, 2.0);
  checkCategory('spam', SPAM_INDICATORS, 0.5);

  // Check custom block words
  if (Array.isArray(config.customBlockWords)) {
    for (const word of config.customBlockWords) {
      if (text.toLowerCase().includes(word.toLowerCase())) {
        categories.hate_speech += 4.0;
        matchedWords.push({ word, category: 'custom_block', intensity: 1 });
      }
    }
  }

  // Check custom flag words
  if (Array.isArray(config.customFlagWords)) {
    for (const word of config.customFlagWords) {
      if (text.toLowerCase().includes(word.toLowerCase())) {
        categories.profanity += 1.5;
        matchedWords.push({ word, category: 'custom_flag', intensity: 1 });
      }
    }
  }

  // Normalize category scores to 0-100
  for (const cat of Object.keys(categories)) {
    categories[cat] = Math.min(100, Math.round(categories[cat] * 10));
  }

  // Compute overall toxicity score (weighted average of active categories)
  let weightedSum = 0;
  let weightTotal = 0;
  for (const [cat, score] of Object.entries(categories)) {
    if (config.enabledCategories[cat]) {
      const weight = CATEGORY_WEIGHTS[cat] || 1;
      weightedSum += score * weight;
      weightTotal += weight;
    }
  }
  const toxicityScore = weightTotal > 0 ? Math.round(weightedSum / weightTotal) : 0;

  // Determine verdict
  const sentiment = analyzeSentiment(text);
  let verdict = 'allow';

  const thresholds = config.thresholds;
  if (categories.hate_speech >= thresholds.blockHateSpeech || categories.threat >= thresholds.blockThreat) {
    verdict = 'block';
  } else if (toxicityScore >= thresholds.block) {
    verdict = 'block';
  } else if (toxicityScore >= thresholds.flag) {
    verdict = 'flag';
  }

  return {
    toxicityScore,
    sentiment,
    categories,
    matchedWords: matchedWords.slice(0, 50),
    verdict,
  };
}

// ── Content Recording ──────────────────────────────────────────────────────

function recordFlaggedContent(entry) {
  try {
    const record = {
      id: `flag-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      timestamp: new Date().toISOString(),
      direction: entry.direction || 'inbound',
      userId: entry.userId || 'anonymous',
      requestId: entry.requestId || '',
      provider: entry.provider || '',
      textPreview: (entry.text || '').substring(0, 500),
      toxicityScore: entry.toxicityScore || 0,
      verdict: entry.verdict || 'flag',
      sentiment: entry.sentiment || null,
      categories: entry.categories || {},
      matchedWords: (entry.matchedWords || []).slice(0, 20),
      action: entry.action || 'flagged',
    };

    _flaggedContent.push(record);
    if (_flaggedContent.length > MAX_FLAGGED) {
      _flaggedContent.shift();
    }

    return { success: true, id: record.id };
  } catch (err) {
    logger.warn('[ContentMod] recordFlaggedContent failed:', err.message);
    return { success: false, error: err.message };
  }
}

// ── Public API ──────────────────────────────────────────────────────────────

function moderateText(text, options = {}) {
  const config = readStore();
  if (!config.enabled) {
    return { verdict: 'allow', toxicityScore: 0, sentiment: null, categories: {}, matchedWords: [], skipped: true };
  }

  const result = scoreToxicity(text);

  if (result.verdict !== 'allow' || result.toxicityScore >= config.thresholds.flag) {
    recordFlaggedContent({
      direction: options.direction || 'inbound',
      userId: options.userId || 'anonymous',
      requestId: options.requestId || '',
      provider: options.provider || '',
      text,
      toxicityScore: result.toxicityScore,
      verdict: result.verdict,
      sentiment: result.sentiment,
      categories: result.categories,
      matchedWords: result.matchedWords,
      action: result.verdict === 'block' ? 'blocked' : 'flagged',
    });
  }

  return result;
}

function getConfig() {
  return readStore();
}

function updateConfig(updates) {
  const config = readStore();
  if (updates.thresholds) {
    config.thresholds = { ...config.thresholds, ...updates.thresholds };
  }
  if (updates.enabledCategories) {
    config.enabledCategories = { ...config.enabledCategories, ...updates.enabledCategories };
  }
  if (updates.customBlockWords !== undefined) {
    config.customBlockWords = updates.customBlockWords;
  }
  if (updates.customFlagWords !== undefined) {
    config.customFlagWords = updates.customFlagWords;
  }
  if (updates.enabled !== undefined) config.enabled = updates.enabled;
  if (updates.checkPrompts !== undefined) config.checkPrompts = updates.checkPrompts;
  if (updates.checkResponses !== undefined) config.checkResponses = updates.checkResponses;
  writeStore();
  return { success: true, config };
}

function resetConfig() {
  _config = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
  writeStore();
  return { success: true, config: _config };
}

function getFlaggedContent(limit = 50, filter = {}) {
  let results = [..._flaggedContent].reverse();
  if (filter.verdict) results = results.filter((r) => r.verdict === filter.verdict);
  if (filter.direction) results = results.filter((r) => r.direction === filter.direction);
  if (filter.userId) results = results.filter((r) => r.userId === filter.userId);
  if (filter.minScore) results = results.filter((r) => r.toxicityScore >= filter.minScore);
  return results.slice(0, limit);
}

function getStats() {
  const total = _flaggedContent.length;
  const blocked = _flaggedContent.filter((r) => r.verdict === 'block').length;
  const flagged = _flaggedContent.filter((r) => r.verdict === 'flag').length;
  const inbound = _flaggedContent.filter((r) => r.direction === 'inbound').length;
  const outbound = _flaggedContent.filter((r) => r.direction === 'outbound').length;

  const categoryStats = {};
  for (const record of _flaggedContent) {
    for (const [cat, score] of Object.entries(record.categories || {})) {
      if (score > 0) {
        categoryStats[cat] = (categoryStats[cat] || 0) + 1;
      }
    }
  }

  const avgToxicity = total > 0
    ? Math.round(_flaggedContent.reduce((sum, r) => sum + r.toxicityScore, 0) / total)
    : 0;

  return {
    total,
    blocked,
    flagged,
    inbound,
    outbound,
    categoryStats,
    avgToxicity,
  };
}

function clearFlagged() {
  _flaggedContent.length = 0;
  return { success: true };
}

module.exports = {
  moderateText,
  scoreToxicity,
  analyzeSentiment,
  getConfig,
  updateConfig,
  resetConfig,
  getFlaggedContent,
  getStats,
  clearFlagged,
};
