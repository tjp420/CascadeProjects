"use strict";

/**
 * Track 394: RFC 8785 JSON Canonicalization Scheme (JCS) utilities.
 *
 * Produces a deterministic, unambiguous JSON serialization suitable for
 * signing and hashing in fraud proofs, verifier inputs, and commit payloads.
 *
 * RFC 8785 compliance:
 * - §3.2.3: Keys sorted by Unicode codepoint order (not UTF-16 code units)
 * - §3.2.3.2: Strings and keys normalized to NFC
 * - §3.2.2: Numbers serialized via ECMAScript Number::toString (JSON.stringify)
 *   with exponent cleanup (E→e, e+→e) for RFC 8785 compliance
 * - §3.2.2: -0 → "0", Infinity/NaN → null (handled by JSON.stringify)
 *
 * @module crypto/jcs-canonicalize
 */

const crypto = require('node:crypto');

/**
 * Compare two strings by Unicode codepoint order (RFC 8785 §3.2.3).
 * Uses Array.from() to iterate by code points, not UTF-16 code units.
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
function _codepointCompare(a, b) {
  const na = a.normalize('NFC');
  const nb = b.normalize('NFC');
  const arrA = Array.from(na);
  const arrB = Array.from(nb);
  const len = Math.min(arrA.length, arrB.length);
  for (let i = 0; i < len; i++) {
    const ca = arrA[i].codePointAt(0);
    const cb = arrB[i].codePointAt(0);
    if (ca !== cb) return ca - cb;
  }
  return arrA.length - arrB.length;
}

/**
 * Recursively canonicalize a value into RFC 8785 JCS string form.
 * @param {*} value
 * @returns {string}
 */
function _canonicalize(value) {
  if (value === null) return 'null';
  const t = typeof value;
  if (t === 'boolean') return value ? 'true' : 'false';
  if (t === 'number') {
    if (!Number.isFinite(value)) return 'null';
    // JSON.stringify uses ECMAScript Number::toString — the shortest
    // representation that round-trips, which RFC 8785 §3.2.2.3 requires.
    let s = JSON.stringify(value);
    // Fix exponent notation: RFC 8785 requires lowercase 'e' without '+'
    s = s.replace('E', 'e').replace('e+', 'e');
    return s;
  }
  if (t === 'string') {
    try { return JSON.stringify(value.normalize('NFC')); }
    catch { return JSON.stringify(value); }
  }
  if (t === 'bigint') return JSON.stringify(value.toString(16));
  if (Array.isArray(value)) {
    return '[' + value.map(_canonicalize).join(',') + ']';
  }
  if (t === 'object') {
    const keys = Object.keys(value).sort(_codepointCompare);
    const parts = [];
    for (const k of keys) {
      const v = value[k];
      if (v === undefined) continue;  // prune undefined (RFC 8785)
      parts.push(JSON.stringify(k.normalize('NFC')) + ':' + _canonicalize(v));
    }
    return '{' + parts.join(',') + '}';
  }
  return 'null';
}

/**
 * Serialize a value as an RFC 8785 JCS canonical JSON string.
 * @param {*} value
 * @returns {string}
 */
function canonicalize(value) {
  return _canonicalize(value);
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
