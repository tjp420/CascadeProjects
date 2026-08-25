/**
 * Deterministic fuzzy content matching for file merger analysis.
 * Uses token Jaccard and line-hash Jaccard — no model inference.
 */

const fs = require("fs");
const crypto = require("crypto");
const path = require("path");
const { buildSemanticHints } = require("./llama-cpp-hints.cjs");
const {
  isDistinctCanonicalRoadmapPair,
} = require("./canonical-roadmap-files.cjs");

const constants = require("../config/constants.cjs");
const DEFAULT_FUZZY_THRESHOLD = 0.85;
const MAX_FUZZY_PAIRS = 16;
const MAX_PATTERN_GROUPS = 12;
const MAX_CONTENT_BYTES = constants.TIMEOUT_2M;

/**
 * Normalize audit relative path.
 * @param {string} relativePath
 * @returns {any}
 */
function normalizeAuditRelativePath(relativePath) {
  const rel = String(relativePath || "").replace(/\\/g, "/");
  const marker = "ai-platform/";
  const idx = rel.indexOf(marker);
  if (idx >= 0) return rel.slice(idx + marker.length);
  return rel;
}

/**
 * Is known generated artifact pair.
 * @param {string} fileA
 * @param {string} fileB
 * @returns {any}
 */
function isKnownGeneratedArtifactPair(fileA, fileB) {
  const relA = normalizeAuditRelativePath(fileA);
  const relB = normalizeAuditRelativePath(fileB);
  /**
   * Is generated simplebeacon json.
   * @param {any} rel
   * @returns {any}
   */
  const isGeneratedSimplebeaconJson = (rel) =>
    rel.includes(".simplebeacon/") && rel.endsWith(".json");
  if (isGeneratedSimplebeaconJson(relA) && isGeneratedSimplebeaconJson(relB))
    return true;
  if (
    relA.endsWith(".simplebeacon/consolidation-report.json") &&
    relB.endsWith(".simplebeacon/consolidation-report.json")
  ) {
    return true;
  }
  return false;
}

/** CI workflow step log placeholders (often empty) — not merge candidates. */
function isCiLogFragmentPath(relativePath) {
  const rel = normalizeAuditRelativePath(relativePath);
  return /^docs\/\d+-(?:stdout|stderr|stdout-stderr)(?:-\d+)?\.txt$/i.test(rel);
}

/**
 * Is ci log fragment pair.
 * @param {string} fileA
 * @param {string} fileB
 * @returns {any}
 */
function isCiLogFragmentPair(fileA, fileB) {
  return isCiLogFragmentPath(fileA) && isCiLogFragmentPath(fileB);
}

/**
 * Has chunk loader for pattern.
 * @param {Array} files
 * @param {any} patternKey
 * @returns {any}
 */
function hasChunkLoaderForPattern(files, patternKey) {
  const normalizedPattern = normalizeAuditRelativePath(patternKey);
  const loaderName = path.basename(normalizedPattern);
  return files.some((file) => {
    const rel = normalizeAuditRelativePath(
      file.relativePath || file.path || "",
    );
    return rel === normalizedPattern || rel.endsWith(`/${loaderName}`);
  });
}

/**
 * Normalize for fuzzy.
 * @param {any} content
 * @returns {any}
 */
function normalizeForFuzzy(content) {
  return String(content || "")
    .replace(/\/\/.*$/gm, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, constants.TIMEOUT_8S);
}

/**
 * Token jaccard similarity.
 * @param {any} a
 * @param {any} b
 * @returns {any}
 */
function tokenJaccardSimilarity(a, b) {
  if (a === b) return 1;
  if (!a.length || !b.length) return 0;
  const tokensA = new Set(a.split(/\W+/).filter((t) => t.length > 2));
  const tokensB = new Set(b.split(/\W+/).filter((t) => t.length > 2));
  if (!tokensA.size || !tokensB.size) return 0;
  let intersection = 0;
  for (const token of tokensA) {
    if (tokensB.has(token)) intersection += 1;
  }
  const union = new Set([...tokensA, ...tokensB]).size;
  return union ? intersection / union : 0;
}

/**
 * Line hash jaccard similarity.
 * @param {any} a
 * @param {any} b
 * @returns {any}
 */
