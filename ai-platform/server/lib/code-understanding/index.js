const { understandCodeSnippet, understandFile, attachUnderstandingToCodebaseReport } = require('./code-understanding-engine');
const { analyzeSemanticLayer } = require('./semantic-analyzer');
const { analyzeContextualLayer } = require('./contextual-analyzer');
const { appendExpertReview, loadExpertReviews, summarizeExpertConsensus } = require('./expert-review-store');
const { detectBusinessLogicPatterns } = require('./business-logic-patterns');

const { generateZscriptModReport } = require('./zscript-mod-report');

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
