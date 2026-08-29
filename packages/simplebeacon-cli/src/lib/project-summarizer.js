"use strict";

/**
 * Project Summarizer — deterministic, offline per-file summaries + repo index.
 *
 * Walks a project, extracts high-signal facts (exports, signatures, classes,
 * top-level constants, dependencies) without an LLM, and writes:
 *   - .simplebeacon/summaries/<rel-path>.json  per-file summary
 *   - .simplebeacon/summaries/index.json       repo-wide index
 *
 * The summaries are designed to replace sending whole files to a model:
 * retrieval picks candidate files via the index, then only the relevant
 * summary + a small snippet is sent.
 */

const fs = require("fs");
const path = require("path");
const { getExtensionCategory } = require("./file-types");
const { estimateTokens } = require("./token-estimator");

const DEFAULT_SUMMARIES_DIR = ".simplebeacon/summaries";
const DEFAULT_INDEX_NAME = "index.json";

const DEFAULT_SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  "coverage",
  ".next",
  ".nuxt",
  ".cache",
  ".turbo",
  ".simplebeacon",
  "vendor",
  ".venv",
  "__pycache__",
  ".pytest_cache",
]);

const DEFAULT_MAX_FILE_BYTES = 256 * 1024; // skip files larger than 256KB
const DEFAULT_MAX_FILES = 20000;

/**
 * Walk a project root and yield file metadata records.
 * @param {string} rootDir
 * @param {Object} [options]
 * @param {Set<string>} [options.skipDirs]
 * @param {number} [options.maxFileBytes]
 * @param {number} [options.maxFiles]
 * @returns {Promise<Array<{absPath: string, relPath: string, ext: string, size: number, mtimeMs: number}>>}
 */
async function walkProject(rootDir, options = {}) {
  const skipDirs = options.skipDirs || DEFAULT_SKIP_DIRS;
  const maxFileBytes = options.maxFileBytes ?? DEFAULT_MAX_FILE_BYTES;
  const maxFiles = options.maxFiles ?? DEFAULT_MAX_FILES;
  const root = path.resolve(rootDir);
  const out = [];
  const stack = [{ dir: root, depth: 0 }];
  const visited = new Set();
  while (stack.length > 0) {
    const { dir, depth } = stack.pop();
    if (depth > 60 || out.length >= maxFiles) continue;
    let real;
    try {
      real = fs.realpathSync(dir);
    } catch {
      continue;
    }
    if (visited.has(real)) continue;
    visited.add(real);
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (entry.name.startsWith(".") && entry.name !== "." && entry.name !== "..") {
        // allow dotfiles but skip dotdirs in skipDirs
      }
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (skipDirs.has(entry.name)) continue;
        stack.push({ dir: full, depth: depth + 1 });
      } else if (entry.isFile()) {
        let stat;
        try {
          stat = fs.statSync(full);
        } catch {
          continue;
        }
        if (stat.size > maxFileBytes) continue;
        out.push({
          absPath: full,
          relPath: path.relative(root, full).replace(/\\/g, "/"),
          ext: path.extname(entry.name).toLowerCase(),
          size: stat.size,
          mtimeMs: stat.mtimeMs,
        });
        if (out.length >= maxFiles) break;
      }
    }
  }
  return out;
}

/**
 * Produce a deterministic summary for a single file.
 * @param {{absPath: string, relPath: string, ext: string, size: number, mtimeMs: number}} fileRec
 * @returns {Promise<Object>} summary record
 */
async function summarizeFile(fileRec) {
  let content = "";
  try {
    content = fs.readFileSync(fileRec.absPath, "utf8");
  } catch {
    content = "";
  }
  const tokenEstimate = estimateTokens(content, { filePath: fileRec.absPath });
  const category = getExtensionCategory(fileRec.ext) || inferCategory(fileRec.ext);
  const facts = extractFacts(content, fileRec.ext);
  const lines = content ? content.split("\n").length : 0;
  return {
    path: fileRec.relPath,
    ext: fileRec.ext,
    category,
    sizeBytes: fileRec.size,
    lines,
    tokenEstimate,
    mtimeMs: fileRec.mtimeMs,
    summary: buildOneLineSummary(fileRec, facts, content),
    exports: facts.exports,
    signatures: facts.signatures,
    classes: facts.classes,
    topConstants: facts.topConstants,
    dependencies: facts.dependencies,
  };
}

/**
 * Extract high-signal facts from source text (JS/TS-first, best-effort elsewhere).
 * @param {string} content
 * @param {string} ext
 * @returns {{exports: string[], signatures: string[], classes: string[], topConstants: string[], dependencies: string[]}}
 */
