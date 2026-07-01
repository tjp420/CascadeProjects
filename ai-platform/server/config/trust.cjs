/**
 * Trust levels, upload limits, and AI timeouts.
 * @module trust
 */

/** Trust tier names (frozen, ordered). */
const TRUST_LEVELS = Object.freeze(['bronze', 'silver', 'gold']);

/** Upload limits mapped by trust level. */
const UPLOAD_LIMITS_BY_TRUST = Object.freeze({
  bronze: 10,
  silver: 25,
  gold: 100
});

/**
 * Get the upload limit for a trust level.
 * @param {string} level
 * @returns {number}
 */
function getUploadLimitForTrust(level) {
  if (typeof level !== 'string') return UPLOAD_LIMITS_BY_TRUST.bronze;
  return UPLOAD_LIMITS_BY_TRUST[level] ?? UPLOAD_LIMITS_BY_TRUST.bronze;
}

/**
 * Check whether a string is a valid trust level.
 * @param {string} level
 * @returns {boolean}
 */
function isValidTrustLevel(level) {
  return typeof level === 'string' && TRUST_LEVELS.includes(level);
}

/** AI / model timeout constants in milliseconds. */
const AI_TIMEOUTS = Object.freeze({
  OLLAMA_DEFAULT: 30_000,
  OLLAMA_STREAMING: 120_000,
  PROXY_DEFAULT: 60_000,
  MODEL_INFERENCE: 90_000,
  EMBEDDING: 15_000
});

module.exports = Object.freeze({
  TRUST_LEVELS,
  UPLOAD_LIMITS_BY_TRUST,
  AI_TIMEOUTS,
  getUploadLimitForTrust,
  isValidTrustLevel
});
