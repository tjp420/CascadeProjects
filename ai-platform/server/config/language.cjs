/**
 * File-extension to human-readable language name mapping.
 * @module language
 */

/** Map: extension (with leading dot, lower-cased) → display name. */
const LANGUAGE_MAP = Object.freeze({
  '.js': 'JavaScript',
  '.ts': 'TypeScript',
  '.jsx': 'JavaScript',
  '.tsx': 'TypeScript',
  '.py': 'Python',
  '.html': 'HTML',
  '.json': 'JSON',
  '.md': 'Markdown',
  '.txt': 'Text',
  '.css': 'CSS',
  '.scss': 'SCSS',
  '.less': 'Less',
  '.xml': 'XML',
  '.yaml': 'YAML',
  '.yml': 'YAML',
  '.sql': 'SQL',
  '.sh': 'Shell',
  '.bat': 'Batch',
  '.java': 'Java',
  '.cpp': 'C++',
  '.c': 'C',
  '.cs': 'C#',
  '.php': 'PHP',
  '.rb': 'Ruby',
  '.go': 'Go',
  '.rs': 'Rust',
  '.swift': 'Swift',
  '.kt': 'Kotlin',
  '.cjs': 'JavaScript',
  '.mjs': 'JavaScript',
  '.vue': 'Vue',
  '.svelte': 'Svelte',
});

/**
 * Look up a human-readable language name for a file extension.
 * @param {string} ext  Extension with leading dot (e.g. ".js").
 * @returns {string}
 */
function getLanguageName(ext) {
  if (typeof ext !== 'string') return 'Unknown';
  const normalized = ext.toLowerCase();
  return LANGUAGE_MAP[normalized] || 'Unknown';
}

module.exports = Object.freeze({
  LANGUAGE_MAP,
  getLanguageName,
});
