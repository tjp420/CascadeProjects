/**
 * Language-specific pattern supplements merged with generic codebase heuristics.
 * Prefer plugin-system builtins for dedicated analyzers; this module remains for direct imports.
 */

const { getLanguageForExtension } = require('../universal-language-config');
const { getBuiltinPluginManager } = require('../plugin-system');
const zscriptPatterns = require('./zscript-patterns');

const EMPTY = { techDebt: [], debug: [], placeholders: [], bestPractices: [] };

function getLanguagePatternSupplements(extension) {
    const language = getLanguageForExtension(extension);
    const plugin = getBuiltinPluginManager().getByLanguage(language);
    if (plugin?.patterns) {
        return plugin.patterns;
    }

    if (language === 'zscript') return zscriptPatterns;
    return EMPTY;
}

module.exports = {
    getLanguagePatternSupplements
};
