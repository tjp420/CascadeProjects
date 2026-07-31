/**
 * Optional Phase 3 semantic hints when LLAMA_CPP_BIN is configured.
 * Does not run GGUF inference during filesystem scans — surfaces review candidates only.
 */

const fs = require('fs');

const MAX_HINTS = 8;

/**
 * Probe llama cpp bin.
 * @param {string} binPath
 * @returns {any}
 */
function probeLlamaCppBin(binPath = process.env.LLAMA_CPP_BIN) {
  if (!binPath) {
    return { configured: false, executable: false, path: null };
  }

  let executable = false;
  try {
    executable = fs.existsSync(binPath);
  } catch {
    executable = false;
  }

  return {
    configured: true,
    executable,
    path: binPath,
  };
}

/**
 * Build semantic hints.
 * @param {Array} fuzzyPairs
 * @param {Object} options
 * @returns {any}
 */
function buildSemanticHints(fuzzyPairs = [], options = {}) {
  const probe = probeLlamaCppBin(options.binPath);
  const pairs = Array.isArray(fuzzyPairs) ? fuzzyPairs : [];

  if (!probe.configured) {
    return {
      enabled: false,
      mode: 'filesystem-only',
      hints: [],
      note: 'Set LLAMA_CPP_BIN for optional semantic review hints on fuzzy pairs',
    };
  }

  const hints = pairs.slice(0, MAX_HINTS).map((pair, index) => ({
    id: `semantic-hint-${index + 1}`,
    type: 'fuzzy-pair-review',
    files: [pair.fileA, pair.fileB],
    similarity: pair.similarity,
    method: pair.method || 'token-jaccard',
    priority: pair.similarity >= 0.95 ? 'medium' : 'low',
    suggestion: 'Review for refactor or merge — semantic embedding not run during scan',
  }));

  return {
    enabled: true,
    mode: probe.executable ? 'llama-cpp-ready' : 'llama-cpp-path-missing',
    llamaCppBin: probe.path,
    executable: probe.executable,
    hints,
    pairsEligible: pairs.length,
    disclaimer: 'Measured fuzzy pairs only — not model-generated similarity scores',
  };
}

module.exports = {
  probeLlamaCppBin,
  buildSemanticHints,
  MAX_HINTS,
};
