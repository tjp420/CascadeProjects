/**
 * @module glob-utils
 * Convert glob-like patterns to cached RegExp matchers.
 */

/**
 * Convert a glob-like pattern to a RegExp.
 * Supports `*`, `**`, and `?` wildcards.
 * @param {string} pattern
 * @returns {RegExp}
 */
function globToRegex(pattern) {
  if (typeof pattern !== 'string') return /(?!)/;
  let regex = '^';
  for (let i = 0; i < pattern.length; i += 1) {
    const c = pattern[i];
    if (c === '*' && pattern[i + 1] === '*') {
      i += 1;
      if (pattern[i + 1] === '/') {
        regex += '(?:.*/)?';
        i += 1;
      } else {
        regex += '.*';
      }
    } else if (c === '*') {
      regex += '[^/]*';
    } else if (c === '?') {
      regex += '[^/]';
    } else {
      regex += c.replace(/[.+^${}()|[\]\\]/g, '\\$&');
    }
  }
  regex += '$';
  try {
    return new RegExp(regex);
  } catch {
    return /(?!)/;
  }
}

/** Cache of compiled glob-to-regex patterns. */
const _globRegexCache = new Map();

/**
 * Compile a glob pattern to a regex, caching the result.
 * @param {string} pattern
 * @returns {RegExp}
 */
function cachedGlobToRegex(pattern) {
  if (typeof pattern !== 'string') return /(?!)/;
  if (_globRegexCache.has(pattern)) return _globRegexCache.get(pattern);
  const re = globToRegex(pattern);
  _globRegexCache.set(pattern, re);
  return re;
}

module.exports = { globToRegex, cachedGlobToRegex };
