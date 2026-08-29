"use strict";

/**
 * Embeddings Index — deterministic, offline TF-IDF + LSH vectors.
 *
 * No external model dependency. Tokenizes passages into terms, builds a
 * corpus-wide IDF table, and represents each passage as a sparse TF-IDF
 * vector hashed into a fixed-dimensional space via locality-sensitive
 * hashing (random projection). Cosine similarity over the hashed vectors
 * approximates TF-IDF cosine similarity.
 *
 * This is intentionally a lightweight retrieval index — it will not match
 * a neural embedding model on semantic similarity, but it is deterministic,
 * offline, zero-dependency, and good enough to find "which files talk
 * about X" without sending anything to a model.
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const DEFAULT_INDEX_DIR = ".simplebeacon/embeddings";
const DEFAULT_INDEX_NAME = "emb.db.json";
const DEFAULT_DIMENSIONS = 256;
const DEFAULT_MAX_PASSAGE_CHARS = 1200;
const DEFAULT_OVERLAP = 200;

/**
 * Tokenize text into lowercase term frequencies.
 * Splits on non-alphanumeric runs and keeps identifiers (camelCase / snake_case).
 * @param {string} text
 * @returns {Map<string, number>}
 */
function tokenize(text) {
  const tokens = new Map();
  if (!text) return tokens;
  // Split into word-ish runs, then split camelCase.
  const raw = text.split(/[^a-zA-Z0-9]+/);
  for (let r of raw) {
    if (!r) continue;
    // Split camelCase boundaries: fooBar -> foo, bar (before lowercasing)
    const parts = r.replace(/([a-z0-9])([A-Z])/g, "$1 $2").toLowerCase().split(/\s+/);
    for (const p of parts) {
      if (!p || p.length < 2) continue;
      if (/^\d+$/.test(p)) continue; // drop pure numbers
      tokens.set(p, (tokens.get(p) || 0) + 1);
    }
  }
  return tokens;
}

/**
 * Deterministic random projection matrix row for a term.
 * Uses a seeded hash so the same term always maps to the same projection.
 * @param {string} term
 * @param {number} dimensions
 * @returns {Float32Array}
 */
function projectTerm(term, dimensions) {
  const vec = new Float32Array(dimensions);
  // Seed a PRNG from a hash of the term for determinism.
  const seed = crypto.createHash("sha256").update(term).digest();
  let state = seed.readUInt32BE(0) >>> 0;
  for (let i = 0; i < dimensions; i++) {
    // xorshift32
    state ^= state << 13; state >>>= 0;
    state ^= state >>> 17;
    state ^= state << 5; state >>>= 0;
    // Map to {-1, +1}.
    vec[i] = (state & 1) ? 1 : -1;
  }
  return vec;
}

/**
 * Build a TF-IDF + LSH vector for a passage given an IDF map.
 * @param {string} passage
 * @param {Map<string, number>} idf  term -> idf weight
 * @param {number} dimensions
 * @returns {{vector: Float32Array, terms: Map<string, number>}}
 */
function embedPassage(passage, idf, dimensions) {
  const terms = tokenize(passage);
  const vector = new Float32Array(dimensions);
  for (const [term, tf] of terms) {
    const w = tf * (idf.get(term) || 1.0);
    const proj = projectTerm(term, dimensions);
    for (let i = 0; i < dimensions; i++) {
      vector[i] += proj[i] * w;
    }
  }
  // L2 normalize.
  let norm = 0;
  for (let i = 0; i < dimensions; i++) norm += vector[i] * vector[i];
  norm = Math.sqrt(norm);
  if (norm > 0) {
    for (let i = 0; i < dimensions; i++) vector[i] /= norm;
  }
  return { vector, terms };
}

/**
 * Compute cosine similarity between two vectors.
 * @param {Float32Array} a
 * @param {Float32Array} b
 * @returns {number}
 */
function cosineSimilarity(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  return dot; // already L2-normalized
}

/**
 * Split a file's content into overlapping passages.
 * @param {string} content
 * @param {Object} [options]
 * @param {number} [options.maxChars]
 * @param {number} [options.overlap]
 * @returns {Array<{text: string, startLine: number, endLine: number}>}
 */
function splitPassages(content, options = {}) {
  const maxChars = options.maxChars ?? DEFAULT_MAX_PASSAGE_CHARS;
  const overlap = options.overlap ?? DEFAULT_OVERLAP;
  if (!content) return [];
  const lines = content.split("\n");
  const passages = [];
  let buf = [];
  let bufLen = 0;
  let startLine = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Hard-chunk a single line that exceeds maxChars on its own.
    if (line.length > maxChars) {
      if (buf.length > 0) {
        passages.push({ text: buf.join("\n"), startLine, endLine: i - 1 });
        buf = [];
        bufLen = 0;
      }
      for (let s = 0; s < line.length; s += maxChars) {
        passages.push({
          text: line.slice(s, s + maxChars),
          startLine: i,
          endLine: i,
        });
      }
      startLine = i + 1;
      continue;
    }
    if (bufLen + line.length + 1 > maxChars && buf.length > 0) {
      passages.push({
        text: buf.join("\n"),
        startLine,
        endLine: i - 1,
      });
      // Roll back overlap chars.
      let kept = [];
      let keptLen = 0;
      for (let j = buf.length - 1; j >= 0; j--) {
        if (keptLen + buf[j].length > overlap) break;
        kept.unshift(buf[j]);
        keptLen += buf[j].length + 1;
      }
      buf = kept;
      bufLen = keptLen;
      startLine = i - kept.length;
    }
    buf.push(line);
    bufLen += line.length + 1;
  }
  if (buf.length > 0) {
    passages.push({
      text: buf.join("\n"),
      startLine,
      endLine: lines.length - 1,
    });
  }
  return passages;
}

