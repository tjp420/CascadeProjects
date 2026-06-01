/**
 * @simplebeacon/intelligence — local hybrid intent analysis for SimpleBeacon.
 */

const { scanIntent, scanIntentAsync, resolveLanguage, isLanguageSupported, engine } = require('./intent-scanner');
const { scanStructuralIntent } = require('./structural-intent-scanner');
const { getTreeSitterStatus } = require('./tree-sitter-loader');
const { probeSlmBin, runSlmReview } = require('./slm-bridge');
const { INTENT_RULE_IDS, LANGUAGE_BY_EXT } = require('./constants');

module.exports = {
    scanIntent,
    scanIntentAsync,
    scanStructuralIntent,
    resolveLanguage,
    isLanguageSupported,
    getTreeSitterStatus,
    probeSlmBin,
    runSlmReview,
    INTENT_RULE_IDS,
    LANGUAGE_BY_EXT,
    engine
};
