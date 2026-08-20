/**
 * String, blank-check, and safe-parsing utilities.
 * @module strings
 */

/**
 * Check whether a value is null, undefined, or a whitespace-only string.
 * @param {any} value
 * @returns {boolean}
 */
function isBlank(value) {
  return (
    value == null || (typeof value === "string" && value.trim().length === 0)
  );
}

/**
 * Safe String() conversion with fallback for unstringable values.
 * @param {any} value
 * @returns {string}
 */
function safeString(value) {
  try {
    return String(value);
  } catch {
    return "[unstringable error]";
  }
}

/**
 * Extract message from Error or coerce to string.
 * @param {any} err
 * @returns {string}
 */
function safeErrorMessage(err) {
  if (err && typeof err.message === "string") return err.message;
  return safeString(err);
}

/**
 * Safely parse an integer with a fallback.
 * @param {string|number} str
 * @param {number} [fallback=0]
 * @returns {number}
 */
function safeParseInt(str, fallback = 0) {
  if (typeof str === "number")
    return Number.isFinite(str) ? Math.floor(str) : fallback;
  if (typeof str !== "string") return fallback;
  const parsed = Number.parseInt(str, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

/**
 * Safely parse a float with a fallback.
 * @param {string|number} str
 * @param {number} [fallback=0]
 * @returns {number}
 */
function safeParseFloat(str, fallback = 0) {
  if (typeof str === "number") return Number.isFinite(str) ? str : fallback;
  if (typeof str !== "string") return fallback;
  const parsed = Number.parseFloat(str);
  return Number.isNaN(parsed) ? fallback : parsed;
}

/**
 * Parse a string into a boolean with explicit truthy/falsy mappings.
 * @param {string|boolean|number} str
 * @returns {boolean | undefined}
 */
function parseBoolean(str) {
  if (typeof str === "boolean") return str;
  if (typeof str === "number") return str !== 0;
  if (typeof str !== "string") return undefined;
  const lowered = str.toLowerCase().trim();
  if (["true", "1", "yes", "on"].includes(lowered)) return true;
  if (["false", "0", "no", "off"].includes(lowered)) return false;
  return undefined;
}

/**
 * Capitalize the first letter of a string.
 * @param {string} str
 * @returns {string}
 */
function capitalize(str) {
  const s = String(str ?? "");
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Pluralize a word based on a count.
 * @param {number} count
 * @param {string} singular
 * @param {string} [plural]
 * @returns {string}
 */
function pluralize(count, singular, plural) {
  const n = Number(count);
  if (!Number.isFinite(n)) return `${count} ${singular}`;
  const word = n === 1 ? singular : (plural ?? `${singular}s`);
  return `${n} ${word}`;
}

/**
 * Truncate a string to a maximum length, adding an ellipsis if trimmed.
 * @param {string} str
 * @param {number} [maxLen=80]
 * @param {string} [suffix='…']
 * @returns {string}
 */
function truncate(str, maxLen = 80, suffix = "…") {
  const s = String(str ?? "");
  const limit = Number.isFinite(maxLen) && maxLen > 0 ? Math.floor(maxLen) : 80;
  if (s.length <= limit) return s;
  const endLen = Math.max(0, limit - String(suffix ?? "…").length);
  return s.slice(0, endLen) + String(suffix ?? "…");
}

/**
 * Ensure a value is an array.
 * @param {any} value
 * @returns {any[]}
 */
function ensureArray(value) {
  if (value == null) return [];
  if (Array.isArray(value)) return value;
  return [value];
}

/**
 * Check if a value is empty (null, undefined, empty string/array/object/Map/Set).
 * @param {any} value
 * @returns {boolean}
 */
function isEmpty(value) {
  if (value == null) return true;
  if (typeof value === "string" || Array.isArray(value))
    return value.length === 0;
  if (value instanceof Map || value instanceof Set) return value.size === 0;
  if (typeof value === "object") return Object.keys(value).length === 0;
  return false;
}

module.exports = Object.freeze({
  isBlank,
  safeString,
  safeErrorMessage,
  safeParseInt,
  safeParseFloat,
  parseBoolean,
  capitalize,
  pluralize,
  truncate,
  ensureArray,
  isEmpty,
});
