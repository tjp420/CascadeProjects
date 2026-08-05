"use strict";

/**
 * Track 394: RFC 8785 JSON Canonicalization Scheme (JCS) utilities.
 *
 * Produces a deterministic, unambiguous JSON serialization suitable for
 * signing and hashing in fraud proofs, verifier inputs, and commit payloads.
 *
 * The algorithm:
 * 1. Recursively sort object keys lexicographically.
 * 2. Preserve array order and primitive values.
 * 3. Serialize with JSON.stringify, which follows the ECMAScript
 *    Number::toString algorithm required by JCS for numeric values.
 *
 * @module crypto/jcs-canonicalize
 */

const crypto = require('node:crypto');

/**
 * Recursively copy and sort an object into a canonical form.
 * @param {*} value
 * @returns {*}
 */
function _canonicalForm(value) {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(_canonicalForm);
  const keys = Object.keys(value).sort();
  const out = {};
  for (const k of keys) out[k] = _canonicalForm(value[k]);
  return out;
}

/**
 * Serialize a value as an RFC 8785 JCS canonical JSON string.
 * @param {*} value
 * @returns {string}
 */
function canonicalize(value) {
  return JSON.stringify(_canonicalForm(value));
}

/**
 * Compute the SHA-256 hash of the JCS canonical JSON of a value.
 * @param {*} value
 * @returns {string} hex digest
 */
function canonicalHash(value) {
  const body = canonicalize(value);
  return crypto.createHash('sha256').update(body).digest('hex');
}

module.exports = { canonicalize, canonicalHash };
