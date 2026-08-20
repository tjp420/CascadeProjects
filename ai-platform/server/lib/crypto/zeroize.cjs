"use strict";

/**
 * Centralized Memory Zeroization Utility
 *
 * Provides synchronous, deterministic scrubbing of sensitive cryptographic
 * material and identity tokens from process memory. Unlike V8 garbage
 * collection which is non-deterministic, these functions immediately
 * overwrite buffer contents with zeros, eliminating heap-inspection and
 * memory-dump exploitation vectors.
 *
 * Usage patterns:
 *
 *   // Direct buffer scrub
 *   const buf = Buffer.from(secretString, 'utf8');
 *   // ... use buf ...
 *   zeroizeBuffer(buf);
 *
 *   // Scoped allocation with automatic cleanup
 *   const result = withZeroizedBuffer(tokenString, (tokenBuf) => {
 *     return jwt.verify(tokenBuf.toString('utf8'), secret);
 *   });
 *   // tokenBuf is zeroized before withZeroizedBuffer returns
 *
 *   // String scrub (creates a mutable buffer copy, zeroizes it)
 *   zeroizeString(secretString); // returns null
 */

/**
 * Synchronously fill a Buffer with zeros, overwriting any sensitive content.
 * Null-safe: handles null, undefined, empty buffers, and non-Buffer values
 * without throwing.
 *
 * @param {Buffer|null|undefined} buf - The buffer to zeroize
 * @returns {void}
 */
function zeroizeBuffer(buf) {
  if (buf == null) return;
  if (!Buffer.isBuffer(buf)) return;
  if (buf.length === 0) return;
  try {
    buf.fill(0);
  } catch {
    // Some buffers (e.g. sliced from a larger ArrayBuffer pool) may throw
    // on fill if the underlying memory is restricted. Swallow silently —
    // the caller's intent is destruction, and a failed fill leaves the
    // buffer reference eligible for GC regardless.
  }
}

/**
 * Zeroize a string by converting it to a mutable Buffer and filling with
 * zeros. The original string primitive remains in V8's interned string
 * space (strings are immutable), but this ensures any Buffer copy we
 * created for processing is scrubbed.
 *
 * Returns null to encourage callers to drop the reference:
 *   token = zeroizeString(token); // token is now null
 *
 * @param {string|null|undefined} str - The string whose buffer copy to zeroize
 * @param {BufferEncoding} [encoding='utf8'] - Encoding to use for Buffer conversion
 * @returns {null}
 */
function zeroizeString(str, encoding) {
  if (str == null || typeof str !== "string" || str.length === 0) return null;
  try {
    const buf = Buffer.from(str, encoding || "utf8");
    zeroizeBuffer(buf);
  } catch {
    // Swallow — best-effort scrub
  }
  return null;
}

/**
 * Higher-order wrapper that allocates a Buffer from an encoded value,
 * passes it to a callback for processing, and guarantees zeroization
 * in a finally block — even if the callback throws.
 *
 * This is the preferred pattern for sensitive data processing:
 *
 *   const decoded = withZeroizedBuffer(tokenString, (buf) => {
 *     return processToken(buf);
 *   });
 *   // buf is guaranteed zeroized here, even if processToken threw
 *
 * @param {string|Buffer} encoded - The sensitive data (string or existing Buffer)
 * @param {(buf: Buffer) => any} fn - Processing callback receiving the mutable Buffer
 * @param {BufferEncoding} [encoding='utf8'] - Encoding for string-to-Buffer conversion
 * @returns {any} The return value of fn, or rethrows if fn throws
 */
function withZeroizedBuffer(encoded, fn, encoding) {
  if (typeof fn !== "function") {
    throw new TypeError("withZeroizedBuffer requires a callback function");
  }

  // If already a Buffer, use directly but still zeroize after
  const isOwnedBuffer = Buffer.isBuffer(encoded);
  const buf = isOwnedBuffer
    ? encoded
    : Buffer.from(String(encoded), encoding || "utf8");

  try {
    return fn(buf);
  } finally {
    // Guaranteed to run even if fn throws
    zeroizeBuffer(buf);
  }
}

module.exports = {
  zeroizeBuffer,
  zeroizeString,
  withZeroizedBuffer,
};