function extractFacts(content, ext) {
  if (!content) {
    return { exports: [], signatures: [], classes: [], topConstants: [], dependencies: [] };
  }
  const isJsLike = [".js", ".ts", ".jsx", ".tsx", ".cjs", ".mjs", ".vue", ".svelte"].includes(ext);
  if (isJsLike) return extractJsFacts(content);
  if (ext === ".py") return extractPyFacts(content);
  return extractGenericFacts(content);
}

function extractJsFacts(content) {
  const exports = [];
  const signatures = [];
  const classes = [];
  const topConstants = [];
  const dependencies = [];

  const exportRe = /export\s+(?:default\s+)?(?:async\s+)?(?:function\s*\*?\s*|class\s+|const\s+|let\s+|var\s+)([A-Za-z0-9_$]+)/g;
  let m;
  while ((m = exportRe.exec(content)) !== null) exports.push(m[1]);

  const fnRe = /(?:^|\n)\s*(?:export\s+)?(?:async\s+)?function\s*\*?\s*([A-Za-z0-9_$]+)\s*\(([^)]*)\)/g;
  while ((m = fnRe.exec(content)) !== null) {
    signatures.push(`${m[1]}(${m[2].trim()})`);
  }
  const arrowRe = /(?:^|\n)\s*(?:export\s+)?(?:const|let|var)\s+([A-Za-z0-9_$]+)\s*=\s*(?:async\s*)?\(([^)]*)\)\s*=>/g;
  while ((m = arrowRe.exec(content)) !== null) {
    signatures.push(`${m[1]}(${m[2].trim()})`);
  }

  const classRe = /(?:^|\n)\s*(?:export\s+)?class\s+([A-Za-z0-9_$]+)/g;
  while ((m = classRe.exec(content)) !== null) classes.push(m[1]);

  const constRe = /(?:^|\n)\s*(?:export\s+)?const\s+([A-Z_][A-Z0-9_]{2,})\s*=/g;
  while ((m = constRe.exec(content)) !== null && topConstants.length < 20) {
    topConstants.push(m[1]);
  }

  const importRe = /(?:import\s+.*?\s+from\s+|require\s*\(\s*)['"]([^'"]+)['"]/g;
  while ((m = importRe.exec(content)) !== null && dependencies.length < 40) {
    dependencies.push(m[1]);
  }

  return {
    exports: dedupe(exports).slice(0, 30),
    signatures: dedupe(signatures).slice(0, 30),
    classes: dedupe(classes).slice(0, 20),
    topConstants: dedupe(topConstants).slice(0, 20),
    dependencies: dedupe(dependencies).slice(0, 40),
  };
}

function extractPyFacts(content) {
  const signatures = [];
  const classes = [];
  const topConstants = [];
  const fnRe = /(?:^|\n)\s*def\s+([A-Za-z0-9_]+)\s*\(([^)]*)\)/g;
  let m;
  while ((m = fnRe.exec(content)) !== null) signatures.push(`${m[1]}(${m[2].trim()})`);
  const classRe = /(?:^|\n)\s*class\s+([A-Za-z0-9_]+)/g;
  while ((m = classRe.exec(content)) !== null) classes.push(m[1]);
  const constRe = /(?:^|\n)\s*([A-Z_][A-Z0-9_]{2,})\s*=/g;
  while ((m = constRe.exec(content)) !== null && topConstants.length < 20) {
    topConstants.push(m[1]);
  }
  const importRe = /(?:^|\n)\s*(?:import|from)\s+([A-Za-z0-9_.]+)/g;
  const dependencies = [];
  while ((m = importRe.exec(content)) !== null && dependencies.length < 40) {
    dependencies.push(m[1]);
  }
  return {
    exports: [],
    signatures: dedupe(signatures).slice(0, 30),
    classes: dedupe(classes).slice(0, 20),
    topConstants: dedupe(topConstants).slice(0, 20),
    dependencies: dedupe(dependencies).slice(0, 40),
  };
}

