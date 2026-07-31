/**
 * Base class for language-specific structure parsers (AST-like, heuristic).
 */

/**
 * Language parser.
 */
class LanguageParser {
  constructor(config = {}) {
    this.language = config.language || 'generic';
    this.extensions = config.extensions || [];
    this.label = config.label || this.language;
  }

  supportsExtension(extension) {
    return this.extensions.includes(String(extension || '').toLowerCase());
  }

  /** Override in subclasses */
  parse(code, context = {}) {
    return {
      language: this.language,
      filePath: context.filePath || null,
      summary: 'No parser implementation',
    };
  }
}

module.exports = {
  LanguageParser,
};
