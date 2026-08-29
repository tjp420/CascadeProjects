"use strict";

/**
 * Local token estimator + context trimmer.
 *
 * Provides a deterministic, offline token-count approximation (no external
 * tokenizer dependency) and a budget-aware context trimmer that preserves
 * high-signal content (function signatures, types, constants) while dropping
 * low-signal content (long string literals, comments, blank runs).
 *
 * The estimate is a calibrated heuristic: code-heavy text tends to tokenize
 * denser than prose, so we apply a per-language multiplier on top of the
 * standard ~4 chars/token baseline. This is intentionally approximate —
 * for exact counts, swap in the target model's tokenizer.
 */

const path = require("path");

// Base chars-per-token for natural-language prose (matches GPT-family averages).
const BASE_CHARS_PER_TOKEN = 4.0;

// Code tokenizes denser than prose — more punctuation/symbols split into tokens.
const CODE_DENSITY_MULTIPLIER = 0.85; // i.e. ~3.4 chars/token for code

const CODE_EXTENSIONS = new Set([
  ".js", ".ts", ".jsx", ".tsx", ".cjs", ".mjs",
  ".py", ".java", ".go", ".rs", ".rb", ".php",
  ".c", ".cpp", ".h", ".hpp", ".cs", ".swift",
  ".kt", ".scala", ".clj", ".sh", ".bash", ".ps1",
  ".sql", ".vue", ".svelte",
]);

/**
 * Estimate the token count for a string.
 *
 * @param {string} text
 * @param {Object} [options]
 * @param {string} [options.filePath]  When provided, tunes density by language
 * @param {boolean} [options.isCode]   Override code detection
 * @returns {number} estimated token count (>= 0)
 */
function estimateTokens(text, options = {}) {
  if (!text) return 0;
  const str = typeof text === "string" ? text : String(text);
  const isCode =
    typeof options.isCode === "boolean"
      ? options.isCode
      : options.filePath
        ? CODE_EXTENSIONS.has(path.extname(options.filePath).toLowerCase())
        : looksLikeCode(str);
  const charsPerToken = isCode
    ? BASE_CHARS_PER_TOKEN * CODE_DENSITY_MULTIPLIER
    : BASE_CHARS_PER_TOKEN;
  // Whitespace runs collapse in most tokenizers — count non-whitespace chars.
  const nonWs = str.replace(/\s+/g, " ").length;
  return Math.max(1, Math.ceil(nonWs / charsPerToken));
}

/**
 * Heuristic: does this text look like code (vs prose)?
 * @param {string} text
 * @returns {boolean}
 */
function looksLikeCode(text) {
  if (!text) return false;
  const sample = text.slice(0, 2000);
  const codeSignals = /[{};=>]|function |const |let |var |import |class |def |return /;
  const proseSignals = /\b(the|and|with|that|this|from|for)\b\s+[a-z]/i;
  let score = 0;
  if (codeSignals.test(sample)) score += 2;
  if (proseSignals.test(sample) && !codeSignals.test(sample)) score -= 1;
  // High symbol-to-letter ratio suggests code.
  const letters = (sample.match(/[a-zA-Z]/g) || []).length;
  const symbols = (sample.match(/[{}()\[\];=<>|&!%^*+\-/]/g) || []).length;
  if (letters > 0 && symbols / letters > 0.15) score += 1;
  return score > 0;
}

/**
 * Estimate tokens for a structured prompt {system, context, user}.
 * @param {{system?: string, context?: string, user?: string}} prompt
 * @param {Object} [options]
 * @returns {{total: number, parts: Object}}
 */
function estimatePromptTokens(prompt, options = {}) {
  const parts = {};
  let total = 0;
  for (const key of ["system", "context", "user"]) {
    const val = prompt && prompt[key] ? prompt[key] : "";
    const t = estimateTokens(val, options);
    parts[key] = t;
    total += t;
  }
  // Every message boundary costs ~4 tokens in chat-tokenized formats.
  const presentParts = Object.values(parts).filter((t) => t > 0).length;
  total += Math.max(0, presentParts - 1) * 4;
  return { total, parts };
}