function lineHashJaccardSimilarity(a, b) {
  /**
   * Hash lines.
   * @param {string} text
   * @returns {any}
   */
  const hashLines = (text) =>
    new Set(
      String(text || "")
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) =>
          crypto.createHash("sha256").update(line).digest("hex").slice(0, 12),
        ),
    );
  const linesA = hashLines(a);
  const linesB = hashLines(b);
  if (!linesA.size || !linesB.size) return 0;
  let intersection = 0;
  for (const hash of linesA) {
    if (linesB.has(hash)) intersection += 1;
  }
  const union = new Set([...linesA, ...linesB]).size;
  return union ? intersection / union : 0;
}

/**
 * Combined similarity.
 * @param {any} a
 * @param {any} b
 * @returns {any}
 */
function combinedSimilarity(a, b) {
  const tokenScore = tokenJaccardSimilarity(a, b);
  const lineScore = lineHashJaccardSimilarity(a, b);
  return Math.max(tokenScore, lineScore);
}

/**
 * Load file content.
 * @param {string} file
 * @returns {any}
 */
function loadFileContent(file) {
  try {
    if (file.size > MAX_CONTENT_BYTES) return null;
    return fs.readFileSync(file.path, "utf8");
  } catch {
    return null;
  }
}

/**
 * Find fuzzy near duplicates.
 * @param {Array} files
 * @param {Object} options
 * @returns {any}
 */
function findFuzzyNearDuplicates(files, options = {}) {
  const threshold = options.threshold ?? DEFAULT_FUZZY_THRESHOLD;
  const extensions = new Set(
    options.extensions || [".js", ".json", ".txt", ".md", ".html", ".css"],
  );
  const scoped = files
    .filter(
      (f) =>
        extensions.has(f.ext) &&
        f.size >= 100 &&
        f.size <= MAX_CONTENT_BYTES &&
        !String(f.relativePath || "").includes("/archive/") &&
        !String(f.relativePath || "").includes("/.simplebeacon/archive/") &&
        !isCiLogFragmentPath(f.relativePath || f.path || ""),
    )
    .slice(0, options.maxFiles ?? 120);

  const loaded = [];
  for (const file of scoped) {
    const raw = loadFileContent(file);
    if (!raw) continue;
    loaded.push({ file, normalized: normalizeForFuzzy(raw), raw });
  }

  const pairs = [];
  for (let i = 0; i < loaded.length; i++) {
    for (let j = i + 1; j < loaded.length; j++) {
      if (loaded[i].file.path === loaded[j].file.path) continue;
      const fileA = loaded[i].file.relativePath || loaded[i].file.name;
      const fileB = loaded[j].file.relativePath || loaded[j].file.name;
      if (isKnownGeneratedArtifactPair(fileA, fileB)) continue;
      if (isCiLogFragmentPair(fileA, fileB)) continue;
      if (isDistinctCanonicalRoadmapPair(fileA, fileB)) continue;
      const tokenScore = tokenJaccardSimilarity(
        loaded[i].normalized,
        loaded[j].normalized,
      );
      const lineScore = lineHashJaccardSimilarity(loaded[i].raw, loaded[j].raw);
      const similarity = Math.max(tokenScore, lineScore);
      if (similarity < threshold) continue;
      if (loaded[i].normalized === loaded[j].normalized) continue;
      pairs.push({
        fileA: loaded[i].file.relativePath || loaded[i].file.name,
        fileB: loaded[j].file.relativePath || loaded[j].file.name,
        similarity: Math.round(similarity * 1000) / constants.MS_PER_SECOND,
        tokenJaccard: Math.round(tokenScore * 1000) / constants.MS_PER_SECOND,
        lineHashJaccard: Math.round(lineScore * 1000) / constants.MS_PER_SECOND,
        method: lineScore >= tokenScore ? "line-hash-jaccard" : "token-jaccard",
        recommendation: "Near-duplicate content — review before merge",
      });
    }
  }

  return pairs
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, MAX_FUZZY_PAIRS);
}

/**
 * Pattern key.
 * @param {string} relativePath
 * @returns {any}
 */
