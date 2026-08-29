"use strict";

/**
 * Semantic Lighthouse — token-sipping structural beacon index for AI agents.
 *
 * Transforms raw codebases into ultra-lightweight "Semantic Beacons"
 * (classes, functions, TODOs, exports, signatures with line numbers)
 * so agents can locate precise logic targets without burning context tokens
 * reading full files.
 *
 * Design principles:
 *   - Offline-first, no source upload, no LLM calls
 *   - Deterministic: same input → same beacons
 *   - Token-sipping: beacon index is ~5-15% of raw file token mass
 *   - Complements the TF-IDF embeddings index (structural vs semantic)
 *
 * Output:
 *   .simplebeacon/beacons/beacon-index.json
 *
 * CLI:
 *   simplebeacon beacon --path .              # generate beacon index
 *   simplebeacon beacon --query "refund bug"  # scan beacons for targets
 *   simplebeacon beacon --query "refund bug" --k 10 --format json
 */

const fs = require("fs");
const path = require("path");
const { walkProject } = require("./project-summarizer");
const { estimateTokens } = require("./token-estimator");

const DEFAULT_BEACONS_DIR = ".simplebeacon/beacons";
const DEFAULT_INDEX_NAME = "beacon-index.json";

// ─── Language-aware structural extraction ───────────────────────────────────

/**
 * Beacon extractor patterns per language category.
 * Each pattern captures a structural anchor without the implementation body.
 */