/**
 * Trim a context string to fit a token budget while preserving high-signal lines.
 *
 * Strategy (priority high → low):
 *   1. Keep signatures, type declarations, exports, constants (high signal)
 *   2. Keep first/last lines of blocks (structural anchors)
 *   3. Drop long string literals, comments, blank runs
 *   4. Truncate remaining lines from the middle
 *
 * @param {string} context
 * @param {number} budgetTokens  Target max token count
 * @param {Object} [options]
 * @param {string} [options.filePath]
 * @returns {{trimmed: string, originalTokens: number, trimmedTokens: number, droppedLines: number}}
 */
function trimContext(context, budgetTokens, options = {}) {
  if (!context) {
    return { trimmed: "", originalTokens: 0, trimmedTokens: 0, droppedLines: 0 };
  }
  const originalTokens = estimateTokens(context, options);
  if (originalTokens <= budgetTokens) {
    return {
      trimmed: context,
      originalTokens,
      trimmedTokens: originalTokens,
      droppedLines: 0,
    };
  }
  const lines = context.split("\n");
  const lineScores = lines.map((line, i) => ({
    i,
    line,
    score: lineSignalScore(line),
    tokens: estimateTokens(line, options),
  }));

  // Sort by score desc, keep highest-scoring lines until budget is reached.
  // Reserve ~15% of the budget for the "trimmed lines" placeholder comments
  // added during reassembly so the final output stays within budget.
  const keepBudget = Math.floor(budgetTokens * 0.85);
  const ranked = [...lineScores].sort((a, b) => b.score - a.score);
  const kept = new Set();
  let usedTokens = 0;
  for (const item of ranked) {
    if (usedTokens + item.tokens > keepBudget) continue;
    kept.add(item.i);
    usedTokens += item.tokens;
    if (usedTokens >= keepBudget) break;
  }

  // Reassemble in original order, marking dropped runs with a placeholder.
  const out = [];
  let droppedRun = 0;
  let droppedLines = 0;
  for (const item of lineScores) {
    if (kept.has(item.i)) {
      if (droppedRun > 0) {
        out.push(`/* … ${droppedRun} low-signal line(s) trimmed … */`);
        droppedRun = 0;
      }
      out.push(item.line);
    } else {
      droppedRun += 1;
      droppedLines += 1;
    }
  }
  if (droppedRun > 0) {
    out.push(`/* … ${droppedRun} low-signal line(s) trimmed … */`);
  }
  const trimmed = out.join("\n");
  const trimmedTokens = estimateTokens(trimmed, options);
  return { trimmed, originalTokens, trimmedTokens, droppedLines };
}

/**
 * Score a line's signal density (higher = more worth keeping).
 * @param {string} line
 * @returns {number}
 */
function lineSignalScore(line) {
  if (!line) return -2; // blank
  const trimmed = line.trim();
  if (!trimmed) return -2;
  let score = 0;
  // Comments are low-signal (but keep license/shebang headers).
  if (/^\s*(\/\/|#|\/\*|\*)/.test(line)) {
    if (/^\s*(#!|\/\*\s*Copyright|@license)/i.test(trimmed)) return 5;
    return -1;
  }
  // Signatures / declarations are high-signal.
  if (
    /\b(function|class|interface|type|enum|const|let|var|export|import|def|public|private|static|async|return|module\.exports)\b/.test(
      trimmed,
    )
  ) {
    score += 6;
  }
  // Type annotations / generics.
  if (/[:<>\[\]{},]/.test(trimmed)) score += 1;
  // Long string literals are low-signal.
  const strLitRatio = (trimmed.match(/["'`]/g) || []).length / Math.max(1, trimmed.length);
  if (strLitRatio > 0.08 && trimmed.length > 60) score -= 2;
  // Very long lines are slightly penalized.
  if (trimmed.length > 200) score -= 1;
  // Short structural lines (braces, brackets) are anchors.
  if (/^[{}\[\]();,]+$/.test(trimmed)) score += 2;
  return score;
}

module.exports = {
  BASE_CHARS_PER_TOKEN,
  CODE_DENSITY_MULTIPLIER,
  CODE_EXTENSIONS,
  estimateTokens,
  estimatePromptTokens,
  trimContext,
  looksLikeCode,
  lineSignalScore,
};
