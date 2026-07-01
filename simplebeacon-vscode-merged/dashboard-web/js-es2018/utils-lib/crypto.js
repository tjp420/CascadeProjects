/**
 * crypto utilities.
 */


/**
 * Generate a random nonce for CSP or script injection.
 * @returns {string} Hex-encoded 16-byte random string.
 */
export function getNonce() {
  const arr = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(arr);
  } else {
    for (let i = 0; i < arr.length; i++) arr[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(arr, b => b.toString(16).padStart(2, '0')).join('');
}


/**
 * Compute a simple 32-bit hash for a string.
 * @param {string} str
 * @returns {number} Unsigned 32-bit hash.
 */
export function hash(str) {
  const s = String(str ?? '');
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  }
  return h >>> 0;
}


/**
 * Generate a random alphanumeric ID.
 * @param {number} [length=8] Length of the ID.
 * @returns {string}
 */
export function randomId(length = 8) {
  const len = Math.max(1, Math.floor(Number(length) || 8));
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const max = chars.length;
  let id = '';
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const arr = new Uint32Array(len);
    crypto.getRandomValues(arr);
    for (let i = 0; i < len; i++) id += chars[arr[i] % max];
  } else {
    for (let i = 0; i < len; i++) id += chars[Math.floor(Math.random() * max)];
  }
  return id;
}


/**
 * Alias for {@link randomId}.
 * @returns {string}
 */
export function uid() {
  return randomId(8);
}


/**
 * Return a random number between `min` and `max` (inclusive).
 * If `floating` is true, returns a float.
 * @param {number} [min=0]
 * @param {number} [max=1]
 * @param {boolean} [floating=false]
 * @returns {number}
 */
export function random(min, max, floating) {
  const lo = min === undefined ? 0 : Number(min) || 0;
  const hi = max === undefined ? 1 : Number(max) || 1;
  const r = Math.random() * (hi - lo) + lo;
  return floating ? r : Math.floor(r);
}

