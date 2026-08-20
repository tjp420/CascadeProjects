"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert");
const { canonicalize, canonicalHash } = require("../jcs-canonicalize.cjs");

describe("JCS canonicalize (Track 394)", () => {
  it("sorts object keys alphabetically", () => {
    assert.strictEqual(
      canonicalize({ z: 1, a: 2, m: 3 }),
      '{"a":2,"m":3,"z":1}',
    );
  });

  it("is deterministic for nested objects and arrays", () => {
    const a = { b: { d: 4, c: 1 }, a: [{ z: 9, a: 8 }] };
    const b = { a: [{ a: 8, z: 9 }], b: { c: 1, d: 4 } };
    assert.strictEqual(canonicalize(a), canonicalize(b));
  });

  it("preserves null, booleans, numbers, and strings", () => {
    assert.strictEqual(
      canonicalize({ s: "hello", n: 42, f: 3.14, t: true, u: null }),
      '{"f":3.14,"n":42,"s":"hello","t":true,"u":null}',
    );
  });

  it("normalizes key order but not array order", () => {
    const a = { items: [3, 1, 2] };
    const b = { items: [3, 1, 2] };
    const c = { items: [2, 1, 3] };
    assert.strictEqual(canonicalize(a), canonicalize(b));
    assert.notStrictEqual(canonicalize(a), canonicalize(c));
  });

  it("produces a stable hash", () => {
    const a = { x: 1, y: { z: "abc", w: 99 } };
    const b = { y: { w: 99, z: "abc" }, x: 1 };
    assert.strictEqual(canonicalHash(a), canonicalHash(b));
  });

  it("matches the RFC 8785 numeric formatting requirements", () => {
    // JSON.stringify uses the ECMAScript Number::toString algorithm, which is
    // the reference numeric representation for JCS.
    assert.ok(canonicalize({ n: -0 }).includes("0"));
    assert.ok(canonicalize({ n: 1.23e12 }).includes("1230000000000"));
    assert.ok(canonicalize({ n: 0.0000001 }).includes("1e-7"));
  });
});

describe("RFC 8785 test vectors (Track 394)", () => {
  // Deterministic test vectors from RFC 8785 to prevent regressions.
  // These verify the specific compliance gaps that were fixed:
  // - Unicode codepoint key sorting (not UTF-16 code units)
  // - Exponent notation cleanup (e+ → e)
  // - NFC normalization
  // - -0, Infinity, NaN handling

  it('canonicalizes -0 as "0" (RFC 8785 §3.2.2)', () => {
    assert.strictEqual(canonicalize(-0), "0");
    assert.strictEqual(canonicalize({ n: -0 }), '{"n":0}');
  });

  it("canonicalizes Infinity and NaN as null (RFC 8785 §3.2.2)", () => {
    assert.strictEqual(canonicalize(Infinity), "null");
    assert.strictEqual(canonicalize(-Infinity), "null");
    assert.strictEqual(canonicalize(NaN), "null");
  });

  it("normalizes exponent notation: no uppercase E, no e+ (RFC 8785 §3.2.2)", () => {
    // 1e21 in JSON.stringify produces "1e+21" — RFC 8785 requires "1e21"
    const result = canonicalize(1e21);
    assert.ok(!result.includes("E"), "should not contain uppercase E");
    assert.ok(!result.includes("e+"), "should not contain e+");
    assert.strictEqual(result, "1e21");
  });

  it("preserves shortest number representation (RFC 8785 §3.2.2.3)", () => {
    // 3.14 must serialize as "3.14", not "3.14000000000000012434"
    assert.strictEqual(canonicalize(3.14), "3.14");
    assert.strictEqual(canonicalize(1.5), "1.5");
    assert.strictEqual(canonicalize(42), "42");
    assert.strictEqual(canonicalize(0), "0");
    assert.strictEqual(canonicalize(-1), "-1");
  });

  it("sorts keys by Unicode codepoint, not UTF-16 code units (RFC 8785 §3.2.3)", () => {
    // The character 'ä' (U+00E4) has codepoint 228.
    // In UTF-16 it's a single code unit, but 'z' (U+007A) = 122 < 228.
    // A simple .sort() using UTF-16 would also put 'a' < 'ä' < 'z',
    // but surrogate pairs (e.g. emoji) would sort incorrectly.
    // Test with a supplementary character: '𝑎' (U+1D44E, mathematical italic a)
    // In UTF-16 this is a surrogate pair, so .sort() would sort by the
    // high surrogate (0xD835), placing it after all BMP characters.
    // By codepoint, U+1D44E > U+007A ('z'), so 'z' should come first.
    const obj = { "𝑎": 1, z: 2 };
    const result = canonicalize(obj);
    assert.ok(
      result.indexOf('"z"') < result.indexOf('"𝑎"'),
      "z (U+007A) should sort before 𝑎 (U+1D44E) by codepoint",
    );
  });

  it("normalizes string values to NFC (RFC 8785 §3.2.3.2)", () => {
    // ' café' in NFD has decomposed é (e + combining accent)
    // In NFC, é is a single codepoint U+00E9
    const nfc = "café";
    const nfd = "cafe\u0301";
    // Both should produce the same canonical output
    assert.strictEqual(canonicalize({ s: nfc }), canonicalize({ s: nfd }));
  });

  it("normalizes object keys to NFC (RFC 8785 §3.2.3.2)", () => {
    const nfcKey = "café";
    const nfdKey = "cafe\u0301";
    const a = {};
    a[nfcKey] = 1;
    const b = {};
    b[nfdKey] = 1;
    assert.strictEqual(canonicalize(a), canonicalize(b));
  });

  it("prunes undefined values (RFC 8785)", () => {
    assert.strictEqual(
      canonicalize({ a: 1, b: undefined, c: 3 }),
      '{"a":1,"c":3}',
    );
  });

  it("handles empty objects and arrays", () => {
    assert.strictEqual(canonicalize({}), "{}");
    assert.strictEqual(canonicalize([]), "[]");
  });

  it("handles nested structures deterministically", () => {
    const a = { x: [1, { b: 2, a: 1 }], y: { d: [3], c: 4 } };
    const b = { y: { c: 4, d: [3] }, x: [1, { a: 1, b: 2 }] };
    assert.strictEqual(canonicalize(a), canonicalize(b));
  });

  it("produces deterministic hashes regardless of key insertion order", () => {
    const a = { root: "abc", sessionId: "s1", tenant: "t1" };
    const b = { tenant: "t1", sessionId: "s1", root: "abc" };
    assert.strictEqual(canonicalHash(a), canonicalHash(b));
  });
});
