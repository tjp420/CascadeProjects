// SPDX-License-Identifier: MIT
/**
 * @simplebeacon/intelligence — local hybrid intent analysis for SimpleBeacon.
 *
 * Unified entry point exposing the full API surface: intent scanning,
 * structural analysis, tree-sitter queries, SLM bridge, and vector cache.
 * Provides an optional IntelligenceEngine facade for programmatic use.
 *
 * @license MIT
 */

'use strict';

// ── Dependency Validation ───────────────────────────────────

const REQUIRED = [
    { file: './intent-scanner', exports: ['scanIntent', 'scanIntentAsync', 'resolveLanguage', 'isLanguageSupported', 'engine'] },
    { file: './structural-intent-scanner', exports: ['scanStructuralIntent', 'scanCredentialDictStubs', 'extractPythonFunctions', 'extractJsFunctions', 'analyzeFunctionBlock', 'isGenericName', 'credentialKeyMatch', 'isPlaceholderCredentialValue', 'hasPlaceholderReturn'] },
    { file: './tree-sitter-loader', exports: ['GRAMMAR_MAP', 'initParser', 'createLanguageParser', 'parseWithTreeSitter', 'isGrammarAvailable', 'getTreeSitterStatus', 'resolveWasmDir'] },
    { file: './slm-bridge', exports: ['probeSlmBin', 'canRunSlm', 'buildSlmPrompt', 'parseSlmResponse', 'validateSlmResult', 'runSlmReview', 'runSlmReviewAsync'] },
    { file: './constants', exports: ['GENERIC_AI_MARKERS', 'CREDENTIAL_KEY_FRAGMENTS', 'INTENT_RULE_IDS', 'LANGUAGE_BY_EXT'] },
    { file: './tree-sitter-queries', exports: ['FUNCTION_NODE_TYPES', 'extractFunctionsFromTree', 'scanStructuralFromTree', 'scanWithTreeSitter'] },
    { file: './vector-cache', exports: ['loadFingerprints', 'extractFeatureVector', 'matchFingerprints', 'fingerprintFindings', 'cosineSimilarity'] }
];

const loaded = {};
for (const req of REQUIRED) {
    let mod;
    try {
        mod = require(req.file);
    } catch (err) {
        throw new Error(
            `[intelligence] Failed to load required submodule "${req.file}". ` +
            `Ensure @simplebeacon/intelligence is installed correctly. Original: ${err.message}`
        );
    }
    for (const name of req.exports) {
        if (!(name in mod)) {
            throw new Error(
                `[intelligence] Submodule "${req.file}" missing expected export "${name}".`
            );
        }
    }
    loaded[req.file] = mod;
}

// ── Destructure all validated submodules ──────────────────────

const {
    scanIntent, scanIntentAsync, resolveLanguage, isLanguageSupported, engine
} = loaded['./intent-scanner'];

const {
    scanStructuralIntent, scanCredentialDictStubs,
    extractPythonFunctions, extractJsFunctions, analyzeFunctionBlock,
    isGenericName, credentialKeyMatch, isPlaceholderCredentialValue, hasPlaceholderReturn
} = loaded['./structural-intent-scanner'];

const {
    GRAMMAR_MAP, initParser, createLanguageParser, parseWithTreeSitter,
    isGrammarAvailable, getTreeSitterStatus, resolveWasmDir
} = loaded['./tree-sitter-loader'];

const {
    probeSlmBin, canRunSlm, buildSlmPrompt, parseSlmResponse,
    validateSlmResult, runSlmReview, runSlmReviewAsync
} = loaded['./slm-bridge'];

const { GENERIC_AI_MARKERS, CREDENTIAL_KEY_FRAGMENTS, INTENT_RULE_IDS, LANGUAGE_BY_EXT } = loaded['./constants'];

const {
    FUNCTION_NODE_TYPES, extractFunctionsFromTree, scanStructuralFromTree, scanWithTreeSitter
} = loaded['./tree-sitter-queries'];

const {
    loadFingerprints, extractFeatureVector, matchFingerprints, fingerprintFindings, cosineSimilarity
} = loaded['./vector-cache'];

// ── JSDoc Type Definitions ────────────────────────────────────

/**
 * @typedef {Object} IntelligenceScanResult
 * @property {boolean} enabled
 * @property {string} filePath
 * @property {string} language
 * @property {boolean} [skipped]
 * @property {string} [reason]
 * @property {number} findingCount
 * @property {Array<Object>} findings
 * @property {string} engine
 */

/**
 * @typedef {Object} SlmProbeResult
 * @property {boolean} configured
 * @property {boolean} executable
 * @property {string|null} path
 */

/**
 * @typedef {Object} SlmReviewResult
 * @property {boolean} enabled
 * @property {boolean} reviewed
 * @property {string} risk
 * @property {string} reason
 */

/**
 * @typedef {Object} TreeSitterStatus
 * @property {boolean} available
 * @property {string|null} version
 * @property {number} grammarCount
 */

/**
 * @typedef {Object} IntelligenceEngineOptions
 * @property {Array<string>} [languages] - Allowed languages for scanning.
 * @property {boolean} [warmTreeSitter=false] - Preload tree-sitter WASM parsers.
 * @property {boolean} [probeSlm=false] - Probe SLM binary on initialization.
 */