const BEACON_PATTERNS = {
  javascript: [
    { entity: "class", re: /(?:export\s+)?(?:default\s+)?class\s+([A-Za-z_$][\w$]*)/g, type: "structural_anchor" },
    { entity: "function", re: /(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(([^)]*)\)/g, type: "functional_target" },
    { entity: "arrow_function", re: /(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?\(([^)]*)\)\s*=>/g, type: "functional_target" },
    { entity: "method", re: /^\s*(?:async\s+)?([A-Za-z_$][\w$]*)\s*\(([^)]*)\)\s*{/gm, type: "functional_target" },
    { entity: "TODO", re: /(?:\/\/|#)\s*(TODO|FIXME|BUG|HACK|XXX)[:\s]*(.*)/gi, type: "intent_beacon" },
    { entity: "export", re: /export\s+(?:const|let|var|function|class|default)\s+([A-Za-z_$][\w$]*)/g, type: "export_beacon" },
  ],
  python: [
    { entity: "class", re: /^(\s*)class\s+([A-Za-z_][\w]*)\s*(?:\(([^)]*)\))?\s*:/gm, type: "structural_anchor", nameGroup: 2 },
    { entity: "function", re: /^(\s*)(?:async\s+)?def\s+([A-Za-z_][\w]*)\s*\(([^)]*)\)/gm, type: "functional_target", nameGroup: 2 },
    { entity: "TODO", re: /#\s*(TODO|FIXME|BUG|HACK|XXX)[:\s]*(.*)/gi, type: "intent_beacon" },
    { entity: "decorator", re: /^(\s*)@([A-Za-z_][\w.]*)/gm, type: "decorator_beacon", nameGroup: 2 },
  ],
  typescript: [
    { entity: "class", re: /(?:export\s+)?(?:default\s+)?(?:abstract\s+)?class\s+([A-Za-z_$][\w$]*)/g, type: "structural_anchor" },
    { entity: "interface", re: /(?:export\s+)?interface\s+([A-Za-z_$][\w$]*)\s*(?:extends\s+[^{]+)?\s*\{/g, type: "type_anchor" },
    { entity: "type", re: /(?:export\s+)?type\s+([A-Za-z_$][\w$]*)\s*=/g, type: "type_anchor" },
    { entity: "function", re: /(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*<[^>]*>?\s*\(([^)]*)\)/g, type: "functional_target" },
    { entity: "arrow_function", re: /(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?\(([^)]*)\)\s*=>/g, type: "functional_target" },
    { entity: "method", re: /^\s*(?:async\s+|static\s+|public\s+|private\s+|protected\s+)*([A-Za-z_$][\w$]*)\s*\(([^)]*)\)\s*:/gm, type: "functional_target" },
    { entity: "TODO", re: /(?:\/\/|#)\s*(TODO|FIXME|BUG|HACK|XXX)[:\s]*(.*)/gi, type: "intent_beacon" },
    { entity: "export", re: /export\s+(?:const|let|var|function|class|default|interface|type|enum)\s+([A-Za-z_$][\w$]*)/g, type: "export_beacon" },
    { entity: "enum", re: /(?:export\s+)?(?:const\s+)?enum\s+([A-Za-z_$][\w$]*)/g, type: "type_anchor" },
  ],
  go: [
    { entity: "struct", re: /type\s+([A-Za-z_]\w*)\s+struct\s*\{/g, type: "structural_anchor" },
    { entity: "interface", re: /type\s+([A-Za-z_]\w*)\s+interface\s*\{/g, type: "type_anchor" },
    { entity: "function", re: /func\s+(?:\([^)]*\)\s+)?([A-Za-z_]\w*)\s*\(([^)]*)\)/g, type: "functional_target" },
    { entity: "TODO", re: /\/\/\s*(TODO|FIXME|BUG|HACK|XXX)[:\s]*(.*)/gi, type: "intent_beacon" },
  ],
  rust: [
    { entity: "struct", re: /(?:pub\s+)?struct\s+([A-Za-z_]\w*)/g, type: "structural_anchor" },
    { entity: "trait", re: /(?:pub\s+)?trait\s+([A-Za-z_]\w*)/g, type: "type_anchor" },
    { entity: "function", re: /(?:pub\s+)?(?:async\s+)?fn\s+([A-Za-z_]\w*)\s*\(([^)]*)\)/g, type: "functional_target" },
    { entity: "impl", re: /impl(?:<[^>]*>)?\s+([A-Za-z_]\w]*)/g, type: "structural_anchor" },
    { entity: "TODO", re: /\/\/\s*(TODO|FIXME|BUG|HACK|XXX)[:\s]*(.*)/gi, type: "intent_beacon" },
  ],
  java: [
    { entity: "class", re: /(?:public|private|protected)?\s*(?:abstract\s+)?class\s+([A-Za-z_]\w*)/g, type: "structural_anchor" },
    { entity: "interface", re: /(?:public|private)?\s*interface\s+([A-Za-z_]\w*)/g, type: "type_anchor" },
    { entity: "method", re: /(?:public|private|protected|static)\s+[\w<>\[\]]+\s+([A-Za-z_]\w*)\s*\(([^)]*)\)\s*\{/g, type: "functional_target" },
    { entity: "TODO", re: /\/\/\s*(TODO|FIXME|BUG|HACK|XXX)[:\s]*(.*)/gi, type: "intent_beacon" },
  ],
  ruby: [
    { entity: "class", re: /class\s+([A-Za-z_]\w*)(?:\s*<\s*([A-Za-z_]\w*))?/g, type: "structural_anchor" },
    { entity: "method", re: /def\s+([A-Za-z_]\w*)\s*(?:\(([^)]*)\))?/g, type: "functional_target" },
    { entity: "module", re: /module\s+([A-Za-z_]\w*)/g, type: "structural_anchor" },
    { entity: "TODO", re: /#\s*(TODO|FIXME|BUG|HACK|XXX)[:\s]*(.*)/gi, type: "intent_beacon" },
  ],
  csharp: [
    { entity: "class", re: /(?:public|private|internal|protected)?\s*(?:abstract\s+|sealed\s+|static\s+)*class\s+([A-Za-z_]\w*)/g, type: "structural_anchor" },
    { entity: "interface", re: /(?:public|private|internal)?\s*interface\s+([A-Za-z_]\w*)/g, type: "type_anchor" },
    { entity: "method", re: /(?:public|private|protected|static|virtual|override)\s+[\w<>\[\]]+\s+([A-Za-z_]\w*)\s*\(([^)]*)\)/g, type: "functional_target" },
    { entity: "TODO", re: /\/\/\s*(TODO|FIXME|BUG|HACK|XXX)[:\s]*(.*)/gi, type: "intent_beacon" },
  ],
  php: [
    { entity: "class", re: /(?:final\s+|abstract\s+)?class\s+([A-Za-z_]\w*)/g, type: "structural_anchor" },
    { entity: "function", re: /function\s+([A-Za-z_]\w*)\s*\(([^)]*)\)/g, type: "functional_target" },
    { entity: "TODO", re: /(?:\/\/|#)\s*(TODO|FIXME|BUG|HACK|XXX)[:\s]*(.*)/gi, type: "intent_beacon" },
  ],
  shell: [
    { entity: "function", re: /(?:function\s+)?([A-Za-z_]\w*)\s*\(\)\s*\{/g, type: "functional_target" },
    { entity: "TODO", re: /#\s*(TODO|FIXME|BUG|HACK|XXX)[:\s]*(.*)/gi, type: "intent_beacon" },
  ],
  sql: [
    { entity: "table", re: /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([A-Za-z_]\w*)/gi, type: "structural_anchor" },
    { entity: "function", re: /CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+([A-Za-z_]\w*)/gi, type: "functional_target" },
    { entity: "procedure", re: /CREATE\s+(?:OR\s+REPLACE\s+)?PROCEDURE\s+([A-Za-z_]\w*)/gi, type: "functional_target" },
  ],
};

// Extension → language mapping
const EXTENSION_LANG_MAP = {
  ".js": "javascript",
  ".jsx": "javascript",
  ".mjs": "javascript",
  ".cjs": "javascript",
  ".ts": "typescript",
  ".tsx": "typescript",
  ".mts": "typescript",
  ".cts": "typescript",
  ".py": "python",
  ".go": "go",
  ".rs": "rust",
  ".java": "java",
  ".rb": "ruby",
  ".cs": "csharp",
  ".php": "php",
  ".sh": "shell",
  ".bash": "shell",
  ".zsh": "shell",
  ".sql": "sql",
};

/**
 * Get the language category for a file extension.
 * @param {string} ext - File extension (e.g. ".js", ".py")
 * @returns {string|null} Language key or null if unsupported
 */
function getLanguageForExt(ext) {
  return EXTENSION_LANG_MAP[ext.toLowerCase()] || null;
}

// ─── Beacon generation ──────────────────────────────────────────────────────

/**
 * Generate beacons for a single file's content.
 * @param {string} filepath - Relative path for labeling
 * @param {string} content - Raw file content
 * @param {string} [languageOverride] - Force a language (e.g. "javascript")
 * @returns {{beacons: Array, fileTokens: number, beaconTokens: number}}
 */
function generateBeacons(filepath, content, languageOverride) {
  const ext = path.extname(filepath);
  const lang = languageOverride || getLanguageForExt(ext);
  if (!lang || !BEACON_PATTERNS[lang]) {
    return { beacons: [], fileTokens: estimateTokens(content), beaconTokens: 0 };
  }

  const patterns = BEACON_PATTERNS[lang];
  const beacons = [];
  const seen = new Set(); // dedup by (entity:name:line)

  for (const pattern of patterns) {
    pattern.re.lastIndex = 0;
    let match;
    while ((match = pattern.re.exec(content)) !== null) {
      const fullMatch = match[0];
      const line = computeLineNumber(content, match.index);
      const nameGroup = pattern.nameGroup || 1;
      const name = match[nameGroup] || fullMatch.trim().slice(0, 60);
      // For intent beacons (TODO/FIXME/BUG), use the captured keyword as entity
      const entity = pattern.type === "intent_beacon" && match[1]
        ? match[1].toUpperCase()
        : pattern.entity;
      const dedupKey = `${entity}:${name}:${line}`;

      if (seen.has(dedupKey)) continue;
      seen.add(dedupKey);

      // Extract a compact signature (first line of the match, trimmed)
      const signature = fullMatch.split("\n")[0].trim().slice(0, 120);

      beacons.push({
        type: pattern.type,
        entity,
        name,
        line,
        signature,
        tokenWeight: Math.max(1, Math.ceil(signature.length / 4)),
      });
    }
  }

  // Sort beacons by line number
  beacons.sort((a, b) => a.line - b.line);

  const fileTokens = estimateTokens(content);
  const beaconTokens = beacons.reduce((sum, b) => sum + b.tokenWeight, 0);

  return { beacons, fileTokens, beaconTokens };
}

/**
 * Compute the 1-based line number for a character index.
 * @param {string} content
 * @param {number} charIndex
 * @returns {number}
 */
function computeLineNumber(content, charIndex) {
  let line = 1;
  for (let i = 0; i < charIndex && i < content.length; i++) {
    if (content[i] === "\n") line++;
  }
  return line;
}

// ─── Project-wide beacon index ──────────────────────────────────────────────

/**
 * Generate a beacon index for an entire project.
 * @param {string} rootDir - Project root directory
 * @param {Object} [options]
 * @param {number} [options.maxFiles=20000]
 * @returns {Promise<{index: Object, outputDir: string}>}
 */
async function generateBeaconIndex(rootDir, options = {}) {
  const root = path.resolve(rootDir);
  const outputDir = path.join(root, DEFAULT_BEACONS_DIR);
  const files = await walkProject(root, { maxFiles: options.maxFiles || 20000 });

  const fileEntries = [];
  let totalFileTokens = 0;
  let totalBeaconTokens = 0;
  let totalBeacons = 0;

  for (const file of files) {
    const lang = getLanguageForExt(file.ext);
    if (!lang) continue; // skip unsupported file types

    let content;
    try {
      content = fs.readFileSync(file.absPath, "utf8");
    } catch {
      continue;
    }

    const { beacons, fileTokens, beaconTokens } = generateBeacons(
      file.relPath,
      content,
      lang,
    );

    if (beacons.length === 0) continue;

    totalFileTokens += fileTokens;
    totalBeaconTokens += beaconTokens;
    totalBeacons += beacons.length;

    fileEntries.push({
      file: file.relPath,
      language: lang,
      beaconCount: beacons.length,
      fileTokens,
      beaconTokens,
      beacons,
    });
  }

  const index = {
    generatedAt: new Date().toISOString(),
    projectRoot: root,
    summary: {
      filesIndexed: fileEntries.length,
      totalBeacons,
      totalFileTokens,
      totalBeaconTokens,
      tokenReductionPct:
        totalFileTokens > 0
          ? Math.round(((totalFileTokens - totalBeaconTokens) / totalFileTokens) * 10000) / 100
          : 0,
    },
    files: fileEntries,
  };

  // Write index to disk
  fs.mkdirSync(outputDir, { recursive: true });
  const indexPath = path.join(outputDir, DEFAULT_INDEX_NAME);
  fs.writeFileSync(indexPath, JSON.stringify(index, null, 2));

  return { index, outputDir };
}

// ─── Beacon scan (low-cost search) ──────────────────────────────────────────

/**
 * Scan the beacon index for targets matching a query.
 * This is the "low-cost scan" — it only examines beacon signatures,
 * not raw file content. Designed for a cheap model to run.
 *
 * @param {Object} index - Beacon index from generateBeaconIndex()
 * @param {string} query - Search intent (e.g. "refund bug fixme")
 * @param {Object} [options]
 * @param {number} [options.k=10] - Max results to return
 * @param {string[]} [options.entityFilter] - Only include these entity types
 * @returns {Array<Object>} Matched coordinates sorted by relevance
 */
function scanBeacons(index, query, options = {}) {
  const k = options.k || 10;
  const entityFilter = options.entityFilter
    ? new Set(options.entityFilter)
    : null;
  const queryTerms = query
    .toLowerCase()
    .split(/[\s,._\-\/]+/)
    .filter((t) => t.length > 1);

  if (queryTerms.length === 0) return [];

  const results = [];

  for (const fileEntry of index.files || []) {
    for (const beacon of fileEntry.beacons || []) {
      // Skip if entity filter is set and this entity isn't included
      if (entityFilter && !entityFilter.has(beacon.entity)) continue;

      // Build searchable text from beacon metadata
      const searchableText = `${beacon.name} ${beacon.signature} ${beacon.entity} ${beacon.type}`.toLowerCase();

      // Score: count how many query terms match
      let score = 0;
      const matchedTerms = [];
      for (const term of queryTerms) {
        if (searchableText.includes(term)) {
          score++;
          matchedTerms.push(term);
        }
      }

      if (score > 0) {
        // Boost intent beacons (TODO/FIXME/BUG) — they're high-value targets
        if (beacon.type === "intent_beacon") score += 2;

        // Boost structural anchors (classes) slightly — they're navigation hubs
        if (beacon.type === "structural_anchor") score += 0.5;

        results.push({
          targetFile: fileEntry.file,
          targetLine: beacon.line,
          entityName: beacon.name,
          entityType: beacon.entity,
          beaconType: beacon.type,
          signature: beacon.signature,
          score,
          matchedTerms,
          estimatedSavedTokens: fileEntry.fileTokens - beacon.tokenWeight,
        });
      }
    }
  }

  // Sort by score (desc), then by saved tokens (desc)
  results.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return (b.estimatedSavedTokens || 0) - (a.estimatedSavedTokens || 0);
  });

  return results.slice(0, k);
}

// ─── Index persistence helpers ──────────────────────────────────────────────

/**
 * Default path for the beacon index.
 * @param {string} rootDir
 * @returns {string}
 */
function defaultIndexPath(rootDir) {
  return path.join(rootDir, DEFAULT_BEACONS_DIR, DEFAULT_INDEX_NAME);
}

/**
 * Load a beacon index from disk.
 * @param {string} indexPath
 * @returns {Object} Parsed beacon index
 */
function loadIndex(indexPath) {
  const raw = fs.readFileSync(indexPath, "utf8");
  return JSON.parse(raw);
}

/**
 * Save a beacon index to disk.
 * @param {Object} index
 * @param {string} indexPath
 */
function saveIndex(index, indexPath) {
  fs.mkdirSync(path.dirname(indexPath), { recursive: true });
  fs.writeFileSync(indexPath, JSON.stringify(index, null, 2));
}

module.exports = {
  generateBeacons,
  generateBeaconIndex,
  scanBeacons,
  loadIndex,
  saveIndex,
  defaultIndexPath,
  getLanguageForExt,
  BEACON_PATTERNS,
  EXTENSION_LANG_MAP,
  DEFAULT_BEACONS_DIR,
  DEFAULT_INDEX_NAME,
};
