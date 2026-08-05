"use strict";

const { describe, it } = require('node:test');
const assert = require('node:assert');
const { canonicalize, canonicalHash } = require('../jcs-canonicalize.cjs');

describe('JCS canonicalize (Track 394)', () => {
  it('sorts object keys alphabetically', () => {
    assert.strictEqual(
      canonicalize({ z: 1, a: 2, m: 3 }),
      '{"a":2,"m":3,"z":1}',
    );
  });

  it('is deterministic for nested objects and arrays', () => {
    const a = { b: { d: 4, c: 1 }, a: [{ z: 9, a: 8 }] };
    const b = { a: [{ a: 8, z: 9 }], b: { c: 1, d: 4 } };
    assert.strictEqual(canonicalize(a), canonicalize(b));
  });

  it('preserves null, booleans, numbers, and strings', () => {
    assert.strictEqual(
      canonicalize({ s: 'hello', n: 42, f: 3.14, t: true, u: null }),
      '{"f":3.14,"n":42,"s":"hello","t":true,"u":null}',
    );
  });

  it('normalizes key order but not array order', () => {
    const a = { items: [3, 1, 2] };
    const b = { items: [3, 1, 2] };
    const c = { items: [2, 1, 3] };
    assert.strictEqual(canonicalize(a), canonicalize(b));
    assert.notStrictEqual(canonicalize(a), canonicalize(c));
  });

  it('produces a stable hash', () => {
    const a = { x: 1, y: { z: 'abc', w: 99 } };
    const b = { y: { w: 99, z: 'abc' }, x: 1 };
    assert.strictEqual(canonicalHash(a), canonicalHash(b));
  });

  it('matches the RFC 8785 numeric formatting requirements', () => {
    // JSON.stringify uses the ECMAScript Number::toString algorithm, which is
    // the reference numeric representation for JCS.
    assert.ok(canonicalize({ n: -0 }).includes('0'));
    assert.ok(canonicalize({ n: 1.23e12 }).includes('1230000000000'));
    assert.ok(canonicalize({ n: 0.0000001 }).includes('1e-7'));
  });
});