/**
 * @typedef {Object} IntelligenceEngineStatus
 * @property {boolean} initialized
 * @property {TreeSitterStatus} treeSitter
 * @property {SlmProbeResult} slm
 * @property {number} grammarCount
 * @property {string[]} loadedModules
 */

// ── IntelligenceEngine Facade ─────────────────────────────────

class IntelligenceEngine {
    /**
     * @param {IntelligenceEngineOptions} [options]
     */
    constructor(options = {}) {
        this._options = options;
        this._initialized = false;
        this._slmProbe = null;
    }

    /**
     * Initialize the engine. Optionally warms tree-sitter and probes SLM.
     * @returns {IntelligenceEngine}
     */
    initialize() {
        if (this._initialized) return this;
        if (this._options.warmTreeSitter) {
            try { initParser(); } catch { /* tree-sitter optional */ }
        }
        if (this._options.probeSlm) {
            this._slmProbe = probeSlmBin();
        }
        this._initialized = true;
        return this;
    }

    /**
     * Run a full intent scan (Tier 1a/1b/1c + optional Tier 2).
     * @param {string} content
     * @param {Object} [options]
     * @returns {Promise<IntelligenceScanResult>}
     */
    async scan(content, options = {}) {
        return scanIntentAsync(content, options);
    }

    /**
     * Synchronous intent scan.
     * @param {string} content
     * @param {Object} [options]
     * @returns {IntelligenceScanResult}
     */
    scanSync(content, options = {}) {
        return scanIntent(content, options);
    }

    /**
     * Whether the SLM bridge is runnable.
     * @returns {boolean}
     */
    canRunSlm() {
        return canRunSlm();
    }

    /**
     * Run a synchronous SLM review.
     * @param {string} content
     * @param {Object} [options]
     * @returns {SlmReviewResult}
     */
    slmReview(content, options = {}) {
        return runSlmReview(content, options);
    }

    /**
     * Run an asynchronous SLM review.
     * @param {string} content
     * @param {Object} [options]
     * @returns {Promise<SlmReviewResult>}
     */
    async slmReviewAsync(content, options = {}) {
        return runSlmReviewAsync(content, options);
    }

    /**
     * Resolve language from a file path.
     * @param {string} filePath
     * @param {Object} [options]
     * @returns {string}
     */
    resolveLanguage(filePath, options = {}) {
        return resolveLanguage(filePath, options);
    }

    /**
     * Check if a language is supported.
     * @param {string} language
     * @param {Object} [options]
     * @returns {boolean}
     */
    isLanguageSupported(language, options = {}) {
        return isLanguageSupported(language, options);
    }

    /**
     * Return aggregated engine status.
     * @returns {IntelligenceEngineStatus}
     */
    getStatus() {
        return {
            initialized: this._initialized,
            treeSitter: getTreeSitterStatus(),
            slm: this._slmProbe || probeSlmBin(),
            grammarCount: Object.keys(GRAMMAR_MAP || {}).length,
            loadedModules: REQUIRED.map((r) => r.file)
        };
    }
}

// ── Singleton & Factory ───────────────────────────────────────

let _singleton = null;

/**
 * Create a new IntelligenceEngine instance.
 * @param {IntelligenceEngineOptions} [options]
 * @returns {IntelligenceEngine}
 */
function createIntelligenceEngine(options) {
    return new IntelligenceEngine(options);
}

/**
 * Get the shared IntelligenceEngine singleton (lazy-initialized).
 * @param {IntelligenceEngineOptions} [options]
 * @returns {IntelligenceEngine}
 */
function getIntelligenceEngine(options = {}) {
    if (!_singleton) {
        _singleton = new IntelligenceEngine(options);
        _singleton.initialize();
    }
    return _singleton;
}

// ── Module Exports ────────────────────────────────────────────
// Note: do NOT Object.freeze() — ES module namespace objects in some
// engines throw when redefining frozen properties.

module.exports = {
    // ── Facade
    IntelligenceEngine,
    createIntelligenceEngine,
    getIntelligenceEngine,

    // ── Intent Scanner
    scanIntent,
    scanIntentAsync,
    resolveLanguage,
    isLanguageSupported,
    engine,

    // ── Structural Intent Scanner
    scanStructuralIntent,
    scanCredentialDictStubs,
    extractPythonFunctions,
    extractJsFunctions,
    analyzeFunctionBlock,
    isGenericName,
    credentialKeyMatch,
    isPlaceholderCredentialValue,
    hasPlaceholderReturn,

    // ── Tree-sitter Loader
    GRAMMAR_MAP,
    initParser,
    createLanguageParser,
    parseWithTreeSitter,
    isGrammarAvailable,
    getTreeSitterStatus,
    resolveWasmDir,

    // ── SLM Bridge
    probeSlmBin,
    canRunSlm,
    buildSlmPrompt,
    parseSlmResponse,
    validateSlmResult,
    runSlmReview,
    runSlmReviewAsync,

    // ── Constants
    GENERIC_AI_MARKERS,
    CREDENTIAL_KEY_FRAGMENTS,
    INTENT_RULE_IDS,
    LANGUAGE_BY_EXT,

    // ── Tree-sitter Queries
    FUNCTION_NODE_TYPES,
    extractFunctionsFromTree,
    scanStructuralFromTree,
    scanWithTreeSitter,

    // ── Vector Cache
    loadFingerprints,
    extractFeatureVector,
    matchFingerprints,
    fingerprintFindings,
    cosineSimilarity
};