function extractGenericFacts(content) {
  // For unknown file types, capture headings / section markers.
  const headings = [];
  const re = /(?:^|\n)\s*(?:#{1,6}\s+|\/\/\s*|\/\*\s*)(.+?)(?:\n|$)/g;
  let m;
  while ((m = re.exec(content)) !== null && headings.length < 20) {
    headings.push(m[1].trim().slice(0, 80));
  }
  return {
    exports: [],
    signatures: headings,
    classes: [],
    topConstants: [],
    dependencies: [],
  };
}

function buildOneLineSummary(fileRec, facts, content) {
  const parts = [];
  if (facts.classes.length) parts.push(`classes: ${facts.classes.slice(0, 3).join(", ")}`);
  if (facts.signatures.length) parts.push(`fns: ${facts.signatures.slice(0, 3).join(", ")}`);
  if (facts.exports.length) parts.push(`exports: ${facts.exports.slice(0, 4).join(", ")}`);
  if (facts.dependencies.length) parts.push(`deps: ${facts.dependencies.slice(0, 4).join(", ")}`);
  if (parts.length) return parts.join(" | ");
  // Fallback: first non-trivial line.
  const firstLine = (content || "")
    .split("\n")
    .map((l) => l.trim())
    .find((l) => l && !/^\s*(\/\/|#|\/\*|\*|<!)/.test(l));
  return firstLine ? firstLine.slice(0, 120) : `(empty or binary) ${fileRec.relPath}`;
}

function inferCategory(ext) {
  if (!ext) return "unknown";
  if ([".md", ".markdown", ".txt", ".rst"].includes(ext)) return "docs";
  if ([".json", ".yaml", ".yml", ".toml", ".ini", ".env"].includes(ext)) return "config";
  if ([".html", ".htm", ".css", ".scss"].includes(ext)) return "markup";
  return "other";
}

function dedupe(arr) {
  return Array.from(new Set(arr));
}

/**
 * Build the repo-wide index from per-file summaries.
 * @param {Array<Object>} summaries
 * @returns {Object}
 */
function buildIndex(summaries) {
  const byCategory = {};
  let totalTokens = 0;
  let totalLines = 0;
  let totalBytes = 0;
  for (const s of summaries) {
    const cat = s.category || "other";
    if (!byCategory[cat]) byCategory[cat] = { count: 0, tokens: 0 };
    byCategory[cat].count += 1;
    byCategory[cat].tokens += s.tokenEstimate;
    totalTokens += s.tokenEstimate;
    totalLines += s.lines;
    totalBytes += s.sizeBytes;
  }
  return {
    generatedAt: new Date().toISOString(),
    fileCount: summaries.length,
    totalTokens,
    totalLines,
    totalBytes,
    byCategory,
    files: summaries.map((s) => ({
      path: s.path,
      ext: s.ext,
      category: s.category,
      tokens: s.tokenEstimate,
      lines: s.lines,
      summary: s.summary,
    })),
  };
}

/**
 * Run the full summarize pipeline for a project root.
 *
 * @param {string} rootDir
 * @param {Object} [options]
 * @param {string} [options.outputDir]  Defaults to <root>/.simplebeacon/summaries
 * @param {Set<string>} [options.skipDirs]
 * @param {number} [options.maxFileBytes]
 * @param {number} [options.maxFiles]
 * @param {boolean} [options.writeFiles]  Write per-file JSON (default true)
 * @returns {Promise<{index: Object, summaries: Array<Object>, outputDir: string}>}
 */
async function summarizeProject(rootDir, options = {}) {
  const root = path.resolve(rootDir);
  const outputDir = options.outputDir
    ? path.resolve(options.outputDir)
    : path.join(root, DEFAULT_SUMMARIES_DIR);
  const writeFiles = options.writeFiles !== false;

  const files = await walkProject(root, options);
  const summaries = [];
  for (const fileRec of files) {
    const summary = await summarizeFile(fileRec);
    summaries.push(summary);
  }
  summaries.sort((a, b) => b.tokenEstimate - a.tokenEstimate);
  const index = buildIndex(summaries);

  if (writeFiles) {
    try {
      fs.mkdirSync(outputDir, { recursive: true });
    } catch {
      /* ignore */
    }
    for (const s of summaries) {
      const safeName = s.path.replace(/[^A-Za-z0-9._-]/g, "_") + ".json";
      try {
        fs.writeFileSync(path.join(outputDir, safeName), JSON.stringify(s, null, 2));
      } catch {
        /* skip unwritable */
      }
    }
    try {
      fs.writeFileSync(path.join(outputDir, DEFAULT_INDEX_NAME), JSON.stringify(index, null, 2));
    } catch {
      /* ignore */
    }
  }

  return { index, summaries, outputDir };
}

module.exports = {
  DEFAULT_SUMMARIES_DIR,
  DEFAULT_INDEX_NAME,
  DEFAULT_SKIP_DIRS,
  walkProject,
  summarizeFile,
  summarizeProject,
  buildIndex,
  extractFacts,
};
