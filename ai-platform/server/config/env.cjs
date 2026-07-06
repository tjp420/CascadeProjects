/**
 * Environment variable helpers and detection.
 * @module env
 */

function isDevelopment() {
  return typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'development';
}

function isProduction() {
  return typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'production';
}

function isTest() {
  return typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'test';
}

function isStaging() {
  return typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'staging';
}

function isCI() {
  if (typeof process === 'undefined' || !process.env) return false;
  return Boolean(process.env.CI || process.env.CONTINUOUS_INTEGRATION);
}

/**
 * Read an environment variable with a fallback.
 * @param {string} key
 * @param {any} fallback
 * @returns {any}
 */
function env(key, fallback) {
  if (typeof process === 'undefined' || !process.env) return fallback;
  const val = process.env[key];
  return val === undefined ? fallback : val;
}

/**
 * Read an environment variable as an integer.
 * @param {string} key
 * @param {number} fallback
 * @returns {number}
 */
function envInt(key, fallback) {
  const val = env(key);
  if (val === undefined) return fallback;
  const parsed = parseInt(val, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

/**
 * Read an environment variable as a float.
 * @param {string} key
 * @param {number} fallback
 * @returns {number}
 */
function envFloat(key, fallback) {
  const val = env(key);
  if (val === undefined) return fallback;
  const parsed = parseFloat(val);
  return Number.isNaN(parsed) ? fallback : parsed;
}

/**
 * Read an environment variable as a boolean.
 * @param {string} key
 * @param {boolean} fallback
 * @returns {boolean}
 */
function envBool(key, fallback) {
  const val = env(key);
  if (val === undefined) return fallback;
  const lowered = val.toLowerCase();
  if (['true', '1', 'yes', 'on'].includes(lowered)) return true;
  if (['false', '0', 'no', 'off'].includes(lowered)) return false;
  return fallback;
}

/**
 * Parse a comma-separated environment variable into an array.
 * @param {string} key
 * @param {string[]} [fallback]
 * @returns {string[]}
 */
function envArray(key, fallback) {
  const val = env(key);
  if (val === undefined) return fallback || [];
  return val.split(',').map((s) => s.trim()).filter(Boolean);
}

/**
 * Parse a JSON environment variable with safe fallback.
 * @param {string} key
 * @param {any} [fallback]
 * @returns {any}
 */
function envJson(key, fallback) {
  const val = env(key);
  if (val === undefined) return fallback;
  try {
    return JSON.parse(val);
  } catch {
    return fallback;
  }
}

module.exports = Object.freeze({
  isDevelopment,
  isProduction,
  isTest,
  isStaging,
  isCI,
  env,
  envInt,
  envFloat,
  envBool,
  envArray,
  envJson
});
