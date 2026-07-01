/**
 * Encoding helpers and clamp utility.
 * @module encoding
 */

/** Default text encoding. */
const DEFAULT_ENCODING = 'utf8';

/**
 * Clamp a number between min and max.
 * @param {number} value
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
function clamp(value, min, max) {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

/**
 * Check whether a string is a valid Node.js encoding.
 * @param {string} enc
 * @returns {boolean}
 */
function isValidEncoding(enc) {
  return typeof enc === 'string' && enc.length > 0 && typeof Buffer !== 'undefined' && Buffer.isEncoding(enc);
}

/**
 * Suggest an encoding for a given file extension.
 * @param {string} ext
 * @returns {string}
 */
function getEncodingForExt(ext) {
  const map = {
    '.txt': 'utf8',
    '.md': 'utf8',
    '.json': 'utf8',
    '.js': 'utf8',
    '.ts': 'utf8',
    '.css': 'utf8',
    '.html': 'utf8',
    '.xml': 'utf8',
    '.csv': 'utf8',
    '.bin': 'binary',
    '.dat': 'binary',
    '.db': 'binary',
    '.wasm': 'binary'
  };
  if (typeof ext !== 'string') return DEFAULT_ENCODING;
  return map[ext.toLowerCase()] || DEFAULT_ENCODING;
}

module.exports = Object.freeze({
  DEFAULT_ENCODING,
  clamp,
  isValidEncoding,
  getEncodingForExt
});
