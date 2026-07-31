/**
 * Offline vector fingerprint matching — Tier 1c enhancement.
 * Maps structural features to precomputed AI-slop behavior vectors.
 */

import fs from 'fs';
import path from 'path';
import { INTENT_RULE_IDS } from './constants.js';

const CACHE_PATH = path.join(
  import.meta.dirname,
  '..',
  'vector-cache',
  'default-fingerprints.json'
);
const ALLOWED_CACHE_ROOT = path.resolve(import.meta.dirname, '..');
const MAX_CACHE_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

let cachedFingerprints = null;

/**
 * Resolve a safe absolute path within ALLOWED_CACHE_ROOT.
 * Rejects paths that escape the allowed root via `..` segments.
 * @param {string} inputPath
 * @returns {string|null}
 */
function resolveSafePath(inputPath) {
  if (!inputPath || typeof inputPath !== 'string') return null;
  const resolved = path.resolve(inputPath);
  const normalizedRoot = path.normalize(ALLOWED_CACHE_ROOT);
  if (!resolved.startsWith(normalizedRoot + path.sep) && resolved !== normalizedRoot) {
    return null;
  }
  return resolved;
}

/**
 * Load fingerprints.
 * @param {string} customPath
 * @returns {any}
 */
function loadFingerprints(customPath) {
  if (cachedFingerprints && !customPath) return cachedFingerprints;

  let cachePath = customPath || CACHE_PATH;
  if (customPath) {
    const safePath = resolveSafePath(customPath);
    if (!safePath) {
      throw new Error('Invalid fingerprint cache path: path traversal detected');
    }
    cachePath = safePath;
  }

  try {
    const stats = fs.statSync(cachePath);
    if (!stats.isFile()) return [];
    if (stats.size > MAX_CACHE_FILE_SIZE) {
      throw new Error('Fingerprint cache file exceeds maximum allowed size');
    }
    const raw = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
    cachedFingerprints = raw.fingerprints || [];
    return cachedFingerprints;
  } catch {
    return [];
  }
}

/**
 * Extract feature vector.
 * @param {any} content
 * @param {Array} structuralFindings
 * @returns {any}
 */
function countMatches(content, pattern) {
  return (content.match(pattern) || []).length;
}

function extractFeatureVector(content, structuralFindings = [], maybeLang) {
  // Backwards compatibility: callers sometimes pass language as second arg
  if (typeof structuralFindings === 'string') {
    maybeLang = structuralFindings;
    structuralFindings = [];
  }
  const text = String(content || '');
  structuralFindings = Array.isArray(structuralFindings) ? structuralFindings : [];
  const genericNames = 'data|result|output|temp|info|val|payload|obj|res';
  const genericAssigns = (text.match(new RegExp(`\\b(${genericNames})\\s*=`, 'gi')) || []).length;
  const tryBlocks = (text.match(/\\btry\\s*[\{:]/g) || []).length;
  const passHandlers = (content.match(/\bpass\b|\bcatch\s*\([^)]*\)\s*\{\s*\}/g) || []).length;
  const literalReturns = (content.match(/\breturn\s+(\{|\[|[\"'`\d])/g) || []).length;
  const genericReturns = (
    content.match(new RegExp(`\\breturn\\s+(${genericNames})\\b`, 'gi')) || []
  ).length;
  const dictAssigns = (content.match(new RegExp(`\\b(${genericNames})\\s*=\\s*\\{`, 'gi')) || [])
    .length;
  const credentialKeys = (content.match(/['"]?(secret|token|pass|key|api_key)['"]?\s*:/gi) || [])
    .length;
  const placeholderVals = (content.match(/your_|changeme|placeholder/gi) || []).length;
  const hollowFindings = structuralFindings.filter((f) => f && f.id === 'SB-INTENT-001').length;
  const credFindings = structuralFindings.filter((f) => f && f.id === 'SB-INTENT-002').length;

  const total = Math.max(content.split('\n').length, 1);
  return [
    Math.min(genericAssigns / total, 1),
    Math.min(credentialKeys / total, 1),
    Math.min(tryBlocks / total, 1),
    Math.min(passHandlers / total, 1),
    Math.min((literalReturns + genericReturns + dictAssigns) / total, 1),
    Math.min(placeholderVals / total, 1),
    Math.min(hollowFindings, 1),
    Math.min(credFindings, 1),
  ];
}

/**
 * Dot product.
 * @param {any} a
 * @param {any} b
 * @returns {any}
 */
function dotProduct(a, b) {
  let sum = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i += 1) {
    sum += a[i] * b[i];
  }
  return sum;
}

/**
 * Magnitude.
 * @param {any} v
 * @returns {any}
 */
function magnitude(v) {
  return Math.sqrt(v.reduce((acc, x) => acc + x * x, 0)) || 1;
}

/**
 * Cosine similarity.
 * @param {any} a
 * @param {any} b
 * @returns {any}
 */
function cosineSimilarity(a, b) {
  return dotProduct(a, b) / (magnitude(a) * magnitude(b));
}

/**
 * Match fingerprints.
 * @param {any} content
 * @param {Array} structuralFindings
 * @param {Object} options
 * @returns {any}
 */
function matchFingerprints(content, structuralFindings = [], options = {}) {
  const fingerprints = loadFingerprints(options.fingerprintCachePath);
  if (!fingerprints.length) return [];

  const features = extractFeatureVector(content, structuralFindings);
  const matches = [];

  for (const fp of fingerprints) {
    const score = cosineSimilarity(features, fp.vector);
    if (score >= (fp.threshold ?? 0.65)) {
      matches.push({
        fingerprintId: fp.id,
        label: fp.label,
        score: Math.round(score * 1000) / 1000,
        features,
      });
    }
  }

  return matches.sort((a, b) => b.score - a.score);
}

/**
 * Fingerprint findings.
 * @param {any} content
 * @param {Array} structuralFindings
 * @param {string} filePath
 * @param {Object} options
 * @returns {any}
 */
function fingerprintFindings(content, structuralFindings, filePath, options = {}) {
  const matches = matchFingerprints(content, structuralFindings, options);

  return matches.map((match) => ({
    id: INTENT_RULE_IDS.FINGERPRINT_MATCH,
    severity: match.score >= 0.8 ? 'medium' : 'low',
    category: 'AI Slop Fingerprint Match',
    type: 'Structural Intent',
    description: `Structural profile matches known AI-slop pattern '${match.label}' (similarity ${match.score}).`,
    filePath,
    line: null,
    pattern: INTENT_RULE_IDS.FINGERPRINT_MATCH,
    metadata: {
      ruleId: INTENT_RULE_IDS.FINGERPRINT_MATCH,
      engine: 'vector-cache',
      fingerprintId: match.fingerprintId,
      similarity: match.score,
    },
  }));
}

export {
  loadFingerprints,
  extractFeatureVector,
  matchFingerprints,
  fingerprintFindings,
  cosineSimilarity,
};
