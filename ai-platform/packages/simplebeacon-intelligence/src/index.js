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

import {
    scanIntent, scanIntentAsync, resolveLanguage, isLanguageSupported, ENGINE as engine
} from './intent-scanner.js';

import {
    scanStructuralIntent, scanCredentialDictStubs,
    extractPythonFunctions, extractJsFunctions, analyzeFunctionBlock,
    isGenericName, credentialKeyMatch, isPlaceholderCredentialValue, hasPlaceholderReturn
} from './structural-intent-scanner.js';

import {
    GRAMMAR_MAP, initParser, createLanguageParser, parseWithTreeSitter,
    isGrammarAvailable, getTreeSitterStatus, resolveWasmDir
} from './tree-sitter-loader.js';

import {
    probeSlmBin, canRunSlm, buildSlmPrompt, parseSlmResponse,
    validateSlmResult, runSlmReview, runSlmReviewAsync
} from './slm-bridge.js';

import { GENERIC_AI_MARKERS, CREDENTIAL_KEY_FRAGMENTS, INTENT_RULE_IDS, LANGUAGE_BY_EXT } from './constants.js';

import {
    FUNCTION_NODE_TYPES, extractFunctionsFromTree, scanStructuralFromTree, scanWithTreeSitter
} from './tree-sitter-queries.js';

import {
    loadFingerprints, extractFeatureVector, matchFingerprints, fingerprintFindings, cosineSimilarity
} from './vector-cache.js';

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
            loadedModules: [
                './intent-scanner.js',
                './structural-intent-scanner.js',
                './tree-sitter-loader.js',
                './slm-bridge.js',
                './constants.js',
                './tree-sitter-queries.js',
                './vector-cache.js'
            ]
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
// Static explicit exports for bundler tree-shaking and static analysis.

export {
    // ── Facade
    IntelligenceEngine,
    createIntelligenceEngine,
    getIntelligenceEngine,

    // ── intent-scanner
    scanIntent,
    scanIntentAsync,
    resolveLanguage,
    isLanguageSupported,
    engine,

    // ── structural-intent-scanner
    scanStructuralIntent,
    scanCredentialDictStubs,
    extractPythonFunctions,
    extractJsFunctions,
    analyzeFunctionBlock,
    isGenericName,
    credentialKeyMatch,
    isPlaceholderCredentialValue,
    hasPlaceholderReturn,

    // ── tree-sitter-loader
    GRAMMAR_MAP,
    initParser,
    createLanguageParser,
    parseWithTreeSitter,
    isGrammarAvailable,
    getTreeSitterStatus,
    resolveWasmDir,

    // ── slm-bridge
    probeSlmBin,
    canRunSlm,
    buildSlmPrompt,
    parseSlmResponse,
    validateSlmResult,
    runSlmReview,
    runSlmReviewAsync,

    // ── constants
    GENERIC_AI_MARKERS,
    CREDENTIAL_KEY_FRAGMENTS,
    INTENT_RULE_IDS,
    LANGUAGE_BY_EXT,

    // ── tree-sitter-queries
    FUNCTION_NODE_TYPES,
    extractFunctionsFromTree,
    scanStructuralFromTree,
    scanWithTreeSitter,

    // ── vector-cache
    loadFingerprints,
    extractFeatureVector,
    matchFingerprints,
    fingerprintFindings,
    cosineSimilarity
};
