const { understandCodeSnippet, understandFile, attachUnderstandingToCodebaseReport } = require('./code-understanding-engine.cjs');
const { analyzeSemanticLayer } = require('./semantic-analyzer.cjs');
const { analyzeContextualLayer } = require('./contextual-analyzer.cjs');
const { appendExpertReview, loadExpertReviews, summarizeExpertConsensus } = require('./expert-review-store.cjs');
const { detectBusinessLogicPatterns } = require('./business-logic-patterns.cjs');

const { generateZscriptModReport } = require('./zscript-mod-report.cjs');

module.exports = {
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
};
