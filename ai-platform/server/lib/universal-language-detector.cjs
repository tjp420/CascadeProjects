/**
 * Heuristic language detection — extension first, content scoring second, generic fallback.
 */

const {
  UNIVERSAL_LANGUAGE_REGISTRY,
  resolveLanguageFromPath,
  getRegistryEntry,
} = require("./universal-language-registry.cjs");

const CONTENT_SIGNATURES = {
  zscript: [
    { pattern: /\bclass\s+\w+\s*:\s*\w+/g, weight: 3 },
    { pattern: /\bStates\s*\{/g, weight: 3 },
    { pattern: /\boverride\s+(?:void|bool|state)\b/g, weight: 2 },
    { pattern: /\bDefault\s*\{/g, weight: 2 },
    { pattern: /\bA_\w+\s*\(/g, weight: 2 },
  ],
  acs: [
    { pattern: /\bscript\s+\w+\s*\(/g, weight: 3 },
    { pattern: /\b#include\s+"\w+\.acs"/g, weight: 2 },
    { pattern: /\bPrint\s*\(/g, weight: 1 },
  ],
  python: [
    { pattern: /^\s*def\s+\w+\s*\(/gm, weight: 2 },
    { pattern: /^\s*class\s+\w+\s*[:(]/gm, weight: 2 },
    { pattern: /^\s*import\s+\w+/gm, weight: 1 },
    { pattern: /^\s*from\s+\w+\s+import/gm, weight: 1 },
  ],
  glsl: [
    { pattern: /\bvoid\s+main\s*\(\s*\)/g, weight: 3 },
    { pattern: /\b(uniform|varying|attribute)\s+\w+/g, weight: 2 },
    { pattern: /\b(gl_Position|gl_FragColor)\b/g, weight: 2 },
  ],
  rust: [
    { pattern: /\bfn\s+\w+\s*\(/g, weight: 2 },
    { pattern: /\b(let|mut|pub)\s+\w+/g, weight: 1 },
    { pattern: /\bimpl\s+\w+/g, weight: 2 },
  ],
  go: [
    { pattern: /\bpackage\s+\w+/g, weight: 3 },
    { pattern: /\bfunc\s+\w+\s*\(/g, weight: 2 },
    { pattern: /\bimport\s+\(/g, weight: 1 },
  ],
  solidity: [
    { pattern: /\bpragma\s+solidity\b/g, weight: 4 },
    { pattern: /\bcontract\s+\w+/g, weight: 3 },
  ],
  yaml: [
    { pattern: /^---\s*$/m, weight: 2 },
    { pattern: /^[\w.-]+:\s*(\S|$)/gm, weight: 1 },
  ],
};

/**
 * Universal language detector.
 */
class UniversalLanguageDetector {
  constructor(options = {}) {
    this.registry = options.registry || UNIVERSAL_LANGUAGE_REGISTRY;
    this.signatures = options.signatures || CONTENT_SIGNATURES;
  }

  detectLanguage(filePath, content = "") {
    const fromPath = resolveLanguageFromPath(filePath);
    if (fromPath) {
      return {
        language: fromPath.id,
        label: fromPath.label,
        family: fromPath.family,
        confidence: 1,
        method: "extension",
      };
    }

    const fromContent = this.detectFromContent(content);
    if (fromContent.confidence >= 0.55) {
      return fromContent;
    }

    return {
      language: "generic",
      label: "Generic",
      family: "unknown",
      confidence: 0.3,
      method: "fallback",
    };
  }

  detectFromContent(content) {
    const text = String(content || "");
    if (!text.trim()) {
      return { language: "generic", confidence: 0, method: "empty" };
    }

    const scores = new Map();
    for (const [languageId, signatures] of Object.entries(this.signatures)) {
      let score = 0;
      for (const sig of signatures) {
        const pattern = new RegExp(sig.pattern.source, sig.pattern.flags);
        const matches = text.match(pattern);
        if (matches) score += sig.weight * Math.min(matches.length, 4);
      }
      if (score > 0) scores.set(languageId, score);
    }

    if (!scores.size) {
      return { language: "generic", confidence: 0.2, method: "content" };
    }

    const ranked = [...scores.entries()].sort((a, b) => b[1] - a[1]);
    const [languageId, rawScore] = ranked[0];
    const entry = getRegistryEntry(languageId);
    const confidence = Math.min(0.95, 0.45 + rawScore * 0.08);

    return {
      language: languageId,
      label: entry?.label || languageId,
      family: entry?.family || "unknown",
      confidence,
      method: "content",
      score: rawScore,
    };
  }
}

/**
 * Create language detector.
 * @param {Object} options
 * @returns {any}
 */
function createLanguageDetector(options) {
  return new UniversalLanguageDetector(options);
}

module.exports = {
  UniversalLanguageDetector,
  createLanguageDetector,
  CONTENT_SIGNATURES,
};