function patternKey(relativePath) {
  const normalized = String(relativePath || "").replace(/\\/g, "/");
  const base = path.basename(normalized);
  const dir = path.dirname(normalized);
  const partMatch = base.match(/^(.+)\.part(\d+)\.([^.]+)$/);
  if (partMatch) {
    return `${dir}/${partMatch[1]}.${partMatch[3]}`;
  }
  const numbered = base.match(/^(.+?)[-_](\d+)\.([^.]+)$/);
  if (numbered) {
    return `${dir}/${numbered[1]}.${numbered[3]}`;
  }
  const sampleSuffix = base.match(/^(.+)-sample\.json$/i);
  if (sampleSuffix) {
    return `${dir}/${sampleSuffix[1]}.json`;
  }
  return null;
}

/**
 * Find pattern consolidation candidates.
 * @param {Array} files
 * @returns {any}
 */
function findPatternConsolidationCandidates(files) {
  const groups = new Map();
  for (const file of files) {
    const key = patternKey(file.relativePath || file.path);
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(file);
  }

  const recommendations = [];
  for (const [pattern, members] of groups.entries()) {
    if (members.length < 2) continue;
    const allPartFiles = members.every((f) => /\.part\d+\./i.test(f.name));
    if (allPartFiles && hasChunkLoaderForPattern(files, pattern)) continue;
    const totalBytes = members.reduce((sum, f) => sum + (f.size || 0), 0);
    recommendations.push({
      id: `pattern-${recommendations.length + 1}`,
      pattern,
      type: "pattern-consolidation",
      fileCount: members.length,
      files: members.map((f) => ({
        path: f.relativePath || f.name,
        name: f.name,
        sizeBytes: f.size,
      })),
      totalSizeBytes: totalBytes,
      recommendation: members.some((f) => /\.part\d+\./i.test(f.name))
        ? "Multi-part split detected — consider single module or lazy-loaded chunks"
        : "Similar naming pattern — review for consolidation",
      risk: "medium",
      effort: "medium",
    });
  }

  return recommendations
    .sort((a, b) => b.totalSizeBytes - a.totalSizeBytes)
    .slice(0, MAX_PATTERN_GROUPS);
}

/**
 * Build fuzzy merge candidates.
 * @param {Array} fuzzyPairs
 * @param {Array} formatBytes
 * @returns {any}
 */
function buildFuzzyMergeCandidates(fuzzyPairs, formatBytes) {
  return fuzzyPairs.map((pair, index) => ({
    id: `fuzzy-near-dup-${index + 1}`,
    mergeType: "fuzzy-near-duplicate",
    similarity: pair.similarity,
    confidence: pair.similarity,
    method: pair.method,
    files: [
      { path: pair.fileA, name: path.basename(pair.fileA), sizeBytes: 0 },
      { path: pair.fileB, name: path.basename(pair.fileB), sizeBytes: 0 },
    ],
    savingsBytes: 0,
    savingsLabel: formatBytes ? formatBytes(0) : "—",
    risk: pair.similarity >= 0.95 ? "medium" : "medium-high",
    effort: "medium",
    recommendation: pair.recommendation,
    mergeStrategy: "manual-merge-review",
    scores: {
      tokenJaccard: pair.tokenJaccard,
      lineHashJaccard: pair.lineHashJaccard,
    },
  }));
}

/**
 * Build advanced analysis.
 * @param {Array} files
 * @param {Object} options
 * @returns {any}
 */
function buildAdvancedAnalysis(files, options = {}) {
  const threshold = options.threshold ?? DEFAULT_FUZZY_THRESHOLD;
  const fuzzyPairs = findFuzzyNearDuplicates(files, { ...options, threshold });
  const patternConsolidation = findPatternConsolidationCandidates(files);
  const semanticHints = buildSemanticHints(fuzzyPairs, options);

  return {
    fuzzyNearDuplicates: {
      threshold,
      pairsFound: fuzzyPairs.length,
      pairs: fuzzyPairs,
    },
    patternConsolidation: {
      groupsFound: patternConsolidation.length,
      recommendations: patternConsolidation,
    },
    semanticHints,
  };
}

module.exports = {
  normalizeForFuzzy,
  tokenJaccardSimilarity,
  lineHashJaccardSimilarity,
  combinedSimilarity,
  findFuzzyNearDuplicates,
  findPatternConsolidationCandidates,
  buildAdvancedAnalysis,
  buildFuzzyMergeCandidates,
  isCiLogFragmentPath,
  isCiLogFragmentPair,
  DEFAULT_FUZZY_THRESHOLD,
  MAX_FUZZY_PAIRS,
};
