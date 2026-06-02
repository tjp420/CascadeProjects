const { LanguageParser } = require('./language-parser-base');
const { ZScriptParser } = require('./zscript-parser');

const PARSER_REGISTRY = {
    zscript: new ZScriptParser()
};

function getParserForLanguage(languageId) {
    return PARSER_REGISTRY[String(languageId || '').toLowerCase()] || null;
}

function getParserForExtension(extension) {
    const ext = String(extension || '').toLowerCase();
    if (ext === '.zs' || ext === '.zscript') return PARSER_REGISTRY.zscript;
    return null;
}

module.exports = {
    LanguageParser,
    ZScriptParser,
    PARSER_REGISTRY,
    getParserForLanguage,
    getParserForExtension
};
