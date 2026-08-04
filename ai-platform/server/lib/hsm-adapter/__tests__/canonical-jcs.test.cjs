const assert = require('assert');
const { canonicalize, canonicalDigest } = require('../../canonical/jcs.cjs');

function runTests() {
  // Basic object key ordering
  const obj = { b: 1, a: 2 };
  const expected = '{"a":2,"b":1}';
  assert.strictEqual(canonicalize(obj), expected);

  // Nested structures
  const nested = { z: [1, { x: 'x' }], a: null };
  const expNested = '{"a":null,"z":[1,{"x":"x"}]}';
  assert.strictEqual(canonicalize(nested), expNested);

  // String escaping
  const s = { s: 'Line\nBreak' };
  assert.strictEqual(canonicalize(s), '{"s":"Line\\nBreak"}');

  // Digest determinism
  const d1 = canonicalDigest({a:1,b:2});
  const d2 = canonicalDigest({b:2,a:1});
  assert.strictEqual(d1, d2);

  console.log('canonical-jcs: PASS');
}

try {
  runTests();
} catch (err) {
  console.error('canonical-jcs: FAIL', err && err.stack || err);
  process.exitCode = 2;
}
