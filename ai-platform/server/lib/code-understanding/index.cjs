'use strict';

/**
 * @module code-understanding
 * Barrel re-export for the `lib/code-understanding/` directory.
 *
 * Re-exports code analysis utilities: snippet understanding, semantic/contextual
 * analysis, expert review storage, business logic detection, and ZScript reporting.
 *
 * @example <caption>Flat access (cherry-pick what you need)</caption>
 * const { understandFile, analyzeSemanticLayer } = require('./code-understanding');
 * const understanding = await understandFile('src/app.js');
 *
 * @example <caption>Grouped namespace access (frozen at runtime)</caption>
 * const codeUnderstanding = require('./code-understanding');
 * Object.isFrozen(codeUnderstanding); // true
 * const report = await codeUnderstanding.analyzeSemanticLayer(ast);
 *
 * @file server/lib/code-understanding/index.cjs
 */

const { understandCodeSnippet, understandFile, attachUnderstandingToCodebaseReport } = require('./code-understanding-engine.cjs');
const { analyzeSemanticLayer } = require('./semantic-analyzer.cjs');
const { analyzeContextualLayer } = require('./contextual-analyzer.cjs');
const { appendExpertReview, loadExpertReviews, summarizeExpertConsensus } = require('./expert-review-store.cjs');
const { detectBusinessLogicPatterns } = require('./business-logic-patterns.cjs');

const { generateZscriptModReport } = require('./zscript-mod-report.cjs');

module.exports = Object.freeze({
    understandCodeSnippet,
    understandFile,
    attachUnderstandingToCodebaseReport,
    analyzeSemanticLayer,
    analyzeContextualLayer,
    appendExpertReview,
    loadExpertReviews,
    summarizeExpertConsensus,
    detectBusinessLogicPatterns,
    generateZscriptModReport
});
