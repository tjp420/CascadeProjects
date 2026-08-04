const crypto = require('crypto');

// Compare two strings by Unicode code points (RFC 8785 requires code point order)
function compareCodePoint(a, b) {
  let ia = 0, ib = 0;
  while (ia < a.length && ib < b.length) {
    const ca = a.codePointAt(ia);
    const cb = b.codePointAt(ib);
    if (ca !== cb) return ca - cb;
    ia += ca > 0xffff ? 2 : 1;
    ib += cb > 0xffff ? 2 : 1;
  }
  if (ia === a.length && ib === b.length) return 0;
  return ia === a.length ? -1 : 1;
}

function canonicalize(value) {
  return canonicalizeValue(value);
}

function canonicalizeValue(v) {
  if (v === null) return 'null';
  const t = typeof v;
  if (t === 'string') return JSON.stringify(v);
  if (t === 'number') {
    if (!Number.isFinite(v)) throw new TypeError('Numeric values must be finite');
    // JavaScript's toString produces a short decimal representation suitable for JCS
    // Ensure -0 becomes 0
    if (Object.is(v, -0)) v = 0;
    return Number(v).toString();
  }
  if (t === 'boolean') return v ? 'true' : 'false';
  if (Array.isArray(v)) {
    const items = v.map(canonicalizeValue);
    return '[' + items.join(',') + ']';
  }
  if (t === 'object') {
    // object: sort keys by Unicode code point order
    const keys = Object.keys(v).sort(compareCodePoint);
    const parts = keys.map(k => JSON.stringify(k) + ':' + canonicalizeValue(v[k]));
    return '{' + parts.join(',') + '}';
  }
  // Unsupported types (undefined, function, symbol) are not allowed in JSON per RFC
  throw new TypeError('Unsupported type for canonicalization: ' + t);
}

function canonicalDigest(value, encoding = 'hex') {
  const canon = canonicalize(value);
  const hash = crypto.createHash('sha256');
  hash.update(canon, 'utf8');
  return hash.digest(encoding);
}

module.exports = {
  canonicalize,
  canonicalDigest,
};