/**
 * Build the corpus IDF map from a set of passages.
 * @param {Array<string>} passages
 * @returns {Map<string, number>}
 */
function buildIdf(passages) {
  const docFreq = new Map();
  for (const passage of passages) {
    const terms = tokenize(passage);
    for (const term of terms.keys()) {
      docFreq.set(term, (docFreq.get(term) || 0) + 1);
    }
  }
  const N = Math.max(1, passages.length);
  const idf = new Map();
  for (const [term, df] of docFreq) {
    idf.set(term, Math.log(1 + N / df));
  }
  return idf;
}

/**
 * Serialize a Float32Array to a base64 string for JSON storage.
 * @param {Float32Array} vec
 * @returns {string}
 */
function serializeVector(vec) {
  const buf = Buffer.from(vec.buffer, vec.byteOffset, vec.byteLength);
  return buf.toString("base64");
}

/**
 * Deserialize a base64 string back to a Float32Array.
 * @param {string} b64
 * @returns {Float32Array}
 */
function deserializeVector(b64) {
  const buf = Buffer.from(b64, "base64");
  return new Float32Array(buf.buffer, buf.byteOffset, buf.length / 4);
}

/**
 * Build an embeddings index from per-file summaries + file contents.
 *
 * @param {Array<{path: string, content: string, summary?: string}>} files
 * @param {Object} [options]
 * @param {number} [options.dimensions]
 * @param {number} [options.maxChars]
 * @param {number} [options.overlap]
 * @returns {Object} index object (serializable)
 */
function buildIndex(files, options = {}) {
  const dimensions = options.dimensions ?? DEFAULT_DIMENSIONS;
  const allPassages = [];
  const passageMeta = [];
  for (const file of files) {
    const content = file.content || "";
    const passages = splitPassages(content, options);
    for (const p of passages) {
      allPassages.push(p.text);
      passageMeta.push({ path: file.path, startLine: p.startLine, endLine: p.endLine });
    }
    // Also index the summary as a passage so summary terms are retrievable.
    if (file.summary) {
      allPassages.push(file.summary);
      passageMeta.push({ path: file.path, startLine: -1, endLine: -1, isSummary: true });
    }
  }
  const idf = buildIdf(allPassages);
  const entries = [];
  for (let i = 0; i < allPassages.length; i++) {
    const { vector } = embedPassage(allPassages[i], idf, dimensions);
    entries.push({
      ...passageMeta[i],
      vector: serializeVector(vector),
    });
  }
  return {
    version: 1,
    dimensions,
    generatedAt: new Date().toISOString(),
    idf: Array.from(idf.entries()),
    entries,
    fileCount: files.length,
    passageCount: entries.length,
  };
}

/**
 * Search an index for the top-K passages matching a query.
 *
 * @param {Object} index  Object returned by buildIndex
 * @param {string} query
 * @param {Object} [options]
 * @param {number} [options.k]  Number of results (default 5)
 * @returns {Array<{path: string, startLine: number, endLine: number, score: number, isSummary?: boolean}>}
 */
function search(index, query, options = {}) {
  const k = options.k ?? 5;
  if (!index || !index.entries || !index.entries.length || !query) return [];
  const idf = new Map(index.idf);
  const { vector: qvec } = embedPassage(query, idf, index.dimensions);
  const scored = [];
  for (const entry of index.entries) {
    const v = deserializeVector(entry.vector);
    const score = cosineSimilarity(qvec, v);
    scored.push({
      path: entry.path,
      startLine: entry.startLine,
      endLine: entry.endLine,
      score,
      isSummary: entry.isSummary === true,
    });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, k);
}

/**
 * Persist an index to disk.
 * @param {Object} index
 * @param {string} indexPath
 * @returns {void}
 */
function saveIndex(index, indexPath) {
  const dir = path.dirname(indexPath);
  try { fs.mkdirSync(dir, { recursive: true }); } catch { /* ignore */ }
  fs.writeFileSync(indexPath, JSON.stringify(index));
}

/**
 * Load an index from disk.
 * @param {string} indexPath
 * @returns {Object|null}
 */
function loadIndex(indexPath) {
  try {
    return JSON.parse(fs.readFileSync(indexPath, "utf8"));
  } catch {
    return null;
  }
}

/**
 * Resolve the default index path for a project root.
 * @param {string} projectRoot
 * @returns {string}
 */
function defaultIndexPath(projectRoot) {
  return path.join(projectRoot || process.cwd(), DEFAULT_INDEX_DIR, DEFAULT_INDEX_NAME);
}

module.exports = {
  DEFAULT_INDEX_DIR,
  DEFAULT_INDEX_NAME,
  DEFAULT_DIMENSIONS,
  tokenize,
  embedPassage,
  cosineSimilarity,
  splitPassages,
  buildIdf,
  buildIndex,
  search,
  saveIndex,
  loadIndex,
  defaultIndexPath,
  serializeVector,
  deserializeVector,
};
